import { IProviderPlugin, ProviderHealth } from '../../types/plugins';
import { config } from '../../config';
import { BaseOpenAIService } from '../../services/baseOpenAIService';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

export class OpenRouterProviderPlugin extends BaseOpenAIService implements IProviderPlugin {
  readonly name = 'OpenRouter';
  protected baseUrl = OPENROUTER_BASE_URL;
  protected apiKey: string = '';

  id = 'openrouter';
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
    costPer1k: { input: 0.0, output: 0.0 },
  };

  private isInitialized = false;

  async initialize(options: Record<string, unknown>): Promise<void> {
    this.apiKey = (options.apiKey as string) || config.OPENROUTER_API_KEY || '';
    this.isInitialized = true;
  }

  isReady(): boolean {
    return this.isInitialized;
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.apiKey) return false;
      const response = await fetch(`${OPENROUTER_BASE_URL}/models`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async getHealth(): Promise<ProviderHealth> {
    const startTime = Date.now();
    const isHealthy = await this.healthCheck();
    return { isHealthy, lastChecked: Date.now(), latency: Date.now() - startTime, errorRate: 0 };
  }

  protected getExtraHeaders(): Record<string, string> {
    return {
      'HTTP-Referer': 'https://solvent.ai',
      'X-Title': 'Solvent AI',
    };
  }

  protected shouldSkipJsonMode(model: string): boolean {
    return /deepseek.*r1|thinking|reasoner/i.test(model);
  }
}

export default OpenRouterProviderPlugin;
