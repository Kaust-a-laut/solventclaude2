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
    if (!config.SERPER_API_KEY) {
      console.error('[SearchService] Error: SERPER_API_KEY missing');
      throw new Error('SERPER_API_KEY is not configured for web search.');
    }

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
      console.error('[SearchService] Web Search Error Details:', error.response?.data || error.message);
      throw new Error(`Web search failed: ${error.message}`);
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