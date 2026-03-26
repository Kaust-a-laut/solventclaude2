import { IProviderPlugin } from '../../types/plugins';
import { ChatMessage, CompletionOptions } from '../../types/ai';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import axios from 'axios';

export class GroqProviderPlugin implements IProviderPlugin {
  id = 'groq';
  name = 'Groq Cloud';
  description = 'Groq cloud-based AI provider';
  version = '1.0.0';
  defaultModel = 'llama-3.3-70b-versatile';
  capabilities = {
    supportsVision: false,
    supportsStreaming: true,
    supportsEmbeddings: false,
    contextWindow: 128000,
    maxOutputTokens: 8192,
    supportsFunctionCalling: true,
    costPer1k: { input: 0.05, output: 0.08 } // Prices in USD per 1000 tokens
  };

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.apiKey) return false;

      // Perform a minimal API call to check health
      const response = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { 'Authorization': `Bearer ${this.apiKey}` }
      });
      return response.ok;
    } catch (error) {
      console.error(`[Groq] Health check failed:`, error);
      return false;
    }
  }

  async getHealth(): Promise<import('../../types/plugins').ProviderHealth> {
    const startTime = Date.now();
    const isHealthy = await this.healthCheck();
    const latency = Date.now() - startTime;

    // In a real implementation, we'd track error rates over time
    const errorRate = 0; // Placeholder

    return {
      isHealthy,
      lastChecked: Date.now(),
      latency,
      errorRate
    };
  }

  private isInitialized = false;
  private apiKey: string | null = null;

  async initialize(options: Record<string, any>): Promise<void> {
    this.apiKey = options.apiKey || config.GROQ_API_KEY;
    logger.info(`[Groq] Initialize called. Options keys: ${Object.keys(options).join(', ')}`);
    logger.info(`[Groq] Config GROQ_API_KEY exists: ${!!config.GROQ_API_KEY}`);
    logger.info(`[Groq] Final API key set: ${!!this.apiKey}`);
    if (!this.apiKey) {
      throw new Error('Groq API Key missing. Please provide it in settings or .env file.');
    }
    this.isInitialized = true;
    logger.info('[Groq] Provider initialized successfully');
  }

  isReady(): boolean {
    return this.isInitialized && !!this.apiKey;
  }

  async complete(messages: ChatMessage[], options: CompletionOptions): Promise<string> {
    if (!this.apiKey) {
      throw new Error('Groq provider not initialized or API key missing');
    }

    const { model, temperature = 0.7, maxTokens = 2048, apiKey, jsonMode } = options;
    const effectiveApiKey = apiKey || this.apiKey;

    // Validate messages array
    if (!messages || messages.length === 0) {
      throw new Error('Messages array is empty or undefined');
    }

    // Validate and normalize message format for Groq API
    const formattedMessages = messages.map((msg, idx) => {
      if (!msg.role) {
        throw new Error(`Message ${idx} missing role: ${JSON.stringify(msg)}`);
      }
      if (msg.content === undefined || msg.content === null) {
        throw new Error(`Message ${idx} has null/undefined content: ${JSON.stringify(msg)}`);
      }
      // Groq only accepts 'user', 'assistant', or 'system' roles
      const validRole = ['user', 'assistant', 'system'].includes(msg.role)
        ? msg.role
        : 'user';
      return {
        role: validRole,
        content: String(msg.content) // Ensure content is a string
      };
    });

    const requestBody = {
      model: model || this.defaultModel,
      messages: formattedMessages,
      temperature,
      max_tokens: maxTokens,
      ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
    };

    logger.info(`[Groq] Sending request: model=${requestBody.model}, messages=${messages.length}, temp=${temperature}, max_tokens=${maxTokens}`);
    logger.debug(`[Groq] Request body: ${JSON.stringify(requestBody, null, 2)}`);

    try {
      const response = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        requestBody,
        {
          headers: {
            'Authorization': `Bearer ${effectiveApiKey}`,
            'Content-Type': 'application/json'
          },
          validateStatus: () => true // Don't throw on HTTP errors, we'll handle them
        }
      );

      // Log the full response for debugging
      logger.debug(`[Groq] Response status: ${response.status}`);
      logger.debug(`[Groq] Response headers: ${JSON.stringify(response.headers)}`);

      if (response.status !== 200) {
        const errorBody = JSON.stringify(response.data, null, 2);
        logger.error(`[Groq] API error (${response.status}): ${errorBody}`);
        throw new Error(`Groq API error (${response.status}): ${response.data?.error?.message || JSON.stringify(response.data)}`);
      }

      if (!response.data?.choices?.[0]?.message?.content) {
        logger.error(`[Groq] Invalid response format: ${JSON.stringify(response.data)}`);
        throw new Error('Groq returned invalid response format');
      }

      return response.data.choices[0].message.content;
    } catch (error: any) {
      // Axios errors have response property
      if (error.response) {
        logger.error(`[Groq] HTTP ${error.response.status}: ${JSON.stringify(error.response.data)}`);
        throw new Error(`Groq API error (${error.response.status}): ${error.response.data?.error?.message || 'Unknown error'}`);
      } else if (error.request) {
        logger.error(`[Groq] No response received: ${error.message}`);
        throw new Error('Groq API did not respond - check network/API key');
      } else {
        logger.error(`[Groq] Request error: ${error.message}`);
        throw error;
      }
    }
  }

  async *stream(messages: ChatMessage[], options: CompletionOptions): AsyncGenerator<string> {
    if (!this.apiKey) {
      throw new Error('Groq provider not initialized or API key missing');
    }

    // Validate messages array
    if (!messages || messages.length === 0) {
      throw new Error('Messages array is empty or undefined');
    }

    // Validate and normalize message format for Groq API
    const formattedMessages = messages.map((msg, idx) => {
      if (!msg.role) {
        throw new Error(`Message ${idx} missing role: ${JSON.stringify(msg)}`);
      }
      if (msg.content === undefined || msg.content === null) {
        throw new Error(`Message ${idx} has null/undefined content: ${JSON.stringify(msg)}`);
      }
      // Groq only accepts 'user', 'assistant', or 'system' roles
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

    logger.info(`[Groq] Streaming request: model=${requestBody.model}, messages=${messages.length}`);

    try {
      const response = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
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
        logger.error(`[Groq] Stream error (${response.status}): ${errorData}`);
        throw new Error(`Groq API error (${response.status}): ${errorData}`);
      }

      // Parse SSE stream
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
              logger.warn(`[Groq] Failed to parse SSE chunk: ${data}`);
            }
          }
        }
      }
    } catch (error: any) {
      if (error.response) {
        logger.error(`[Groq] Stream HTTP ${error.response.status}: ${JSON.stringify(error.response.data)}`);
        throw new Error(`Groq API error (${error.response.status}): ${error.response.data?.error?.message || 'Unknown error'}`);
      } else if (error.request) {
        logger.error(`[Groq] Stream no response: ${error.message}`);
        throw new Error('Groq API did not respond - check network/API key');
      } else {
        logger.error(`[Groq] Stream error: ${error.message}`);
        throw error;
      }
    }
  }
}

// Export as default for dynamic loading
export default GroqProviderPlugin;