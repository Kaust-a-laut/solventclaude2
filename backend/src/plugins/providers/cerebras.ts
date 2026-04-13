import { IProviderPlugin, ProviderHealth } from '../../types/plugins';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import { BaseOpenAIService } from '../../services/baseOpenAIService';

export class CerebrasProviderPlugin extends BaseOpenAIService implements IProviderPlugin {
  readonly name = 'Cerebras Cloud';
  protected baseUrl = 'https://api.cerebras.ai/v1';
  protected apiKey: string = '';

  id = 'cerebras';
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
    costPer1k: { input: 0.0, output: 0.0 },
  };

  private isInitialized = false;

  async initialize(options: Record<string, unknown>): Promise<void> {
    this.apiKey = (options.apiKey as string) || config.CEREBRAS_API_KEY || '';
    this.isInitialized = true;
    logger.info(`[Cerebras] Provider initialized (API key present: ${!!this.apiKey})`);
  }

  isReady(): boolean {
    return this.isInitialized;
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.apiKey) return false;
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      return response.ok;
    } catch (error) {
      logger.error('[Cerebras] Health check failed:', error);
      return false;
    }
  }

  async getHealth(): Promise<ProviderHealth> {
    const startTime = Date.now();
    const isHealthy = await this.healthCheck();
    return { isHealthy, lastChecked: Date.now(), latency: Date.now() - startTime, errorRate: 0 };
  }
}

export default CerebrasProviderPlugin;
