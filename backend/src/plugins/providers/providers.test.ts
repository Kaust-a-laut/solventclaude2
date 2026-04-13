import { describe, it, expect } from 'vitest';
import { GeminiProviderPlugin } from './gemini';
import { GroqProviderPlugin } from './groq';
import { OllamaProviderPlugin } from './ollama';
import { BaseOpenAIService } from '../../services/baseOpenAIService';
import { FireworksProviderPlugin } from './fireworks';
import { CerebrasProviderPlugin } from './cerebras';
import { OpenRouterProviderPlugin } from './openrouter';

describe('Provider Capabilities', () => {
  it('gemini should declare vision and embedding support', () => {
    const plugin = new GeminiProviderPlugin();
    expect(plugin.capabilities?.supportsVision).toBe(true);
    expect(plugin.capabilities?.supportsEmbeddings).toBe(true);
    expect(plugin.capabilities?.contextWindow).toBeGreaterThan(0);
  });

  it('groq should declare streaming support', () => {
    const plugin = new GroqProviderPlugin();
    expect(plugin.capabilities?.supportsStreaming).toBe(true);
    expect(plugin.capabilities?.supportsVision).toBe(false);
  });

  it('ollama should declare local-first capabilities', () => {
    const plugin = new OllamaProviderPlugin();
    expect(plugin.capabilities?.supportsStreaming).toBe(true);
  });

  it('groq should extend BaseOpenAIService for tool-calling loop', () => {
    const plugin = new GroqProviderPlugin();
    expect(plugin).toBeInstanceOf(BaseOpenAIService);
  });

  it('fireworks should extend BaseOpenAIService for tool-calling loop', () => {
    const plugin = new FireworksProviderPlugin();
    expect(plugin).toBeInstanceOf(BaseOpenAIService);
  });
});