import { IProviderPlugin } from '../../types/plugins';
import { ChatMessage, CompletionOptions } from '../../types/ai';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import axios from 'axios';

export class CerebrasProviderPlugin implements IProviderPlugin {
  id = 'cerebras';
  name = 'Cerebras Cloud';
  description = 'Cerebras wafer-scale inference — ultra-fast OpenAI-compatible API';
  version = '1.0.0';
  defaultModel = 'llama3.1-8b';
  capabilities = {
    supportsVision: false,
    supportsStreaming: true,
    supportsEmbeddings: false,
    contextWindow: 128000,
    maxOutputTokens: 8192,
    supportsFunctionCalling: false,
    costPer1k: { input: 0.0, output: 0.0 } // Free tier
  };

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.apiKey) return false;

      const response = await fetch('https://api.cerebras.ai/v1/models', {
        headers: { 'Authorization': `Bearer ${this.apiKey}` }
      });
      return response.ok;
    } catch (error) {
      console.error(`[Cerebras] Health check failed:`, error);
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

  async initialize(options: Record<string, any>): Promise<void> {
    this.apiKey = options.apiKey || config.CEREBRAS_API_KEY;
    logger.info(`[Cerebras] Initialize called. API key set: ${!!this.apiKey}`);
    if (!this.apiKey) {
      logger.warn('[Cerebras] No API key — provider will be unavailable');
      return;
    }
    this.isInitialized = true;
    logger.info('[Cerebras] Provider initialized successfully');
  }

  isReady(): boolean {
    return this.isInitialized && !!this.apiKey;
  }

  async complete(messages: ChatMessage[], options: CompletionOptions): Promise<string> {
    if (!this.apiKey) {
      throw new Error('Cerebras provider not initialized or API key missing');
    }

    const { model, temperature = 0.7, maxTokens = 2048, apiKey, jsonMode } = options;
    const effectiveApiKey = apiKey || this.apiKey;

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

    const requestBody = {
      model: model || this.defaultModel,
      messages: formattedMessages,
      temperature,
      max_tokens: maxTokens,
      ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
    };

    logger.info(`[Cerebras] Sending request: model=${requestBody.model}, messages=${messages.length}, temp=${temperature}, max_tokens=${maxTokens}`);

    try {
      const response = await axios.post(
        'https://api.cerebras.ai/v1/chat/completions',
        requestBody,
        {
          headers: {
            'Authorization': `Bearer ${effectiveApiKey}`,
            'Content-Type': 'application/json'
          },
          validateStatus: () => true
        }
      );

      logger.debug(`[Cerebras] Response status: ${response.status}`);

      if (response.status !== 200) {
        const errorBody = JSON.stringify(response.data, null, 2);
        logger.error(`[Cerebras] API error (${response.status}): ${errorBody}`);
        throw new Error(`Cerebras API error (${response.status}): ${response.data?.error?.message || JSON.stringify(response.data)}`);
      }

      if (!response.data?.choices?.[0]?.message?.content) {
        logger.error(`[Cerebras] Invalid response format: ${JSON.stringify(response.data)}`);
        throw new Error('Cerebras returned invalid response format');
      }

      return response.data.choices[0].message.content;
    } catch (error: any) {
      if (error.response) {
        logger.error(`[Cerebras] HTTP ${error.response.status}: ${JSON.stringify(error.response.data)}`);
        throw new Error(`Cerebras API error (${error.response.status}): ${error.response.data?.error?.message || 'Unknown error'}`);
      } else if (error.request) {
        logger.error(`[Cerebras] No response received: ${error.message}`);
        throw new Error('Cerebras API did not respond - check network/API key');
      } else {
        logger.error(`[Cerebras] Request error: ${error.message}`);
        throw error;
      }
    }
  }

  async *stream(messages: ChatMessage[], options: CompletionOptions): AsyncGenerator<string> {
    if (!this.apiKey) {
      throw new Error('Cerebras provider not initialized or API key missing');
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

    const { model, temperature = 0.7, maxTokens = 2048, apiKey } = options;
    const effectiveApiKey = apiKey || this.apiKey;

    const requestBody = {
      model: model || this.defaultModel,
      messages: formattedMessages,
      temperature,
      max_tokens: maxTokens,
      stream: true,
    };

    logger.info(`[Cerebras] Streaming request: model=${requestBody.model}, messages=${messages.length}`);

    try {
      const response = await axios.post(
        'https://api.cerebras.ai/v1/chat/completions',
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
        logger.error(`[Cerebras] Stream error (${response.status}): ${errorData}`);
        throw new Error(`Cerebras API error (${response.status}): ${errorData}`);
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
              logger.warn(`[Cerebras] Failed to parse SSE chunk: ${data}`);
            }
          }
        }
      }
    } catch (error: any) {
      if (error.response) {
        logger.error(`[Cerebras] Stream HTTP ${error.response.status}: ${JSON.stringify(error.response.data)}`);
        throw new Error(`Cerebras API error (${error.response.status}): ${error.response.data?.error?.message || 'Unknown error'}`);
      } else if (error.request) {
        logger.error(`[Cerebras] Stream no response: ${error.message}`);
        throw new Error('Cerebras API did not respond - check network/API key');
      } else {
        logger.error(`[Cerebras] Stream error: ${error.message}`);
        throw error;
      }
    }
  }
}

export default CerebrasProviderPlugin;
