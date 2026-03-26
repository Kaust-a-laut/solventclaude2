import { IProviderPlugin } from '../../types/plugins';
import { ChatMessage, CompletionOptions } from '../../types/ai';
import { config } from '../../config';
import { Ollama } from 'ollama';

export class OllamaProviderPlugin implements IProviderPlugin {
  id = 'ollama';
  name = 'Ollama';
  description = 'Local Ollama AI provider';
  version = '1.0.0';
  defaultModel = 'qwen2.5-coder:7b';
  capabilities = {
    supportsVision: false,  // Depends on model
    supportsStreaming: true,
    supportsEmbeddings: false,
    contextWindow: 32768,  // Varies by model
    maxOutputTokens: 4096,
    supportsFunctionCalling: false,
    costPer1k: { input: 0, output: 0 } // Local provider, no cost
  };

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.client) return false;

      // Check if Ollama is reachable
      const response = await this.client.ps();
      return !!response;
    } catch (error) {
      console.error(`[Ollama] Health check failed:`, error);
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

  private client: Ollama | null = null;
  private isInitialized = false;

  async initialize(options: Record<string, any>): Promise<void> {
    const host = options.host || config.OLLAMA_HOST || 'http://127.0.0.1:11434';
    this.client = new Ollama({ host });
    this.isInitialized = true;
  }

  isReady(): boolean {
    return this.isInitialized && !!this.client;
  }

  async complete(messages: ChatMessage[], options: CompletionOptions): Promise<string> {
    if (!this.client) {
      throw new Error('Ollama provider not initialized');
    }

    const { model, temperature = 0.7, maxTokens = 2048, jsonMode } = options;

    const response = await this.client.chat({
      model: model || this.defaultModel,
      messages: messages.map(msg => ({ role: msg.role, content: msg.content })),
      ...(jsonMode ? { format: 'json' } : {}),
      options: {
        temperature,
        num_predict: maxTokens,
      }
    });

    return response.message.content;
  }

  async *stream(messages: ChatMessage[], options: CompletionOptions): AsyncGenerator<string> {
    if (!this.client) {
      throw new Error('Ollama provider not initialized');
    }

    const { model, temperature = 0.7, maxTokens = 2048, jsonMode } = options;

    const response = await this.client.chat({
      model: model || this.defaultModel,
      messages: messages.map(msg => ({ role: msg.role, content: msg.content })),
      ...(jsonMode ? { format: 'json' } : {}),
      options: {
        temperature,
        num_predict: maxTokens,
      },
      stream: true
    });

    for await (const chunk of response) {
      yield chunk.message.content;
    }
  }
}

// Export as default for dynamic loading
export default OllamaProviderPlugin;