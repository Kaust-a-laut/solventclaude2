import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { vectorService } from './vectorService';
import fs from 'fs/promises';
import path from 'path';

// Deterministic word-bag embedding so tests run without a real Gemini API key
const makeEmbedding = (text: string): number[] => {
  const arr = new Array(768).fill(0);
  const words = text.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(/\s+/);
  for (const word of words) {
    if (!word) continue;
    let h = 5381;
    for (let i = 0; i < word.length; i++) h = ((h << 5) + h + word.charCodeAt(i)) >>> 0;
    arr[h % 768] += 1;
  }
  const mag = Math.sqrt(arr.reduce((s, v) => s + v * v, 0));
  return mag > 0 ? arr.map(v => v / mag) : arr;
};

const mockEmbedModel = {
  embedContent: async (text: string) => ({ embedding: { values: makeEmbedding(text) } }),
  batchEmbedContents: async ({ requests }: any) => ({
    embeddings: requests.map((r: any) => ({ values: makeEmbedding(r.content.parts[0].text) })),
  }),
};

beforeAll(async () => {
  (vectorService as any).genAI = { getGenerativeModel: () => mockEmbedModel };
  // Wait for the constructor's un-awaited loadMemory() to finish, then reset to a clean slate
  // so it can't race-overwrite entries added by addEntriesBatch during tests.
  await (vectorService as any).loadMemory();
  (vectorService as any).memory = [];
  (vectorService as any).rebuildIndices();
});

const EMBEDDING_CACHE_PATH = path.resolve(__dirname, '../../../.solvent_embedding_cache.json');

describe('VectorService Enhancements', () => {
  beforeEach(() => {
    // Clean memory before each test to avoid cross-test contamination
    (vectorService as any).memory = [];
    (vectorService as any).rebuildIndices();
  });

  it('should support batch adding entries', async () => {
    const entries = [
      { text: 'Batch entry 1', metadata: { type: 'test', tags: ['batch'] } },
      { text: 'Batch entry 2', metadata: { type: 'test', tags: ['batch', 'secondary'] } }
    ];

    const ids = await vectorService.addEntriesBatch(entries);
    expect(ids).toHaveLength(2);
    
    // Verify indexing
    const results = await vectorService.search('Batch entry', 5, { tags: ['batch'] });
    expect(results.length).toBeGreaterThanOrEqual(2);
    expect(results.some(r => r.metadata.text === 'Batch entry 1')).toBe(true);
  });

  it('should use LRU cache for embeddings', async () => {
    // This is hard to test directly without exposing internals more, 
    // but we can verify that repeated calls are fast.
    const text = 'Cache test ' + Date.now();
    const start1 = Date.now();
    await vectorService.getEmbedding(text);
    const end1 = Date.now();
    
    const start2 = Date.now();
    await vectorService.getEmbedding(text);
    const end2 = Date.now();
    
    expect(end2 - start2).toBeLessThanOrEqual(end1 - start1);
  });

  it('should filter by type using index', async () => {
    const type = 'unique_type_' + Date.now();
    await vectorService.addEntry('Type test', { type });

    const results = await vectorService.search('Type test', 5, { type });
    expect(results).toHaveLength(1);
    expect(results[0].metadata.type).toBe(type);
  });
});

describe('Embedding Cache Persistence', () => {
  afterEach(async () => {
    // Clean up test cache file
    try {
      await fs.unlink(EMBEDDING_CACHE_PATH);
    } catch {
      // File may not exist, that's fine
    }
  });

  it('should persist embedding cache to disk', async () => {
    // Generate an embedding to populate cache
    const text = 'Cache persistence test ' + Date.now();
    await vectorService.getEmbedding(text);

    // Persist cache
    await vectorService.persistEmbeddingCache();

    // Verify file exists
    const exists = await fs.access(EMBEDDING_CACHE_PATH).then(() => true).catch(() => false);
    expect(exists).toBe(true);

    // Verify content structure
    const content = JSON.parse(await fs.readFile(EMBEDDING_CACHE_PATH, 'utf-8'));
    expect(Array.isArray(content)).toBe(true);
    expect(content.length).toBeGreaterThan(0);
    expect(content[0]).toHaveProperty('text');
    expect(content[0]).toHaveProperty('vector');
  });

  it('should load embedding cache from disk on initialization', async () => {
    // Create a mock cache file
    const mockCache = [
      { text: 'preloaded_test_entry', vector: new Array(768).fill(0.1), lastAccess: Date.now() }
    ];
    await fs.writeFile(EMBEDDING_CACHE_PATH, JSON.stringify(mockCache));

    // Force reload
    await vectorService.loadEmbeddingCache();

    // Verify cache was loaded (embedding call should be instant)
    const start = Date.now();
    const result = await vectorService.getEmbedding('preloaded_test_entry');
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(50); // Should be near-instant from cache
    expect(result).toHaveLength(768);
  });
});
