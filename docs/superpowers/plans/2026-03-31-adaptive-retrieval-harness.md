# Adaptive Retrieval Harness — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Instrument Solvent's retrieval pipeline with persistent execution traces (JSONL), a debug API endpoint, an enhanced provenance HUD in MessageItem, and a Traces tab in IntelPanel — building the filesystem foundation the Phase C automated proposer loop will read.

**Architecture:** `contextService.ts` exports harness constants and computes per-section token breakdowns; `traceLogger.ts` appends JSONL entries fire-and-forget; `aiService.ts` wires logging between enrichContext and the model call; `aiController.ts` adds a localhost-only read endpoint; the frontend gains a richer MessageItem HUD and a new IntelPanel Traces tab backed by `TraceList.tsx`.

**Tech Stack:** TypeScript, Node.js `fs/promises`, Express, Vitest, React, Tailwind CSS, Lucide icons

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `backend/src/services/contextService.ts` | Modify | Export harness constants, add `getHarnessSnapshot()`, add `promptTokens` to `ContextProvenance`, compute token breakdown before return |
| `backend/src/services/traceLogger.ts` | **New** | `appendTrace()` — JSONL append, 50MB rotation, keep 2 rotated files |
| `backend/src/services/traceLogger.test.ts` | **New** | Tests for write and rotation |
| `backend/src/services/aiService.ts` | Modify | Call `traceLogger.appendTrace()` fire-and-forget after `enrichContext()` |
| `backend/src/controllers/aiController.ts` | Modify | Add `GET /api/debug/traces` — localhost check, JSONL read, filter, return |
| `frontend/src/store/types.ts` | Modify | Add `promptTokens` to `ContextProvenance` |
| `frontend/src/components/MessageItem.tsx` | Modify | Richer badge hovers: scores + signal chips, token count, TIMING chip, BUDGET bar |
| `frontend/src/lib/api-client.ts` | Modify | Add `getTraces(params)` |
| `frontend/src/components/TraceList.tsx` | **New** | Filter bar, trace list rows, expanded detail, compare mode |
| `frontend/src/components/IntelPanel.tsx` | Modify | Add Traces tab, conditionally render `TraceList` |

---

## Task 1: Export Harness Constants from contextService

**Files:**
- Modify: `backend/src/services/contextService.ts:17-113`

- [ ] **Step 1: Add `export` to all scoring constants (lines 17-113)**

In `contextService.ts`, change each `const` declaration for the scoring constants to `export const`. The lines to change are 17, 22, 27, 33, 37, 42, 47, 52, 62, 67, 72, 77, 82, 87, 92, 97, 102, 107, 113.

For example, line 17:
```typescript
// BEFORE
const RETRIEVAL_COUNT_MASSIVE = 15;

// AFTER
export const RETRIEVAL_COUNT_MASSIVE = 15;
```

Apply this `export` prefix to ALL constants from line 17 through 113:
`RETRIEVAL_COUNT_MASSIVE`, `RETRIEVAL_COUNT_CONSTRAINED`, `RETRIEVAL_COUNT_DEFAULT`, `RULES_COUNT_MASSIVE`, `RULES_COUNT_DEFAULT`, `DEDUP_SIMILARITY_THRESHOLD`, `MIN_SCORE_MASSIVE_CONTEXT`, `MIN_SCORE_STANDARD_CONTEXT`, `MAX_SUPPRESSED_ITEMS_UI`, `SCORE_BOOST_UNIVERSAL`, `SCORE_BOOST_META_SUMMARY`, `SCORE_BOOST_CRYSTALLIZED`, `SCORE_BOOST_PERMANENT_RULE`, `SCORE_BOOST_KEYWORD_MATCH`, `SCORE_BOOST_TAG_MATCH`, `SCORE_DECAY_CODE_BLOCK_PER_DAY`, `LINKED_MEMORY_SCORE_MULTIPLIER`, `SCORE_PENALTY_STALE_CODE`, `SCORE_BOOST_PER_RETRIEVAL`, `MAX_RETRIEVAL_BOOST_COUNT`, `SCORE_BOOST_PER_IMPORTANCE`

- [ ] **Step 2: Add `getHarnessSnapshot()` function after the constants block (after line 113)**

Insert this function immediately after the `SCORE_BOOST_PER_IMPORTANCE` constant:

```typescript
/**
 * Returns a snapshot of all current harness scoring parameters.
 * Used in retrieval traces so the Phase C automated proposer can correlate
 * parameter configurations with retrieval outcomes.
 */
export function getHarnessSnapshot() {
  return {
    RETRIEVAL_COUNT_DEFAULT,
    RETRIEVAL_COUNT_MASSIVE,
    RETRIEVAL_COUNT_CONSTRAINED,
    MIN_SCORE_STANDARD: MIN_SCORE_STANDARD_CONTEXT,
    MIN_SCORE_MASSIVE: MIN_SCORE_MASSIVE_CONTEXT,
    SCORE_BOOST_UNIVERSAL,
    SCORE_BOOST_META_SUMMARY,
    SCORE_BOOST_CRYSTALLIZED,
    SCORE_BOOST_PERMANENT_RULE,
    SCORE_BOOST_KEYWORD_MATCH,
    SCORE_BOOST_TAG_MATCH,
    SCORE_BOOST_PER_RETRIEVAL,
    SCORE_BOOST_PER_IMPORTANCE,
    DEDUP_SIMILARITY_THRESHOLD,
    LINKED_MEMORY_SCORE_MULTIPLIER,
    SCORE_PENALTY_STALE_CODE,
  } as const;
}
```

- [ ] **Step 3: Verify backend compiles**

Run: `cd backend && npx tsc --noEmit`
Expected: No new errors.

- [ ] **Step 4: Commit**

```bash
git add backend/src/services/contextService.ts
git commit -m "feat(harness): export scoring constants and add getHarnessSnapshot()"
```

---

## Task 2: Add promptTokens to ContextProvenance

**Files:**
- Modify: `backend/src/services/contextService.ts:312-324` (ContextProvenance interface)
- Modify: `backend/src/services/contextService.ts:684-696` (provenance construction)
- Modify: `backend/src/services/contextService.ts:843-845` (add promptTokens before return)

- [ ] **Step 1: Extend `ContextProvenance` interface (line 312)**

Replace the existing `ContextProvenance` interface:

```typescript
// BEFORE (lines 312-324)
export interface ContextProvenance {
  workspaceFiles: string[];
  active: ProvenanceItem[];
  suppressed: ProvenanceItem[];
  counts: {
    workspace: number;
    local: number;
    global: number;
    rules: number;
    tokenBudget?: number;
    tokensUsed?: number;
  };
}

// AFTER
export interface ContextProvenance {
  workspaceFiles: string[];
  active: ProvenanceItem[];
  suppressed: ProvenanceItem[];
  counts: {
    workspace: number;
    local: number;
    global: number;
    rules: number;
    tokenBudget?: number;
    tokensUsed?: number;
  };
  promptTokens?: {
    memory: number;
    rules: number;
    workspace: number;
    conversationHistory: number;
    systemPrompt: number;
    total: number;
    budget: number;
  };
}
```

- [ ] **Step 2: Compute promptTokens just before the return (line ~845)**

Find the line `return { messages: [systemPrompt, ...data.messages], provenance };` (currently the last line of `enrichContext`, around line 845).

Insert this block immediately BEFORE that return statement:

```typescript
// Compute per-section token breakdown for trace logging and HUD display.
// Must be computed after systemPrompt is assembled (line ~843).
const systemPromptTokens = estimateTokens(systemPrompt.content);
const rulesTokens = estimateTokens(rulesContext || '');
const workspaceTokens = data.openFiles?.reduce(
  (acc, f) => acc + estimateTokens(f.content), 0
) || 0;
const historyTokens = data.messages.reduce(
  (acc, m) => acc + estimateTokens(typeof m.content === 'string' ? m.content : ''), 0
);
provenance.promptTokens = {
  memory: memoryTokensUsed,
  rules: rulesTokens,
  workspace: workspaceTokens,
  conversationHistory: historyTokens,
  systemPrompt: systemPromptTokens,
  total: memoryTokensUsed + rulesTokens + workspaceTokens + historyTokens + systemPromptTokens,
  budget: budget.total || (budget.memory + budget.history),
};
```

- [ ] **Step 3: Verify backend compiles**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add backend/src/services/contextService.ts
git commit -m "feat(harness): add promptTokens per-section breakdown to ContextProvenance"
```

---

## Task 3: Create TraceLogger Service

**Files:**
- Create: `backend/src/services/traceLogger.ts`
- Create: `backend/src/services/traceLogger.test.ts`

- [ ] **Step 1: Write the failing tests first**

Create `backend/src/services/traceLogger.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import path from 'path';

// We test the module by mocking fs operations
vi.mock('fs/promises');
vi.mock('fs');

const mockAppendFile = vi.mocked(fs.appendFile);
const mockRename = vi.mocked(fs.rename);
const mockUnlink = vi.mocked(fs.unlink);
const mockStat = vi.mocked(fs.stat);
const mockAccess = vi.mocked(fs.access);

describe('TraceLogger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: file does not exist (access throws) and stat shows small file
    mockAccess.mockRejectedValue(new Error('ENOENT'));
    mockStat.mockRejectedValue(new Error('ENOENT'));
    mockAppendFile.mockResolvedValue(undefined);
    mockRename.mockResolvedValue(undefined);
    mockUnlink.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('should append a JSON line to the trace file', async () => {
    const { traceLogger } = await import('./traceLogger');
    const trace = {
      id: 'test-id',
      ts: '2026-03-31T00:00:00.000Z',
      responseId: 'resp-1',
      sessionId: 'sess-1',
      mode: 'chat',
      provider: 'groq',
      model: 'llama-3.3-70b-versatile',
      query: 'test query',
      harnessSnapshot: {} as any,
      active: [],
      suppressed: [],
      promptTokens: { memory: 100, rules: 50, workspace: 0, conversationHistory: 200, systemPrompt: 300, total: 650, budget: 4096 },
      counts: { workspace: 0, local: 0, global: 0, rules: 0 },
      pipelineMs: 123,
      outcome: null,
    };

    await traceLogger.appendTrace(trace);

    expect(mockAppendFile).toHaveBeenCalledOnce();
    const [filePath, content] = mockAppendFile.mock.calls[0]!;
    expect(filePath).toContain('.solvent_retrieval_traces.jsonl');
    const parsed = JSON.parse((content as string).trim());
    expect(parsed.id).toBe('test-id');
    expect(parsed.query).toBe('test query');
  });

  it('should rotate the file when it exceeds 50MB', async () => {
    // File exists and is larger than 50MB
    mockAccess.mockResolvedValue(undefined);
    mockStat.mockResolvedValue({ size: 52_428_801 } as any); // > 50MB
    mockRename.mockResolvedValue(undefined);
    mockAppendFile.mockResolvedValue(undefined);

    const { traceLogger } = await import('./traceLogger');
    await traceLogger.appendTrace({
      id: 'x', ts: '', responseId: '', sessionId: '', mode: '', provider: '', model: '',
      query: '', harnessSnapshot: {} as any, active: [], suppressed: [],
      promptTokens: { memory: 0, rules: 0, workspace: 0, conversationHistory: 0, systemPrompt: 0, total: 0, budget: 0 },
      counts: { workspace: 0, local: 0, global: 0, rules: 0 },
      pipelineMs: 0, outcome: null,
    });

    expect(mockRename).toHaveBeenCalled();
    expect(mockAppendFile).toHaveBeenCalled();
  });

  it('should not throw if file write fails — fire and forget', async () => {
    mockAppendFile.mockRejectedValue(new Error('disk full'));

    const { traceLogger } = await import('./traceLogger');
    // Should not throw
    await expect(traceLogger.appendTrace({
      id: 'x', ts: '', responseId: '', sessionId: '', mode: '', provider: '', model: '',
      query: '', harnessSnapshot: {} as any, active: [], suppressed: [],
      promptTokens: { memory: 0, rules: 0, workspace: 0, conversationHistory: 0, systemPrompt: 0, total: 0, budget: 0 },
      counts: { workspace: 0, local: 0, global: 0, rules: 0 },
      pipelineMs: 0, outcome: null,
    })).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx vitest run src/services/traceLogger.test.ts`
Expected: FAIL — `Cannot find module './traceLogger'`

- [ ] **Step 3: Create `backend/src/services/traceLogger.ts`**

```typescript
import { appendFile, stat, rename, unlink, access } from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger';
import { ContextProvenance } from './contextService';

export interface HarnessSnapshot {
  RETRIEVAL_COUNT_DEFAULT: number;
  RETRIEVAL_COUNT_MASSIVE: number;
  RETRIEVAL_COUNT_CONSTRAINED: number;
  MIN_SCORE_STANDARD: number;
  MIN_SCORE_MASSIVE: number;
  SCORE_BOOST_UNIVERSAL: number;
  SCORE_BOOST_META_SUMMARY: number;
  SCORE_BOOST_CRYSTALLIZED: number;
  SCORE_BOOST_PERMANENT_RULE: number;
  SCORE_BOOST_KEYWORD_MATCH: number;
  SCORE_BOOST_TAG_MATCH: number;
  SCORE_BOOST_PER_RETRIEVAL: number;
  SCORE_BOOST_PER_IMPORTANCE: number;
  DEDUP_SIMILARITY_THRESHOLD: number;
  LINKED_MEMORY_SCORE_MULTIPLIER: number;
  SCORE_PENALTY_STALE_CODE: number;
}

export interface RetrievalTrace {
  id: string;
  ts: string;
  responseId: string;
  sessionId: string;
  mode: string;
  provider: string;
  model: string;
  query: string;
  harnessSnapshot: HarnessSnapshot;
  active: ContextProvenance['active'];
  suppressed: ContextProvenance['suppressed'];
  promptTokens: NonNullable<ContextProvenance['promptTokens']>;
  counts: ContextProvenance['counts'];
  pipelineMs: number;
  // Phase A: always null. Phase B will populate with user feedback signals.
  outcome: null | 'correction' | 'crystallized' | 'rerequested' | 'accepted';
}

const TRACE_FILE = path.join(process.cwd(), '.solvent_retrieval_traces.jsonl');
const ROTATE_1 = path.join(process.cwd(), '.solvent_retrieval_traces.1.jsonl');
const ROTATE_2 = path.join(process.cwd(), '.solvent_retrieval_traces.2.jsonl');
const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

async function rotateIfNeeded(): Promise<void> {
  try {
    await access(TRACE_FILE);
    const { size } = await stat(TRACE_FILE);
    if (size <= MAX_SIZE_BYTES) return;
    // Rotate: .2 is deleted, .1 becomes .2, current becomes .1
    try { await unlink(ROTATE_2); } catch { /* .2 may not exist */ }
    try { await rename(ROTATE_1, ROTATE_2); } catch { /* .1 may not exist */ }
    await rename(TRACE_FILE, ROTATE_1);
  } catch {
    // File doesn't exist yet — no rotation needed
  }
}

class TraceLogger {
  async appendTrace(trace: RetrievalTrace): Promise<void> {
    try {
      await rotateIfNeeded();
      await appendFile(TRACE_FILE, JSON.stringify(trace) + '\n', 'utf-8');
    } catch (err) {
      // Fire-and-forget: never let trace logging crash the main request
      logger.warn(`[TraceLogger] Failed to write trace: ${err}`);
    }
  }
}

export const traceLogger = new TraceLogger();
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx vitest run src/services/traceLogger.test.ts`
Expected: 3 tests pass.

- [ ] **Step 5: Verify backend compiles**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/traceLogger.ts backend/src/services/traceLogger.test.ts
git commit -m "feat(harness): add TraceLogger service with JSONL append and 50MB rotation"
```

---

## Task 4: Wire Trace Logging in aiService

**Files:**
- Modify: `backend/src/services/aiService.ts:1-20` (imports)
- Modify: `backend/src/services/aiService.ts:119-121` (after enrichContext)

- [ ] **Step 1: Add imports at the top of `aiService.ts`**

Find the existing imports block. Add these two imports:

```typescript
import { traceLogger, RetrievalTrace } from './traceLogger';
import { getHarnessSnapshot } from './contextService';
import { v4 as uuidv4 } from 'uuid';
```

Note: `uuidv4` may already be imported — check the existing imports first. If `import { v4 as uuidv4 } from 'uuid';` already exists, skip that line.

- [ ] **Step 2: Add trace logging after enrichContext (line ~120)**

Find this block in `processChat()`:

```typescript
// 2. Enrich Context
const { messages: enrichedMessages, provenance } = await this.enrichContext(data);
const normalizedMessages = normalizeMessages(enrichedMessages);
```

Replace it with:

```typescript
// 2. Enrich Context
const enrichStart = Date.now();
const { messages: enrichedMessages, provenance } = await this.enrichContext(data);
const pipelineMs = Date.now() - enrichStart;
const normalizedMessages = normalizeMessages(enrichedMessages);

// 2.1 Log retrieval trace (fire-and-forget — never blocks the response)
const trace: RetrievalTrace = {
  id: uuidv4(),
  ts: new Date().toISOString(),
  responseId: uuidv4(), // Phase B will correlate this with the actual response id
  sessionId: data.sessionId || 'unknown',
  mode: data.mode || 'chat',
  provider,
  model,
  query: data.messages[data.messages.length - 1]?.content?.slice(0, 500) || '',
  harnessSnapshot: getHarnessSnapshot(),
  active: provenance.active.map(p => ({
    id: p.id,
    text: p.text.slice(0, 200),
    type: p.type,
    tier: (p as any).tier || '',
    score: p.score,
    source: p.source || '',
    status: 'active' as const,
  })),
  suppressed: provenance.suppressed.map(p => ({
    id: p.id,
    text: p.text.slice(0, 200),
    type: p.type,
    tier: (p as any).tier || '',
    score: p.score,
    reason: p.reason || 'unknown',
    status: 'suppressed' as const,
  })),
  promptTokens: provenance.promptTokens ?? {
    memory: 0, rules: 0, workspace: 0, conversationHistory: 0,
    systemPrompt: 0, total: 0, budget: 0,
  },
  counts: provenance.counts,
  pipelineMs,
  outcome: null,
};
traceLogger.appendTrace(trace).catch(() => {}); // fire-and-forget
```

- [ ] **Step 3: Verify `data.sessionId` exists on the request type**

Check `backend/src/types/ai.ts` for the `ChatRequestData` interface. If `sessionId` is not present, add it as optional:

```typescript
sessionId?: string;
```

- [ ] **Step 4: Verify backend compiles**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Smoke test — start backend and send a message**

Run: `cd backend && npm run dev`
Send any message through the app.
Expected: `.solvent_retrieval_traces.jsonl` is created in the `backend/` directory. Verify with:
```bash
tail -1 backend/.solvent_retrieval_traces.jsonl | python3 -m json.tool | head -30
```
Expected: Valid JSON with `id`, `ts`, `query`, `harnessSnapshot`, `active`, `suppressed`, `promptTokens` fields.

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/aiService.ts backend/src/types/ai.ts
git commit -m "feat(harness): wire trace logging in aiService after enrichContext"
```

---

## Task 5: Add Debug API Endpoint

**Files:**
- Modify: `backend/src/controllers/aiController.ts`

- [ ] **Step 1: Add imports at the top of `aiController.ts`**

Add to the existing imports:

```typescript
import { createReadStream } from 'fs';
import { readFile, access } from 'fs/promises';
import path from 'path';
```

- [ ] **Step 2: Add the `getTraces` handler function**

Add this function to `aiController.ts` (before the module exports, after existing handler functions):

```typescript
const TRACE_FILE_PATH = path.join(process.cwd(), '..', 'backend', '.solvent_retrieval_traces.jsonl');
const ALT_TRACE_FILE_PATH = path.join(process.cwd(), '.solvent_retrieval_traces.jsonl');

export const getTraces = async (req: Request, res: Response): Promise<void> => {
  // Localhost-only gate — this endpoint exposes internal memory content
  const ip = req.ip || req.socket?.remoteAddress || '';
  const isLocal = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
  if (!isLocal) {
    res.status(403).json({ error: 'This endpoint is only accessible from localhost.' });
    return;
  }

  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const queryFilter = (req.query.query as string || '').toLowerCase();
  const modeFilter = (req.query.mode as string || '');
  const sinceFilter = req.query.since ? new Date(req.query.since as string).getTime() : 0;
  const outcomeFilter = req.query.outcome as string || '';

  // Try both possible file locations
  let filePath = TRACE_FILE_PATH;
  try {
    await access(filePath);
  } catch {
    try {
      await access(ALT_TRACE_FILE_PATH);
      filePath = ALT_TRACE_FILE_PATH;
    } catch {
      res.json([]);
      return;
    }
  }

  try {
    const content = await readFile(filePath, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);

    // Newest first — reverse the lines
    const reversed = lines.reverse();

    const results: any[] = [];
    for (const line of reversed) {
      if (results.length >= limit) break;
      try {
        const trace = JSON.parse(line);
        if (queryFilter && !trace.query?.toLowerCase().includes(queryFilter)) continue;
        if (modeFilter && trace.mode !== modeFilter) continue;
        if (sinceFilter && new Date(trace.ts).getTime() < sinceFilter) continue;
        if (outcomeFilter && trace.outcome !== outcomeFilter) continue;
        results.push(trace);
      } catch {
        // Skip malformed lines
      }
    }

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: 'Failed to read trace file.' });
  }
};
```

- [ ] **Step 3: Register the route**

Find where routes are registered in the Express app. Look for the router file that wires up `aiController` handlers — likely `backend/src/routes/ai.ts` or similar. Add:

```typescript
router.get('/debug/traces', getTraces);
```

If routes are registered directly in `aiController.ts` or in `backend/src/app.ts`, search for where other `/api/` routes are registered and add the same pattern.

Run: `grep -r "getTraces\|debug/traces\|aiController" backend/src/routes/ backend/src/app.ts 2>/dev/null | head -20`

This will show you the right file to edit for route registration.

- [ ] **Step 4: Verify backend compiles**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Smoke test the endpoint**

With the backend running, run:
```bash
curl "http://localhost:3001/api/debug/traces?limit=5" | python3 -m json.tool | head -40
```
Expected: JSON array of up to 5 trace objects, newest first.

- [ ] **Step 6: Commit**

```bash
git add backend/src/controllers/aiController.ts
git commit -m "feat(harness): add GET /api/debug/traces endpoint (localhost-only)"
```

---

## Task 6: Update Frontend ContextProvenance Type

**Files:**
- Modify: `frontend/src/store/types.ts:20-30`

- [ ] **Step 1: Add `promptTokens` to `ContextProvenance`**

Replace the existing `ContextProvenance` interface (lines 20-30):

```typescript
// BEFORE
export interface ContextProvenance {
  workspaceFiles: string[];
  active: ProvenanceItem[];
  suppressed: ProvenanceItem[];
  counts: {
    workspace: number;
    local: number;
    global: number;
    rules: number;
  };
}

// AFTER
export interface ContextProvenance {
  workspaceFiles: string[];
  active: ProvenanceItem[];
  suppressed: ProvenanceItem[];
  counts: {
    workspace: number;
    local: number;
    global: number;
    rules: number;
    tokenBudget?: number;
    tokensUsed?: number;
  };
  promptTokens?: {
    memory: number;
    rules: number;
    workspace: number;
    conversationHistory: number;
    systemPrompt: number;
    total: number;
    budget: number;
  };
}
```

- [ ] **Step 2: Verify frontend compiles**

Run: `cd frontend && npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors related to `ContextProvenance`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/store/types.ts
git commit -m "feat(harness): add promptTokens to frontend ContextProvenance type"
```

---

## Task 7: Enhance MessageItem Provenance HUD

**Files:**
- Modify: `frontend/src/components/MessageItem.tsx:188-318`

- [ ] **Step 1: Add score+signal chip helper inside the component**

Just before the `return (` statement in `MessageItem.tsx`, add this helper function:

```typescript
const ScoreChip = ({ score, signals }: { score: number; signals?: string[] }) => (
  <span className="flex items-center gap-1 flex-wrap mt-0.5">
    <span className={cn(
      "text-[10px] font-mono px-1 py-0.5 rounded",
      score >= 0.8 ? "bg-emerald-500/20 text-emerald-400" :
      score >= 0.6 ? "bg-amber-500/20 text-amber-400" :
      "bg-slate-500/20 text-slate-400"
    )}>
      {score.toFixed(2)}
    </span>
    {signals?.map((s, i) => (
      <span key={i} className="text-[9px] text-slate-500 bg-white/5 px-1 rounded">{s}</span>
    ))}
  </span>
);
```

- [ ] **Step 2: Add token count to WORKSPACE badge hover (lines 201-210)**

Find the WORKSPACE badge hover content (the `<div className="space-y-1.5 ...">` block). Replace it with:

```typescript
<div className="bg-black/90 border border-white/10 rounded-lg p-3 backdrop-blur-xl shadow-2xl">
  <div className="text-[11px] font-black text-slate-400 uppercase tracking-tighter mb-2 border-b border-white/10 pb-1">
    Active File Context
    {message.provenance.promptTokens && (
      <span className="ml-2 font-mono text-slate-500 normal-case">
        {message.provenance.promptTokens.workspace} tok
      </span>
    )}
  </div>
  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
    {message.provenance.workspaceFiles.map((file: string, i: number) => (
      <div key={i} className="text-[11px] font-mono text-slate-300 truncate">/ {file}</div>
    ))}
  </div>
</div>
```

- [ ] **Step 3: Add score breakdown to PROJECT badge (lines 225-243)**

Find the PROJECT badge item rendering. Replace the inner content of each item `<div>` with:

```typescript
{message.provenance.active.filter((p: any) => p.source === 'LOCAL').map((p: any, i: number) => (
  <div key={i} className={cn(
    "text-[11px] text-slate-300 leading-relaxed border-l border-jb-accent/30 pl-2 group/item relative",
    deprecatedIds.has(p.id) && "opacity-40 line-through"
  )}>
    <div className="flex justify-between items-start gap-2">
      <span className="text-jb-accent font-black uppercase text-[11px] block">{p.type}</span>
      {!deprecatedIds.has(p.id) && (
        <button
          onClick={() => handleDeprecate(p.id, p.text)}
          className="opacity-0 group-hover/item:opacity-100 text-slate-500 hover:text-rose-400 transition-all p-0.5"
          title="Kill this memory"
        >
          <Trash2 size={10} />
        </button>
      )}
    </div>
    <ScoreChip score={p.score} />
    {p.text}
  </div>
))}
```

- [ ] **Step 4: Add score breakdown to GLOBAL badge active items (lines 269-291)**

Find the GLOBAL badge active patterns rendering. Add `<ScoreChip score={p.score} />` after the label span and before `{p.text}`:

```typescript
{message.provenance.active.filter((p: any) => p.source === 'GLOBAL').map((p: any, i: number) => (
  <div key={i} className={cn(
    "text-[11px] text-slate-200 leading-relaxed border-l-2 border-emerald-500 pl-2 group/item relative",
    deprecatedIds.has(p.id) && "opacity-40 line-through"
  )}>
    <div className="flex justify-between items-start gap-2">
      <span className="text-emerald-400 font-black uppercase text-[11px] flex items-center gap-1">
        <div className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
        Active Pattern
      </span>
      {!deprecatedIds.has(p.id) && (
        <button
          onClick={() => handleDeprecate(p.id, p.text)}
          className="opacity-0 group-hover/item:opacity-100 text-slate-500 hover:text-rose-400 transition-all p-0.5"
          title="Deprecate this pattern globally"
        >
          <Ban size={10} />
        </button>
      )}
    </div>
    <ScoreChip score={p.score} />
    {p.text}
  </div>
))}
```

- [ ] **Step 5: Expand RULES badge to show rule text on hover (lines 311-316)**

Replace the static RULES badge with an interactive hover version:

```typescript
{/* Rules Badge */}
{message.provenance.counts.rules > 0 && (
  <div className="group/hud relative">
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] font-bold cursor-help">
      <Shield size={10} />
      <span>{message.provenance.counts.rules} RULES</span>
    </div>
    <div className="absolute bottom-full left-0 mb-2 w-72 hidden group-hover/hud:block z-50 animate-in fade-in slide-in-from-bottom-2">
      <div className="bg-black/90 border border-amber-500/30 rounded-lg p-3 backdrop-blur-xl shadow-2xl">
        <div className="text-[11px] font-black text-amber-400 uppercase tracking-tighter mb-2 border-b border-amber-500/20 pb-1">
          Active Rules
        </div>
        <div className="space-y-2">
          {message.provenance.active.filter((p: any) => p.type === 'permanent_rule').map((p: any, i: number) => (
            <div key={i} className="text-[11px] text-slate-300 border-l-2 border-amber-500/50 pl-2">
              {p.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 6: Add TIMING chip and BUDGET bar after the RULES badge (after line 316, before closing `</div>`)**

```typescript
{/* Timing Chip */}
{message.provenance.promptTokens && (
  <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 border border-white/10 text-slate-500 text-[11px] font-mono">
    <span>{message.provenance.promptTokens.total.toLocaleString()} tok</span>
  </div>
)}

{/* Budget Bar */}
{message.provenance.promptTokens && message.provenance.promptTokens.budget > 0 && (() => {
  const { total, budget, memory, rules, workspace, conversationHistory, systemPrompt } = message.provenance.promptTokens!;
  const pct = Math.min((total / budget) * 100, 100);
  const barColor = pct >= 95 ? 'bg-rose-500' : pct >= 85 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="group/budget relative w-full mt-1">
      <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden flex">
        <div className="h-full bg-blue-500/50" style={{ width: `${(memory/budget)*100}%` }} title="Memory" />
        <div className="h-full bg-purple-500/50" style={{ width: `${(rules/budget)*100}%` }} title="Rules" />
        <div className="h-full bg-emerald-500/50" style={{ width: `${(workspace/budget)*100}%` }} title="Workspace" />
        <div className="h-full bg-amber-500/50" style={{ width: `${(conversationHistory/budget)*100}%` }} title="History" />
        <div className="h-full bg-slate-500/50" style={{ width: `${(systemPrompt/budget)*100}%` }} title="System" />
      </div>
      <div className="absolute bottom-full left-0 mb-1 w-56 hidden group-hover/budget:block z-50">
        <div className="bg-black/90 border border-white/10 rounded-lg p-2 text-[10px] space-y-1">
          {[
            { label: 'Memory', val: memory, color: 'bg-blue-500' },
            { label: 'Rules', val: rules, color: 'bg-purple-500' },
            { label: 'Workspace', val: workspace, color: 'bg-emerald-500' },
            { label: 'History', val: conversationHistory, color: 'bg-amber-500' },
            { label: 'System', val: systemPrompt, color: 'bg-slate-500' },
          ].map(({ label, val, color }) => (
            <div key={label} className="flex items-center gap-2">
              <div className={cn("w-2 h-2 rounded-sm", color)} />
              <span className="text-slate-400 w-20">{label}</span>
              <span className="font-mono text-slate-300">{val.toLocaleString()}</span>
            </div>
          ))}
          <div className="border-t border-white/10 pt-1 flex justify-between">
            <span className="text-slate-400">Total / Budget</span>
            <span className={cn("font-mono", pct >= 95 ? 'text-rose-400' : pct >= 85 ? 'text-amber-400' : 'text-slate-300')}>
              {total.toLocaleString()} / {budget.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
})()}
```

- [ ] **Step 7: Verify frontend compiles**

Run: `cd frontend && npx tsc --noEmit 2>&1 | head -30`
Expected: No new errors.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/MessageItem.tsx
git commit -m "feat(harness): enhance MessageItem HUD with scores, signal chips, token budget bar"
```

---

## Task 8: Add getTraces to API Client

**Files:**
- Modify: `frontend/src/lib/api-client.ts`

- [ ] **Step 1: Add `getTraces` function**

Find the `API_BASE_URL` usage in `api-client.ts` and add this exported function alongside the existing ones:

```typescript
export interface TraceFilter {
  limit?: number;
  query?: string;
  mode?: string;
  since?: string;
  outcome?: string;
}

export async function getTraces(filter: TraceFilter = {}): Promise<any[]> {
  const params = new URLSearchParams();
  if (filter.limit) params.set('limit', String(filter.limit));
  if (filter.query) params.set('query', filter.query);
  if (filter.mode) params.set('mode', filter.mode);
  if (filter.since) params.set('since', filter.since);
  if (filter.outcome) params.set('outcome', filter.outcome);

  const url = `${API_BASE_URL}/api/debug/traces${params.toString() ? '?' + params.toString() : ''}`;
  const res = await fetchWithRetry(url, { method: 'GET' });
  if (!res.ok) return [];
  return res.json();
}
```

- [ ] **Step 2: Verify frontend compiles**

Run: `cd frontend && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/api-client.ts
git commit -m "feat(harness): add getTraces() to API client"
```

---

## Task 9: Create TraceList Component

**Files:**
- Create: `frontend/src/components/TraceList.tsx`

- [ ] **Step 1: Create `TraceList.tsx`**

```typescript
import React, { useState, useEffect, useCallback } from 'react';
import { getTraces, TraceFilter } from '../lib/api-client';
import { cn } from '../lib/utils';
import { GitCompare, ChevronDown, ChevronRight } from 'lucide-react';

interface TraceRow {
  id: string;
  ts: string;
  mode: string;
  provider: string;
  model: string;
  query: string;
  active: any[];
  suppressed: any[];
  promptTokens: {
    memory: number; rules: number; workspace: number;
    conversationHistory: number; systemPrompt: number; total: number; budget: number;
  };
  counts: { workspace: number; local: number; global: number; rules: number };
  harnessSnapshot: Record<string, number>;
  pipelineMs: number;
  outcome: string | null;
}

const REASON_COLORS: Record<string, string> = {
  below_min_score: 'text-rose-400 bg-rose-500/10',
  duplicate: 'text-amber-400 bg-amber-500/10',
  stale_code: 'text-orange-400 bg-orange-500/10',
  token_budget: 'text-purple-400 bg-purple-500/10',
  conflict: 'text-red-400 bg-red-500/10',
};

function BudgetBar({ pt }: { pt: TraceRow['promptTokens'] }) {
  if (!pt || pt.budget === 0) return null;
  const pct = Math.min((pt.total / pt.budget) * 100, 100);
  return (
    <div className="mt-3">
      <div className="flex justify-between text-[10px] text-slate-500 mb-1">
        <span>Context Budget</span>
        <span className={cn("font-mono", pct >= 95 ? 'text-rose-400' : pct >= 85 ? 'text-amber-400' : 'text-slate-400')}>
          {pt.total.toLocaleString()} / {pt.budget.toLocaleString()} tok
        </span>
      </div>
      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden flex">
        <div className="h-full bg-blue-500/60" style={{ width: `${(pt.memory / pt.budget) * 100}%` }} />
        <div className="h-full bg-purple-500/60" style={{ width: `${(pt.rules / pt.budget) * 100}%` }} />
        <div className="h-full bg-emerald-500/60" style={{ width: `${(pt.workspace / pt.budget) * 100}%` }} />
        <div className="h-full bg-amber-500/60" style={{ width: `${(pt.conversationHistory / pt.budget) * 100}%` }} />
        <div className="h-full bg-slate-500/60" style={{ width: `${(pt.systemPrompt / pt.budget) * 100}%` }} />
      </div>
    </div>
  );
}

export const TraceList: React.FC = () => {
  const [traces, setTraces] = useState<TraceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<TraceFilter>({ limit: 50 });
  const [queryInput, setQueryInput] = useState('');
  const [modeInput, setModeInput] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set());
  const [comparing, setComparing] = useState(false);

  const fetchTraces = useCallback(async (f: TraceFilter) => {
    setLoading(true);
    try {
      const results = await getTraces(f);
      setTraces(results);
    } catch {
      setTraces([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTraces(filter);
  }, [filter, fetchTraces]);

  // Debounced filter updates
  useEffect(() => {
    const t = setTimeout(() => {
      setFilter(f => ({ ...f, query: queryInput || undefined, mode: modeInput || undefined }));
    }, 300);
    return () => clearTimeout(t);
  }, [queryInput, modeInput]);

  const toggleCompare = (id: string) => {
    setCompareIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); }
      else if (next.size < 2) { next.add(id); }
      return next;
    });
  };

  const comparePair = comparing && compareIds.size === 2
    ? traces.filter(t => compareIds.has(t.id))
    : null;

  const formatTime = (ts: string) => {
    try { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
    catch { return ts; }
  };

  const budgetPct = (pt: TraceRow['promptTokens']) =>
    pt?.budget > 0 ? (pt.total / pt.budget) * 100 : 0;

  return (
    <div className="flex flex-col h-full">
      {/* Filter bar */}
      <div className="flex gap-2 p-2 border-b border-white/5">
        <input
          value={queryInput}
          onChange={e => setQueryInput(e.target.value)}
          placeholder="Filter by query..."
          className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-[12px] text-slate-300 placeholder-slate-600 outline-none focus:border-white/20"
        />
        <select
          value={modeInput}
          onChange={e => setModeInput(e.target.value)}
          className="bg-white/5 border border-white/10 rounded px-2 py-1 text-[12px] text-slate-300 outline-none"
        >
          <option value="">All modes</option>
          {['chat', 'coding', 'waterfall', 'debate', 'browser', 'compare'].map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        {compareIds.size === 2 && (
          <button
            onClick={() => setComparing(c => !c)}
            className="flex items-center gap-1 px-2 py-1 bg-blue-500/20 border border-blue-500/30 rounded text-[11px] text-blue-400"
          >
            <GitCompare size={10} />
            Compare
          </button>
        )}
      </div>

      {/* Compare view */}
      {comparePair && (
        <div className="border-b border-white/10 p-3 bg-white/3">
          <div className="text-[11px] font-black text-slate-400 uppercase mb-2">Comparing 2 Traces</div>
          <div className="grid grid-cols-2 gap-3 text-[10px]">
            {comparePair.map(t => (
              <div key={t.id}>
                <div className="text-slate-500 mb-1">{formatTime(t.ts)} · {t.mode} · {t.query.slice(0, 50)}</div>
                <div className="text-emerald-400 font-black mb-0.5">ACTIVE ({t.active.length})</div>
                {t.active.map((a: any) => (
                  <div key={a.id} className="text-slate-400 truncate">· {a.text?.slice(0, 60)}</div>
                ))}
                <div className="text-rose-400 font-black mt-1 mb-0.5">SUPPRESSED ({t.suppressed.length})</div>
                {t.suppressed.slice(0, 3).map((s: any) => (
                  <div key={s.id} className="text-slate-500 truncate">· {s.text?.slice(0, 60)}</div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trace list */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {loading && (
          <div className="text-center text-slate-600 text-[12px] p-4">Loading traces...</div>
        )}
        {!loading && traces.length === 0 && (
          <div className="text-center text-slate-600 text-[12px] p-8">
            No traces yet. Send a message in chat to generate the first trace.
          </div>
        )}
        {traces.map(trace => {
          const pct = budgetPct(trace.promptTokens);
          const isExpanded = expandedId === trace.id;
          const isSelected = compareIds.has(trace.id);
          return (
            <div
              key={trace.id}
              className={cn(
                "border-b border-white/5 hover:bg-white/3 transition-colors",
                isSelected && "bg-blue-500/5 border-l-2 border-l-blue-500"
              )}
            >
              {/* Collapsed row */}
              <div
                className="flex items-center gap-2 p-2 cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : trace.id)}
              >
                {/* Budget color indicator */}
                <div className={cn(
                  "w-1 h-8 rounded-full flex-shrink-0",
                  pct >= 95 ? 'bg-rose-500' : pct >= 85 ? 'bg-amber-500' : 'bg-emerald-500/50'
                )} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <span className="text-slate-500 font-mono">{formatTime(trace.ts)}</span>
                    <span className="text-slate-600">·</span>
                    <span className="text-slate-400">{trace.mode}</span>
                    <span className="text-slate-600">·</span>
                    <span className="text-slate-500 text-[10px]">{trace.provider}</span>
                  </div>
                  <div className="text-[12px] text-slate-300 truncate">{trace.query}</div>
                  <div className="flex gap-3 text-[10px] text-slate-600 mt-0.5">
                    <span>{trace.active.length} active</span>
                    <span>{trace.suppressed.length} suppressed</span>
                    {trace.promptTokens && (
                      <span className="font-mono">{trace.promptTokens.total.toLocaleString()}/{trace.promptTokens.budget.toLocaleString()} tok</span>
                    )}
                    <span>{trace.pipelineMs}ms</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleCompare(trace.id)}
                    onClick={e => e.stopPropagation()}
                    className="w-3 h-3 accent-blue-500"
                    title="Select for compare"
                  />
                  {isExpanded ? <ChevronDown size={12} className="text-slate-500" /> : <ChevronRight size={12} className="text-slate-500" />}
                </div>
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="px-4 pb-3 space-y-3 border-t border-white/5 bg-white/2">
                  {/* Active items */}
                  <div>
                    <div className="text-[10px] font-black text-emerald-400 uppercase mt-2 mb-1">
                      Active ({trace.active.length})
                    </div>
                    {trace.active.map((a: any) => (
                      <div key={a.id} className="text-[10px] text-slate-400 border-l border-emerald-500/30 pl-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-emerald-400">{a.score?.toFixed(2)}</span>
                          <span className="text-slate-600 uppercase text-[9px]">{a.type}</span>
                          <span className="text-slate-600 text-[9px]">{a.source}</span>
                        </div>
                        <div className="text-slate-500 truncate">{a.text}</div>
                      </div>
                    ))}
                  </div>

                  {/* Suppressed items */}
                  {trace.suppressed.length > 0 && (
                    <div>
                      <div className="text-[10px] font-black text-rose-400 uppercase mb-1">
                        Suppressed ({trace.suppressed.length})
                      </div>
                      {trace.suppressed.map((s: any) => (
                        <div key={s.id} className="text-[10px] text-slate-500 border-l border-rose-500/20 pl-2 mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-slate-600">{s.score?.toFixed(2)}</span>
                            <span className={cn("text-[9px] px-1 rounded", REASON_COLORS[s.reason] || 'text-slate-500 bg-white/5')}>
                              {s.reason}
                            </span>
                          </div>
                          <div className="truncate line-through decoration-rose-500/30">{s.text}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Budget bar */}
                  {trace.promptTokens && <BudgetBar pt={trace.promptTokens} />}

                  {/* Harness snapshot — collapsed by default */}
                  <details className="mt-2">
                    <summary className="text-[10px] font-black text-slate-600 uppercase cursor-pointer hover:text-slate-400">
                      Harness Snapshot
                    </summary>
                    <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5">
                      {Object.entries(trace.harnessSnapshot || {}).map(([k, v]) => (
                        <div key={k} className="flex justify-between text-[9px]">
                          <span className="text-slate-600 truncate">{k}</span>
                          <span className="font-mono text-slate-400">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  </details>

                  {/* Outcome badge */}
                  <div className="text-[10px] text-slate-600">
                    Outcome: <span className={cn(
                      "ml-1 px-1 rounded",
                      trace.outcome ? 'text-blue-400 bg-blue-500/10' : 'text-slate-600'
                    )}>
                      {trace.outcome ?? '—'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Verify frontend compiles**

Run: `cd frontend && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/TraceList.tsx
git commit -m "feat(harness): add TraceList component with filter, expand, compare"
```

---

## Task 10: Add Traces Tab to IntelPanel

**Files:**
- Modify: `frontend/src/components/IntelPanel.tsx`

- [ ] **Step 1: Add import for TraceList**

At the top of `IntelPanel.tsx`, add:

```typescript
import { TraceList } from './TraceList';
```

- [ ] **Step 2: Add `activeTab` state**

Inside the `IntelPanel` component, after the existing `useState` declarations, add:

```typescript
const [activeTab, setActiveTab] = useState<'search' | 'traces'>('search');
```

- [ ] **Step 3: Add tab bar above the search input**

Find the search bar section at the top of the IntelPanel render. Add a tab bar immediately before the search input `<form>` or `<div>`:

```typescript
{/* Tab bar */}
<div className="flex border-b border-white/10">
  <button
    onClick={() => setActiveTab('search')}
    className={cn(
      "flex-1 py-2 text-[11px] font-bold uppercase tracking-wider transition-colors",
      activeTab === 'search'
        ? "text-white border-b-2 border-white"
        : "text-slate-500 hover:text-slate-300"
    )}
  >
    Search
  </button>
  <button
    onClick={() => setActiveTab('traces')}
    className={cn(
      "flex-1 py-2 text-[11px] font-bold uppercase tracking-wider transition-colors",
      activeTab === 'traces'
        ? "text-white border-b-2 border-white"
        : "text-slate-500 hover:text-slate-300"
    )}
  >
    Traces
  </button>
</div>
```

- [ ] **Step 4: Conditionally render TraceList or the existing search content**

Wrap the existing search content (everything below the tab bar) in a conditional:

```typescript
{activeTab === 'traces' ? (
  <TraceList />
) : (
  // ... existing search/reader/Q&A content unchanged ...
)}
```

The existing content structure remains identical — only its rendering is gated by `activeTab === 'search'`.

- [ ] **Step 5: Verify frontend compiles**

Run: `cd frontend && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 6: Full build check**

Run: `cd frontend && npm run build 2>&1 | tail -20`
Expected: Build completes without errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/IntelPanel.tsx
git commit -m "feat(harness): add Traces tab to IntelPanel wiring TraceList component"
```

---

## Task 11: Final Verification

- [ ] **Step 1: Run all backend tests**

Run: `cd backend && npx vitest run`
Expected: All tests pass, including the new `traceLogger.test.ts`.

- [ ] **Step 2: Run full type-check across both packages**

Run: `cd backend && npx tsc --noEmit && cd ../frontend && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: End-to-end smoke test**

1. Start backend: `cd backend && npm run dev`
2. Start frontend: `cd frontend && npm run dev`
3. Send a message in chat
4. Check trace file exists: `ls -lh backend/.solvent_retrieval_traces.jsonl`
5. Verify trace content: `tail -1 backend/.solvent_retrieval_traces.jsonl | python3 -m json.tool | head -40`
6. Check debug endpoint: `curl "http://localhost:3001/api/debug/traces?limit=1" | python3 -m json.tool`
7. Open IntelPanel in the app → click "Traces" tab → verify trace rows appear
8. Click a trace row → verify expanded detail shows active/suppressed items with scores
9. Hover over a message's provenance badges → verify score chips appear on PROJECT and GLOBAL items
10. Hover over the budget bar → verify per-section breakdown tooltip

- [ ] **Step 4: Final commit**

```bash
git add -A
git status  # verify only expected files
git commit -m "feat(harness): Phase A complete — retrieval trace logging, debug endpoint, HUD and Traces UI"
```
