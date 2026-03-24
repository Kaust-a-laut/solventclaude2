import axios from 'axios';
import { AIProvider, ChatMessage, CompletionOptions } from '../types/ai';
import { toolService } from './toolService';
import { getOpenAITools } from '../constants/tools';
import { logger } from '../utils/logger';
import { config } from '../config';
import { normalizeMessages } from '../utils/messageUtils';
import type { AgentEvent } from '../types/agentEvents';

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
    const key = this.apiKey;
    return !!key && key.length > 0;
  }

  complete = this.generateChatCompletion;

  protected getToolDefinitions() {
    return getOpenAITools();
  }

  async generateChatCompletion(messages: ChatMessage[], options: CompletionOptions): Promise<string> {
    const apiKey = options.apiKey || this.apiKey;
    if (!apiKey) throw new Error(`${this.name} API Key missing`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- accumulates tool-response objects during the loop
    const currentMessages: any[] = [...normalizeMessages(messages)];
    const model = options.model || this.defaultModel;

    try {
      let iteration = 0;
      const maxIterations = 5;

      while (iteration < maxIterations) {
        const payload: any = {
          model,
          messages: currentMessages,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens ?? 2048,
        };

        // CRITICAL FIX: Most providers (Groq, OpenAI) do not allow 
        // response_format: "json_object" and tools to be used simultaneously.
        if (options.jsonMode) {
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
        const content = message.content || "";
        
        if (!message.tool_calls) {
          return typeof content === 'string' ? content : JSON.stringify(content);
        }

        // Handle Tool Calls
        logger.info(`[${this.name}] Tool calls detected: ${message.tool_calls.length}`);
        currentMessages.push(message);
        
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
          } catch (toolError: any) {
            logger.error(`[${this.name}] Tool execution failed (${name}): ${toolError.message}`);
            currentMessages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              name: name,
              content: JSON.stringify({ error: toolError.message })
            });
          }
        }

        iteration++;
      }

      throw new Error(`${this.name} agent exceeded maximum tool-calling iterations.`);
    } catch (error: any) {
      const errorMsg = error.response?.data?.error?.message || error.message;
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
    onEvent: (event: AgentEvent) => void
  ): Promise<string> {
    const apiKey = options.apiKey || this.apiKey;
    if (!apiKey) throw new Error(`${this.name} API Key missing`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- accumulates tool-response objects during the loop
    const currentMessages: any[] = [...normalizeMessages(messages)];
    const model = options.model || this.defaultModel;

    try {
      let iteration = 0;
      const maxIterations = 5;

      while (iteration < maxIterations) {
        const payload: any = {
          model,
          messages: currentMessages,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens ?? 2048,
        };

        if (options.jsonMode) {
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
        const content = message.content || "";

        if (!message.tool_calls) {
          onEvent({ type: 'text_complete', content: typeof content === 'string' ? content : JSON.stringify(content) });
          return typeof content === 'string' ? content : JSON.stringify(content);
        }

        // Handle Tool Calls with events
        logger.info(`[${this.name}] Tool calls detected: ${message.tool_calls.length}`);
        currentMessages.push(message);

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
          } catch (toolError: any) {
            logger.error(`[${this.name}] Tool execution failed (${name}): ${toolError.message}`);
            onEvent({ type: 'tool_error', tool: name, error: toolError.message, iteration, callId });
            currentMessages.push({
              role: "tool",
              tool_call_id: callId,
              name,
              content: JSON.stringify({ error: toolError.message })
            });
          }
        }

        iteration++;
      }

      throw new Error(`${this.name} agent exceeded maximum tool-calling iterations.`);
    } catch (error: any) {
      const errorMsg = error.response?.data?.error?.message || error.message;
      logger.error(`[${this.name}] Request Failed: ${errorMsg}`);
      throw new Error(`${this.name} API failed: ${errorMsg}`);
    }
  }

  /**
   * Optional method for subclasses to provide extra headers (e.g. OpenRouter)
   */
  protected getExtraHeaders?(): Record<string, string>;
}
