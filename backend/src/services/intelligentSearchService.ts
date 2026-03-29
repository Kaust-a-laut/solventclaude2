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
            content: `You are a search query optimizer. Given a user query, rewrite it to be more specific and comprehensive for web search. Add relevant technical terms, synonyms, and the current year (2026) for temporal context. Do NOT answer the question — return ONLY the refined search query string. Keep it under 150 characters.`,
          },
          { role: 'user', content: query },
        ],
        {
          model: 'llama-3.3-70b-versatile',
          temperature: 0.2,
          maxTokens: 150,
        }
      );
      const expanded = response.trim();
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

    // Stage 2: Brave Search
    const rawResults = await searchService.webSearch(expandedQuery, page);
    const totalFound = rawResults.results?.length || 0;

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

    // Stage 3: AI Re-rank
    const rankedResults = await this.rerankResults(query, rawResults.results || []);
    const totalRelevant = rankedResults.length;

    // Stage 4: AI Synthesis
    const synthesis = await this.synthesize(query, rankedResults.slice(0, 8));

    const pipelineMs = Date.now() - startTime;
    if (pipelineMs > 5000) {
      logger.warn(`[IntelligentSearch] Pipeline exceeded 5s budget: ${pipelineMs}ms`);
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
   * Stage 3: AI Re-rank & Filter (placeholder — implemented in Task 4)
   */
  private async rerankResults(query: string, results: any[]): Promise<RankedResult[]> {
    return results.map((r: any, i: number) => ({
      title: r.title,
      link: r.link,
      snippet: r.snippet,
      position: i + 1,
      relevanceScore: 0,
    }));
  }

  /**
   * Stage 4: AI Synthesis (placeholder — implemented in Task 5)
   */
  private async synthesize(query: string, results: RankedResult[]): Promise<Synthesis | undefined> {
    return undefined;
  }
}

export const intelligentSearchService = new IntelligentSearchService();
