import { IProviderPlugin } from '../../types/plugins';
import { ChatMessage, CompletionOptions } from '../../types/ai';
import { config } from '../../config';
import { logger } from '../../utils/logger';
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

  async initialize(options: Record<string, unknown>): Promise<void> {
    this.apiKey = (options.apiKey as string) || config.OPENROUTER_API_KEY || null;
    this.isInitialized = true;
  }

  isReady(): boolean {
    return this.isInitialized;
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
    const { model, temperature = 0.7, maxTokens = 2048, apiKey, jsonMode } = options;
    const effectiveApiKey = apiKey || this.apiKey;
    if (!effectiveApiKey) throw new Error('OpenRouter API key missing. Provide it in settings or set OPENROUTER_API_KEY in .env.');
    const effectiveModel = model || this.defaultModel;
    logger.info(`[OpenRouter] Sending request: model=${effectiveModel}, messages=${messages.length}, maxTokens=${maxTokens}`);

    // Reasoning models (R1, thinking models) use <think> blocks before JSON,
    // so response_format: json_object can break them. Skip jsonMode for these.
    const isReasoningModel = /deepseek.*r1|thinking|reasoner/i.test(effectiveModel);
    const useJsonMode = jsonMode && !isReasoningModel;

    try {
      const response = await axios.post(`${OPENROUTER_BASE_URL}/chat/completions`, {
        model: effectiveModel,
        messages: messages.map(msg => ({ role: msg.role, content: msg.content })),
        temperature,
        max_tokens: maxTokens,
        ...(useJsonMode ? { response_format: { type: 'json_object' } } : {}),
      }, {
        headers: {
          'Authorization': `Bearer ${effectiveApiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://solvent.ai',
          'X-Title': 'Solvent AI'
        },
        timeout: 180_000, // 3 minutes — reasoning models can be slow
      });

      logger.info(`[OpenRouter] Response OK: model=${effectiveModel}`);
      return response.data.choices[0].message.content;
    } catch (error: unknown) {
      const err = error as { response?: { status?: number; data?: unknown }; message?: string };
      const status = err?.response?.status;
      const errData = err?.response?.data;
      logger.error(`[OpenRouter] Request error (${status}): model=${effectiveModel}`, JSON.stringify(errData || err.message));
      throw error;
    }
  }

}

export default OpenRouterProviderPlugin;
