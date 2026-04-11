import { searchService } from './searchService';
import { AIProviderFactory } from './aiProviderFactory';
import { logger } from '../utils/logger';

interface RankedResult {
  title: string;
  link: string;
  snippet: string;
  position: number;
  relevanceScore: number;
}

interface Synthesis {
  answer: string;
  sources: string[];
}

interface IntelligentSearchResult {
  results: RankedResult[];
  answerBox?: any;
  relatedSearches?: { query: string }[];
  synthesis?: Synthesis;
  expandedQuery?: string;
  stats?: {
    totalFound: number;
    totalRelevant: number;
    pipelineMs: number;
  };
}

class IntelligentSearchService {
  /**
   * Stage 1: Query Expansion
   * Rewrites the user query for better search recall using Groq LLM.
   */
  private async expandQuery(query: string): Promise<string> {
    try {
      const groq = await AIProviderFactory.getProvider('groq');
      const response = await groq.complete(
        [
          {
            role: 'system',
            content: `You are a search query optimizer. Your job is to maximize search result quality. Rules:
- If the query is already specific and well-formed, return it UNCHANGED
- If the query is vague or casual, sharpen it with precise terms
- Keep queries concise but don't sacrifice clarity for brevity — use as many words as needed
- Preserve the user's intent: don't add topics they didn't ask about
- If the query mentions "latest" or "news", keep those temporal signals
- Add a year (2026) only if recency matters and isn't already specified
- Return ONLY the query string, nothing else

Examples:
"ai stuff" → "latest AI breakthroughs 2026"
"how does react work" → "React fundamentals tutorial"
"new papers on transformers" → "transformer research papers 2026"
"TypeScript generic constraints for mapped types" → "TypeScript generic constraints for mapped types"
"best practices for kubernetes horizontal pod autoscaling" → "best practices for kubernetes horizontal pod autoscaling"`,
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

    // Fallback: if expanded query yields < 2 results on page 1, retry with original
    if (page === 1 && totalFound < 2 && expandedQuery !== query) {
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

  /**
   * Stage 3: AI Re-rank & Filter
   * LLM scores each result 0-100 for relevance, removes duplicates and low scores.
   */
  private async rerankResults(query: string, results: any[]): Promise<RankedResult[]> {
    if (!results.length) return [];

    try {
      const groq = await AIProviderFactory.getProvider('groq');

      const resultsForLLM = results.map((r: any, i: number) => ({
        index: i,
        title: r.title,
        url: r.link,
        snippet: r.snippet,
      }));

      const response = await groq.complete(
        [
          {
            role: 'system',
            content: `You are a search result ranker. Given a user query and a list of search results, score each result 0-100 for relevance to the user's intent. Remove duplicates (same domain + similar title). Return JSON only.

Scoring guidelines:
- 80-100: Directly answers the query or is highly relevant to the main intent
- 60-79: Clearly relevant topic-wise, contains useful information
- 40-59: Somewhat relevant, tangentially related, or partial match
- 20-39: Weak relevance but may have some useful context
- 0-19: Irrelevant, spam, or unrelated

IMPORTANT: Score ALL results — do NOT omit any. For broad/general queries (e.g., "latest ai news", "tech updates"), most results should score 50+. Be generous with scoring — users prefer seeing more results over fewer.

Output schema:
{
  "results": [{ "index": <number>, "score": <number>, "reason": "<brief reason>" }],
  "removed": <number of duplicate results removed (same domain + near-identical title)>
}

Sort by score descending. Include ALL results — the UI handles visual differentiation by score.`,
          },
          {
            role: 'user',
            content: `Query: "${query}"\n\nResults:\n${JSON.stringify(resultsForLLM, null, 2)}`,
          },
        ],
        {
          model: 'llama-3.3-70b-versatile',
          temperature: 0.1,
          maxTokens: 2048,
          jsonMode: true,
        }
      );

      const parsed = JSON.parse(response);
      const ranked: RankedResult[] = [];

      for (const item of parsed.results || []) {
        // Handle both 0-based and 1-based indices from LLM
        let original = results[item.index];
        if (!original && item.index > 0) original = results[item.index - 1];
        if (!original) continue;
        ranked.push({
          title: original.title,
          link: original.link,
          snippet: original.snippet,
          position: ranked.length + 1,
          relevanceScore: typeof item.score === 'number' ? item.score : 50,
        });
      }

      // If all results were filtered out (too strict), fall back to showing raw results
      // This handles general queries like "latest ai news" where strict relevance filtering
      // would show zero results
      if (ranked.length === 0 && results.length > 0) {
        logger.info(`[IntelligentSearch] All results filtered by relevance, falling back to raw results`);
        return results.map((r: any, i: number) => ({
          title: r.title,
          link: r.link,
          snippet: r.snippet,
          position: i + 1,
          relevanceScore: 50, // Neutral score for fallback
        }));
      }

      logger.info(`[IntelligentSearch] Re-ranked: ${results.length} → ${ranked.length} results (${parsed.removed || 0} removed)`);
      return ranked;
    } catch (error) {
      logger.warn(`[IntelligentSearch] Re-rank failed, returning raw results: ${error}`);
      return results.map((r: any, i: number) => ({
        title: r.title,
        link: r.link,
        snippet: r.snippet,
        position: i + 1,
        relevanceScore: 50, // Neutral score when re-ranking fails
      }));
    }
  }

  /**
   * Stage 4: AI Synthesis
   * Generates a concise answer from the top re-ranked results.
   */
  private async synthesize(query: string, results: RankedResult[]): Promise<Synthesis | undefined> {
    if (!results.length) return undefined;

    try {
      const groq = await AIProviderFactory.getProvider('groq');

      const context = results.map((r, i) => `[${i + 1}] ${r.title} (${r.link})\n${r.snippet}`).join('\n\n');

      const response = await groq.complete(
        [
          {
            role: 'system',
            content: `You are a search synthesis engine. Given a user query and top search results, generate a rich, in-depth overview (8-12 sentences) that synthesizes information across the results. Structure your response as a mini-briefing:
- Open with a high-level summary of the landscape
- Cover key developments, breakthroughs, and announcements with specific details
- Mention names, companies, models, papers, dates, and numbers when available
- Note emerging trends or implications
- Use inline technical terms in backticks
Return JSON only.

Output schema:
{
  "answer": "<8-12 sentence in-depth synthesis briefing with specific details, technical terms in backticks, and trend analysis>",
  "sources": ["<url1>", "<url2>", ...]
}

Include all URLs that informed the answer (up to 8).`,
          },
          {
            role: 'user',
            content: `Query: "${query}"\n\nTop Results:\n${context}`,
          },
        ],
        {
          model: 'llama-3.3-70b-versatile',
          temperature: 0.3,
          maxTokens: 1200,
          jsonMode: true,
        }
      );

      const parsed = JSON.parse(response);
      logger.info(`[IntelligentSearch] Synthesis generated from ${parsed.sources?.length || 0} sources`);
      return {
        answer: parsed.answer || '',
        sources: parsed.sources || [],
      };
    } catch (error) {
      logger.warn(`[IntelligentSearch] Synthesis failed, omitting: ${error}`);
      return undefined;
    }
  }
}

export const intelligentSearchService = new IntelligentSearchService();
