import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies before importing the service
vi.mock('./searchService', () => ({
  searchService: {
    webSearch: vi.fn(),
    dualSearch: vi.fn(),
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
    it('should expand query, dual-search, re-rank, and synthesize', async () => {
      // Stage 1: Query expansion
      mockGroq.complete.mockResolvedValueOnce('react performance 2026');

      // Stage 2: Dual search returns 10+ results
      const mockResults = Array.from({ length: 12 }, (_, i) => ({
        title: `Result ${i + 1}`,
        link: `https://example${i}.com/article`,
        snippet: `Snippet for result ${i + 1}`,
        source: i < 6 ? 'news' : 'web',
      }));
      (searchService.dualSearch as any).mockResolvedValueOnce({
        results: mockResults,
        answerBox: null,
        relatedSearches: [{ query: 'react memo' }],
      });

      // Stage 3: Re-rank (returns all 12 scored)
      mockGroq.complete.mockResolvedValueOnce(JSON.stringify({
        results: mockResults.map((_, i) => ({
          index: i,
          score: 95 - i * 3,
          reason: 'Relevant',
        })),
        removed: 0,
      }));

      // Stage 4: Synthesis
      mockGroq.complete.mockResolvedValueOnce(JSON.stringify({
        answer: 'React performance can be improved with `useMemo` and `React.memo`.',
        sources: ['https://example0.com/article'],
      }));

      const result = await intelligentSearchService.search('react performance');

      expect(result.expandedQuery).toBe('react performance 2026');
      expect(result.results).toHaveLength(12);
      expect(result.results[0]!.relevanceScore).toBe(95);
      expect(result.synthesis?.answer).toContain('useMemo');
      expect(result.stats?.totalFound).toBe(12);

      // Verify dualSearch was called (not webSearch)
      expect(searchService.dualSearch).toHaveBeenCalledWith('react performance 2026', 1);
      expect(searchService.webSearch).not.toHaveBeenCalled();
    });

    it('should skip re-rank when result pool is small (≤5)', async () => {
      mockGroq.complete.mockResolvedValueOnce('niche topic query');

      (searchService.dualSearch as any).mockResolvedValueOnce({
        results: [
          { title: 'A', link: 'https://a.com', snippet: 'a', source: 'web' },
          { title: 'B', link: 'https://b.com', snippet: 'b', source: 'news' },
        ],
        answerBox: null,
        relatedSearches: [],
      });

      // Synthesis (no re-rank call expected)
      mockGroq.complete.mockResolvedValueOnce(JSON.stringify({
        answer: 'Summary.',
        sources: ['https://a.com'],
      }));

      const result = await intelligentSearchService.search('niche topic');

      expect(result.results).toHaveLength(2);
      // Default score of 70 when re-rank is skipped
      expect(result.results[0]!.relevanceScore).toBe(70);
      expect(result.results[1]!.relevanceScore).toBe(70);
      // Groq called only twice: expand + synthesize (no re-rank)
      expect(mockGroq.complete).toHaveBeenCalledTimes(2);
    });

    it('should fall back to original query when expanded yields < 3 results', async () => {
      mockGroq.complete.mockResolvedValueOnce('overly specific expanded query');

      // Expanded query yields 1 result
      (searchService.dualSearch as any).mockResolvedValueOnce({
        results: [{ title: 'Only One', link: 'https://one.com', snippet: 'solo', source: 'web' }],
        answerBox: null,
        relatedSearches: [],
      });

      // Fallback with original query yields 8 results
      const fallbackResults = Array.from({ length: 8 }, (_, i) => ({
        title: `Fallback ${i}`,
        link: `https://fallback${i}.com`,
        snippet: `fb${i}`,
        source: 'web',
      }));
      (searchService.dualSearch as any).mockResolvedValueOnce({
        results: fallbackResults,
        answerBox: null,
        relatedSearches: [],
      });

      // Re-rank the 8 results
      mockGroq.complete.mockResolvedValueOnce(JSON.stringify({
        results: fallbackResults.map((_, i) => ({ index: i, score: 80 - i, reason: 'ok' })),
        removed: 0,
      }));

      // Synthesis
      mockGroq.complete.mockResolvedValueOnce(JSON.stringify({
        answer: 'Fallback worked.',
        sources: ['https://fallback0.com'],
      }));

      const result = await intelligentSearchService.search('latest ai developments');

      expect(searchService.dualSearch).toHaveBeenCalledTimes(2);
      expect(result.results).toHaveLength(8);
    });

    it('should fall back gracefully when query expansion fails', async () => {
      mockGroq.complete.mockRejectedValueOnce(new Error('Groq timeout'));

      (searchService.dualSearch as any).mockResolvedValueOnce({
        results: Array.from({ length: 6 }, (_, i) => ({
          title: `Result ${i}`, link: `https://r${i}.com`, snippet: `s${i}`, source: 'web',
        })),
        answerBox: null,
        relatedSearches: [],
      });

      // Re-rank
      mockGroq.complete.mockResolvedValueOnce(JSON.stringify({
        results: Array.from({ length: 6 }, (_, i) => ({ index: i, score: 80, reason: 'ok' })),
        removed: 0,
      }));

      // Synthesis
      mockGroq.complete.mockResolvedValueOnce(JSON.stringify({
        answer: 'Test.',
        sources: ['https://r0.com'],
      }));

      const result = await intelligentSearchService.search('test query');

      // Should use original query when expansion fails
      expect(searchService.dualSearch).toHaveBeenCalledWith('test query', 1);
      expect(result.expandedQuery).toBe('test query');
      expect(result.results).toHaveLength(6);
    });

    it('should return raw results when re-rank fails', async () => {
      mockGroq.complete.mockResolvedValueOnce('expanded query');

      (searchService.dualSearch as any).mockResolvedValueOnce({
        results: Array.from({ length: 8 }, (_, i) => ({
          title: `R${i}`, link: `https://r${i}.com`, snippet: `s${i}`, source: 'web',
        })),
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

      expect(result.results).toHaveLength(8);
      expect(result.results[0]!.relevanceScore).toBe(50); // Fallback neutral score
    });
  });

  describe('search() — pagination (page > 1)', () => {
    it('should use webSearch (not dualSearch) and skip AI stages on pagination', async () => {
      (searchService.webSearch as any).mockResolvedValueOnce({
        results: [{ title: 'Page 2', link: 'https://p2.com', snippet: 'p2' }],
        answerBox: null,
        relatedSearches: [],
      });

      const result = await intelligentSearchService.search('query', 2, 'cached query');

      expect(mockGroq.complete).not.toHaveBeenCalled();
      expect(searchService.webSearch).toHaveBeenCalledWith('cached query', 2);
      expect(searchService.dualSearch).not.toHaveBeenCalled();
      expect(result.synthesis).toBeUndefined();
    });
  });
});
