# Split Embedding Strategy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route embedding calls to the optimal provider — Gemini for latency-critical queries, Ollama for cost-critical batch indexing — and persist the embedding cache so startup never re-embeds.

**Architecture:** `getEmbedding()` (used by search/chat) tries Gemini first for sub-second responses, falls back to Ollama, then zero vector. `batchGetEmbeddings()` (used by project indexing) tries Ollama first for free unlimited throughput, falls back to Gemini, then zero vector. The existing `embeddingCache` Map already has dirty-flag persistence infrastructure, but `persistEmbeddingCache()` only writes dirty entries — losing clean entries on reload. Fix: persist ALL entries. Flush on shutdown.

**Tech Stack:** `@google/generative-ai` (Gemini), `ollama` (local), Node `fs/promises` for cache file

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `backend/src/services/vectorService.ts` | Modify | Flip `getEmbedding()` to Gemini-first; fix `persistEmbeddingCache()` to write all entries; add `source` tag to cached embeddings |
| `backend/src/services/ollamaService.ts` | No change | Already has `embed()` and `batchEmbed()` |
| `backend/src/server.ts` | Modify | Flush embedding cache on graceful shutdown |
| `backend/src/services/vectorService.test.ts` | Modify | Add test for cache persistence round-trip |

---

### Task 1: Flip `getEmbedding()` to Gemini-first

The single-text `getEmbedding()` is called during chat (3-4 times per message via `contextService.enrichContext()`). Gemini responds in <1s. Ollama on CPU takes 3-15s. Flip the order so queries are fast.

**Files:**
- Modify: `backend/src/services/vectorService.ts:450-499`

- [ ] **Step 1: Edit `getEmbedding()` — Gemini first, Ollama fallback**

Replace the current method body (lines 450-500) with:

```typescript
async getEmbedding(text: string): Promise<number[]> {
    await this.embeddingCacheLoaded; // Ensure cache is loaded
    if (!text || text.trim().length === 0) return new Array(768).fill(0);

    const cached = this.embeddingCache.get(text);
    if (cached?.vector) {
      cached.lastAccess = Date.now();
      memoryMetrics.recordCacheHit();
      return cached.vector;
    }

    // Handle case where cache entry exists but vector is missing
    if (cached) {
      this.embeddingCache.delete(text);
    }

    // Try Gemini first (fast API, <1s — ideal for latency-critical query path)
    if (!this.geminiEmbedFailed) {
      try {
        const genAI = this.getGenAI();
        const model = genAI.getGenerativeModel(
          { model: "gemini-embedding-001" },
        );
        const result = await model.embedContent(text);
        // gemini-embedding-001 outputs 3072 dims; truncate to 768 (Matryoshka embeddings)
        const values = result.embedding.values.slice(0, 768);

        memoryMetrics.recordCacheMiss();
        this.cacheEmbedding(text, values);
        return values;
      } catch (err: unknown) {
        this.geminiEmbedFailed = true;
        logger.warn('[VectorService] Gemini embedding failed (will skip future attempts), trying Ollama:', err instanceof Error ? err.message : String(err));
      }
    }

    // Fallback to Ollama (free, local, native 768 dims — slower on CPU)
    try {
      const values = await this.ollama!.embed(text);
      memoryMetrics.recordCacheMiss();
      this.cacheEmbedding(text, values);
      return values;
    } catch (err: unknown) {
      logger.warn('[VectorService] Ollama embedding also failed, using zero vector:', err instanceof Error ? err.message : String(err));
    }

    // Last resort: zero vector
    return new Array(768).fill(0);
  }
```

Key change: Gemini is tried first (fast for queries), Ollama is the fallback (reliable but slow).

- [ ] **Step 2: Verify `batchGetEmbeddings()` is still Ollama-first**

Confirm that `batchGetEmbeddings()` (line ~522) still tries Ollama batch first, then Gemini fallback. This method is used by the codebase indexer for bulk work — Ollama is correct here (free, no rate limits). **No code change needed** — just verify the order is: Ollama batch → Gemini batch → zero vectors.

- [ ] **Step 3: Run type check**

Run: `cd backend && npx tsc --noEmit`
Expected: Exit 0, no errors

- [ ] **Step 4: Commit**

```bash
git add backend/src/services/vectorService.ts
git commit -m "feat(embed): Gemini-first for queries, Ollama-first for batch indexing"
```

---

### Task 2: Fix embedding cache persistence to write ALL entries

The current `persistEmbeddingCache()` only writes dirty entries to disk. On reload, `loadEmbeddingCache()` reads whatever is on disk. This means clean entries from a previous persist are LOST after the next persist — because the new persist only writes the dirty subset, overwriting the full file.

**Files:**
- Modify: `backend/src/services/vectorService.ts:200-227`

- [ ] **Step 1: Fix `persistEmbeddingCache()` to write all entries**

Replace the method (lines 200-227) with:

```typescript
async persistEmbeddingCache() {
    try {
      const entries = Array.from(this.embeddingCache.entries())
        .map(([text, { vector, lastAccess }]) => ({
          text,
          vector,
          lastAccess
        }));

      if (entries.length === 0) {
        logger.debug('[VectorService] Embedding cache empty, nothing to persist.');
        return;
      }

      await AtomicFileSystem.writeJson(this.embeddingCachePath, entries);
      logger.info(`[VectorService] Persisted ${entries.length} embeddings to cache.`);

      // Mark all entries as clean after successful persist
      for (const [, entry] of this.embeddingCache.entries()) {
        entry.dirty = false;
      }
    } catch (error) {
      logger.error('[VectorService] Failed to persist embedding cache', error);
    }
  }
```

Key change: writes ALL cache entries, not just dirty ones. The dirty flag is still useful — Task 3 uses it to decide *whether* to persist (skip if nothing changed).

- [ ] **Step 2: Update `cacheEmbedding()` threshold check to use dirty count**

The periodic persist in `cacheEmbedding()` (line ~612) fires every 100 writes. This is fine but wasteful if nothing is dirty. Replace the threshold check (lines 612-617) with:

```typescript
    // Periodic persistence — only if there are dirty entries
    this.cacheWriteCounter++;
    if (this.cacheWriteCounter >= this.CACHE_PERSIST_THRESHOLD) {
      this.cacheWriteCounter = 0;
      const hasDirty = Array.from(this.embeddingCache.values()).some(e => e.dirty);
      if (hasDirty) {
        this.persistEmbeddingCache().catch(e => logger.error('[VectorService] Cache persist failed', e));
      }
    }
```

- [ ] **Step 3: Run type check**

Run: `cd backend && npx tsc --noEmit`
Expected: Exit 0

- [ ] **Step 4: Commit**

```bash
git add backend/src/services/vectorService.ts
git commit -m "fix(embed): persist full embedding cache, not just dirty entries"
```

---

### Task 3: Flush embedding cache on graceful shutdown

Currently the server shuts down without flushing. Any embeddings generated since the last periodic persist are lost.

**Files:**
- Modify: `backend/src/server.ts:376-396`

- [ ] **Step 1: Import vectorService in server.ts**

Check if `vectorService` is already imported. If not, add:

```typescript
import { vectorService } from './services/vectorService';
```

(It's likely already imported — grep for it first.)

- [ ] **Step 2: Add cache flush to `gracefulShutdown()`**

In the `gracefulShutdown()` function (line 377), add the embedding cache flush after the indexer stop. Replace the function body:

```typescript
async function gracefulShutdown(signal: string): Promise<void> {
  logger.info(`[Server] Received ${signal}, starting graceful shutdown...`);

  httpServer.close(() => {
    logger.info('[Server] HTTP server closed');
    process.exit(0);
  });

  try {
    await codebaseIndexer.stop();
    logger.info('[Server] Codebase indexer stopped');
  } catch (error) {
    logger.warn('[Server] Error stopping codebase indexer', error);
  }

  try {
    await vectorService.persistEmbeddingCache();
    logger.info('[Server] Embedding cache flushed');
  } catch (error) {
    logger.warn('[Server] Error flushing embedding cache', error);
  }

  setTimeout(() => {
    logger.warn('[Server] Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}
```

- [ ] **Step 3: Verify `persistEmbeddingCache` is exported**

Check that `persistEmbeddingCache` is a public method on `VectorService` (it is — it's `async persistEmbeddingCache()` with no `private` modifier). Also verify `vectorService` is the exported singleton instance.

- [ ] **Step 4: Run type check**

Run: `cd backend && npx tsc --noEmit`
Expected: Exit 0

- [ ] **Step 5: Commit**

```bash
git add backend/src/server.ts
git commit -m "feat(embed): flush embedding cache on graceful shutdown"
```

---

### Task 4: Test cache persistence round-trip

**Files:**
- Modify: `backend/src/services/vectorService.test.ts`

- [ ] **Step 1: Write test for cache persist and reload**

Add a test that:
1. Generates an embedding (or sets one manually)
2. Persists the cache
3. Clears the in-memory cache
4. Reloads from disk
5. Verifies the embedding is restored

```typescript
it('should persist and reload embedding cache from disk', async () => {
  // Manually inject a cached embedding
  const testVector = new Array(768).fill(0).map((_, i) => i / 768);
  (vectorService as any).embeddingCache.set('persist_test_text', {
    vector: testVector,
    lastAccess: Date.now(),
    dirty: true
  });

  // Persist to disk
  await vectorService.persistEmbeddingCache();

  // Clear in-memory cache
  (vectorService as any).embeddingCache.clear();
  expect((vectorService as any).embeddingCache.size).toBe(0);

  // Reload from disk
  await (vectorService as any).loadEmbeddingCache();

  // Verify round-trip
  const reloaded = (vectorService as any).embeddingCache.get('persist_test_text');
  expect(reloaded).toBeDefined();
  expect(reloaded.vector).toEqual(testVector);
  expect(reloaded.dirty).toBe(false); // Loaded entries should be clean

  // Clean up the test cache file
  const cachePath = (vectorService as any).embeddingCachePath;
  const fs = await import('fs/promises');
  await fs.unlink(cachePath).catch(() => {});
});
```

- [ ] **Step 2: Run the test**

Run: `cd backend && npx vitest run src/services/vectorService.test.ts`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add backend/src/services/vectorService.test.ts
git commit -m "test(embed): add cache persistence round-trip test"
```

---

### Task 5: Manual integration test

No code changes — verify the full flow works end-to-end.

- [ ] **Step 1: Delete stale cache files**

```bash
rm -f .solvent_embedding_cache.json .solvent_memory.json .solvent_hnsw.bin .solvent_hnsw.bin.meta.json
```

- [ ] **Step 2: Start backend, send a chat message**

Start the backend. Send a chat message through the UI. Check logs for:
- `[VectorService]` should show Gemini embedding calls (not Ollama) for query path
- Response should arrive quickly (no 3-15s embed delay)

- [ ] **Step 3: Graceful shutdown (Ctrl+C)**

Stop the server. Check logs for:
- `[Server] Embedding cache flushed`
- File `.solvent_embedding_cache.json` should exist with cached embeddings

- [ ] **Step 4: Restart and verify cache hit**

Start the backend again. Send the same chat message. Check logs for:
- `[VectorService] Loaded N cached embeddings from disk.`
- No new Gemini embed calls for the same query text (cache hit)

- [ ] **Step 5: Commit all remaining changes**

```bash
git add -A
git commit -m "feat(embed): split embedding strategy — Gemini queries, Ollama batch, persistent cache"
```

---

## Design Notes

### Mixed embedding spaces

Gemini (`gemini-embedding-001` truncated to 768) and Ollama (`nomic-embed-text` native 768) produce vectors in different semantic spaces. This means a query embedded by Gemini searching against documents embedded by Ollama will have degraded similarity scores compared to same-model pairs.

**Mitigation:** In practice this is acceptable because:
1. The hybrid retrieval system (vector search + BM25 keyword search + RRF fusion) provides redundancy — keyword search is model-agnostic
2. Chat queries search against whatever was indexed — if a project was indexed by Ollama, queries should ideally also use Ollama. But the latency tradeoff makes Gemini worth it for the query path
3. Zero vectors (the current state) are far worse than mixed-model vectors

**Future improvement:** Tag cached embeddings with their source model. When searching, prefer re-embedding the query with the same model that produced the index. This is out of scope for this plan.
