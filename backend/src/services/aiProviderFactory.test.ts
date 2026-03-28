import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AIProviderFactory, OPENAI_COMPATIBLE_PROVIDERS } from './aiProviderFactory';
import { pluginManager } from './pluginManager';

// Mock pluginManager
vi.mock('./pluginManager', () => ({
  pluginManager: {
    resolveProvider: vi.fn(),
    getAllProviders: vi.fn(),
    initialize: vi.fn(),
    getRegistry: vi.fn()
  }
}));

describe('OPENAI_COMPATIBLE_PROVIDERS', () => {
  it('should have groq configured correctly', () => {
    expect(OPENAI_COMPATIBLE_PROVIDERS.groq).toEqual({
      name: 'groq',
      baseUrl: 'https://api.groq.com/openai/v1',
      apiKeyEnvVar: 'GROQ_API_KEY',
      defaultModel: 'llama-3.3-70b-versatile'
    });
  });

  it('should have deepseek configured correctly', () => {
    expect(OPENAI_COMPATIBLE_PROVIDERS.deepseek).toEqual({
      name: 'deepseek',
      baseUrl: 'https://api.deepseek.com',
      apiKeyEnvVar: 'DEEPSEEK_API_KEY',
      defaultModel: 'deepseek-chat'
    });
  });

  it('should have openrouter configured correctly', () => {
    expect(OPENAI_COMPATIBLE_PROVIDERS.openrouter).toEqual({
      name: 'openrouter',
      baseUrl: 'https://openrouter.ai/api/v1',
      apiKeyEnvVar: 'OPENROUTER_API_KEY',
      defaultModel: 'google/gemini-2.0-flash-001:free'
    });
  });

  it('should have dashscope configured correctly', () => {
    expect(OPENAI_COMPATIBLE_PROVIDERS.dashscope).toEqual({
      name: 'dashscope',
      baseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
      apiKeyEnvVar: 'DASHSCOPE_API_KEY',
      defaultModel: 'qwen3-coder-plus'
    });
  });

  it('should have cerebras configured correctly', () => {
    expect(OPENAI_COMPATIBLE_PROVIDERS.cerebras).toEqual({
      name: 'cerebras',
      baseUrl: 'https://api.cerebras.ai/v1',
      apiKeyEnvVar: 'CEREBRAS_API_KEY',
      defaultModel: 'llama3.1-8b'
    });
  });

  it('should have all providers with required fields', () => {
    Object.values(OPENAI_COMPATIBLE_PROVIDERS).forEach(provider => {
      expect(provider).toHaveProperty('name');
      expect(provider).toHaveProperty('baseUrl');
      expect(provider).toHaveProperty('apiKeyEnvVar');
      expect(provider).toHaveProperty('defaultModel');
      
      expect(provider.name).toBeTruthy();
      expect(provider.baseUrl).toMatch(/^https:\/\//);
      expect(provider.apiKeyEnvVar).toMatch(/_API_KEY$/);
      expect(provider.defaultModel).toBeTruthy();
    });
  });
});

describe('AIProviderFactory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getProvider', () => {
    it('should resolve a provider via pluginManager', async () => {
      const mockProvider = { name: 'groq', complete: vi.fn() };
      vi.mocked(pluginManager.resolveProvider).mockResolvedValue(mockProvider as any);

      const provider = await AIProviderFactory.getProvider('groq');

      expect(provider).toBe(mockProvider);
      expect(pluginManager.resolveProvider).toHaveBeenCalledWith('groq');
    });

    it('should throw if provider is not found', async () => {
      vi.mocked(pluginManager.resolveProvider).mockRejectedValue(new Error('Provider not found'));

      await expect(AIProviderFactory.getProvider('nonexistent')).rejects.toThrow('Provider not found');
    });

    it('should handle different provider names', async () => {
      const mockProvider = { name: 'gemini', complete: vi.fn() };
      vi.mocked(pluginManager.resolveProvider).mockResolvedValue(mockProvider as any);

      await AIProviderFactory.getProvider('gemini');

      expect(pluginManager.resolveProvider).toHaveBeenCalledWith('gemini');
    });
  });

  describe('getAllProviders', () => {
    it('should return all providers from pluginManager', async () => {
      const mockProviders = [
        { name: 'groq' },
        { name: 'gemini' },
        { name: 'ollama' }
      ];
      vi.mocked(pluginManager.getAllProviders).mockResolvedValue(mockProviders as any);

      const providers = await AIProviderFactory.getAllProviders();

      expect(providers).toBe(mockProviders);
      expect(pluginManager.getAllProviders).toHaveBeenCalled();
    });

    it('should return empty array if no providers available', async () => {
      vi.mocked(pluginManager.getAllProviders).mockResolvedValue([]);

      const providers = await AIProviderFactory.getAllProviders();

      expect(providers).toEqual([]);
    });
  });
});
