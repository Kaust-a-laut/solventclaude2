import { AIProviderFactory } from './aiProviderFactory';
import { logger } from '../utils/logger';

interface RerankCandidate {
  id: string;
  score: number;
  metadata: { text: string; [key: string]: any };
}

interface RerankedResult extends RerankCandidate {
  rerankerScore: number;
}

const MAX_DOC_CHARS = 500;
const MIN_CANDIDATES_FOR_RERANK = 2;
const RERANK_MODEL = 'llama-3.3-70b-versatile';

export class Reranker {
  async rerank(query: string, candidates: RerankCandidate[]): Promise<RerankedResult[]> {
    if (candidates.length < MIN_CANDIDATES_FOR_RERANK) {
      return candidates.map(c => ({ ...c, rerankerScore: c.score * 10 }));
    }

    try {
      const provider = await AIProviderFactory.getProvider('groq');

      const docs = candidates.map((c, i) => {
        const text = (c.metadata.text || '').substring(0, MAX_DOC_CHARS);
        return `[${c.id}] ${text}`;
      }).join('\n\n');

      const prompt = `Score each document's relevance to the query on a 0-10 scale.
10 = directly answers the query. 0 = completely irrelevant.

Query: "${query.substring(0, 200)}"

Documents:
${docs}

Respond with JSON only:
{"scores": [{"id": "<doc_id>", "relevance": <0-10>}, ...]}`;

      const response = await provider.complete([
        { role: 'system', content: 'You are a relevance scorer. Output JSON only.' },
        { role: 'user', content: prompt }
      ], { model: RERANK_MODEL, temperature: 0, jsonMode: true });

      const cleaned = response.replace(/ᚫ[\s\S]*?<\/think>/g, '').replace(/```json/g, '').replace(/```/g, '').trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleaned);

      const scoreMap = new Map<string, number>();
      for (const s of parsed.scores || []) {
        scoreMap.set(s.id, Math.max(0, Math.min(10, s.relevance)));
      }

      return candidates
        .map(c => ({
          ...c,
          rerankerScore: scoreMap.get(c.id) ?? c.score * 10
        }))
        .sort((a, b) => b.rerankerScore - a.rerankerScore);

    } catch (err: unknown) {
      logger.warn('[Reranker] LLM reranking failed, falling back to original order:', err instanceof Error ? err.message : String(err));
      return candidates.map(c => ({ ...c, rerankerScore: c.score * 10 }));
    }
  }
}

export const reranker = new Reranker();