import { pluginManager } from './pluginManager';
import { IProviderPlugin } from '../types/plugins';

/**
 * Provider configuration for OpenAI-compatible providers.
 * Used for documentation and centralized configuration.
 */
export interface ProviderConfig {
  name: string;
  baseUrl: string;
  apiKeyEnvVar: string;
  defaultModel: string;
}

/**
 * Configuration map for OpenAI-compatible providers.
 * Centralized provider configuration to reduce duplication.
 */
export const OPENAI_COMPATIBLE_PROVIDERS: Record<string, ProviderConfig> = {
  groq: {
    name: 'groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    apiKeyEnvVar: 'GROQ_API_KEY',
    defaultModel: 'llama-3.3-70b-versatile'
  },
  deepseek: {
    name: 'deepseek',
    baseUrl: 'https://api.deepseek.com',
    apiKeyEnvVar: 'DEEPSEEK_API_KEY',
    defaultModel: 'deepseek-chat'
  },
  openrouter: {
    name: 'openrouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKeyEnvVar: 'OPENROUTER_API_KEY',
    defaultModel: 'google/gemini-2.0-flash-001:free'
  },
  dashscope: {
    name: 'dashscope',
    baseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    apiKeyEnvVar: 'DASHSCOPE_API_KEY',
    defaultModel: 'qwen3-coder-plus'
  },
  cerebras: {
    name: 'cerebras',
    baseUrl: 'https://api.cerebras.ai/v1',
    apiKeyEnvVar: 'CEREBRAS_API_KEY',
    defaultModel: 'llama3.1-8b'
  }
};

export class AIProviderFactory {
  static async getProvider(name: string): Promise<IProviderPlugin> {
    return pluginManager.resolveProvider(name);
  }

  static async getAllProviders() {
    return pluginManager.getAllProviders();
  }
}
