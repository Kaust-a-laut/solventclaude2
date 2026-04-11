import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import { config } from '../config';

interface BraveSearchResult {
  title: string;
  url: string;
  description: string;
  index?: number;
}

interface DirectoryNode {
  name: string;
  files: string[];
  directories: DirectoryNode[];
}

export class SearchService {
  private rootDir: string;

  constructor() {
    this.rootDir = path.resolve(__dirname, '../../../');
  }

  async webSearch(query: string, page: number = 1) {
    console.log(`[SearchService] Executing search for: "${query}" (page ${page})`);

    // Prefer Brave Search API, fall back to Serper
    if (config.BRAVE_SEARCH_API_KEY) {
      return this.braveSearch(query, page);
    }
    if (config.SERPER_API_KEY) {
      return this.serperSearch(query, page);
    }

    console.error('[SearchService] Error: No search API key configured');
    throw new Error('No search API key configured. Set BRAVE_SEARCH_API_KEY or SERPER_API_KEY.');
  }

  async dualSearch(query: string, page: number = 1) {
    console.log(`[SearchService] Dual search for: "${query}" (page ${page})`);

    if (!config.BRAVE_SEARCH_API_KEY) {
      // Fall back to single-endpoint search for non-Brave providers
      return this.webSearch(query, page);
    }

    const offset = (page - 1) * 20;

    const fetchEndpoint = async (endpoint: string, resultKey: string, retries = 2) => {
      for (let attempt = 0; attempt <= retries; attempt++) {
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
          return rawResults.map((r: BraveSearchResult) => ({
            title: r.title,
            link: r.url,
            snippet: r.description,
            source: resultKey, // 'web' or 'news' — used for UI badges later
          }));
        } catch (error: unknown) {
          const err = error as { response?: { status?: number; headers?: Record<string, string>; data?: unknown }; message?: string };
          const is429 = err?.response?.status === 429;
          if (is429 && attempt < retries) {
            const waitSec = parseInt(err?.response?.headers?.['retry-after'] || '', 10) || (2 * (attempt + 1));
            console.warn(`[SearchService] ${resultKey} 429 — retrying in ${waitSec}s (attempt ${attempt + 1}/${retries})`);
            await new Promise(r => setTimeout(r, waitSec * 1000));
            continue;
          }
          console.warn(`[SearchService] ${resultKey} endpoint failed: ${err.message}`);
          return [];
        }
      }
      return [];
    };

    const [webResults, newsResults] = await Promise.all([
      fetchEndpoint('https://api.search.brave.com/res/v1/web/search', 'web'),
      fetchEndpoint('https://api.search.brave.com/res/v1/news/search', 'news'),
    ]);

    // Merge: news first (fresher), then web — deduplicate by normalized URL
    const seen = new Set<string>();
    const merged: Array<{ title: string; link: string; snippet: string; source: string }> = [];

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

  private async braveSearch(query: string, page: number = 1, retries: number = 2) {
    const offset = (page - 1) * 20;
    const isNewsQuery = /news|latest|articles|headlines/i.test(query);
    const endpoint = isNewsQuery
      ? 'https://api.search.brave.com/res/v1/news/search'
      : 'https://api.search.brave.com/res/v1/web/search';

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await axios.get(endpoint, {
          params: {
            q: query,
            count: 20,
            offset,
            result_filter: isNewsQuery ? undefined : 'web',
          },
          headers: {
            'Accept': 'application/json',
            'Accept-Encoding': 'gzip',
            'X-Subscription-Token': config.BRAVE_SEARCH_API_KEY,
          },
          timeout: 8000,
        });

        console.log(`[SearchService] Brave (${isNewsQuery ? 'news' : 'web'}) responded with status: ${response.status}`);

        const data = response.data;
        const rawResults = isNewsQuery
          ? (data.news?.results || [])
          : (data.web?.results || []);

        const results = rawResults.map((r: BraveSearchResult) => ({
          title: r.title,
          link: r.url,
          snippet: r.description,
          position: r.index,
        }));

        let answerBox = null;
        if (data.infobox) {
          answerBox = {
            title: data.infobox.title || query,
            answer: data.infobox.long_desc || data.infobox.description,
            snippet: data.infobox.description,
          };
        }

        const relatedSearches = (data.query?.related_queries || []).map((q: string) => ({ query: q }));

        return { results, answerBox, relatedSearches };
      } catch (error: unknown) {
        const err = error as { response?: { status?: number; headers?: Record<string, string>; data?: unknown }; message?: string };
        const is429 = err?.response?.status === 429;
        if (is429 && attempt < retries) {
          const waitSec = parseInt(err?.response?.headers?.['retry-after'] || '', 10) || (2 * (attempt + 1));
          console.warn(`[SearchService] Brave 429 — retrying in ${waitSec}s (attempt ${attempt + 1}/${retries})`);
          await new Promise(r => setTimeout(r, waitSec * 1000));
          continue;
        }
        console.error('[SearchService] Brave Search Error:', err.response?.data || err.message);
        throw new Error(`Brave search failed: ${err.message}`);
      }
    }
    throw new Error('Brave search failed: max retries exceeded');
  }

  private async serperSearch(query: string, page: number = 1) {
    const isNewsQuery = /news|latest|articles|headlines/i.test(query);
    const endpoint = isNewsQuery ? 'https://google.serper.dev/news' : 'https://google.serper.dev/search';

    try {
      const response = await axios.post(endpoint, {
        q: query,
        gl: 'us',
        hl: 'en',
        num: 20,
        page,
        autocorrect: true
      }, {
        headers: {
          'X-API-KEY': config.SERPER_API_KEY,
          'Content-Type': 'application/json'
        }
      });

      console.log(`[SearchService] Serper (${isNewsQuery ? 'news' : 'search'}) responded with status: ${response.status}`);

      const results = isNewsQuery ? response.data.news : response.data.organic;

      return {
        results: results || [],
        answerBox: response.data.answerBox,
        relatedSearches: response.data.relatedSearches
      };
    } catch (error: unknown) {
      const err = error as { response?: { data?: unknown }; message?: string };
      console.error('[SearchService] Serper Search Error:', err.response?.data || err.message);
      throw new Error(`Serper search failed: ${err.message}`);
    }
  }

  async getKnowledgeMap(maxDepth: number = 3) {
    return await this.scanDir(this.rootDir, 0, maxDepth);
  }

  private async scanDir(currentPath: string, depth: number, maxDepth: number): Promise<DirectoryNode | null> {
    if (depth > maxDepth) return null;

    const entries = await fs.readdir(currentPath, { withFileTypes: true });
    const summary: DirectoryNode = {
      name: path.basename(currentPath) || 'root',
      files: [],
      directories: []
    };

    for (const entry of entries) {
      if (['node_modules', '.git', 'dist', '.next'].includes(entry.name)) continue;

      if (entry.isDirectory()) {
        const subDir = await this.scanDir(path.join(currentPath, entry.name), depth + 1, maxDepth);
        if (subDir) summary.directories.push(subDir);
      } else {
        summary.files.push(entry.name);
      }
    }

    return summary;
  }
}

export const searchService = new SearchService();