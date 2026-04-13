import { IProviderPlugin, ProviderHealth } from '../../types/plugins';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import { BaseOpenAIService } from '../../services/baseOpenAIService';

export class GroqProviderPlugin extends BaseOpenAIService implements IProviderPlugin {
  readonly name = 'Groq Cloud';
  protected baseUrl = 'https://api.groq.com/openai/v1';
  protected apiKey: string = '';

  id = 'groq';
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
    costPer1k: { input: 0.05, output: 0.08 },
  };

  private isInitialized = false;

  async initialize(options: Record<string, unknown>): Promise<void> {
    this.apiKey = (options.apiKey as string) || config.GROQ_API_KEY || '';
    this.isInitialized = true;
    logger.info(`[Groq] Provider initialized (API key present: ${!!this.apiKey})`);
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
      logger.error('[Groq] Health check failed:', error);
      return false;
    }
  }

  async getHealth(): Promise<ProviderHealth> {
    const startTime = Date.now();
    const isHealthy = await this.healthCheck();
    return { isHealthy, lastChecked: Date.now(), latency: Date.now() - startTime, errorRate: 0 };
  }
}

export default GroqProviderPlugin;
