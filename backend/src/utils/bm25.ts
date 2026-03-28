/**
 * Lightweight BM25 scorer for hybrid search (keyword + vector).
 * No external dependencies — built on simple tokenization and inverted index.
 */

// BM25 hyperparameters
const K1 = 1.2;
const B = 0.75;

// Minimum word length to index
const MIN_WORD_LENGTH = 2;

interface DocEntry {
  id: string;
  termFreqs: Map<string, number>;
  length: number;
}

export class BM25Index {
  private docs: Map<string, DocEntry> = new Map();
  private invertedIndex: Map<string, Set<string>> = new Map(); // term -> doc IDs
  private avgDocLength: number = 0;
  private docCount: number = 0;

  /**
   * Tokenize text into lowercase terms.
   */
  private tokenize(text: string): string[] {
    return text.toLowerCase().split(/\W+/).filter(w => w.length >= MIN_WORD_LENGTH);
  }

  /**
   * Build or rebuild the index from a set of documents.
   */
  build(documents: Array<{ id: string; text: string }>) {
    this.docs.clear();
    this.invertedIndex.clear();

    let totalLength = 0;

    for (const doc of documents) {
      const tokens = this.tokenize(doc.text);
      const termFreqs = new Map<string, number>();

      for (const token of tokens) {
        termFreqs.set(token, (termFreqs.get(token) || 0) + 1);

        if (!this.invertedIndex.has(token)) {
          this.invertedIndex.set(token, new Set());
        }
        this.invertedIndex.get(token)!.add(doc.id);
      }

      this.docs.set(doc.id, {
        id: doc.id,
        termFreqs,
        length: tokens.length
      });

      totalLength += tokens.length;
    }

    this.docCount = documents.length;
    this.avgDocLength = this.docCount > 0 ? totalLength / this.docCount : 1;
  }

  /**
   * Add a single document to the index (or replace if same id exists).
   */
  addDocument(doc: { id: string; text: string }): void {
    if (this.docs.has(doc.id)) {
      this.removeDocument(doc.id);
    }
    const tokens = this.tokenize(doc.text);
    const termFreqs = new Map<string, number>();
    for (const token of tokens) {
      termFreqs.set(token, (termFreqs.get(token) ?? 0) + 1);
      if (!this.invertedIndex.has(token)) {
        this.invertedIndex.set(token, new Set());
      }
      this.invertedIndex.get(token)!.add(doc.id);
    }
    this.docs.set(doc.id, { id: doc.id, termFreqs, length: tokens.length });
    this.docCount++;
    this.recalcAvgDocLength();
  }

  /**
   * Remove a document from the index by id.
   */
  removeDocument(id: string): void {
    const doc = this.docs.get(id);
    if (!doc) return;
    for (const term of doc.termFreqs.keys()) {
      const docSet = this.invertedIndex.get(term);
      if (docSet) {
        docSet.delete(id);
        if (docSet.size === 0) {
          this.invertedIndex.delete(term);
        }
      }
    }
    this.docs.delete(id);
    this.docCount--;
    this.recalcAvgDocLength();
  }

  /**
   * Recalculate the average document length across all indexed documents.
   */
  private recalcAvgDocLength(): void {
    if (this.docCount === 0) {
      this.avgDocLength = 1;
      return;
    }
    let total = 0;
    for (const doc of this.docs.values()) {
      total += doc.length;
    }
    this.avgDocLength = total / this.docCount;
  }

  /**
   * Compute IDF (Inverse Document Frequency) for a term.
   */
  private idf(term: string): number {
    const df = this.invertedIndex.get(term)?.size || 0;
    if (df === 0) return 0;
    // Standard BM25 IDF: log((N - df + 0.5) / (df + 0.5) + 1)
    return Math.log((this.docCount - df + 0.5) / (df + 0.5) + 1);
  }

  /**
   * Score a single document against a query.
   */
  private scoreDoc(doc: DocEntry, queryTerms: string[]): number {
    let score = 0;
    for (const term of queryTerms) {
      const tf = doc.termFreqs.get(term) || 0;
      if (tf === 0) continue;

      const idfVal = this.idf(term);
      const lengthNorm = 1 - B + B * (doc.length / this.avgDocLength);
      const tfNorm = (tf * (K1 + 1)) / (tf + K1 * lengthNorm);

      score += idfVal * tfNorm;
    }
    return score;
  }

  /**
   * Search the index and return scored results.
   */
  search(query: string, limit: number): Array<{ id: string; score: number }> {
    if (this.docCount === 0) return [];

    const queryTerms = this.tokenize(query);
    if (queryTerms.length === 0) return [];

    // Only score docs that contain at least one query term
    const candidateIds = new Set<string>();
    for (const term of queryTerms) {
      const docIds = this.invertedIndex.get(term);
      if (docIds) {
        for (const id of docIds) {
          candidateIds.add(id);
        }
      }
    }

    const results: Array<{ id: string; score: number }> = [];
    for (const id of candidateIds) {
      const doc = this.docs.get(id)!;
      const score = this.scoreDoc(doc, queryTerms);
      if (score > 0) {
        results.push({ id, score });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  /**
   * Get the number of indexed documents.
   */
  get size(): number {
    return this.docCount;
  }
}

/**
 * Merge vector search results and BM25 results using Reciprocal Rank Fusion.
 * Produces a single ranked list that combines both signals.
 *
 * @param vectorResults - Results from vector similarity search (id + score)
 * @param bm25Results - Results from BM25 keyword search (id + score)
 * @param k - RRF constant (default 60 — standard value from the literature)
 * @returns Merged results sorted by RRF score
 */
export function reciprocalRankFusion(
  vectorResults: Array<{ id: string; score: number }>,
  bm25Results: Array<{ id: string; score: number }>,
  k: number = 60
): Array<{ id: string; rrfScore: number }> {
  const rrfScores = new Map<string, number>();

    // Add vector rank contributions
    for (let rank = 0; rank < vectorResults.length; rank++) {
      const result = vectorResults[rank]!;
      const { id } = result;
      rrfScores.set(id, (rrfScores.get(id) || 0) + 1 / (k + rank + 1));
    }

    // Add BM25 rank contributions
    for (let rank = 0; rank < bm25Results.length; rank++) {
      const result = bm25Results[rank]!;
      const { id } = result;
      rrfScores.set(id, (rrfScores.get(id) || 0) + 1 / (k + rank + 1));
    }

  const merged = Array.from(rrfScores.entries())
    .map(([id, rrfScore]) => ({ id, rrfScore }))
    .sort((a, b) => b.rrfScore - a.rrfScore);

  return merged;
}
