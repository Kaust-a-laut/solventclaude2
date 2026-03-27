import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { HNSWIndex } from './hnswIndex';
import fs from 'fs/promises';
import path from 'path';

describe('HNSWIndex', () => {
  let index: HNSWIndex;
  const testIndexPath = path.resolve(__dirname, '../../../.solvent_test_hnsw.bin');

  beforeEach(() => {
    index = new HNSWIndex(768, 1000);
  });

  afterEach(async () => {
    await fs.rm(testIndexPath, { force: true });
    await fs.rm(`${testIndexPath}.meta.json`, { force: true });
  });

  it('should add vectors and search', async () => {
    const vector1 = new Array(768).fill(0.1);
    const vector2 = new Array(768).fill(0.2);
    const vector3 = new Array(768).fill(0.9);

    index.add('id1', vector1);
    index.add('id2', vector2);
    index.add('id3', vector3);

    // Search for something close to vector3
    const query = new Array(768).fill(0.85);
    const results = index.search(query, 2);

    expect(results.length).toBe(2);
    expect(results[0]!.id).toBe('id3'); // Closest match
  });

  it('should persist and reload index', async () => {
    const vector = new Array(768).fill(0.5);
    index.add('persist_test', vector);

    await index.save(testIndexPath);

    const newIndex = new HNSWIndex(768, 1000);
    await newIndex.load(testIndexPath);

    const query = new Array(768).fill(0.5);
    const results = newIndex.search(query, 1);

    expect(results.length).toBe(1);
    expect(results[0]!.id).toBe('persist_test');
  });

  it('should handle removal of vectors', () => {
    const vector = new Array(768).fill(0.3);
    index.add('to_remove', vector);

    const sizeBefore = index.size();
    index.markDeleted('to_remove');

    // Size stays same but search won't return it
    const query = new Array(768).fill(0.3);
    const results = index.search(query, 1);

    expect(results.find(r => r.id === 'to_remove')).toBeUndefined();
  });
});
