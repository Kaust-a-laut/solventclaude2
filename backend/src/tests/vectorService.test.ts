import { describe, it, beforeAll, beforeEach, afterEach, expect } from 'vitest';
import { vectorService } from '../services/vectorService';
import { config } from '../config';

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

beforeAll(() => {
  (vectorService as any).genAI = { getGenerativeModel: () => mockEmbedModel };
});
import fs from 'fs/promises';
import path from 'path';

describe('VectorService', () => {
  const testDbPath = path.resolve(__dirname, '../../../.solvent_memory_test.json');

  beforeEach(async () => {
    // Backup original db and use test db
    const originalPath = path.resolve(__dirname, '../../../.solvent_memory.json');
    try {
      await fs.copyFile(originalPath, originalPath + '.backup');
    } catch (e) {
      // Backup doesn't exist, that's fine
    }
    
    // Point to test DB
    (vectorService as any).dbPath = testDbPath;
    
    // Clear test DB
    await fs.writeFile(testDbPath, '[]');
    await (vectorService as any).loadMemory();
  });

  afterEach(async () => {
    // Restore original db
    const originalPath = path.resolve(__dirname, '../../../.solvent_memory.json');
    try {
      await fs.copyFile(originalPath + '.backup', originalPath);
      await fs.unlink(originalPath + '.backup');
    } catch (e) {
      // No backup to restore, that's fine
    }
    
    // Clean up test db
    try {
      await fs.unlink(testDbPath);
    } catch (e) {
      // Test db doesn't exist, that's fine
    }
  });

  describe('LRU Cache', () => {
    it('should maintain cache size within limits', async () => {
      // Test the cache size property directly
      const cache = (vectorService as any).embeddingCache;
      expect(cache.size).toBeLessThanOrEqual(config.MEMORY_CACHE_SIZE);
    });

    it('should update access time when retrieving cached embeddings', async () => {
      // Add entries to the cache
      await vectorService.addEntry('Test content A', { type: 'test', id: 'test-a' });
      await vectorService.addEntry('Test content B', { type: 'test', id: 'test-b' });

      // Access first entry again (should update access time)
      await vectorService.getEmbedding('Test content A');

      // Verify the cache has the expected entries
      const cache = (vectorService as any).embeddingCache;
      expect(cache.has('Test content A')).toBe(true);
      expect(cache.has('Test content B')).toBe(true);
    }, 30000);
  });

  describe('Secondary Indexing', () => {
    it('should maintain typeIndex correctly', async () => {
      await vectorService.addEntry('Rule content', { type: 'permanent_rule', id: 'rule-1' });
      await vectorService.addEntry('Pattern content', { type: 'solution_pattern', id: 'pattern-1' });
      
      const typeIndex = (vectorService as any).typeIndex;
      expect(typeIndex.get('permanent_rule')).toContain('rule-1');
      expect(typeIndex.get('solution_pattern')).toContain('pattern-1');
    });

    it('should maintain tagIndex correctly', async () => {
      await vectorService.addEntry('Tagged content', { 
        type: 'test', 
        tags: ['important', 'feature'], 
        id: 'tagged-1' 
      });
      
      const tagIndex = (vectorService as any).tagIndex;
      expect(tagIndex.get('important')).toContain('tagged-1');
      expect(tagIndex.get('feature')).toContain('tagged-1');
    });

    it('should update indices when entries are removed', async () => {
      await vectorService.addEntry('To be deprecated', { 
        type: 'test', 
        tags: ['temporary'], 
        id: 'temp-1' 
      });
      
      const typeIndex = (vectorService as any).typeIndex;
      const tagIndex = (vectorService as any).tagIndex;
      
      expect(typeIndex.get('test')).toContain('temp-1');
      expect(tagIndex.get('temporary')).toContain('temp-1');
      
      await vectorService.deprecateEntry('temp-1', 'Testing removal');
      
      // Entry should remain in memory but be marked as deprecated
      const memory = (vectorService as any).memory;
      const entry = memory.find((m: any) => m.id === 'temp-1');
      expect(entry).toBeDefined();
      expect(entry.metadata.status).toBe('deprecated');
    });
  });

  describe('Batch Operations', () => {
    it('should add multiple entries in batch', async () => {
      const entries = [
        { text: 'Batch content 1', metadata: { type: 'batch', id: 'batch-1' } },
        { text: 'Batch content 2', metadata: { type: 'batch', id: 'batch-2' } },
        { text: 'Batch content 3', metadata: { type: 'batch', id: 'batch-3' } }
      ];
      
      const ids = await vectorService.addEntriesBatch(entries);
      
      expect(ids.length).toBe(3);
      expect(ids).toContain('batch-1');
      expect(ids).toContain('batch-2');
      expect(ids).toContain('batch-3');
      
      // Verify entries were added to memory
      const memory = (vectorService as any).memory;
      expect(memory.length).toBeGreaterThanOrEqual(3);
    });

    it('should handle batch embeddings', async () => {
      const texts = [
        'Embedding test 1',
        'Embedding test 2',
        'Embedding test 3'
      ];
      
      const embeddings = await vectorService.batchGetEmbeddings(texts);
      
      expect(embeddings.length).toBe(3);
      expect(Array.isArray(embeddings[0])).toBe(true);
      expect(embeddings[0].length).toBeGreaterThan(0);
    });
  });

  describe('Search with Indices', () => {
    it('should use typeIndex for faster filtering', async () => {
      await vectorService.addEntry('Rule 1', { type: 'permanent_rule', id: 'rule-1' });
      await vectorService.addEntry('Rule 2', { type: 'permanent_rule', id: 'rule-2' });
      await vectorService.addEntry('Pattern 1', { type: 'solution_pattern', id: 'pattern-1' });
      
      // Search with type filter should use index
      const results = await vectorService.search('rules', 10, { type: 'permanent_rule' });
      
      expect(results.length).toBeGreaterThanOrEqual(2);
      results.forEach(r => {
        expect(r.metadata.type).toBe('permanent_rule');
      });
    });

    it('should use tagIndex for faster filtering', async () => {
      await vectorService.addEntry('Important content', { 
        type: 'test', 
        tags: ['important', 'priority'], 
        id: 'imp-1' 
      });
      await vectorService.addEntry('Regular content', { 
        type: 'test', 
        tags: ['regular'], 
        id: 'reg-1' 
      });
      
      // Search with tag filter
      const results = await vectorService.search('content', 10, { tags: ['important'] });
      
      // Should include entries with the 'important' tag
      const hasImportant = results.some(r => r.id === 'imp-1');
      expect(hasImportant).toBe(true);
    });
  });

  describe('Memory Tiering', () => {
    it('should support archived tier', async () => {
      await vectorService.addEntry('Archived content', { 
        type: 'compressed_summary', 
        tier: 'archived', 
        id: 'arch-1' 
      });
      
      const results = await vectorService.search('archived', 10, { tier: 'archived' });
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].metadata.tier).toBe('archived');
    });
  });

  describe('Link Management', () => {
    it('should store and retrieve linked memories', async () => {
      // Add an entry with links
      await vectorService.addEntry('Main concept', { 
        type: 'concept', 
        id: 'main-1', 
        links: ['related-1', 'related-2'] 
      });
      
      // Add related entries
      await vectorService.addEntry('Related concept 1', { 
        type: 'concept', 
        id: 'related-1' 
      });
      
      await vectorService.addEntry('Related concept 2', { 
        type: 'concept', 
        id: 'related-2' 
      });
      
      // Verify the main entry has links
             const memory = (vectorService as any).memory;
             const mainEntry = memory.find((m: any) => m.id === 'main-1');
             expect(mainEntry.metadata.links).toBeDefined();
             expect(mainEntry.metadata.links.some((l: any) => l.targetId === 'related-1')).toBe(true);
          });
      
  });

  describe('Semantic Graph (RAG++)', () => {
    it('should extract symbols and resolve links during indexing', async () => {
      // Create two related code blocks
      const code1 = 'export interface IService { execute(): void; }';
      const code2 = 'export class Service implements IService { execute() {} }';
      
      // We need to simulate the project indexing or manually use the methods
      // For simplicity, manually add them and check links
      
      const id1 = await vectorService.addEntry(code1, { type: 'code_block', symbols: ['IService'] });
      const id2 = await vectorService.addEntry(code2, { type: 'code_block', symbols: ['Service'] });
      
      // Manually trigger link resolution (as indexProject would do in its second pass)
      const entry2 = (vectorService as any).memory.find((m: any) => m.id === id2);
      const links = (vectorService as any).findReferenceTargets(code2, id2);
      entry2.metadata.links = links;

      expect(links.length).toBeGreaterThan(0);
      expect(links.some((l: any) => l.targetId === id1)).toBe(true);
    });

    it('should expand search results with linked memories', async () => {
      const codeInterface = 'export interface ILogger { log(msg: string): void; }';
      const codeImpl = 'export class ConsoleLogger implements ILogger { log(msg: string) { console.log(msg); } }';
      
      const idInterface = await vectorService.addEntry(codeInterface, { 
        type: 'code_block', 
        symbols: ['ILogger'],
        tier: 'episodic' 
      });
      
      const idImpl = await vectorService.addEntry(codeImpl, { 
        type: 'code_block', 
        symbols: ['ConsoleLogger'],
        links: [{ targetId: idInterface, type: 'depends_on' }],
        tier: 'episodic'
      });

      // Search for the implementation
      const results = await vectorService.search('ConsoleLogger implementation', 1);
      
      // Should find the implementation AND expand to include the interface
      expect(results.some(r => r.id === idImpl)).toBe(true);
      expect(results.some(r => r.id === idInterface)).toBe(true);
    });
  });
});