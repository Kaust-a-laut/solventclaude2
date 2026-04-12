// backend/src/services/previewStashStore.test.ts
import { describe, it, expect } from 'vitest';
import { PreviewStashStore } from './previewStashStore';

describe('PreviewStashStore', () => {
  it('stores and retrieves stash', () => {
    const store = new PreviewStashStore(1000, 10000);
    const stash = { entries: [], bodyHTML: null, bodyHash: null, updatedAt: 0 };
    store.set('session-1', stash);
    const result = store.get('session-1');
    expect(result).not.toBeNull();
    expect(result!.entries).toEqual([]);
    expect(result!.bodyHTML).toBeNull();
    expect(result!.bodyHash).toBeNull();
    expect(result!.updatedAt).toBeGreaterThan(0);
    store.destroy();
  });

  it('returns null for unknown session', () => {
    const store = new PreviewStashStore(1000, 10000);
    expect(store.get('unknown')).toBeNull();
    store.destroy();
  });

  it('returns null after TTL expires', async () => {
    const store = new PreviewStashStore(50, 10000);
    const stash = { entries: [], bodyHTML: null, bodyHash: null, updatedAt: 0 };
    store.set('session-1', stash);
    expect(store.get('session-1')).not.toBeNull();
    await new Promise((r) => setTimeout(r, 100));
    expect(store.get('session-1')).toBeNull();
    store.destroy();
  });

  it('prunes expired entries', async () => {
    const store = new PreviewStashStore(50, 50);
    const stash = { entries: [], bodyHTML: null, bodyHash: null, updatedAt: 0 };
    store.set('session-1', stash);
    store.set('session-2', stash);
    expect(store.get('session-1')).not.toBeNull();
    await new Promise((r) => setTimeout(r, 150));
    expect(store.get('session-1')).toBeNull();
    expect(store.get('session-2')).toBeNull();
    store.destroy();
  });
});
