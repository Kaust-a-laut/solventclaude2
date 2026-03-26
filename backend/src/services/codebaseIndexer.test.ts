import { describe, it, expect } from 'vitest';
import { CodebaseIndexer } from './codebaseIndexer';

describe('CodebaseIndexer', () => {
  const indexer = new CodebaseIndexer();

  it('should generate consistent hashes', () => {
    const hash1 = (indexer as any).hashContent('test content');
    const hash2 = (indexer as any).hashContent('test content');
    expect(hash1).toBe(hash2);
  });

  it('should generate different hashes for different content', () => {
    const hash1 = (indexer as any).hashContent('test content 1');
    const hash2 = (indexer as any).hashContent('test content 2');
    expect(hash1).not.toBe(hash2);
  });

  it('should generate 16-character hex strings', () => {
    const hash = (indexer as any).hashContent('test');
    expect(hash).toHaveLength(16);
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });
});
