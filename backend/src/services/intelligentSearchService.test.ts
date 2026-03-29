import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies before importing the service
vi.mock('./searchService', () => ({
  searchService: {
    webSearch: vi.fn(),
  },
}));

vi.mock('./aiProviderFactory', () => ({
  AIProviderFactory: {
    getProvider: vi.fn(),
  },
}));

vi.mock('../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { intelligentSearchService } from './intelligentSearchService';
import { searchService } from './searchService';
import { AIProviderFactory } from './aiProviderFactory';

const mockGroq = {
  complete: vi.fn(),
};

describe('IntelligentSearchService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (AIProviderFactory.getProvider as any).mockResolvedValue(mockGroq);
  });

  describe('search() — full pipeline (page 1)', () => {
    it('should expand query, search, re-rank, and synthesize', async () => {
      // Stage 1: Query expansion
      mockGroq.complete.mockResolvedValueOnce('react performance optimization rendering 2026');

      // Stage 2: Brave search
      (searchService.webSearch as any).mockResolvedValueOnce({
        results: [
          { title: 'React Perf Guide', link: 'https://react.dev/perf', snippet: 'Performance tips' },
          { title: 'Rendering Best Practices', link: 'https://example.com/render', snippet: 'Render optimization' },
        ],
        answerBox: null,
        relatedSearches: [{ query: 'react memo' }],
      });

      // Stage 3: Re-rank
      mockGroq.complete.mockResolvedValueOnce(JSON.stringify({
        results: [
          { index: 0, score: 92, reason: 'Directly relevant' },
          { index: 1, score: 78, reason: 'Related' },
        ],
        removed: 0,
      }));

      // Stage 4: Synthesis
      mockGroq.complete.mockResolvedValueOnce(JSON.stringify({
        answer: 'React performance can be improved with `useMemo` and `React.memo`.',
        sources: ['https://react.dev/perf'],
      }));

      const result = await intelligentSearchService.search('react performance');

      expect(result.expandedQuery).toBe('react performance optimization rendering 2026');
      expect(result.results).toHaveLength(2);
      expect(result.results[0]!.relevanceScore).toBe(92);
      expect(result.results[1]!.relevanceScore).toBe(78);
      expect(result.synthesis?.answer).toContain('useMemo');
      expect(result.synthesis?.sources).toContain('https://react.dev/perf');
      expect(result.stats?.totalFound).toBe(2);
      expect(result.stats?.totalRelevant).toBe(2);
      expect(result.stats?.pipelineMs).toBeGreaterThan(0);

      // Verify Groq was called 3 times (expand + rerank + synthesize)
      expect(mockGroq.complete).toHaveBeenCalledTimes(3);
      // Verify Brave search was called with expanded query
      expect(searchService.webSearch).toHaveBeenCalledWith('react performance optimization rendering 2026', 1);
    });

    it('should fall back gracefully when query expansion fails', async () => {
      mockGroq.complete.mockRejectedValueOnce(new Error('Groq timeout'));

      (searchService.webSearch as any).mockResolvedValueOnce({
        results: [{ title: 'Result', link: 'https://test.com', snippet: 'Test' }],
        answerBox: null,
        relatedSearches: [],
      });

      // Re-rank
      mockGroq.complete.mockResolvedValueOnce(JSON.stringify({
        results: [{ index: 0, score: 80, reason: 'ok' }],
        removed: 0,
      }));

      // Synthesis
      mockGroq.complete.mockResolvedValueOnce(JSON.stringify({
        answer: 'Test answer.',
        sources: ['https://test.com'],
      }));

      const result = await intelligentSearchService.search('test query');

      // Should use original query when expansion fails
      expect(searchService.webSearch).toHaveBeenCalledWith('test query', 1);
      expect(result.expandedQuery).toBe('test query');
      expect(result.results).toHaveLength(1);
    });

    it('should return raw results when re-rank fails', async () => {
      mockGroq.complete.mockResolvedValueOnce('expanded query');

      (searchService.webSearch as any).mockResolvedValueOnce({
        results: [
          { title: 'A', link: 'https://a.com', snippet: 'a' },
          { title: 'B', link: 'https://b.com', snippet: 'b' },
        ],
        answerBox: null,
        relatedSearches: [],
      });

      // Re-rank fails
      mockGroq.complete.mockRejectedValueOnce(new Error('Groq error'));

      // Synthesis
      mockGroq.complete.mockResolvedValueOnce(JSON.stringify({
        answer: 'Synthesized.',
        sources: [],
      }));

      const result = await intelligentSearchService.search('query');

      expect(result.results).toHaveLength(2);
      expect(result.results[0]!.relevanceScore).toBe(0); // Fallback: no scores
    });
  });

  describe('search() — pagination (page > 1)', () => {
    it('should skip expansion and synthesis on subsequent pages', async () => {
      (searchService.webSearch as any).mockResolvedValueOnce({
        results: [{ title: 'Page 2 Result', link: 'https://p2.com', snippet: 'p2' }],
        answerBox: null,
        relatedSearches: [],
      });

      const result = await intelligentSearchService.search('query', 2, 'cached expanded query');

      // Should NOT call Groq at all
      expect(mockGroq.complete).not.toHaveBeenCalled();
      // Should use cached expanded query for Brave search
      expect(searchService.webSearch).toHaveBeenCalledWith('cached expanded query', 2);
      expect(result.expandedQuery).toBe('cached expanded query');
      expect(result.synthesis).toBeUndefined();
    });
  });
});
