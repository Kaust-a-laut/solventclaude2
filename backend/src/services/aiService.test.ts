import { describe, it, expect, vi, beforeEach } from 'vitest';
import { aiService } from './aiService';
import { AIProviderFactory } from './aiProviderFactory';

// Mock dependencies
vi.mock('fs/promises', () => ({
  default: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
  },
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('./aiProviderFactory');
vi.mock('./searchService');
vi.mock('./contextService', () => ({
  contextService: {
    enrichContext: vi.fn().mockImplementation(async (data) => ({
      messages: data.messages,
      provenance: { active: [], suppressed: [], counts: { workspace: 0, local: 0, global: 0, rules: 0 }, promptTokens: { memory: 0, rules: 0, workspace: 0, conversationHistory: 0, systemPrompt: 0, total: 0, budget: 0 } }
    }))
  },
  getHarnessSnapshot: vi.fn().mockReturnValue({
    RETRIEVAL_COUNT_DEFAULT: 8,
    RETRIEVAL_COUNT_MASSIVE: 15,
    RETRIEVAL_COUNT_CONSTRAINED: 3,
    MIN_SCORE_STANDARD: 0.6,
    MIN_SCORE_MASSIVE: 0.5,
    SCORE_BOOST_UNIVERSAL: 0.35,
    SCORE_BOOST_META_SUMMARY: 0.30,
    SCORE_BOOST_CRYSTALLIZED: 0.25,
    SCORE_BOOST_PERMANENT_RULE: 0.20,
    SCORE_BOOST_KEYWORD_MATCH: 0.15,
    SCORE_BOOST_TAG_MATCH: 0.20,
    SCORE_BOOST_PER_RETRIEVAL: 0.02,
    SCORE_BOOST_PER_IMPORTANCE: 0.04,
    DEDUP_SIMILARITY_THRESHOLD: 0.92,
    LINKED_MEMORY_SCORE_MULTIPLIER: 0.9,
    SCORE_PENALTY_STALE_CODE: 0.5,
  })
}));
vi.mock('./pollinationsService', () => ({
  pollinationsService: {
    generateImage: vi.fn().mockResolvedValue({ base64: 'dGVzdA==', imageUrl: 'test.png' })
  }
}));
vi.mock('./localImageService', () => ({
  localImageService: {
    checkModelAvailability: vi.fn().mockResolvedValue({ available: true })
  }
}));

describe('AIService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should list available models correctly', async () => {
    const mockProviders = [
      { id: 'ollama', name: 'Ollama', defaultModel: 'llama3', isReady: () => true },
      { id: 'gemini', name: 'Gemini', defaultModel: 'gemini-2.0-flash', isReady: () => true }
    ];
    (AIProviderFactory.getAllProviders as any).mockResolvedValue(mockProviders);

    const models = await aiService.listAvailableModels();
    
    expect(models).toHaveProperty('ollama');
    expect(models).toHaveProperty('gemini');
    expect(models.gemini).toContain('gemini-2.0-flash');
  });

  it('should detect image generation intent', async () => {
    const mockGemini = { 
      id: 'gemini',
      complete: vi.fn().mockRejectedValue(new Error('direct gemini image fail')),
      isReady: () => true 
    };
    (AIProviderFactory.getProvider as any).mockResolvedValue(mockGemini);

    const data: any = {
      messages: [{ role: 'user', content: 'generate an image of a cat' }],
      mode: 'vision',
      provider: 'gemini',
      model: 'gemini-1.5-flash',
      imageProvider: 'pollinations'
    };

    const result = await aiService.processChat(data);
    expect(result.isGeneratedImage).toBe(true);
    expect(result.response).toContain('generated the image');
    expect(result.imageUrl).toBeDefined();
  });

  it('should handle thinking mode by injecting system instructions', async () => {
    const mockGroq = { 
      id: 'groq',
      complete: vi.fn().mockResolvedValue('I am thinking'),
      isReady: () => true 
    };
    (AIProviderFactory.getProvider as any).mockResolvedValue(mockGroq);

    const data: any = {
      messages: [{ role: 'user', content: 'Hello' }],
      provider: 'groq',
      model: 'llama-3.3-70b-versatile',
      thinkingModeEnabled: true
    };

    await aiService.processChat(data);
    
    // Check if provider was called with thinking instruction
    const callArgs = (mockGroq.complete as any).mock.calls[0][0];
    expect(callArgs[0].content).toContain('[DEEP THINKING MODE ACTIVE]');
  });
});