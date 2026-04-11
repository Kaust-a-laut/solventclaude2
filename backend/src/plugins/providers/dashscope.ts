import { IProviderPlugin } from '../../types/plugins';
import { ChatMessage, CompletionOptions } from '../../types/ai';
import { config } from '../../config';
import { logger } from '../../utils/logger';
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

  async initialize(options: Record<string, unknown>): Promise<void> {
    this.apiKey = (options.apiKey as string) || config.DASHSCOPE_API_KEY || null;
    this.isInitialized = true;
  }

  isReady(): boolean {
    return this.isInitialized;
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
    const { model, temperature = 0.7, maxTokens = 2048, apiKey, jsonMode } = options;
    const effectiveApiKey = apiKey || this.apiKey;
    if (!effectiveApiKey) throw new Error('DashScope API key missing. Provide it in settings or set DASHSCOPE_API_KEY in .env.');

    const effectiveModel = model || this.defaultModel;
    const isThinkingModel = /qwen3|qwq/i.test(effectiveModel) && !/qwen3\.5/i.test(effectiveModel);
    try {
      const response = await axios.post(`${DASHSCOPE_BASE_URL}/chat/completions`, {
        model: effectiveModel,
        messages: messages.map(msg => ({ role: msg.role, content: msg.content })),
        temperature,
        max_tokens: maxTokens,
        ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
        // Qwen3/QwQ thinking models: disable thinking for structured JSON output
        // to prevent thinking tokens from eating the output budget and truncating JSON
        ...(isThinkingModel && jsonMode ? { enable_thinking: false } : {}),
      }, {
        headers: {
          'Authorization': `Bearer ${effectiveApiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 180_000,
      });

      logger.info(`[DashScope] Response OK: model=${effectiveModel}`);
      return response.data.choices[0].message.content;
    } catch (error: unknown) {
      const err = error as { response?: { status?: number; data?: unknown }; message?: string };
      const status = err?.response?.status;
      const errData = err?.response?.data;
      logger.error(`[DashScope] Request error (${status}): model=${effectiveModel}`, JSON.stringify(errData || err.message));
      throw error;
    }
  }

}

export default DashScopeProviderPlugin;
