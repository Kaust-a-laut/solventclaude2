import { IProviderPlugin } from '../../types/plugins';
import { ChatMessage, CompletionOptions } from '../../types/ai';
import { config } from '../../config';
import axios from 'axios';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

export class OpenRouterProviderPlugin implements IProviderPlugin {
  id = 'openrouter';
  name = 'OpenRouter';
  description = 'OpenRouter — unified API for 200+ models including Claude, GPT-4o, DeepSeek, Llama';
  version = '1.0.0';
  defaultModel = 'openai/gpt-4o-mini';
  capabilities = {
    supportsVision: false,
    supportsStreaming: false,
    supportsEmbeddings: false,
    contextWindow: 128000,
    maxOutputTokens: 8192,
    supportsFunctionCalling: true,
    costPer1k: { input: 0.0, output: 0.0 } // Varies per model
  };

  private isInitialized = false;
  private apiKey: string | null = null;

  async initialize(options: Record<string, any>): Promise<void> {
    this.apiKey = options.apiKey || config.OPENROUTER_API_KEY;
    if (!this.apiKey) {
      throw new Error('OpenRouter API key missing. Set OPENROUTER_API_KEY in your .env file.');
    }
    this.isInitialized = true;
  }

  isReady(): boolean {
    return this.isInitialized && !!this.apiKey;
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.apiKey) return false;
      const response = await fetch(`${OPENROUTER_BASE_URL}/models`, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` }
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async getHealth(): Promise<import('../../types/plugins').ProviderHealth> {
    const startTime = Date.now();
    const isHealthy = await this.healthCheck();
    return {
      isHealthy,
      lastChecked: Date.now(),
      latency: Date.now() - startTime,
      errorRate: 0
    };
  }

  async complete(messages: ChatMessage[], options: CompletionOptions): Promise<string> {
    if (!this.apiKey) throw new Error('OpenRouter provider not initialized');

    const { model, temperature = 0.7, maxTokens = 2048, apiKey, jsonMode } = options;
    const effectiveApiKey = apiKey || this.apiKey;
    const effectiveModel = model || this.defaultModel;
    console.log(`[OpenRouter] Sending request: model=${effectiveModel}, messages=${messages.length}`);

    try {
      const response = await axios.post(`${OPENROUTER_BASE_URL}/chat/completions`, {
        model: effectiveModel,
        messages: messages.map(msg => ({ role: msg.role, content: msg.content })),
        temperature,
        max_tokens: maxTokens,
        ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
      }, {
        headers: {
          'Authorization': `Bearer ${effectiveApiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://solvent.ai',
          'X-Title': 'Solvent AI'
        }
      });

      console.log(`[OpenRouter] Response OK: model=${effectiveModel}`);
      return response.data.choices[0].message.content;
    } catch (error: any) {
      const status = error?.response?.status;
      const errData = error?.response?.data;
      console.error(`[OpenRouter] Request error (${status}): model=${effectiveModel}`, JSON.stringify(errData || error.message));
      throw error;
    }
  }

}

export default OpenRouterProviderPlugin;
