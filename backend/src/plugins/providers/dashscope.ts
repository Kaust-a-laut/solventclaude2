import { IProviderPlugin } from '../../types/plugins';
import { ChatMessage, CompletionOptions } from '../../types/ai';
import { config } from '../../config';
import axios from 'axios';

const DASHSCOPE_BASE_URL = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';

export class DashScopeProviderPlugin implements IProviderPlugin {
  id = 'dashscope';
  name = 'DashScope';
  description = 'Alibaba Cloud DashScope — Qwen3-Coder, Qwen3.5, Qwen-Max and more';
  version = '1.0.0';
  defaultModel = 'qwen3-coder-plus';
  capabilities = {
    supportsVision: false,
    supportsStreaming: false,
    supportsEmbeddings: false,
    contextWindow: 131072,
    maxOutputTokens: 8192,
    supportsFunctionCalling: true,
    costPer1k: { input: 0.0004, output: 0.0012 }
  };

  private isInitialized = false;
  private apiKey: string | null = null;

  async initialize(options: Record<string, any>): Promise<void> {
    this.apiKey = options.apiKey || config.DASHSCOPE_API_KEY;
    if (!this.apiKey) {
      throw new Error('DashScope API key missing. Set DASHSCOPE_API_KEY in your .env file.');
    }
    this.isInitialized = true;
  }

  isReady(): boolean {
    return this.isInitialized && !!this.apiKey;
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.apiKey) return false;
      const response = await fetch(`${DASHSCOPE_BASE_URL}/models`, {
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
    if (!this.apiKey) throw new Error('DashScope provider not initialized');

    const { model, temperature = 0.7, maxTokens = 2048, apiKey, jsonMode } = options;
    const effectiveApiKey = apiKey || this.apiKey;

    const response = await axios.post(`${DASHSCOPE_BASE_URL}/chat/completions`, {
      model: model || this.defaultModel,
      messages: messages.map(msg => ({ role: msg.role, content: msg.content })),
      temperature,
      max_tokens: maxTokens,
      ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
    }, {
      headers: {
        'Authorization': `Bearer ${effectiveApiKey}`,
        'Content-Type': 'application/json',
      }
    });

    return response.data.choices[0].message.content;
  }

}

export default DashScopeProviderPlugin;
