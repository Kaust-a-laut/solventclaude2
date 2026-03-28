import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import { config } from '../config';

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

  private async braveSearch(query: string, page: number = 1) {
    const offset = (page - 1) * 20;
    const isNewsQuery = /news|latest|articles|headlines/i.test(query);

    try {
      const endpoint = isNewsQuery
        ? 'https://api.search.brave.com/res/v1/news/search'
        : 'https://api.search.brave.com/res/v1/web/search';

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
        }
      });

      console.log(`[SearchService] Brave (${isNewsQuery ? 'news' : 'web'}) responded with status: ${response.status}`);

      const data = response.data;

      // Normalize Brave response to match our existing format
      const rawResults = isNewsQuery
        ? (data.news?.results || [])
        : (data.web?.results || []);

      const results = rawResults.map((r: any) => ({
        title: r.title,
        link: r.url,
        snippet: r.description,
        position: r.index,
      }));

      // Extract answer box from infobox or FAQ
      let answerBox = null;
      if (data.infobox) {
        answerBox = {
          title: data.infobox.title || query,
          answer: data.infobox.long_desc || data.infobox.description,
          snippet: data.infobox.description,
        };
      }

      // Extract related searches
      const relatedSearches = (data.query?.related_queries || []).map((q: string) => ({ query: q }));

      return { results, answerBox, relatedSearches };
    } catch (error: any) {
      console.error('[SearchService] Brave Search Error:', error.response?.data || error.message);
      throw new Error(`Brave search failed: ${error.message}`);
    }
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
    } catch (error: any) {
      console.error('[SearchService] Serper Search Error:', error.response?.data || error.message);
      throw new Error(`Serper search failed: ${error.message}`);
    }
  }

  async getKnowledgeMap(maxDepth: number = 3) {
    return await this.scanDir(this.rootDir, 0, maxDepth);
  }

  private async scanDir(currentPath: string, depth: number, maxDepth: number): Promise<any> {
    if (depth > maxDepth) return null;

    const entries = await fs.readdir(currentPath, { withFileTypes: true });
    const summary: any = {
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