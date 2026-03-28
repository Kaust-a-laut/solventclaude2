import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Reranker } from './reranker';

vi.mock('./aiProviderFactory', () => ({
  AIProviderFactory: {
    getProvider: vi.fn()
  }
}));

import { AIProviderFactory } from './aiProviderFactory';

describe('Reranker', () => {
  let reranker: Reranker;

  beforeEach(() => {
    reranker = new Reranker();
  });

  it('should rerank candidates by LLM relevance scores', async () => {
    const mockProvider = {
      complete: vi.fn().mockResolvedValue(JSON.stringify({
        scores: [
          { id: 'a', relevance: 9 },
          { id: 'b', relevance: 3 },
          { id: 'c', relevance: 7 }
        ]
      }))
    };
    vi.mocked(AIProviderFactory.getProvider).mockResolvedValue(mockProvider as any);

    const candidates = [
      { id: 'a', score: 0.8, metadata: { text: 'TypeScript strict mode enables noImplicitAny' } },
      { id: 'b', score: 0.75, metadata: { text: 'CSS flexbox layout guide' } },
      { id: 'c', score: 0.7, metadata: { text: 'TypeScript compiler options reference' } }
    ];

    const result = await reranker.rerank('How do I enable strict TypeScript?', candidates);

    expect(result).toHaveLength(3);
    expect(result[0]!.id).toBe('a');
    expect(result[1]!.id).toBe('c');
    expect(result[2]!.id).toBe('b');
    expect(result[0]!.rerankerScore).toBe(9);
  });

  it('should return original order on LLM failure', async () => {
    vi.mocked(AIProviderFactory.getProvider).mockRejectedValue(new Error('provider down'));

    const candidates = [
      { id: 'a', score: 0.8, metadata: { text: 'hello' } },
      { id: 'b', score: 0.6, metadata: { text: 'world' } }
    ];

    const result = await reranker.rerank('test', candidates);

    expect(result).toHaveLength(2);
    expect(result[0]!.id).toBe('a');
    expect(result[1]!.id).toBe('b');
  });

  it('should skip reranking for small candidate sets', async () => {
    vi.mocked(AIProviderFactory.getProvider).mockClear();
    
    const candidates = [
      { id: 'a', score: 0.8, metadata: { text: 'only one' } }
    ];

    const result = await reranker.rerank('test', candidates);

    expect(result).toHaveLength(1);
    expect(AIProviderFactory.getProvider).not.toHaveBeenCalled();
  });

  it('should truncate long documents before sending to LLM', async () => {
    const mockProvider = {
      complete: vi.fn().mockResolvedValue(JSON.stringify({
        scores: [{ id: 'a', relevance: 5 }, { id: 'b', relevance: 8 }]
      }))
    };
    vi.mocked(AIProviderFactory.getProvider).mockResolvedValue(mockProvider as any);

    const longText = 'word '.repeat(500);
    const candidates = [
      { id: 'a', score: 0.8, metadata: { text: longText } },
      { id: 'b', score: 0.7, metadata: { text: 'short text' } }
    ];

    await reranker.rerank('query', candidates);

    const prompt = mockProvider.complete.mock.calls[0]![0]![1]!.content;
    expect(prompt.length).toBeLessThan(longText.length + 500);
  });
});