# Fix Search Pipeline — Rich, High-Volume Results

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the intelligent search pipeline return 10-20 high-quality, diverse results (news + web + research) instead of the current 0-1 results.

**Architecture:** Three root causes are being fixed: (1) `searchService` only calls ONE Brave endpoint (news OR web) per query — we add a parallel dual-endpoint method that merges both; (2) query expansion is keyword-stuffing queries, causing Brave to return few results — we make expansion conservative; (3) the re-ranker adds scoring but never adds results — when the raw pool is small, re-ranking is skipped to avoid dropping what little we have.

**Tech Stack:** TypeScript, Vitest, Brave Search API (web + news endpoints), Groq LLM (llama-3.3-70b-versatile)

---

## Root Cause Analysis

The user searches "latest ai news" and gets 1 result. Here's why:

1. **`searchService.braveSearch()`** (line 30) uses regex `/news|latest|articles|headlines/i` on the query to decide: hit Brave News endpoint OR Brave Web endpoint. Only one is ever called. For AI research, papers, and breaking news, you need BOTH.

2. **Query expansion** tells the LLM: "Add relevant technical terms, synonyms, and the current year (2026)". This produces keyword-stuffed queries like `"latest artificial intelligence machine learning developments breakthroughs advances neural networks research 2026"` — Brave Search doesn't handle these well and returns 0-1 results.

3. **The re-ranker can't add results** — it only scores/filters what Brave returns. If Brave returns 1 result, re-ranking outputs ≤1 result.

4. **Brave requests `count: 20`** already, so each endpoint CAN return up to 20. Calling both gives a pool of up to 40, which we merge, dedupe, and re-rank down to 20.

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `backend/src/services/searchService.ts` | Modify | Add `dualSearch()` that calls both web + news endpoints in parallel |
| `backend/src/services/intelligentSearchService.ts` | Modify | Use `dualSearch()`, fix query expansion prompt, skip re-rank when pool is small |
| `backend/src/services/intelligentSearchService.test.ts` | Modify | Update mocks for `dualSearch()`, add dual-endpoint and skip-rerank tests |

---

### Task 1: Add `dualSearch()` to SearchService

**Files:**
- Modify: `backend/src/services/searchService.ts:13-26`

- [ ] **Step 1: Add the `dualSearch()` method after `webSearch()` (line 26)**

This method calls both Brave Web and Brave News endpoints in parallel, merges results, and deduplicates by URL.

```typescript
async dualSearch(query: string, page: number = 1) {
  console.log(`[SearchService] Dual search for: "${query}" (page ${page})`);

  if (!config.BRAVE_SEARCH_API_KEY) {
    // Fall back to single-endpoint search for non-Brave providers
    return this.webSearch(query, page);
  }

  const offset = (page - 1) * 20;

  const fetchEndpoint = async (endpoint: string, resultKey: string) => {
    try {
      const response = await axios.get(endpoint, {
        params: {
          q: query,
          count: 20,
          offset,
        },
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': config.BRAVE_SEARCH_API_KEY,
        },
        timeout: 8000,
      });
      const rawResults = response.data[resultKey]?.results || [];
      return rawResults.map((r: any) => ({
        title: r.title,
        link: r.url,
        snippet: r.description,
        source: resultKey, // 'web' or 'news' — used for UI badges later
      }));
    } catch (error: any) {
      console.warn(`[SearchService] ${resultKey} endpoint failed: ${error.message}`);
      return [];
    }
  };

  const [webResults, newsResults] = await Promise.all([
    fetchEndpoint('https://api.search.brave.com/res/v1/web/search', 'web'),
    fetchEndpoint('https://api.search.brave.com/res/v1/news/search', 'news'),
  ]);

  // Merge: news first (fresher), then web — deduplicate by normalized URL
  const seen = new Set<string>();
  const merged: any[] = [];

  for (const r of [...newsResults, ...webResults]) {
    const normalizedUrl = r.link.replace(/\/$/, '').toLowerCase();
    if (!seen.has(normalizedUrl)) {
      seen.add(normalizedUrl);
      merged.push(r);
    }
  }

  console.log(`[SearchService] Dual search: ${webResults.length} web + ${newsResults.length} news = ${merged.length} unique results`);

  return {
    results: merged,
    answerBox: null,
    relatedSearches: [],
  };
}
```

- [ ] **Step 2: Verify backend compiles**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add backend/src/services/searchService.ts
git commit -m "feat(search): add dualSearch() for parallel web+news Brave queries"
```

---

### Task 2: Rework IntelligentSearchService — conservative expansion + dual search + skip-rerank

**Files:**
- Modify: `backend/src/services/intelligentSearchService.ts`

- [ ] **Step 1: Update the import to also import `SearchService` type and expose `dualSearch` in mock**

No import change needed — `searchService` is already imported. We just call `searchService.dualSearch()` instead of `searchService.webSearch()`.

- [ ] **Step 2: Replace the `expandQuery()` prompt**

Replace the entire `expandQuery` method body (lines 36-60) with a conservative expansion that produces SHORT, focused queries:

```typescript
private async expandQuery(query: string): Promise<string> {
  try {
    const groq = await AIProviderFactory.getProvider('groq');
    const response = await groq.complete(
      [
        {
          role: 'system',
          content: `You are a search query optimizer. Rewrite the user's query to get better search results. Rules:
- Keep it SHORT (under 8 words)
- Do NOT add filler words or long keyword lists
- Add ONE specific term if it helps focus the intent
- If the query mentions "latest" or "news", keep those words
- Return ONLY the query string, nothing else

Examples:
"ai stuff" → "latest AI breakthroughs 2026"
"how does react work" → "React fundamentals tutorial"
"new papers on transformers" → "transformer research papers 2026"`,
        },
        { role: 'user', content: query },
      ],
      {
        model: 'llama-3.3-70b-versatile',
        temperature: 0.2,
        maxTokens: 60,
      }
    );
    const expanded = response.trim().replace(/^["']|["']$/g, ''); // Strip quotes LLMs sometimes add
    logger.info(`[IntelligentSearch] Expanded query: "${query}" → "${expanded}"`);
    return expanded || query;
  } catch (error) {
    logger.warn(`[IntelligentSearch] Query expansion failed, using original query: ${error}`);
    return query;
  }
}
```

- [ ] **Step 3: Replace the `search()` method to use `dualSearch()` and skip re-rank on small pools**

Replace the entire `search()` method (lines 62-119) with:

```typescript
async search(query: string, page: number = 1, cachedExpandedQuery?: string): Promise<IntelligentSearchResult> {
  const startTime = Date.now();

  // Stage 1: Query Expansion (skip on pagination if cached)
  const expandedQuery = cachedExpandedQuery || await this.expandQuery(query);

  // Stage 2: Dual Search (web + news in parallel)
  // Use dualSearch for page 1, webSearch for pagination
  let rawResults;
  if (page === 1) {
    rawResults = await searchService.dualSearch(expandedQuery, page);
  } else {
    rawResults = await searchService.webSearch(expandedQuery, page);
  }
  let totalFound = rawResults.results?.length || 0;

  // Fallback: if expanded query yields < 3 results, retry with original
  if (totalFound < 3 && expandedQuery !== query) {
    logger.info(`[IntelligentSearch] Only ${totalFound} results from expanded query, retrying with original: "${query}"`);
    const fallbackResults = page === 1
      ? await searchService.dualSearch(query, page)
      : await searchService.webSearch(query, page);
    const fallbackCount = fallbackResults.results?.length || 0;
    if (fallbackCount > totalFound) {
      rawResults = fallbackResults;
      totalFound = fallbackCount;
    }
  }

  // On pagination (page > 1), skip re-ranking and synthesis
  if (page > 1) {
    return {
      results: (rawResults.results || []).map((r: any, i: number) => ({
        title: r.title,
        link: r.link,
        snippet: r.snippet,
        position: i + 1,
        relevanceScore: 0,
      })),
      answerBox: rawResults.answerBox,
      relatedSearches: rawResults.relatedSearches,
      expandedQuery,
      stats: {
        totalFound,
        totalRelevant: totalFound,
        pipelineMs: Date.now() - startTime,
      },
    };
  }

  // Stage 3: AI Re-rank (skip if pool is small — re-ranking can't add results)
  let rankedResults: RankedResult[];
  if (totalFound <= 5) {
    logger.info(`[IntelligentSearch] Small result pool (${totalFound}), skipping re-rank`);
    rankedResults = (rawResults.results || []).map((r: any, i: number) => ({
      title: r.title,
      link: r.link,
      snippet: r.snippet,
      position: i + 1,
      relevanceScore: 70, // Default decent score for small pools
    }));
  } else {
    rankedResults = await this.rerankResults(query, rawResults.results || []);
  }
  const totalRelevant = rankedResults.length;

  // Stage 4: AI Synthesis (use top 10 for richer answers)
  const synthesis = await this.synthesize(query, rankedResults.slice(0, 10));

  const pipelineMs = Date.now() - startTime;
  if (pipelineMs > 8000) {
    logger.warn(`[IntelligentSearch] Pipeline exceeded 8s budget: ${pipelineMs}ms`);
  }

  return {
    results: rankedResults,
    answerBox: rawResults.answerBox,
    relatedSearches: rawResults.relatedSearches,
    synthesis,
    expandedQuery,
    stats: { totalFound, totalRelevant, pipelineMs },
  };
}
```

- [ ] **Step 4: Verify backend compiles**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/intelligentSearchService.ts
git commit -m "fix(search): conservative query expansion, dual search, skip rerank on small pools"
```

---

### Task 3: Update Tests

**Files:**
- Modify: `backend/src/services/intelligentSearchService.test.ts`

- [ ] **Step 1: Update the mock to include `dualSearch`**

Replace the existing `searchService` mock (lines 4-8) with:

```typescript
vi.mock('./searchService', () => ({
  searchService: {
    webSearch: vi.fn(),
    dualSearch: vi.fn(),
  },
}));
```

- [ ] **Step 2: Replace ALL existing tests with updated versions**

Replace the entire `describe('IntelligentSearchService', ...)` block with:

```typescript
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
```

- [ ] **Step 3: Run tests**

Run: `cd backend && npx vitest run src/services/intelligentSearchService.test.ts`
Expected: 7 tests pass

- [ ] **Step 4: Run full backend type-check**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/intelligentSearchService.test.ts
git commit -m "test: update search pipeline tests for dual-endpoint and skip-rerank"
```

---

### Task 4: Manual Verification

- [ ] **Step 1: Restart the backend** (user does this in their terminal: Ctrl+C → re-run)

- [ ] **Step 2: Search "latest ai news" in the app browser**

Expected: 10-20 results mixing news articles and web pages. Results should include AI research, industry news, development announcements.

- [ ] **Step 3: Search "Claude Anthropic research" in the app browser**

Expected: 10+ results with Anthropic blog posts, research papers, news coverage.

- [ ] **Step 4: Search "arxiv transformer papers 2026"**

Expected: Research-focused results from arxiv, Google Scholar, academic sources.

- [ ] **Step 5: Commit all remaining changes and verify clean state**

```bash
git status
# Ensure no untracked files that shouldn't be committed
```
