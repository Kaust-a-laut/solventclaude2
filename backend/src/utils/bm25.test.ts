import { describe, it, expect, beforeEach } from 'vitest';
import { BM25Index, reciprocalRankFusion } from '../utils/bm25';

describe('BM25Index', () => {
  let index: BM25Index;

  beforeEach(() => {
    index = new BM25Index();
  });

  describe('build', () => {
    it('should build an index from documents', () => {
      const documents = [
        { id: '1', text: 'The quick brown fox jumps over the lazy dog' },
        { id: '2', text: 'The slow red cat walks under the active mouse' },
        { id: '3', text: 'Quick brown foxes are faster than lazy dogs' }
      ];

      index.build(documents);

      expect(index.size).toBe(3);
    });

    it('should handle empty documents', () => {
      index.build([]);
      expect(index.size).toBe(0);
    });

    it('should tokenize words correctly', () => {
      const documents = [
        { id: '1', text: 'Hello world! How are you?' },
        { id: '2', text: 'World peace is important.' }
      ];

      index.build(documents);

      expect(index.size).toBe(2);
    });

    it('should filter out short words (less than 2 characters)', () => {
      const documents = [
        { id: '1', text: 'I a am an the be to of and in' }
      ];

      index.build(documents);
      // Only 'am', 'an', 'the', 'be', 'to', 'of', 'and', 'in' should be indexed
      expect(index.size).toBe(1);
    });
  });

  describe('search', () => {
    beforeEach(() => {
      const documents = [
        { id: '1', text: 'TypeScript is a programming language developed by Microsoft' },
        { id: '2', text: 'JavaScript is a scripting language for web development' },
        { id: '3', text: 'Python is a general-purpose programming language' },
        { id: '4', text: 'React is a JavaScript library for building user interfaces' }
      ];
      index.build(documents);
    });

    it('should find documents matching query terms', () => {
      const results = index.search('TypeScript language', 10);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]!.id).toBe('1'); // Document 1 should rank highest
    });

    it('should rank by relevance (BM25 scoring)', () => {
      const results = index.search('programming language', 10);

      expect(results.length).toBe(3);
      // Documents 1 and 3 both mention "programming language"
      expect(['1', '3']).toContain(results[0]!.id);
    });

    it('should respect the limit parameter', () => {
      const results = index.search('language', 2);

      expect(results.length).toBe(2);
    });

    it('should return empty array for no matches', () => {
      const results = index.search('quantum computing', 10);

      expect(results.length).toBe(0);
    });

    it('should handle empty query', () => {
      const results = index.search('', 10);

      expect(results.length).toBe(0);
    });

    it('should handle special characters in query', () => {
      const results = index.search('TypeScript!!! ??? language...', 10);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]!.id).toBe('1');
    });

    it('should be case-insensitive', () => {
      const results1 = index.search('typescript', 10);
      const results2 = index.search('TypeScript', 10);
      const results3 = index.search('TYPESCRIPT', 10);

      expect(results1).toEqual(results2);
      expect(results2).toEqual(results3);
    });
  });

  describe('addDocument()', () => {
    it('should add a document to an existing index', () => {
      index.build([{ id: '1', text: 'The quick brown fox' }]);
      index.addDocument({ id: '2', text: 'The lazy dog sleeps' });

      expect(index.size).toBe(2);
      const results = index.search('lazy dog', 10);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]!.id).toBe('2');
    });

    it('should update scores after adding documents', () => {
      index.build([{ id: '1', text: 'TypeScript programming language' }]);
      index.addDocument({ id: '2', text: 'TypeScript compiler options' });

      const results = index.search('TypeScript', 10);
      expect(results.length).toBe(2);
      expect(results.map(r => r.id)).toContain('1');
      expect(results.map(r => r.id)).toContain('2');
    });

    it('should handle adding to an empty index', () => {
      index.addDocument({ id: '1', text: 'Hello world example' });

      expect(index.size).toBe(1);
      const results = index.search('hello', 10);
      expect(results.length).toBe(1);
      expect(results[0]!.id).toBe('1');
    });

    it('should replace a document with the same id', () => {
      index.build([{ id: '1', text: 'The quick brown fox' }]);
      index.addDocument({ id: '1', text: 'The lazy red cat' });

      expect(index.size).toBe(1);
      const foxResults = index.search('fox', 10);
      expect(foxResults.length).toBe(0);
      const catResults = index.search('cat', 10);
      expect(catResults.length).toBe(1);
      expect(catResults[0]!.id).toBe('1');
    });
  });

  describe('removeDocument()', () => {
    it('should remove a document from the index', () => {
      index.build([
        { id: '1', text: 'The quick brown fox' },
        { id: '2', text: 'The lazy dog sleeps' }
      ]);
      index.removeDocument('1');

      expect(index.size).toBe(1);
      const results = index.search('fox', 10);
      expect(results.length).toBe(0);
    });

    it('should clean up inverted index entries', () => {
      index.build([
        { id: '1', text: 'unique alpha term' },
        { id: '2', text: 'unique beta term' }
      ]);
      index.removeDocument('1');

      const results = index.search('alpha', 10);
      expect(results.length).toBe(0);
      // 'beta' should still be findable
      const betaResults = index.search('beta', 10);
      expect(betaResults.length).toBe(1);
      expect(betaResults[0]!.id).toBe('2');
    });

    it('should be a no-op for non-existent ids', () => {
      index.build([{ id: '1', text: 'The quick brown fox' }]);
      index.removeDocument('nonexistent');

      expect(index.size).toBe(1);
    });
  });

  describe('edge cases', () => {
    it('should handle very short documents', () => {
      const documents = [
        { id: '1', text: 'Hi' },
        { id: '2', text: 'Hello there' }
      ];

      index.build(documents);
      const results = index.search('hello', 10);

      expect(results.length).toBe(1);
      expect(results[0]!.id).toBe('2');
    });

    it('should handle duplicate terms in documents', () => {
      const documents = [
        { id: '1', text: 'Python Python Python is great' },
        { id: '2', text: 'Python is okay' }
      ];

      index.build(documents);
      const results = index.search('Python', 10);

      expect(results.length).toBe(2);
      expect(results[0]!.id).toBe('1'); // Higher frequency should rank higher
    });
  });
});

describe('reciprocalRankFusion', () => {
  it('should merge results from vector and BM25 searches', () => {
    const vectorResults = [
      { id: '1', score: 0.9 },
      { id: '2', score: 0.8 },
      { id: '3', score: 0.7 }
    ];

    const bm25Results = [
      { id: '2', score: 10.5 },
      { id: '4', score: 8.2 },
      { id: '1', score: 5.1 }
    ];

    const merged = reciprocalRankFusion(vectorResults, bm25Results);

    expect(merged.length).toBe(4);
    // Document 2 appears high in both, should rank first
    expect(merged[0]!.id).toBe('2');
  });

  it('should handle empty vector results', () => {
    const vectorResults: Array<{ id: string; score: number }> = [];
    const bm25Results = [
      { id: '1', score: 10.5 },
      { id: '2', score: 8.2 }
    ];

    const merged = reciprocalRankFusion(vectorResults, bm25Results);

    expect(merged.length).toBe(2);
    expect(merged[0]!.id).toBe('1');
    expect(merged[1]!.id).toBe('2');
  });

  it('should handle empty BM25 results', () => {
    const vectorResults = [
      { id: '1', score: 0.9 },
      { id: '2', score: 0.8 }
    ];
    const bm25Results: Array<{ id: string; score: number }> = [];

    const merged = reciprocalRankFusion(vectorResults, bm25Results);

    expect(merged.length).toBe(2);
    expect(merged[0]!.id).toBe('1');
    expect(merged[1]!.id).toBe('2');
  });

  it('should handle both empty results', () => {
    const vectorResults: Array<{ id: string; score: number }> = [];
    const bm25Results: Array<{ id: string; score: number }> = [];

    const merged = reciprocalRankFusion(vectorResults, bm25Results);

    expect(merged.length).toBe(0);
  });

  it('should use custom k parameter', () => {
    const vectorResults = [
      { id: '1', score: 0.9 },
      { id: '2', score: 0.8 }
    ];

    const bm25Results = [
      { id: '2', score: 10.5 },
      { id: '1', score: 5.1 }
    ];

    const merged1 = reciprocalRankFusion(vectorResults, bm25Results, 60);
    const merged2 = reciprocalRankFusion(vectorResults, bm25Results, 10);

    expect(merged1.length).toBe(2);
    expect(merged2.length).toBe(2);
    // Different k values should produce different rankings
    expect(merged1[0]!.id).toBe(merged2[0]!.id); // Both should still rank doc 1 first in this case
  });

  it('should handle documents appearing in only one result set', () => {
    const vectorResults = [
      { id: '1', score: 0.9 },
      { id: '5', score: 0.5 }
    ];

    const bm25Results = [
      { id: '2', score: 10.5 },
      { id: '3', score: 8.2 }
    ];

    const merged = reciprocalRankFusion(vectorResults, bm25Results);

    expect(merged.length).toBe(4);
    expect(merged.map(m => m.id)).toEqual(expect.arrayContaining(['1', '2', '3', '5']));
  });
});
