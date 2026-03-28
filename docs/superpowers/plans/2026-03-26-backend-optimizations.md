# Backend Optimizations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Five targeted backend improvements — BM25 incremental updates, plugin parallel init, provider concurrency limiter, Gemini/Ollama timeouts, and socket batcher wiring.

**Architecture:** Each optimization is independent and self-contained. No new abstractions or frameworks — just focused improvements to existing code. Each task produces a working, testable change.

**Tech Stack:** TypeScript, Vitest, Node.js EventEmitter, AbortSignal, Socket.io

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `backend/src/utils/bm25.ts` | Modify | Add `addDocument()` and `removeDocument()` methods |
| `backend/src/utils/bm25.test.ts` | Modify | Add tests for incremental operations |
| `backend/src/services/contextService.ts` | Modify | Use incremental BM25 updates instead of full rebuild |
| `backend/src/services/pluginManager.ts` | Modify | Parallelize plugin loading with `Promise.allSettled()` |
| `backend/src/services/providerSemaphore.ts` | Create | Simple semaphore for concurrent provider calls |
| `backend/src/services/providerSemaphore.test.ts` | Create | Tests for semaphore behavior |
| `backend/src/services/aiService.ts` | Modify | Wrap provider calls with semaphore |
| `backend/src/services/geminiService.ts` | Modify | Add timeout to all API calls |
| `backend/src/services/ollamaService.ts` | Modify | Add timeout to all API calls |
| `backend/src/server.ts` | Modify | Route more socket events through existing batcher |

---

### Task 1: BM25 Incremental Updates

**Files:**
- Modify: `backend/src/utils/bm25.ts:19-65`
- Modify: `backend/src/utils/bm25.test.ts`
- Modify: `backend/src/services/contextService.ts:108-122`

- [ ] **Step 1: Write failing tests for `addDocument()`**

Add to `backend/src/utils/bm25.test.ts` after the existing `build()` test block:

```typescript
describe('addDocument()', () => {
  it('should add a document to an existing index', () => {
    index.build([
      { id: 'doc1', text: 'the quick brown fox' },
    ]);
    index.addDocument({ id: 'doc2', text: 'the lazy brown dog' });

    expect(index.size).toBe(2);
    const results = index.search('dog', 5);
    expect(results[0]!.id).toBe('doc2');
  });

  it('should update scores after adding documents', () => {
    index.build([
      { id: 'doc1', text: 'machine learning algorithms' },
    ]);
    index.addDocument({ id: 'doc2', text: 'deep learning neural networks' });

    const results = index.search('learning', 5);
    expect(results).toHaveLength(2);
  });

  it('should handle adding to an empty index', () => {
    index.addDocument({ id: 'doc1', text: 'hello world' });
    expect(index.size).toBe(1);
    const results = index.search('hello', 5);
    expect(results).toHaveLength(1);
    expect(results[0]!.id).toBe('doc1');
  });

  it('should replace a document with the same id', () => {
    index.build([
      { id: 'doc1', text: 'old content about cats' },
    ]);
    index.addDocument({ id: 'doc1', text: 'new content about dogs' });
    expect(index.size).toBe(1);

    const catResults = index.search('cats', 5);
    expect(catResults).toHaveLength(0);

    const dogResults = index.search('dogs', 5);
    expect(dogResults).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx vitest run src/utils/bm25.test.ts -v`
Expected: FAIL — `index.addDocument is not a function`

- [ ] **Step 3: Implement `addDocument()` in bm25.ts**

Add after the `build()` method (after line 65) in `backend/src/utils/bm25.ts`:

```typescript
addDocument(doc: { id: string; text: string }): void {
  // If document already exists, remove it first
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx vitest run src/utils/bm25.test.ts -v`
Expected: All PASS

- [ ] **Step 5: Write failing tests for `removeDocument()`**

Add to `backend/src/utils/bm25.test.ts`:

```typescript
describe('removeDocument()', () => {
  it('should remove a document from the index', () => {
    index.build([
      { id: 'doc1', text: 'the quick brown fox' },
      { id: 'doc2', text: 'the lazy brown dog' },
    ]);
    index.removeDocument('doc1');

    expect(index.size).toBe(1);
    const results = index.search('fox', 5);
    expect(results).toHaveLength(0);
  });

  it('should clean up inverted index entries', () => {
    index.build([
      { id: 'doc1', text: 'unique term here' },
      { id: 'doc2', text: 'other words entirely' },
    ]);
    index.removeDocument('doc1');

    // 'unique' should no longer match anything
    const results = index.search('unique', 5);
    expect(results).toHaveLength(0);
  });

  it('should be a no-op for non-existent ids', () => {
    index.build([{ id: 'doc1', text: 'hello world' }]);
    index.removeDocument('nonexistent');
    expect(index.size).toBe(1);
  });
});
```

- [ ] **Step 6: Run tests to verify they fail**

Run: `cd backend && npx vitest run src/utils/bm25.test.ts -v`
Expected: FAIL — `index.removeDocument is not a function`

- [ ] **Step 7: Implement `removeDocument()` in bm25.ts**

Add after `addDocument()` in `backend/src/utils/bm25.ts`:

```typescript
removeDocument(id: string): void {
  const doc = this.docs.get(id);
  if (!doc) return;

  // Remove from inverted index
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
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `cd backend && npx vitest run src/utils/bm25.test.ts -v`
Expected: All PASS

- [ ] **Step 9: Update contextService to use incremental BM25**

Replace lines 108-122 in `backend/src/services/contextService.ts`:

**Old code:**
```typescript
// Shared BM25 index instance — rebuilt when vector memory changes
const bm25Index = new BM25Index();
let bm25LastBuildSize = 0;
```
(and the `ensureBM25Index()` function)

**New code:**
```typescript
// Shared BM25 index — incrementally updated as vector memory changes
const bm25Index = new BM25Index();
let bm25IndexedIds = new Set<string>();

function ensureBM25Index() {
  const allDocs = vectorService.getAllTexts();
  const currentIds = new Set(allDocs.map(d => d.id));

  // Remove deleted documents
  for (const id of bm25IndexedIds) {
    if (!currentIds.has(id)) {
      bm25Index.removeDocument(id);
      bm25IndexedIds.delete(id);
    }
  }

  // Add new documents
  for (const doc of allDocs) {
    if (!bm25IndexedIds.has(doc.id)) {
      bm25Index.addDocument(doc);
      bm25IndexedIds.add(doc.id);
    }
  }
}
```

- [ ] **Step 10: Run full backend type check and tests**

Run: `cd backend && npx tsc --noEmit && npx vitest run -v`
Expected: Zero type errors, all tests pass

- [ ] **Step 11: Commit**

```bash
git add backend/src/utils/bm25.ts backend/src/utils/bm25.test.ts backend/src/services/contextService.ts
git commit -m "feat: add incremental BM25 updates — addDocument/removeDocument instead of full rebuild"
```

---

### Task 2: Parallelize Plugin Initialization

**Files:**
- Modify: `backend/src/services/pluginManager.ts:51-57,59-98,100-139`

- [ ] **Step 1: Write the parallel `loadAllPlugins()` implementation**

Replace lines 51-57 in `backend/src/services/pluginManager.ts`:

**Old code:**
```typescript
private async loadAllPlugins(): Promise<void> {
  await this.loadProviderPlugins();
  await this.loadToolPlugins();
}
```

**New code:**
```typescript
private async loadAllPlugins(): Promise<void> {
  const [providerResults, toolResults] = await Promise.allSettled([
    this.loadProviderPlugins(),
    this.loadToolPlugins()
  ]);

  if (providerResults.status === 'rejected') {
    logger.error('[PluginManager] Provider plugin loading failed:', providerResults.reason);
  }
  if (toolResults.status === 'rejected') {
    logger.error('[PluginManager] Tool plugin loading failed:', toolResults.reason);
  }
}
```

- [ ] **Step 2: Parallelize individual plugin file loading within `loadProviderPlugins()`**

In `loadProviderPlugins()`, replace the sequential for-loop (the loop over plugin files) with parallel loading. Find the loop body that does `import(filePath)` + `registerProvider()` sequentially for each file and replace it with:

```typescript
await Promise.allSettled(
  pluginFiles.map(async (file) => {
    const filePath = path.join(providerDir, file);
    try {
      const module = await import(filePath);
      const PluginClass = module.default || module;

      if (typeof PluginClass === 'function') {
        const instance = new PluginClass();
        if (this.isValidProviderPlugin(instance)) {
          await this.registerProvider(instance);
        } else {
          logger.warn(`[PluginManager] Invalid provider plugin: ${file}`);
        }
      }
    } catch (err: unknown) {
      logger.error(`[PluginManager] Failed to load provider plugin ${file}:`, err instanceof Error ? err.message : String(err));
    }
  })
);
```

- [ ] **Step 3: Parallelize individual plugin file loading within `loadToolPlugins()`**

Same pattern — replace the sequential for-loop in `loadToolPlugins()` with:

```typescript
await Promise.allSettled(
  pluginFiles.map(async (file) => {
    const filePath = path.join(toolDir, file);
    try {
      const module = await import(filePath);
      const PluginClass = module.default || module;

      if (typeof PluginClass === 'function') {
        const instance = new PluginClass();
        if (this.isValidToolPlugin(instance)) {
          await this.registerTool(instance);
        } else {
          logger.warn(`[PluginManager] Invalid tool plugin: ${file}`);
        }
      }
    } catch (err: unknown) {
      logger.error(`[PluginManager] Failed to load tool plugin ${file}:`, err instanceof Error ? err.message : String(err));
    }
  })
);
```

- [ ] **Step 4: Run type check and tests**

Run: `cd backend && npx tsc --noEmit && npx vitest run -v`
Expected: Zero type errors, all tests pass

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/pluginManager.ts
git commit -m "perf: parallelize plugin initialization with Promise.allSettled"
```

---

### Task 3: Provider Concurrency Semaphore

**Files:**
- Create: `backend/src/services/providerSemaphore.ts`
- Create: `backend/src/services/providerSemaphore.test.ts`
- Modify: `backend/src/services/aiService.ts`

- [ ] **Step 1: Write failing tests for the semaphore**

Create `backend/src/services/providerSemaphore.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { ProviderSemaphore } from './providerSemaphore';

describe('ProviderSemaphore', () => {
  it('should allow up to maxConcurrent tasks', async () => {
    const sem = new ProviderSemaphore(2);
    let running = 0;
    let maxRunning = 0;

    const task = () => sem.run(async () => {
      running++;
      maxRunning = Math.max(maxRunning, running);
      await new Promise(r => setTimeout(r, 50));
      running--;
    });

    await Promise.all([task(), task(), task(), task()]);
    expect(maxRunning).toBe(2);
  });

  it('should return the task result', async () => {
    const sem = new ProviderSemaphore(1);
    const result = await sem.run(async () => 42);
    expect(result).toBe(42);
  });

  it('should propagate errors without leaking slots', async () => {
    const sem = new ProviderSemaphore(1);

    await expect(sem.run(async () => {
      throw new Error('boom');
    })).rejects.toThrow('boom');

    // Slot should be released — this should not hang
    const result = await sem.run(async () => 'ok');
    expect(result).toBe('ok');
  });

  it('should report pending count', async () => {
    const sem = new ProviderSemaphore(1);
    let resolve1!: () => void;
    const blocker = new Promise<void>(r => { resolve1 = r; });

    const p1 = sem.run(() => blocker);
    const p2Promise = sem.run(async () => 'queued');

    expect(sem.pending).toBe(1);
    resolve1();
    await p1;
    await p2Promise;
    expect(sem.pending).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx vitest run src/services/providerSemaphore.test.ts -v`
Expected: FAIL — cannot find module

- [ ] **Step 3: Implement the semaphore**

Create `backend/src/services/providerSemaphore.ts`:

```typescript
export class ProviderSemaphore {
  private running = 0;
  private queue: Array<() => void> = [];

  constructor(private readonly maxConcurrent: number) {}

  get pending(): number {
    return this.queue.length;
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.running < this.maxConcurrent) {
      this.running++;
      return Promise.resolve();
    }
    return new Promise<void>(resolve => this.queue.push(resolve));
  }

  private release(): void {
    const next = this.queue.shift();
    if (next) {
      next();
    } else {
      this.running--;
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx vitest run src/services/providerSemaphore.test.ts -v`
Expected: All PASS

- [ ] **Step 5: Wire semaphore into aiService.ts**

In `backend/src/services/aiService.ts`, add the import near the top:

```typescript
import { ProviderSemaphore } from './providerSemaphore';
```

Add the instance after the imports (module-level):

```typescript
const providerSemaphore = new ProviderSemaphore(
  parseInt(process.env.MAX_CONCURRENT_PROVIDER_CALLS || '5', 10)
);
```

Then wrap the main provider call sites. Find `selectedProvider.complete()` calls (lines ~214, ~377) and wrap each one. For example, change:

```typescript
const response = await selectedProvider.complete(messages, options);
```

to:

```typescript
const response = await providerSemaphore.run(() =>
  selectedProvider.complete(messages, options)
);
```

Apply the same pattern to the fallback calls (~lines 466, 476, 485) and `compareModels()` (~line 571). For `compareModels()`, the `Promise.allSettled` calls are already parallel — just wrap each individual `provider.complete()` inside `providerSemaphore.run()`.

- [ ] **Step 6: Run type check and tests**

Run: `cd backend && npx tsc --noEmit && npx vitest run -v`
Expected: Zero type errors, all tests pass

- [ ] **Step 7: Commit**

```bash
git add backend/src/services/providerSemaphore.ts backend/src/services/providerSemaphore.test.ts backend/src/services/aiService.ts
git commit -m "feat: add provider concurrency semaphore (default 5 concurrent calls)"
```

---

### Task 4: Gemini and Ollama Timeouts

**Files:**
- Modify: `backend/src/services/geminiService.ts:29-157`
- Modify: `backend/src/services/ollamaService.ts:11-69`

- [ ] **Step 1: Add timeout helper to geminiService.ts**

At the top of `backend/src/services/geminiService.ts`, after the imports, add:

```typescript
const GEMINI_TIMEOUT_MS = parseInt(process.env.GEMINI_TIMEOUT_MS || '60000', 10);

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      val => { clearTimeout(timer); resolve(val); },
      err => { clearTimeout(timer); reject(err); }
    );
  });
}
```

- [ ] **Step 2: Wrap all Gemini API calls with timeout**

In `generateChatCompletion()` (~line 53), change:

```typescript
const result = await chat.sendMessage(lastMessage);
```

to:

```typescript
const result = await withTimeout(chat.sendMessage(lastMessage), GEMINI_TIMEOUT_MS, 'Gemini chat');
```

Apply the same pattern to:
- `generateChatStream()` (~line 115): `withTimeout(chat.sendMessageStream(lastMessage), GEMINI_TIMEOUT_MS, 'Gemini stream')`
- `generateVisionContent()` (~line 132): `withTimeout(model.generateContent(parts), GEMINI_TIMEOUT_MS, 'Gemini vision')`
- `generateImage()` (~line 143): `withTimeout(model.generateContent(...), GEMINI_TIMEOUT_MS, 'Gemini image')`
- Recursive tool call in `generateChatCompletion()` (~line 85): `withTimeout(chat.sendMessage(toolResults), GEMINI_TIMEOUT_MS, 'Gemini tool response')`

- [ ] **Step 3: Add timeout to ollamaService.ts**

At the top of `backend/src/services/ollamaService.ts`, after imports, add:

```typescript
const OLLAMA_TIMEOUT_MS = parseInt(process.env.OLLAMA_TIMEOUT_MS || '120000', 10);

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      val => { clearTimeout(timer); resolve(val); },
      err => { clearTimeout(timer); reject(err); }
    );
  });
}
```

Wrap the API calls:
- `generateChatCompletion()` (~line 14): `withTimeout(ollama.chat({...}), OLLAMA_TIMEOUT_MS, 'Ollama chat')`
- `generateChatStream()` (~line 33): `withTimeout(ollama.chat({..., stream: true}), OLLAMA_TIMEOUT_MS, 'Ollama stream')`
- `embed()` (~line 54): `withTimeout(ollama.embed({...}), OLLAMA_TIMEOUT_MS, 'Ollama embed')`

- [ ] **Step 4: Run type check and tests**

Run: `cd backend && npx tsc --noEmit && npx vitest run -v`
Expected: Zero type errors, all tests pass

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/geminiService.ts backend/src/services/ollamaService.ts
git commit -m "feat: add configurable timeouts to Gemini (60s) and Ollama (120s) API calls"
```

---

### Task 5: Wire Up Socket Batcher

**Files:**
- Modify: `backend/src/server.ts:158-181`

- [ ] **Step 1: Identify socket events to batch**

In `backend/src/server.ts`, the batcher is already instantiated at line 158:
```typescript
const batcher = new SocketBatcher(io, 100);
```

Currently only `MISSION_PROGRESS` uses `batcher.emit()` (line 166). The `MISSION_COMPLETE` and `MISSION_FAILED` events use direct `io.emit()`.

Additionally, check for `appEventBus` listeners that emit socket events. Search for any `io.emit` calls that should be batched.

- [ ] **Step 2: Route high-frequency events through batcher**

In `backend/src/server.ts`, find all `io.emit()` calls that are high-frequency (progress updates, streaming tokens) and route them through the batcher. Keep low-frequency critical events (errors, completion, failure) as direct `io.emit()`.

Change any streaming/progress `io.emit()` calls to `batcher.emit()`. For example, if there are `supervisor:emit-event` handlers on the appEventBus that emit progress events:

```typescript
appEventBus.on('supervisor:emit-event', ({ event, data }) => {
  if (event.includes('PROGRESS') || event.includes('STREAM')) {
    batcher.emit(event, data);
  } else {
    io.emit(event, data);
  }
});
```

Keep `MISSION_COMPLETE` and `MISSION_FAILED` as direct `io.emit()` — these are one-shot events that must arrive immediately.

- [ ] **Step 3: Run type check and tests**

Run: `cd backend && npx tsc --noEmit && npx vitest run -v`
Expected: Zero type errors, all tests pass

- [ ] **Step 4: Commit**

```bash
git add backend/src/server.ts
git commit -m "perf: route high-frequency socket events through batcher (100ms window)"
```

---

## Final Verification

- [ ] **Run full type check:** `cd backend && npx tsc --noEmit`
- [ ] **Run full test suite:** `cd backend && npx vitest run -v`
- [ ] **Run frontend type check:** `cd frontend && npx tsc --noEmit`
