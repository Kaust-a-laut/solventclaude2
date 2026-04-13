import axios from 'axios';
import { randomUUID } from 'crypto';
import { AIProvider, ChatMessage, CompletionOptions } from '../types/ai';
import { toolService } from './toolService';
import { getOpenAITools } from '../constants/tools';
import { logger } from '../utils/logger';
import { config } from '../config';
import { normalizeMessages } from '../utils/messageUtils';
import type { AgentEvent } from '../types/agentEvents';

/**
 * Simple XML tool call parser using string operations to avoid regex issues.
 * Parses formats like: <tool_name><param>value</param></tool_name>
 */
function parseXmlToolCalls(content: string, validNames: string[]): Array<{id: string; name: string; args: Record<string, unknown>}> {
  const calls: Array<{id: string; name: string; args: Record<string, unknown>}> = [];
  
  for (const name of validNames) {
    const openTag = '<' + name + '>';
    const closeTag = '</' + name + '>';
    let searchPos = 0;
    
    while (true) {
      const openIdx = content.indexOf(openTag, searchPos);
      if (openIdx === -1) break;
      
      const closeIdx = content.indexOf(closeTag, openIdx);
      if (closeIdx === -1) break;
      
      const blockEnd = closeIdx + closeTag.length;
      const inner = content.substring(openIdx + openTag.length, closeIdx);
      
      // Parse parameters from inner content
      const args: Record<string, unknown> = {};
      const paramRegex = /<(\w+)>([\s\S]*?)<\/\1>/g;
      let match: RegExpExecArray | null;
      while ((match = paramRegex.exec(inner)) !== null) {
        if (match[1] && match[2]) {
          args[match[1]] = match[2].trim();
        }
      }
      
      calls.push({ id: randomUUID(), name, args });
      searchPos = blockEnd;
    }
  }
  
  return calls;
}

/**
 * Strip <think>...</think> blocks emitted by reasoning models (Qwen3, DeepSeek-R1, etc.)
 * before processing content or returning it to the user.
 */
function stripThinkTags(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

function filterToolsByTier(
  tools: unknown[],
  tier?: 'full-agentic' | 'code-only',
  traits?: { toolUse: string; multimodal: boolean; contextWindow: number }
): unknown[] {
  if (tier !== 'full-agentic') {
    const excludeNames = ['get_console_logs', 'get_dom_snapshot', 'get_selected_element', 'capture_screenshot'];
    return (tools as Array<{ function: { name: string } }>).filter(
      t => !excludeNames.includes(t.function.name)
    );
  }

  if (!traits?.multimodal) {
    return (tools as Array<{ function: { name: string } }>).filter(
      t => t.function.name !== 'capture_screenshot'
    );
  }

  return tools;
}

/**
 * Abstract base class for OpenAI-compatible providers (Groq, DeepSeek, OpenRouter, etc.)
 * Provides standardized message mapping and recursive tool-calling logic.
 */
export abstract class BaseOpenAIService implements AIProvider {
  abstract readonly name: string;
  protected abstract baseUrl: string;
  protected abstract apiKey: string;
  public defaultModel: string = '';

  isReady(): boolean {
    // Always report ready — runtime API keys from the frontend can satisfy the requirement
    return true;
  }

  complete = this.generateChatCompletion;

  protected getToolDefinitions() {
    return getOpenAITools();
  }

  async generateChatCompletion(messages: ChatMessage[], options: CompletionOptions): Promise<string> {
    const apiKey = options.apiKey || this.apiKey;
    if (!apiKey) throw new Error(`${this.name} API Key missing`);

    const currentMessages: Array<{ role: string; content: string; name?: string; tool_call_id?: string; tool_calls?: unknown }> = normalizeMessages(messages).map(m => ({ role: m.role, content: m.content }));
    const model = options.model || this.defaultModel;

    try {
      let iteration = 0;
      const maxIterations = 8;
      let consecutiveFailures = 0;
      const maxConsecutiveFailures = 3;

      while (iteration < maxIterations) {
        const payload: Record<string, unknown> = {
          model,
          messages: currentMessages,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens ?? 2048,
        };

        // CRITICAL FIX: Most providers (Groq, OpenAI) do not allow
        // response_format: "json_object" and tools to be used simultaneously.
        if (options.jsonMode && !this.shouldSkipJsonMode(model)) {
          payload.response_format = { type: "json_object" };
        } else if (options.shouldSearch !== false) {
          payload.tools = this.getToolDefinitions();
          payload.tool_choice = "auto";
        }

        const response = await axios.post(
          `${this.baseUrl}/chat/completions`,
          payload,
          {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
              ...(this.getExtraHeaders?.() || {})
            },
            timeout: config.AI_PROVIDER_TIMEOUT_MS ?? 120_000,
            signal: options.signal
          }
        );

        const message = response.data.choices[0].message;
        const rawContent = message.content || "";
        const content = stripThinkTags(typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent));

        if (!message.tool_calls) {
          return content;
        }

        // Handle Tool Calls
        logger.info(`[${this.name}] Tool calls detected: ${message.tool_calls.length}`);
        currentMessages.push({ ...message, content });
        
        for (const toolCall of message.tool_calls) {
          const name = toolCall.function.name;
          const args = JSON.parse(toolCall.function.arguments);
          
          try {
            const result = await toolService.executeTool(name, args);
            currentMessages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              name: name,
              content: JSON.stringify(result)
            });
          } catch (toolError: unknown) {
            const toolErr = toolError as Error;
            logger.error(`[${this.name}] Tool execution failed (${name}): ${toolErr.message}`);
            currentMessages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              name: name,
              content: JSON.stringify({ error: toolErr.message })
            });
          }
        }

        iteration++;
      }

      throw new Error(`${this.name} agent exceeded maximum tool-calling iterations.`);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } }; message?: string };
      const errorMsg = err.response?.data?.error?.message || err.message;
      logger.error(`[${this.name}] Request Failed: ${errorMsg}`);
      throw new Error(`${this.name} API failed: ${errorMsg}`);
    }
  }

  /**
   * Event-emitting variant of generateChatCompletion.
   * Same recursive tool loop, but emits AgentEvents for each tool call
   * so the frontend can show real-time tool activity.
   */
  async generateChatCompletionWithEvents(
    messages: ChatMessage[],
    options: CompletionOptions,
    onEvent: (event: AgentEvent) => void,
    tier?: 'full-agentic' | 'code-only',
    traits?: { toolUse: 'strong' | 'basic'; multimodal: boolean; contextWindow: number }
  ): Promise<string> {
    const apiKey = options.apiKey || this.apiKey;
    if (!apiKey) throw new Error(`${this.name} API Key missing`);

    const currentMessages: Array<{ role: string; content: string; name?: string; tool_call_id?: string; tool_calls?: unknown }> = normalizeMessages(messages).map(m => ({ role: m.role, content: m.content }));
    const model = options.model || this.defaultModel;

    try {
      let iteration = 0;
      const maxIterations = tier === 'full-agentic' ? 12 : 6;
      let consecutiveFailures = 0;
      const maxConsecutiveFailures = 3;

      while (iteration < maxIterations) {
        const payload: Record<string, unknown> = {
          model,
          messages: currentMessages,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens ?? 2048,
        };

        if (options.jsonMode && !this.shouldSkipJsonMode(model)) {
          payload.response_format = { type: "json_object" };
        } else if (options.shouldSearch !== false) {
          const allTools = this.getToolDefinitions();
          const filteredTools = filterToolsByTier(allTools, tier, traits);
          payload.tools = filteredTools;
          payload.tool_choice = "auto";
        }

        const response = await axios.post(
          `${this.baseUrl}/chat/completions`,
          payload,
          {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
              ...(this.getExtraHeaders?.() || {})
            },
            timeout: config.AI_PROVIDER_TIMEOUT_MS ?? 120_000,
            signal: options.signal
          }
        );

        const message = response.data.choices[0].message;
        const rawContent = message.content || "";
        const content = stripThinkTags(typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent));

        if (!message.tool_calls) {
          // Fallback: check if the model emitted tool calls as XML in content
          const validNames = (this.getToolDefinitions() as Array<{ function: { name: string } }>)
            .map(t => t.function.name);
          const xmlCalls = parseXmlToolCalls(typeof content === 'string' ? content : JSON.stringify(content), validNames);

          if (xmlCalls.length > 0) {
            logger.info('[' + this.name + '] XML tool calls detected: ' + xmlCalls.map(c => c.name).join(', '));
            
            const cleanContent = '';
            currentMessages.push({
              role: 'assistant',
              content: cleanContent,
              tool_calls: xmlCalls.map(c => ({
                id: c.id,
                type: 'function',
                function: { name: c.name, arguments: JSON.stringify(c.args) }
              }))
            });

            for (const call of xmlCalls) {
              onEvent({ type: 'tool_start', tool: call.name, args: call.args, iteration, callId: call.id });
              try {
                const result = await toolService.executeTool(call.name, call.args);
                onEvent({ type: 'tool_result', tool: call.name, result, iteration, callId: call.id });
                currentMessages.push({
                  role: 'tool',
                  tool_call_id: call.id,
                  name: call.name,
                  content: JSON.stringify(result)
                });
                consecutiveFailures = 0;
              } catch (toolError: unknown) {
                const toolErr = toolError as Error;
                consecutiveFailures++;
                logger.error('[' + this.name + '] XML tool failed (' + call.name + '): ' + toolErr.message);
                onEvent({ type: 'tool_error', tool: call.name, error: toolErr.message, iteration, callId: call.id });

                let errorContent = toolErr.message;
                if (call.name === 'read_file' && toolErr.message.includes('ENOENT')) {
                  errorContent += '\n\nRECOVERY: File not found. Use list_files to discover available paths.';
                }
                currentMessages.push({
                  role: 'tool',
                  tool_call_id: call.id,
                  name: call.name,
                  content: JSON.stringify({ error: errorContent })
                });
              }
            }

            if (consecutiveFailures === 0) {
              iteration++;
            } else if (consecutiveFailures >= maxConsecutiveFailures) {
              iteration++;
            }
            continue;
          }

          // Truly done
          onEvent({ type: 'text_complete', content: typeof content === 'string' ? content : JSON.stringify(content) });
          return typeof content === 'string' ? content : JSON.stringify(content);
        }

        // Handle Tool Calls with events
        logger.info(`[${this.name}] Tool calls detected: ${message.tool_calls.length}`);
        currentMessages.push({ ...message, content });

        for (const toolCall of message.tool_calls) {
          const name = toolCall.function.name;
          let args: Record<string, unknown>;
          try {
            args = JSON.parse(toolCall.function.arguments);
          } catch {
            args = { _raw: toolCall.function.arguments };
          }
          const callId = toolCall.id;

          onEvent({ type: 'tool_start', tool: name, args, iteration, callId });

          try {
            const result = await toolService.executeTool(name, args);
            onEvent({ type: 'tool_result', tool: name, result, iteration, callId });
            currentMessages.push({
              role: "tool",
              tool_call_id: callId,
              name,
              content: JSON.stringify(result)
            });
            consecutiveFailures = 0; // Reset on success
          } catch (toolError: unknown) {
            const toolErr = toolError as Error;

            // Check if this is a browser-tool round-trip
            if (toolErr.message.startsWith('BROWSER_TOOL:')) {
              const browserToolName = toolErr.message.split(':')[1]!;
              const browserCallId = randomUUID();

              // Emit browser-tool event
              onEvent({
                type: 'browser-tool',
                tool: browserToolName,
                callId: browserCallId,
              } as AgentEvent);

              // Wait for result from POST /api/preview/tool-result
              const { createPendingCall } = await import('../routes/previewRoutes');
              const result = await createPendingCall(browserCallId);

              onEvent({ type: 'tool_result', tool: browserToolName, result, iteration, callId });
              currentMessages.push({
                role: "tool",
                tool_call_id: callId,
                name: browserToolName,
                content: JSON.stringify(result)
              });
              consecutiveFailures = 0;
              continue; // Continue the loop with the result
            }

            consecutiveFailures++;
            logger.error(`[${this.name}] Tool execution failed (${name}): ${toolErr.message}`);
            onEvent({ type: 'tool_error', tool: name, error: toolErr.message, iteration, callId });

            // Add recovery hint for file operations
            let errorContent = toolErr.message;
            if (name === 'read_file' && toolErr.message.includes('ENOENT')) {
              errorContent += '\n\nRECOVERY: The file path does not exist. Use list_files to discover available files before retrying.';
            } else if (name === 'list_files' && toolErr.message.includes('ENOENT')) {
              errorContent += '\n\nRECOVERY: The directory does not exist. Try listing the parent directory or use list_files with "." to see the project root.';
            } else if (name === 'run_shell' && consecutiveFailures >= maxConsecutiveFailures) {
              errorContent += '\n\nRECOVERY: Multiple shell attempts failed. Try a different approach or ask the user for help.';
            }

            currentMessages.push({
              role: "tool",
              tool_call_id: callId,
              name,
              content: JSON.stringify({ error: errorContent })
            });

            // Don't increment iteration on failure — give the model a chance to recover
            if (consecutiveFailures >= maxConsecutiveFailures) {
              // Force a final API call with recovery hint, then stop
              iteration++;
            }
          }
        }

        // Only increment iteration on successful tool execution
        // (failed calls don't count toward the limit, giving the model room to recover)
        if (consecutiveFailures === 0) {
          iteration++;
        }
      }

      throw new Error(`${this.name} agent exceeded maximum tool-calling iterations.`);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } }; message?: string };
      const errorMsg = err.response?.data?.error?.message || err.message;
      logger.error(`[${this.name}] Request Failed: ${errorMsg}`);
      throw new Error(`${this.name} API failed: ${errorMsg}`);
    }
  }

  /**
   * Optional method for subclasses to provide extra headers (e.g. OpenRouter)
   */
  protected getExtraHeaders?(): Record<string, string>;

  /**
   * Override in subclasses to suppress jsonMode for specific model families.
   * Example: OpenRouter suppresses it for reasoning models that use <think> blocks.
   */
  protected shouldSkipJsonMode(_model: string): boolean {
    return false;
  }
}
