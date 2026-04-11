import { IProviderPlugin } from '../../types/plugins';
import { ChatMessage, CompletionOptions } from '../../types/ai';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import axios from 'axios';

export class FireworksProviderPlugin implements IProviderPlugin {
  id = 'fireworks';
  name = 'Fireworks AI';
  description = 'Fireworks AI — fast inference for open models via OpenAI-compatible API';
  version = '1.0.0';
  defaultModel = 'accounts/fireworks/models/llama-v3p3-70b-instruct';
  capabilities = {
    supportsVision: false,
    supportsStreaming: true,
    supportsEmbeddings: false,
    contextWindow: 131072,
    maxOutputTokens: 16384,
    supportsFunctionCalling: true,
    costPer1k: { input: 0.0, output: 0.0 }
  };

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.apiKey) return false;

      const response = await fetch('https://api.fireworks.ai/inference/v1/models', {
        headers: { 'Authorization': `Bearer ${this.apiKey}` }
      });
      return response.ok;
    } catch (error) {
      logger.error(`[Fireworks] Health check failed:`, error);
      return false;
    }
  }

  async getHealth(): Promise<import('../../types/plugins').ProviderHealth> {
    const startTime = Date.now();
    const isHealthy = await this.healthCheck();
    const latency = Date.now() - startTime;

    return {
      isHealthy,
      lastChecked: Date.now(),
      latency,
      errorRate: 0
    };
  }

  private isInitialized = false;
  private apiKey: string | null = null;

  async initialize(options: Record<string, unknown>): Promise<void> {
    this.apiKey = (options.apiKey as string) || config.FIREWORKS_API_KEY || null;
    this.isInitialized = true;
    if (this.apiKey) {
      logger.info(`[Fireworks] Provider initialized (API key present: true)`);
    } else {
      logger.error(`[Fireworks] ⚠️  NO API KEY — all requests will fail synchronously. Set FIREWORKS_API_KEY in the project root .env (NOT backend/.env — that file is ignored).`);
    }
  }

  isReady(): boolean {
    return this.isInitialized;
  }

  async complete(messages: ChatMessage[], options: CompletionOptions): Promise<string> {
    const { model, temperature = 0.7, maxTokens = 2048, apiKey, jsonMode } = options;
    const effectiveApiKey = apiKey || this.apiKey;
    if (!effectiveApiKey) {
      throw new Error('Fireworks API key missing. Provide it in settings or set FIREWORKS_API_KEY in .env.');
    }

    if (!messages || messages.length === 0) {
      throw new Error('Messages array is empty or undefined');
    }

    const formattedMessages = messages.map((msg, idx) => {
      if (!msg.role) {
        throw new Error(`Message ${idx} missing role: ${JSON.stringify(msg)}`);
      }
      if (msg.content === undefined || msg.content === null) {
        throw new Error(`Message ${idx} has null/undefined content: ${JSON.stringify(msg)}`);
      }
      const validRole = ['user', 'assistant', 'system'].includes(msg.role)
        ? msg.role
        : 'user';
      return {
        role: validRole,
        content: String(msg.content)
      };
    });

    // Fireworks requires stream=true for max_tokens > 4096. Auto-switch to
    // streaming mode internally and collect chunks to preserve the synchronous
    // complete() contract for callers.
    const mustStream = maxTokens > 4096;

    const requestBody: Record<string, unknown> = {
      model: model || this.defaultModel,
      messages: formattedMessages,
      temperature,
      max_tokens: maxTokens,
      ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
      ...(mustStream ? { stream: true } : {}),
    };

    logger.info(`[Fireworks] Sending request: model=${requestBody.model}, messages=${messages.length}, temp=${temperature}, max_tokens=${maxTokens}${mustStream ? ' (stream=true, required for max_tokens>4096)' : ''}`);

    try {
      if (mustStream) {
        // Streamed path — accumulate deltas into a single string.
        const response = await axios.post(
          'https://api.fireworks.ai/inference/v1/chat/completions',
          requestBody,
          {
            headers: {
              'Authorization': `Bearer ${effectiveApiKey}`,
              'Content-Type': 'application/json',
            },
            responseType: 'stream',
            validateStatus: () => true,
            timeout: 300_000,
            signal: options.signal,
          }
        );

        logger.debug(`[Fireworks] Stream response status: ${response.status}`);

        if (response.status !== 200) {
          let errorData = '';
          for await (const chunk of response.data) errorData += chunk.toString();
          logger.error(`[Fireworks] Stream API error (${response.status}): ${errorData}`);
          throw new Error(`Fireworks API error (${response.status}): ${errorData}`);
        }

        let accumulated = '';
        let buffer = '';
        for await (const chunk of response.data) {
          buffer += chunk.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const raw of lines) {
            const line = raw.trim();
            if (!line || line.startsWith(':')) continue;
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta;
              const piece = delta?.content ?? delta?.reasoning_content;
              if (piece) accumulated += piece;
            } catch {
              // ignore partial chunks
            }
          }
        }

        if (!accumulated) {
          logger.error(`[Fireworks] Stream returned empty content`);
          throw new Error('Fireworks returned empty streamed response');
        }
        return accumulated;
      }

      const response = await axios.post(
        'https://api.fireworks.ai/inference/v1/chat/completions',
        requestBody,
        {
          headers: {
            'Authorization': `Bearer ${effectiveApiKey}`,
            'Content-Type': 'application/json'
          },
          validateStatus: () => true,
          timeout: 180_000,
          signal: options.signal,
        }
      );

      logger.debug(`[Fireworks] Response status: ${response.status}`);

      if (response.status !== 200) {
        const errorBody = JSON.stringify(response.data, null, 2);
        logger.error(`[Fireworks] API error (${response.status}): ${errorBody}`);
        throw new Error(`Fireworks API error (${response.status}): ${response.data?.error?.message || JSON.stringify(response.data)}`);
      }

      const msg = response.data?.choices?.[0]?.message;
      const content = msg?.content || msg?.reasoning_content;
      if (!content) {
        logger.error(`[Fireworks] Invalid response format: ${JSON.stringify(response.data)}`);
        throw new Error('Fireworks returned invalid response format');
      }

      return content;
    } catch (error: unknown) {
      const err = error as { response?: { status: number; data: unknown }; request?: unknown; message?: string };
      if (err.response) {
        logger.error(`[Fireworks] HTTP ${err.response.status}: ${JSON.stringify(err.response.data)}`);
        throw new Error(`Fireworks API error (${err.response.status}): ${(err.response.data as { error?: { message?: string } })?.error?.message || 'Unknown error'}`);
      } else if (err.request) {
        logger.error(`[Fireworks] No response received: ${err.message}`);
        throw new Error('Fireworks API did not respond - check network/API key');
      } else {
        logger.error(`[Fireworks] Request error: ${err.message}`);
        throw error;
      }
    }
  }

  async *stream(messages: ChatMessage[], options: CompletionOptions): AsyncGenerator<string> {
    if (!messages || messages.length === 0) {
      throw new Error('Messages array is empty or undefined');
    }

    const formattedMessages = messages.map((msg, idx) => {
      if (!msg.role) {
        throw new Error(`Message ${idx} missing role: ${JSON.stringify(msg)}`);
      }
      if (msg.content === undefined || msg.content === null) {
        throw new Error(`Message ${idx} has null/undefined content: ${JSON.stringify(msg)}`);
      }
      const validRole = ['user', 'assistant', 'system'].includes(msg.role)
        ? msg.role
        : 'user';
      return {
        role: validRole,
        content: String(msg.content)
      };
    });

    const { model, temperature = 0.7, maxTokens = 2048, apiKey } = options;
    const effectiveApiKey = apiKey || this.apiKey;
    if (!effectiveApiKey) {
      throw new Error('Fireworks API key missing. Provide it in settings or set FIREWORKS_API_KEY in .env.');
    }

    const requestBody = {
      model: model || this.defaultModel,
      messages: formattedMessages,
      temperature,
      max_tokens: maxTokens,
      stream: true,
    };

    logger.info(`[Fireworks] Streaming request: model=${requestBody.model}, messages=${messages.length}`);

    try {
      const response = await axios.post(
        'https://api.fireworks.ai/inference/v1/chat/completions',
        requestBody,
        {
          headers: {
            'Authorization': `Bearer ${effectiveApiKey}`,
            'Content-Type': 'application/json'
          },
          responseType: 'stream',
          validateStatus: () => true
        }
      );

      if (response.status !== 200) {
        let errorData = '';
        for await (const chunk of response.data) {
          errorData += chunk.toString();
        }
        logger.error(`[Fireworks] Stream error (${response.status}): ${errorData}`);
        throw new Error(`Fireworks API error (${response.status}): ${errorData}`);
      }

      for await (const chunk of response.data) {
        const text = chunk.toString();
        const lines = text.split('\n').filter((line: string) => line.trim() && !line.startsWith(':'));

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              return;
            }
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                yield content;
              }
            } catch (e) {
              logger.warn(`[Fireworks] Failed to parse SSE chunk: ${data}`);
            }
          }
        }
      }
    } catch (error: unknown) {
      const err = error as { response?: { status: number; data: unknown }; request?: unknown; message?: string };
      if (err.response) {
        logger.error(`[Fireworks] Stream HTTP ${err.response.status}: ${JSON.stringify(err.response.data)}`);
        throw new Error(`Fireworks API error (${err.response.status}): ${(err.response.data as { error?: { message?: string } })?.error?.message || 'Unknown error'}`);
      } else if (err.request) {
        logger.error(`[Fireworks] Stream no response: ${err.message}`);
        throw new Error('Fireworks API did not respond - check network/API key');
      } else {
        logger.error(`[Fireworks] Stream error: ${err.message}`);
        throw error;
      }
    }
  }
}

export default FireworksProviderPlugin;
