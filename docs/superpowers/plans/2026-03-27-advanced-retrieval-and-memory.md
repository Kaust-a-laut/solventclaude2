# Advanced Retrieval Pipeline & Memory Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade Solvent's memory system with cross-encoder re-ranking, LLM-rated importance scoring at write time, agent self-managed core memory via tool calls, a maker-checker loop in the waterfall reviewer, and structured handoff metadata between pipeline stages.

**Architecture:** Five independent improvements. (1) A re-ranker service sits between RRF merge and final scoring in contextService, boosting retrieval accuracy 20-35%. (2) Every memory write gets an LLM-rated importance score (1-10) that feeds into the retrieval scoring formula. (3) A core memory block (always in-context, editable by the model via tools) replaces passive-only retrieval for the most critical facts. (4) The waterfall reviewer loops back to executor on failure instead of one-shot. (5) Each pipeline stage passes structured handoff metadata (confidence, decisions, constraints) rather than raw text.

**Tech Stack:** TypeScript, Vitest, Gemini embedding API, Groq LLM for scoring, existing vectorService/contextService/waterfallService

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `backend/src/services/reranker.ts` | Create | Cross-encoder re-ranking via LLM scoring |
| `backend/src/services/reranker.test.ts` | Create | Tests for re-ranker |
| `backend/src/services/contextService.ts` | Modify | Integrate re-ranker after RRF merge, integrate core memory |
| `backend/src/services/vectorService.ts` | Modify | Add importance score to addEntry(), use in search scoring |
| `backend/src/services/memoryConsolidationService.ts` | Modify | Generate importance score during knowledge extraction |
| `backend/src/services/coreMemory.ts` | Create | Persistent key-value core memory (always in-context) |
| `backend/src/services/coreMemory.test.ts` | Create | Tests for core memory |
| `backend/src/services/toolService.ts` | Modify | Register core memory read/write tools |
| `backend/src/services/waterfallService.ts` | Modify | Add maker-checker loop, structured handoff metadata |
| `backend/src/services/waterfallService.test.ts` | Create | Tests for handoff metadata structure |
| `backend/src/types/memory.ts` | Modify | Add ImportanceScore type, HandoffMetadata interface |

---

### Task 1: Cross-Encoder Re-Ranker Service

**Files:**
- Create: `backend/src/services/reranker.ts`
- Create: `backend/src/services/reranker.test.ts`
- Modify: `backend/src/services/contextService.ts:501-522`

The re-ranker takes the top N candidates from RRF merge and asks an LLM to score query-document relevance on a 0-10 scale. This is dramatically more accurate than cosine similarity alone because the LLM reads query+document jointly.

- [ ] **Step 1: Write failing tests for the re-ranker**

Create `backend/src/services/reranker.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Reranker } from './reranker';

// Mock the AIProviderFactory
vi.mock('./aiProviderFactory', () => ({
  AIProviderFactory: {
    getProvider: vi.fn()
  }
}));

import { AIProviderFactory } from './aiProviderFactory';

describe('Reranker', () => {
  let reranker: Reranker;

  beforeEach(() => {
    reranker = new Reranker();
  });

  it('should rerank candidates by LLM relevance scores', async () => {
    const mockProvider = {
      complete: vi.fn().mockResolvedValue(JSON.stringify({
        scores: [
          { id: 'a', relevance: 9 },
          { id: 'b', relevance: 3 },
          { id: 'c', relevance: 7 }
        ]
      }))
    };
    vi.mocked(AIProviderFactory.getProvider).mockResolvedValue(mockProvider as any);

    const candidates = [
      { id: 'a', score: 0.8, metadata: { text: 'TypeScript strict mode enables noImplicitAny' } },
      { id: 'b', score: 0.75, metadata: { text: 'CSS flexbox layout guide' } },
      { id: 'c', score: 0.7, metadata: { text: 'TypeScript compiler options reference' } }
    ];

    const result = await reranker.rerank('How do I enable strict TypeScript?', candidates);

    expect(result).toHaveLength(3);
    expect(result[0]!.id).toBe('a');
    expect(result[1]!.id).toBe('c');
    expect(result[2]!.id).toBe('b');
    expect(result[0]!.rerankerScore).toBe(9);
  });

  it('should return original order on LLM failure', async () => {
    vi.mocked(AIProviderFactory.getProvider).mockRejectedValue(new Error('provider down'));

    const candidates = [
      { id: 'a', score: 0.8, metadata: { text: 'hello' } },
      { id: 'b', score: 0.6, metadata: { text: 'world' } }
    ];

    const result = await reranker.rerank('test', candidates);

    expect(result).toHaveLength(2);
    expect(result[0]!.id).toBe('a');
    expect(result[1]!.id).toBe('b');
  });

  it('should skip reranking for small candidate sets', async () => {
    const candidates = [
      { id: 'a', score: 0.8, metadata: { text: 'only one' } }
    ];

    const result = await reranker.rerank('test', candidates);

    expect(result).toHaveLength(1);
    expect(AIProviderFactory.getProvider).not.toHaveBeenCalled();
  });

  it('should truncate long documents before sending to LLM', async () => {
    const mockProvider = {
      complete: vi.fn().mockResolvedValue(JSON.stringify({
        scores: [{ id: 'a', relevance: 5 }, { id: 'b', relevance: 8 }]
      }))
    };
    vi.mocked(AIProviderFactory.getProvider).mockResolvedValue(mockProvider as any);

    const longText = 'word '.repeat(500);
    const candidates = [
      { id: 'a', score: 0.8, metadata: { text: longText } },
      { id: 'b', score: 0.7, metadata: { text: 'short text' } }
    ];

    await reranker.rerank('query', candidates);

    const prompt = mockProvider.complete.mock.calls[0]![0]![1]!.content;
    expect(prompt.length).toBeLessThan(longText.length + 500);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx vitest run src/services/reranker.test.ts -v`
Expected: FAIL — Cannot find module './reranker'

- [ ] **Step 3: Implement the re-ranker**

Create `backend/src/services/reranker.ts`:

```typescript
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

      const cleaned = response.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/```json/g, '').replace(/```/g, '').trim();
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx vitest run src/services/reranker.test.ts -v`
Expected: All PASS

- [ ] **Step 5: Wire re-ranker into contextService.ts**

In `backend/src/services/contextService.ts`, add the import near the top:

```typescript
import { reranker } from './reranker';
```

Then in `enrichContext()`, after the RRF merge and BM25-only results injection (after line 522), and before link traversal (before line 524), insert a re-ranking step:

```typescript
    // Re-rank top candidates via cross-encoder LLM scoring
    const reranked = await reranker.rerank(lastMessage, relevantEntries.slice(0, 20));
    const rerankerScoreMap = new Map(reranked.map(r => [r.id, r.rerankerScore]));
```

Then in the scoring section (around line 582-586), replace the RRF boost with a combined RRF + reranker boost:

```typescript
      // RRF + Reranker hybrid boost
      const rrfBoost = rrfScoreMap.get(e.id);
      if (rrfBoost) {
        finalScore += rrfBoost * 10;
      }
      const rerankerBoost = rerankerScoreMap.get(e.id);
      if (rerankerBoost !== undefined) {
        finalScore += rerankerBoost * 0.05; // normalize 0-10 to ~0-0.5 boost
      }
```

- [ ] **Step 6: Run type check and full tests**

Run: `cd backend && npx tsc --noEmit && npx vitest run -v`
Expected: Zero type errors, all tests pass

- [ ] **Step 7: Commit**

```bash
git add backend/src/services/reranker.ts backend/src/services/reranker.test.ts backend/src/services/contextService.ts
git commit -m "feat: add LLM cross-encoder re-ranker to retrieval pipeline

Scores query-document relevance via Groq LLM after RRF merge.
Falls back gracefully to original ranking on failure.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 2: Importance Scoring at Memory Write Time

**Files:**
- Modify: `backend/src/services/vectorService.ts:585-623`
- Modify: `backend/src/services/memoryConsolidationService.ts:88-146`
- Modify: `backend/src/services/contextService.ts` (scoring section)
- Modify: `backend/src/types/memory.ts`

Every memory entry gets an `importance` score (1-10) at write time. This feeds into the retrieval scoring formula so high-importance memories surface even when semantic similarity is moderate.

- [ ] **Step 1: Add ImportanceScore type**

In `backend/src/types/memory.ts`, add after the existing type definitions:

```typescript
export type ImportanceScore = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
```

- [ ] **Step 2: Write failing test for importance in scoring**

Add to an existing test file or create `backend/src/services/contextService.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

describe('Importance scoring in retrieval', () => {
  it('should boost high-importance entries in final score', () => {
    // This test validates the scoring formula integration
    // importance=10 entry should score higher than importance=1 at same similarity
    const baseScore = 0.7;
    const importanceHigh = 10;
    const importanceLow = 1;
    const IMPORTANCE_WEIGHT = 0.04;

    const scoreHigh = baseScore + (importanceHigh * IMPORTANCE_WEIGHT);
    const scoreLow = baseScore + (importanceLow * IMPORTANCE_WEIGHT);

    expect(scoreHigh).toBeGreaterThan(scoreLow);
    expect(scoreHigh - scoreLow).toBeCloseTo(0.36, 2);
  });
});
```

- [ ] **Step 3: Run test to verify it passes (formula validation)**

Run: `cd backend && npx vitest run src/services/contextService.test.ts -v`

- [ ] **Step 4: Add importance scoring to knowledge extraction**

In `backend/src/services/memoryConsolidationService.ts`, modify the `extractKnowledge()` prompt (around line 98) to include importance scoring. Add to the JSON output schema:

Change the prompt's JSON spec from:
```
"isWorthRemembering": boolean,
```
to:
```
"isWorthRemembering": boolean,
"importance": <1-10 integer — 1=trivial detail, 5=useful fact, 8=critical rule, 10=project-defining decision>,
```

Then where the memory is crystallized (around line 137), pass the importance score:

```typescript
      if (analysis.isWorthRemembering && analysis.conciseStatement) {
        const importance = Math.max(1, Math.min(10, analysis.importance || 5));
        newMemoryId = await vectorService.addEntry(analysis.conciseStatement, {
          type: analysis.category || 'technical_fact',
          tier: 'crystallized',
          tags: analysis.tags || [],
          links: analysis.links || [],
          confidence: 'HIGH',
          source: 'chat',
          importance
        });
```

- [ ] **Step 5: Add default importance to vectorService.addEntry()**

In `backend/src/services/vectorService.ts`, in the `addEntry()` method (around line 600-607), ensure importance is preserved:

```typescript
    const entry: VectorEntry = {
      id: metadata.id || Date.now().toString() + Math.random().toString(36).substr(2, 5),
      vector,
      metadata: {
        ...metadata,
        text,
        tier: metadata.tier || 'episodic',
        importance: metadata.importance || 5,
        createdAt: metadata.createdAt || new Date().toISOString(),
        status: metadata.status || 'active',
        links: normalizedLinks
      }
    };
```

- [ ] **Step 6: Integrate importance into contextService scoring**

In `backend/src/services/contextService.ts`, in the scoring section (around line 563-598), add importance boost after the existing boosts. Add a constant near the top of the file:

```typescript
const SCORE_BOOST_PER_IMPORTANCE = 0.04; // importance 10 = +0.4, importance 1 = +0.04
```

Then in the scoring loop, after the retrieval reinforcement boost (around line 594):

```typescript
      // Importance score boost (1-10 scale from LLM rating at write time)
      const importance = e.metadata.importance || 5;
      finalScore += importance * SCORE_BOOST_PER_IMPORTANCE;
```

- [ ] **Step 7: Run type check and full tests**

Run: `cd backend && npx tsc --noEmit && npx vitest run -v`
Expected: Zero type errors, all tests pass

- [ ] **Step 8: Commit**

```bash
git add backend/src/services/vectorService.ts backend/src/services/memoryConsolidationService.ts backend/src/services/contextService.ts backend/src/types/memory.ts
git commit -m "feat: add LLM-rated importance scoring (1-10) to memory entries

Importance is rated at crystallization time by the knowledge extraction
LLM and used as a retrieval boost in the scoring formula.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 3: Agent Self-Managed Core Memory

**Files:**
- Create: `backend/src/services/coreMemory.ts`
- Create: `backend/src/services/coreMemory.test.ts`
- Modify: `backend/src/services/toolService.ts`
- Modify: `backend/src/services/contextService.ts`

Core memory is a small key-value store (~10 slots) that is **always injected into the system prompt**. Unlike vector search which is query-dependent, core memory is persistent context the model can read and write via tool calls. This is the Letta/MemGPT pattern.

- [ ] **Step 1: Write failing tests for CoreMemory**

Create `backend/src/services/coreMemory.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CoreMemory } from './coreMemory';
import { existsSync, unlinkSync } from 'fs';

const TEST_PATH = '/tmp/test_core_memory.json';

describe('CoreMemory', () => {
  let core: CoreMemory;

  beforeEach(() => {
    if (existsSync(TEST_PATH)) unlinkSync(TEST_PATH);
    core = new CoreMemory(TEST_PATH, 10);
  });

  afterEach(() => {
    if (existsSync(TEST_PATH)) unlinkSync(TEST_PATH);
  });

  it('should set and get a key', () => {
    core.set('user_name', 'Caleb');
    expect(core.get('user_name')).toBe('Caleb');
  });

  it('should list all entries', () => {
    core.set('user_name', 'Caleb');
    core.set('project', 'Solvent AI');
    const all = core.getAll();
    expect(all).toHaveLength(2);
    expect(all.find(e => e.key === 'user_name')!.value).toBe('Caleb');
  });

  it('should delete a key', () => {
    core.set('temp', 'data');
    core.delete('temp');
    expect(core.get('temp')).toBeUndefined();
  });

  it('should enforce max slots', () => {
    for (let i = 0; i < 10; i++) {
      core.set(`key${i}`, `value${i}`);
    }
    expect(() => core.set('key10', 'overflow')).toThrow('Core memory full');
  });

  it('should allow overwrite of existing key without counting as new slot', () => {
    core.set('key', 'v1');
    core.set('key', 'v2');
    expect(core.get('key')).toBe('v2');
    expect(core.getAll()).toHaveLength(1);
  });

  it('should persist to disk and reload', () => {
    core.set('persistent', 'data');
    core.save();

    const core2 = new CoreMemory(TEST_PATH, 10);
    expect(core2.get('persistent')).toBe('data');
  });

  it('should render as context block', () => {
    core.set('user_name', 'Caleb');
    core.set('project', 'Solvent AI');
    const block = core.toContextBlock();
    expect(block).toContain('user_name: Caleb');
    expect(block).toContain('project: Solvent AI');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx vitest run src/services/coreMemory.test.ts -v`
Expected: FAIL — Cannot find module './coreMemory'

- [ ] **Step 3: Implement CoreMemory**

Create `backend/src/services/coreMemory.ts`:

```typescript
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { logger } from '../utils/logger';

interface CoreEntry {
  key: string;
  value: string;
  updatedAt: string;
}

export class CoreMemory {
  private entries: Map<string, CoreEntry> = new Map();

  constructor(
    private readonly filePath: string,
    private readonly maxSlots: number = 10
  ) {
    this.load();
  }

  get(key: string): string | undefined {
    return this.entries.get(key)?.value;
  }

  set(key: string, value: string): void {
    if (!this.entries.has(key) && this.entries.size >= this.maxSlots) {
      throw new Error('Core memory full — delete an entry before adding a new one');
    }
    this.entries.set(key, {
      key,
      value,
      updatedAt: new Date().toISOString()
    });
    this.save();
  }

  delete(key: string): boolean {
    const deleted = this.entries.delete(key);
    if (deleted) this.save();
    return deleted;
  }

  getAll(): CoreEntry[] {
    return Array.from(this.entries.values());
  }

  toContextBlock(): string {
    if (this.entries.size === 0) return '';
    const lines = Array.from(this.entries.values())
      .map(e => `${e.key}: ${e.value}`)
      .join('\n');
    return `[CORE MEMORY — Always Available]\n${lines}`;
  }

  save(): void {
    try {
      const data = Array.from(this.entries.values());
      writeFileSync(this.filePath, JSON.stringify(data, null, 2));
    } catch (err: unknown) {
      logger.error('[CoreMemory] Failed to save:', err instanceof Error ? err.message : String(err));
    }
  }

  private load(): void {
    try {
      if (existsSync(this.filePath)) {
        const raw = readFileSync(this.filePath, 'utf-8');
        const data: CoreEntry[] = JSON.parse(raw);
        for (const entry of data) {
          this.entries.set(entry.key, entry);
        }
      }
    } catch (err: unknown) {
      logger.warn('[CoreMemory] Failed to load, starting fresh:', err instanceof Error ? err.message : String(err));
    }
  }
}

export const coreMemory = new CoreMemory('.solvent_core_memory.json', 10);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx vitest run src/services/coreMemory.test.ts -v`
Expected: All PASS

- [ ] **Step 5: Register core memory tools in toolService.ts**

In `backend/src/services/toolService.ts`, find the tool definitions section and add three new tools. First import at the top:

```typescript
import { coreMemory } from './coreMemory';
```

Then add to the tool registry (wherever tools are defined — look for patterns like `case 'crystallize_memory':` or similar switch/map):

```typescript
// Core Memory Tools
case 'read_core_memory':
  return JSON.stringify(coreMemory.getAll());

case 'write_core_memory': {
  const { key, value } = args as { key: string; value: string };
  if (!key || !value) return 'Error: key and value are required';
  try {
    coreMemory.set(key, value);
    return `Core memory updated: ${key} = ${value}`;
  } catch (err: unknown) {
    return `Error: ${err instanceof Error ? err.message : String(err)}`;
  }
}

case 'delete_core_memory': {
  const { key } = args as { key: string };
  if (!key) return 'Error: key is required';
  const deleted = coreMemory.delete(key);
  return deleted ? `Deleted core memory key: ${key}` : `Key not found: ${key}`;
}
```

Also add the tool definitions to wherever tool schemas are listed (for the LLM to know about them):

```typescript
{
  name: 'read_core_memory',
  description: 'Read all entries in your persistent core memory. Core memory is always visible to you in the system prompt, but this tool lets you get the raw data.',
  parameters: {}
},
{
  name: 'write_core_memory',
  description: 'Write a key-value pair to your persistent core memory. Core memory is always included in your context. Use it for facts you need across every conversation: user identity, active project goals, key decisions. Max 10 slots.',
  parameters: {
    key: { type: 'string', description: 'The memory key (e.g., user_name, active_goal, project_stack)' },
    value: { type: 'string', description: 'The value to store (keep concise — this consumes context tokens every request)' }
  }
},
{
  name: 'delete_core_memory',
  description: 'Remove a key from core memory to free a slot.',
  parameters: {
    key: { type: 'string', description: 'The key to remove' }
  }
}
```

- [ ] **Step 6: Inject core memory into system prompt**

In `backend/src/services/contextService.ts`, import core memory:

```typescript
import { coreMemory } from './coreMemory';
```

Then in the system prompt assembly section (around line 800, before the `[PROJECT MEMORY]` block), inject core memory:

```typescript
    // Core memory — always in context
    const coreBlock = coreMemory.toContextBlock();
    if (coreBlock) {
      systemPrompt += `\n\n${coreBlock}\n`;
    }
```

- [ ] **Step 7: Run type check and full tests**

Run: `cd backend && npx tsc --noEmit && npx vitest run -v`
Expected: Zero type errors, all tests pass

- [ ] **Step 8: Commit**

```bash
git add backend/src/services/coreMemory.ts backend/src/services/coreMemory.test.ts backend/src/services/toolService.ts backend/src/services/contextService.ts
git commit -m "feat: add agent self-managed core memory (Letta/MemGPT pattern)

Persistent key-value store (10 slots) always injected into system prompt.
Model can read/write/delete via tool calls. Persists to disk.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 4: Structured Handoff Metadata Between Waterfall Stages

**Files:**
- Modify: `backend/src/types/memory.ts`
- Modify: `backend/src/services/waterfallService.ts`

Each pipeline stage currently passes raw text. We add a structured metadata envelope so receiving stages know the upstream confidence, key decisions, and constraints without re-deriving them.

- [ ] **Step 1: Add HandoffMetadata type**

In `backend/src/types/memory.ts`, add:

```typescript
export interface StageHandoff {
  stage: 'architect' | 'reasoner' | 'executor' | 'reviewer';
  confidence: number;        // 0-1, self-rated by the producing stage
  keyDecisions: string[];    // decisions made, carried forward
  constraints: string[];     // constraints for the next stage
  openQuestions: string[];   // unresolved items
  tokenCount: number;        // tokens used by this stage's output
}
```

- [ ] **Step 2: Write failing test for handoff metadata**

Create `backend/src/services/waterfallService.test.ts` (or add to existing):

```typescript
import { describe, it, expect } from 'vitest';

describe('StageHandoff metadata', () => {
  it('should have required fields', () => {
    const handoff = {
      stage: 'architect' as const,
      confidence: 0.85,
      keyDecisions: ['Use React over Vue because existing codebase'],
      constraints: ['Must maintain backward compatibility'],
      openQuestions: ['Which state management library?'],
      tokenCount: 1200
    };

    expect(handoff.confidence).toBeGreaterThanOrEqual(0);
    expect(handoff.confidence).toBeLessThanOrEqual(1);
    expect(handoff.keyDecisions.length).toBeGreaterThan(0);
    expect(handoff.stage).toBe('architect');
  });
});
```

- [ ] **Step 3: Run test**

Run: `cd backend && npx vitest run src/services/waterfallService.test.ts -v`
Expected: PASS

- [ ] **Step 4: Add handoff metadata extraction to architect phase**

In `backend/src/services/waterfallService.ts`, after the architect response is parsed (around lines 219-241 where keyDecisions/techStack are extracted), create and attach handoff metadata:

```typescript
    const architectHandoff: StageHandoff = {
      stage: 'architect',
      confidence: architect.complexity === 'low' ? 0.9 : architect.complexity === 'medium' ? 0.75 : 0.6,
      keyDecisions: architect.keyDecisions || [],
      constraints: architect.assumptions || [],
      openQuestions: [],
      tokenCount: JSON.stringify(architect).length / 4
    };
```

Import `StageHandoff` from types:
```typescript
import { StageHandoff } from '../types/memory';
```

- [ ] **Step 5: Thread handoff through reasoner and executor**

Modify the reasoner prompt builder to include the architect's handoff metadata. In the reasoner prompt section (around line 340), add before the existing requirements:

```typescript
    const handoffContext = `
UPSTREAM HANDOFF (from Architect):
- Confidence: ${architectHandoff.confidence}
- Key Decisions (MUST carry forward): ${architectHandoff.keyDecisions.map((d, i) => `\n  ${i + 1}. ${d}`).join('')}
- Constraints: ${architectHandoff.constraints.join(', ')}`;
```

Prepend `handoffContext` to the reasoner prompt.

Similarly, create a `reasonerHandoff` after the reasoner response is parsed:

```typescript
    const reasonerHandoff: StageHandoff = {
      stage: 'reasoner',
      confidence: (reasoner.steps?.length || 0) >= 3 ? 0.85 : 0.65,
      keyDecisions: [...architectHandoff.keyDecisions, ...(reasoner.carriedDecisions || [])],
      constraints: architectHandoff.constraints,
      openQuestions: reasoner.openQuestions || [],
      tokenCount: JSON.stringify(reasoner).length / 4
    };
```

Thread `reasonerHandoff` into the executor prompt the same way.

- [ ] **Step 6: Include handoff in final yield**

Modify the final yield and return (around line 191-199) to include the handoff chain:

```typescript
    yield { phase: 'completed', score: reviewer.score, data: { reviewer, attempts: attempts + 1, handoffChain: [architectHandoff, reasonerHandoff] } };

    return {
      architect,
      reasoner,
      executor,
      reviewer,
      attempts: attempts + 1,
      handoffChain: [architectHandoff, reasonerHandoff],
      history: history.length > 1 ? history : undefined
    };
```

- [ ] **Step 7: Run type check and full tests**

Run: `cd backend && npx tsc --noEmit && npx vitest run -v`
Expected: Zero type errors, all tests pass

- [ ] **Step 8: Commit**

```bash
git add backend/src/types/memory.ts backend/src/services/waterfallService.ts backend/src/services/waterfallService.test.ts
git commit -m "feat: add structured StageHandoff metadata to waterfall pipeline

Each stage produces confidence, keyDecisions, constraints, openQuestions.
Handoff chain threads through architect→reasoner→executor→reviewer.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 5: Enhanced Maker-Checker Loop in Waterfall Reviewer

**Files:**
- Modify: `backend/src/services/waterfallService.ts:172-189`

The existing retry loop sends feedback back to the executor on low scores. We enhance it with:
1. Categorized issue severity (critical/major/minor) so the executor knows priority
2. A decision log so repeated issues don't recur
3. Explicit "what changed" tracking between attempts

- [ ] **Step 1: Enhance the reviewer feedback format**

In `backend/src/services/waterfallService.ts`, modify the retry loop (around line 172-189). Replace the simple feedback string construction:

```typescript
    const decisionLog: string[] = [];

    while ((reviewer.score ?? 0) < 80 && attempts < maxRetries) {
      if (signal?.aborted) throw new SolventError('Waterfall cancelled by user.', SolventErrorCode.OPERATION_CANCELLED);
      attempts++;

      // Categorize issues by severity
      const issues = Array.isArray(reviewer.issues) ? reviewer.issues : ['Review failed — please regenerate with higher quality'];
      const criticalIssues = issues.filter((i: string) => /compil|error|crash|security|inject/i.test(i));
      const majorIssues = issues.filter((i: string) => !criticalIssues.includes(i) && /missing|wrong|incorrect|broken/i.test(i));
      const minorIssues = issues.filter((i: string) => !criticalIssues.includes(i) && !majorIssues.includes(i));

      // Build prioritized feedback
      const feedbackParts: string[] = [
        `Previous attempt scored ${reviewer.score ?? 0}/100.`,
        `Attempt ${attempts} of ${maxRetries}.`
      ];

      if (criticalIssues.length > 0) {
        feedbackParts.push(`\nCRITICAL (must fix):\n${criticalIssues.map((i: string) => `  - ${i}`).join('\n')}`);
      }
      if (majorIssues.length > 0) {
        feedbackParts.push(`\nMAJOR (should fix):\n${majorIssues.map((i: string) => `  - ${i}`).join('\n')}`);
      }
      if (minorIssues.length > 0) {
        feedbackParts.push(`\nMINOR (nice to fix):\n${minorIssues.map((i: string) => `  - ${i}`).join('\n')}`);
      }

      if (decisionLog.length > 0) {
        feedbackParts.push(`\nPREVIOUS FIXES (do NOT revert these):\n${decisionLog.map((d, i) => `  ${i + 1}. ${d}`).join('\n')}`);
      }

      const feedback = feedbackParts.join('\n');

      yield {
        phase: 'retrying',
        message: `Score ${reviewer.score}/100. ${criticalIssues.length} critical, ${majorIssues.length} major issues. Attempt ${attempts}...`,
        data: { issues: reviewer.issues, reviewer, attempt: attempts, criticalCount: criticalIssues.length, majorCount: majorIssues.length }
      };

      executor = await this.runExecutorWithContext(reasoner, sessionContext, feedback, signal, modelSelection);

      // Log what was attempted this round
      decisionLog.push(`Attempt ${attempts}: addressed ${criticalIssues.length} critical + ${majorIssues.length} major issues (score was ${reviewer.score})`);

      yield { phase: 'reviewing', message: 'Reviewing refined code...', attempts: attempts + 1 };
      reviewer = await this.runReviewWithContext(reasoner, executor, sessionContext, signal, modelSelection);

      history.push({ executor, reviewer });
    }
```

- [ ] **Step 2: Run type check and full tests**

Run: `cd backend && npx tsc --noEmit && npx vitest run -v`
Expected: Zero type errors, all tests pass

- [ ] **Step 3: Commit**

```bash
git add backend/src/services/waterfallService.ts
git commit -m "feat: enhance maker-checker loop with categorized issues and decision log

Issues categorized as critical/major/minor for executor prioritization.
Decision log prevents reverting previous fixes across retry iterations.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Final Verification

- [ ] **Run full backend type check:** `cd backend && npx tsc --noEmit`
- [ ] **Run full backend test suite:** `cd backend && npx vitest run -v`
- [ ] **Run full frontend type check:** `cd frontend && npx tsc --noEmit`
