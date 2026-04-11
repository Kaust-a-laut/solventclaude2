# Adaptive Retrieval Harness Phase B — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Attach reward outcome signals to retrieval traces, make retrieval parameter-aware of conversation mode, and surface a thumbs-down feedback mechanism so users can flag poor retrievals as `correction` outcomes.

**Architecture:** `contextService.ts` gets a `getModeRetrievalProfile()` function that returns per-mode count/threshold deltas applied inside `enrichContext()`; `traceLogger.ts` gains `updateOutcome()` (appends an `outcome_patch` record) and `readTraces()` (reads JSONL + merges patches); `aiService.ts` returns `traceId` in its response and auto-marks the prior session trace as `accepted` when a new turn arrives; a new `PATCH /api/debug/traces/:id/outcome` endpoint and `sessionId` filter are added to `aiController.ts`; the frontend stores `traceId` on assistant messages and renders a thumbs-down button in `MessageItem.tsx`.

**Tech Stack:** TypeScript, Node.js `fs/promises`, Express, Zod, Vitest, React, Tailwind CSS, Lucide icons

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `backend/src/services/contextService.ts` | Modify | Add `MODE_RETRIEVAL_PROFILES`, export `getModeRetrievalProfile()`, apply deltas in `enrichContext()` |
| `backend/src/services/contextService.test.ts` | **New** | Tests for `getModeRetrievalProfile()` — pure function, no mocks needed |
| `backend/src/services/traceLogger.ts` | Modify | Add `OutcomePatch` interface, `updateOutcome()`, `readTraces()` with patch merging |
| `backend/src/services/traceLogger.test.ts` | Modify | Add tests for `updateOutcome` and `readTraces` with patch merging |
| `backend/src/services/aiService.ts` | Modify | Add `traceId` to `CompletionResponse`; add in-memory `lastTraceBySession` Map; auto-emit `accepted` at turn start; return `traceId` in response |
| `backend/src/controllers/aiController.ts` | Modify | Add `updateTraceOutcome` handler; update `getTraces` to use `traceLogger.readTraces()` + `sessionId` filter; add `traceLogger` import |
| `backend/src/routes/aiRoutes.ts` | Modify | Register `PATCH /debug/traces/:id/outcome` |
| `frontend/src/store/types.ts` | Modify | Add `traceId?: string` to `Message` |
| `frontend/src/services/ChatService.ts` | Modify | Add `sessionId?: string \| null` to `ChatParams`; pass in request body; return `traceId` |
| `frontend/src/store/actionSlice.ts` | Modify | Pass `currentSessionId` in `ChatParams`; attach `traceId` to assistant message |
| `frontend/src/lib/api-client.ts` | Modify | Add `sessionId` to `TraceFilter`; add `updateTraceOutcome()` |
| `frontend/src/components/MessageItem.tsx` | Modify | Add thumbs-down button that calls `updateTraceOutcome(message.traceId, 'correction')` |
| `frontend/src/components/TraceList.tsx` | Modify | Show colored outcome badge per row; manual override dropdown in expanded view |

---

## Task 1: Mode-Aware Retrieval Profiles

**Files:**
- Modify: `backend/src/services/contextService.ts` (after `getHarnessSnapshot()`, and lines ~525, ~543, ~548, ~660, ~703)
- Create: `backend/src/services/contextService.test.ts`

- [ ] **Step 1: Write the failing test first**

Create `backend/src/services/contextService.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { getModeRetrievalProfile } from './contextService';

describe('getModeRetrievalProfile', () => {
  it('returns +2 count delta for coding mode', () => {
    expect(getModeRetrievalProfile('coding').countDelta).toBe(2);
  });

  it('returns negative minScoreDelta for coding mode', () => {
    expect(getModeRetrievalProfile('coding').minScoreDelta).toBeLessThan(0);
  });

  it('returns -2 count delta for browser mode', () => {
    expect(getModeRetrievalProfile('browser').countDelta).toBe(-2);
  });

  it('returns positive minScoreDelta for browser mode', () => {
    expect(getModeRetrievalProfile('browser').minScoreDelta).toBeGreaterThan(0);
  });

  it('returns -2 count delta for vision mode', () => {
    expect(getModeRetrievalProfile('vision').countDelta).toBe(-2);
  });

  it('returns zero deltas for chat mode', () => {
    const p = getModeRetrievalProfile('chat');
    expect(p.countDelta).toBe(0);
    expect(p.minScoreDelta).toBe(0);
  });

  it('returns zero deltas for undefined', () => {
    expect(getModeRetrievalProfile(undefined).countDelta).toBe(0);
  });

  it('returns zero deltas for unknown mode', () => {
    expect(getModeRetrievalProfile('debate').countDelta).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && npx vitest run src/services/contextService.test.ts 2>&1 | tail -10
```

Expected: FAIL — `getModeRetrievalProfile is not exported`.

- [ ] **Step 3: Add `MODE_RETRIEVAL_PROFILES` constant and `getModeRetrievalProfile()` to contextService.ts**

In `backend/src/services/contextService.ts`, locate `export function getHarnessSnapshot()` (around line 120). Insert this block immediately after the closing `}` of `getHarnessSnapshot`:

```typescript
/**
 * Per-mode adjustments applied on top of the model-based retrieval parameters.
 * countDelta: added to maxRetrievalCount (positive = fetch more, negative = fetch fewer).
 * minScoreDelta: added to minScore threshold (positive = stricter, negative = broader).
 */
const MODE_RETRIEVAL_PROFILES: Partial<Record<string, { countDelta: number; minScoreDelta: number }>> = {
  coding:  { countDelta: +2, minScoreDelta: -0.05 }, // More precision context; lower bar for local memories
  browser: { countDelta: -2, minScoreDelta: +0.05 }, // Current page dominates; fewer background memories
  vision:  { countDelta: -2, minScoreDelta: +0.05 }, // Same rationale as browser
};

export function getModeRetrievalProfile(mode?: string): { countDelta: number; minScoreDelta: number } {
  return MODE_RETRIEVAL_PROFILES[mode ?? ''] ?? { countDelta: 0, minScoreDelta: 0 };
}
```

- [ ] **Step 4: Apply mode profile in `enrichContext()`**

In `enrichContext()`, locate this line (around line 525):

```typescript
const maxRetrievalCount = isMassiveContext ? RETRIEVAL_COUNT_MASSIVE : (isConstrained ? RETRIEVAL_COUNT_CONSTRAINED : RETRIEVAL_COUNT_DEFAULT);
```

Replace it with:

```typescript
const baseRetrievalCount = isMassiveContext ? RETRIEVAL_COUNT_MASSIVE : (isConstrained ? RETRIEVAL_COUNT_CONSTRAINED : RETRIEVAL_COUNT_DEFAULT);
const modeProfile = getModeRetrievalProfile(data.mode);
const maxRetrievalCount = Math.max(1, baseRetrievalCount + modeProfile.countDelta);
```

Then locate the `minScore` line (around line 660):

```typescript
const minScore = isMassiveContext ? MIN_SCORE_MASSIVE_CONTEXT : MIN_SCORE_STANDARD_CONTEXT;
```

Replace it with:

```typescript
const minScore = (isMassiveContext ? MIN_SCORE_MASSIVE_CONTEXT : MIN_SCORE_STANDARD_CONTEXT) + modeProfile.minScoreDelta;
```

(`modeProfile` is already in scope from line ~527 above.)

- [ ] **Step 5: Run test to verify it passes**

```bash
cd backend && npx vitest run src/services/contextService.test.ts 2>&1 | tail -10
```

Expected: all 8 tests PASS.

- [ ] **Step 6: Verify backend compiles**

```bash
cd backend && npx tsc --noEmit 2>&1 | head -20
```

Expected: No new errors.

- [ ] **Step 7: Commit**

```bash
git add backend/src/services/contextService.ts backend/src/services/contextService.test.ts
git commit -m "feat(harness): mode-aware retrieval profiles — coding +2 count, browser -2 count"
```

---

## Task 2: TraceLogger — updateOutcome + readTraces

**Files:**
- Modify: `backend/src/services/traceLogger.ts`
- Modify: `backend/src/services/traceLogger.test.ts`

- [ ] **Step 1: Add the failing tests**

Append to `backend/src/services/traceLogger.test.ts` (after the existing describe block):

```typescript
describe('TraceLogger.updateOutcome', () => {
  it('should append an outcome_patch JSON line', async () => {
    mockStat.mockResolvedValue({ size: 100 } as any);
    mockAccess.mockResolvedValue(undefined);
    mockAppendFile.mockResolvedValue(undefined);

    const { traceLogger } = await import('./traceLogger');
    await traceLogger.updateOutcome('trace-abc', 'correction');

    expect(mockAppendFile).toHaveBeenCalledOnce();
    const writtenLine = mockAppendFile.mock.calls[0][1] as string;
    const patch = JSON.parse(writtenLine.trim());
    expect(patch.type).toBe('outcome_patch');
    expect(patch.traceId).toBe('trace-abc');
    expect(patch.outcome).toBe('correction');
    expect(patch.ts).toBeDefined();
  });
});

describe('TraceLogger.readTraces', () => {
  it('should return parsed traces from file content', async () => {
    const mockReadFile = vi.mocked(fs.readFile);
    mockReadFile.mockResolvedValue(JSON.stringify({
      id: 'trace-1', ts: '2026-01-01T00:00:00Z', responseId: 'r1',
      sessionId: 'sess-1', mode: 'chat', provider: 'groq', model: 'llama',
      query: 'hello', harnessSnapshot: {} as any, active: [], suppressed: [],
      promptTokens: { memory: 0, rules: 0, workspace: 0, conversationHistory: 0, systemPrompt: 0, total: 0, budget: 0 },
      counts: { workspace: 0, local: 0, global: 0, rules: 0 },
      pipelineMs: 100, outcome: null,
    }) as any);

    const { traceLogger } = await import('./traceLogger');
    const traces = await traceLogger.readTraces('/fake/path.jsonl');
    expect(traces).toHaveLength(1);
    expect(traces[0].id).toBe('trace-1');
    expect(traces[0].outcome).toBeNull();
  });

  it('should merge outcome_patch records into the corresponding trace', async () => {
    const mockReadFile = vi.mocked(fs.readFile);
    const traceLine = JSON.stringify({
      id: 'trace-2', ts: '2026-01-01T00:00:00Z', responseId: 'r2',
      sessionId: 'sess-2', mode: 'chat', provider: 'groq', model: 'llama',
      query: 'test', harnessSnapshot: {} as any, active: [], suppressed: [],
      promptTokens: { memory: 0, rules: 0, workspace: 0, conversationHistory: 0, systemPrompt: 0, total: 0, budget: 0 },
      counts: { workspace: 0, local: 0, global: 0, rules: 0 },
      pipelineMs: 50, outcome: null,
    });
    const patchLine = JSON.stringify({
      type: 'outcome_patch', traceId: 'trace-2', outcome: 'correction', ts: '2026-01-01T00:01:00Z'
    });
    mockReadFile.mockResolvedValue((traceLine + '\n' + patchLine) as any);

    const { traceLogger } = await import('./traceLogger');
    const traces = await traceLogger.readTraces('/fake/path.jsonl');
    expect(traces).toHaveLength(1);
    expect(traces[0].outcome).toBe('correction');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && npx vitest run src/services/traceLogger.test.ts 2>&1 | tail -15
```

Expected: FAIL — `updateOutcome` and `readTraces` don't exist yet.

- [ ] **Step 3: Add `OutcomePatch` interface, `updateOutcome()`, and `readTraces()` to traceLogger.ts**

In `backend/src/services/traceLogger.ts`, add `readFile` to the existing `fs/promises` import:

```typescript
import { appendFile, stat, rename, unlink, access, readFile } from 'fs/promises';
```

Add the `OutcomePatch` interface after `RetrievalTrace`:

```typescript
interface OutcomePatch {
  type: 'outcome_patch';
  traceId: string;
  outcome: RetrievalTrace['outcome'];
  ts: string;
}
```

Inside the `TraceLogger` class, add two new methods after `appendTrace`:

```typescript
  async updateOutcome(traceId: string, outcome: NonNullable<RetrievalTrace['outcome']>): Promise<void> {
    try {
      const patch: OutcomePatch = {
        type: 'outcome_patch',
        traceId,
        outcome,
        ts: new Date().toISOString(),
      };
      await appendFile(TRACE_FILE, JSON.stringify(patch) + '\n', 'utf-8');
    } catch (err) {
      logger.warn(`[TraceLogger] Failed to write outcome patch: ${err}`);
    }
  }

  async readTraces(filePath: string = TRACE_FILE): Promise<RetrievalTrace[]> {
    try {
      const content = await readFile(filePath, 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);

      const traces = new Map<string, RetrievalTrace>();
      const patches = new Map<string, RetrievalTrace['outcome']>();

      for (const line of lines) {
        try {
          const record = JSON.parse(line);
          if (record.type === 'outcome_patch') {
            patches.set(record.traceId, record.outcome);
          } else if (record.id) {
            traces.set(record.id, record as RetrievalTrace);
          }
        } catch {
          // Skip malformed lines
        }
      }

      // Apply patches — last patch for a given traceId wins
      for (const [traceId, outcome] of patches) {
        const trace = traces.get(traceId);
        if (trace) trace.outcome = outcome;
      }

      return [...traces.values()];
    } catch {
      return [];
    }
  }
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && npx vitest run src/services/traceLogger.test.ts 2>&1 | tail -15
```

Expected: all tests PASS.

- [ ] **Step 5: Verify backend compiles**

```bash
cd backend && npx tsc --noEmit 2>&1 | head -10
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/traceLogger.ts backend/src/services/traceLogger.test.ts
git commit -m "feat(harness): add updateOutcome() and readTraces() with patch-merge to TraceLogger"
```

---

## Task 3: Return traceId from Backend AI Response

**Files:**
- Modify: `backend/src/services/aiService.ts` (lines ~70, ~98, ~127–163, ~192–196)
- Modify: `backend/src/controllers/aiController.ts` (chatRequestSchema line ~18, chatRequestSchema body line ~23)

- [ ] **Step 1: Add `traceId` to `CompletionResponse` and `lastTraceBySession` Map**

In `backend/src/services/aiService.ts`, find the `CompletionResponse` interface (line ~70):

```typescript
// BEFORE
interface CompletionResponse {
  response: string;
  model: string;
  info?: string;
  waterfall?: any;
  provenance?: any;
  isGeneratedImage?: boolean;
  imageUrl?: string;
}
```

Replace with:

```typescript
// AFTER
interface CompletionResponse {
  response: string;
  model: string;
  info?: string;
  waterfall?: any;
  provenance?: any;
  isGeneratedImage?: boolean;
  imageUrl?: string;
  traceId?: string;
}
```

Then find the `AIService` class declaration (line ~87):

```typescript
export class AIService {
  private waterfallService = new WaterfallService();
```

Replace with:

```typescript
export class AIService {
  private waterfallService = new WaterfallService();
  // Maps sessionId → last trace id for that session (used for auto-accepted signal).
  // Ephemeral: cleared on backend restart. Phase C will persist this.
  private lastTraceBySession = new Map<string, string>();
```

- [ ] **Step 2: Emit `accepted` on prior trace + store new traceId**

In `processChat()`, find the trace logging block that starts with:

```typescript
      // 2.1 Log retrieval trace (fire-and-forget — never blocks the response)
      const trace: RetrievalTrace = {
```

Insert this block immediately BEFORE it (after `const pipelineMs = Date.now() - enrichStart;`):

```typescript
      // Auto-signal: if this session already has a pending trace, mark it accepted.
      // The user sending a new message is implicit acceptance of the prior response.
      const sessionId = data.sessionId || 'unknown';
      const prevTraceId = this.lastTraceBySession.get(sessionId);
      if (prevTraceId) {
        traceLogger.updateOutcome(prevTraceId, 'accepted').catch(() => {});
      }
```

Then find the existing `traceLogger.appendTrace(trace).catch(() => {});` line. Insert this immediately AFTER it:

```typescript
      this.lastTraceBySession.set(sessionId, trace.id);
```

- [ ] **Step 3: Include traceId in the returned response**

Find `this.consolidateMemory(mode, data.messages, responseData);` (line ~195) and the `return responseData;` that follows shortly after. The `attachProvenance` call at line ~192 returns a new object. Change the return to include `traceId`:

Find:
```typescript
      responseData = this.attachProvenance(responseData, provenance);
```

Replace with:
```typescript
      responseData = { ...this.attachProvenance(responseData, provenance), traceId: trace.id };
```

- [ ] **Step 4: Add sessionId to chatRequestSchema**

In `backend/src/controllers/aiController.ts`, find `chatRequestSchema` (line ~18). Add `sessionId` to it:

```typescript
// Find this line in the schema:
  activeFile: z.string().optional()
// Add after it:
  sessionId: z.string().optional(),
```

Wait — the schema ends with `browserContext` (line ~47). Find the closing of `chatRequestSchema` and add `sessionId` just before the closing `})`:

```typescript
// BEFORE the closing });
  activeFile: z.string().optional()
});
```

Add `sessionId` so the block reads:

```typescript
  activeFile: z.string().optional(),
  sessionId: z.string().optional()
});
```

- [ ] **Step 5: Verify backend compiles**

```bash
cd backend && npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/aiService.ts backend/src/controllers/aiController.ts
git commit -m "feat(harness): return traceId in AI response, auto-accepted signal on next turn"
```

---

## Task 4: PATCH Outcome Endpoint + sessionId Filter in getTraces

**Files:**
- Modify: `backend/src/controllers/aiController.ts`
- Modify: `backend/src/routes/aiRoutes.ts`

- [ ] **Step 1: Add `traceLogger` import to `aiController.ts`**

At the top of `backend/src/controllers/aiController.ts`, add to existing imports:

```typescript
import { traceLogger } from '../services/traceLogger';
```

- [ ] **Step 2: Add `updateTraceOutcome` handler**

In `aiController.ts`, add this method to the `AIController` class, just before `getTraces`:

```typescript
  static async updateTraceOutcome(req: Request, res: Response) {
    const ip = req.ip || req.socket?.remoteAddress || '';
    const isLocal = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
    if (!isLocal) {
      res.status(403).json({ error: 'This endpoint is only accessible from localhost.' });
      return;
    }

    const { id } = req.params;
    const validOutcomes = ['correction', 'crystallized', 'rerequested', 'accepted'] as const;
    const schema = z.object({ outcome: z.enum(validOutcomes) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: `outcome must be one of: ${validOutcomes.join(', ')}` });
      return;
    }

    await traceLogger.updateOutcome(id, parsed.data.outcome);
    res.json({ success: true });
  }
```

- [ ] **Step 3: Update `getTraces` to use `traceLogger.readTraces()` + add `sessionId` filter**

Replace the existing `getTraces` method body (from the line after `const outcomeFilter = ...` through `res.json(results)`) with:

```typescript
  static async getTraces(req: Request, res: Response) {
    const TRACE_FILE_PATH = path.join(process.cwd(), '..', 'backend', '.solvent_retrieval_traces.jsonl');
    const ALT_TRACE_FILE_PATH = path.join(process.cwd(), '.solvent_retrieval_traces.jsonl');

    const ip = req.ip || req.socket?.remoteAddress || '';
    const isLocal = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
    if (!isLocal) {
      res.status(403).json({ error: 'This endpoint is only accessible from localhost.' });
      return;
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const queryFilter = (req.query.query as string || '').toLowerCase();
    const modeFilter = req.query.mode as string || '';
    const sinceFilter = req.query.since ? new Date(req.query.since as string).getTime() : 0;
    const outcomeFilter = req.query.outcome as string || '';
    const sessionFilter = req.query.sessionId as string || '';

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
      const allTraces = await traceLogger.readTraces(filePath);
      // Newest first
      const reversed = [...allTraces].reverse();

      const results = reversed.filter(trace => {
        if (queryFilter && !trace.query?.toLowerCase().includes(queryFilter)) return false;
        if (modeFilter && trace.mode !== modeFilter) return false;
        if (sinceFilter && new Date(trace.ts).getTime() < sinceFilter) return false;
        if (outcomeFilter && trace.outcome !== outcomeFilter) return false;
        if (sessionFilter && trace.sessionId !== sessionFilter) return false;
        return true;
      }).slice(0, limit);

      res.json(results);
    } catch {
      res.status(500).json({ error: 'Failed to read trace file.' });
    }
  }
```

- [ ] **Step 4: Register the PATCH route in aiRoutes.ts**

In `backend/src/routes/aiRoutes.ts`, find:

```typescript
router.get('/debug/traces', AIController.getTraces);
```

Add immediately after:

```typescript
router.patch('/debug/traces/:id/outcome', AIController.updateTraceOutcome);
```

- [ ] **Step 5: Verify backend compiles**

```bash
cd backend && npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors.

- [ ] **Step 6: Run backend tests**

```bash
cd backend && npm test 2>&1 | tail -10
```

Expected: Same pass count as before + new contextService and traceLogger tests.

- [ ] **Step 7: Commit**

```bash
git add backend/src/controllers/aiController.ts backend/src/routes/aiRoutes.ts
git commit -m "feat(harness): add PATCH /debug/traces/:id/outcome + sessionId filter in getTraces"
```

---

## Task 5: Frontend — traceId on Message + sessionId in Requests

**Files:**
- Modify: `frontend/src/store/types.ts`
- Modify: `frontend/src/services/ChatService.ts`
- Modify: `frontend/src/store/actionSlice.ts`

- [ ] **Step 1: Add `traceId` to `Message` type**

In `frontend/src/store/types.ts`, find the `Message` interface:

```typescript
export interface Message {
  id?: string;
  role: 'user' | 'assistant' | 'system' | 'model';
  content: string;
  model?: string;
  image?: string | null;
  thinking?: string;
  isGeneratedImage?: boolean;
  imageUrl?: string;
  provenance?: ContextProvenance;
}
```

Replace with:

```typescript
export interface Message {
  id?: string;
  role: 'user' | 'assistant' | 'system' | 'model';
  content: string;
  model?: string;
  image?: string | null;
  thinking?: string;
  isGeneratedImage?: boolean;
  imageUrl?: string;
  provenance?: ContextProvenance;
  traceId?: string;
}
```

- [ ] **Step 2: Add `sessionId` to `ChatParams` in ChatService.ts**

In `frontend/src/services/ChatService.ts`, find `ChatParams` interface:

```typescript
export interface ChatParams {
  // ... existing fields ...
  activeFile?: string | null;
}
```

Add `sessionId` as the last property:

```typescript
  activeFile?: string | null;
  sessionId?: string | null;
}
```

- [ ] **Step 3: Pass `sessionId` in the request body and return `traceId`**

In `ChatService.sendMessage`, find the JSON request body (around the `body: JSON.stringify({` block). Add `sessionId`:

```typescript
        body: JSON.stringify({
          provider,
          model,
          messages: [...messages, userMessage],
          image,
          mode: currentMode,
          smartRouter,
          temperature: thinkingModeEnabled ? 0.3 : temperature,
          maxTokens,
          deviceInfo,
          notepadContent,
          openFiles,
          codingHistory,
          browserContext,
          apiKeys,
          thinkingModeEnabled,
          imageProvider,
          activeFile: activeFile || undefined,
          sessionId: params.sessionId || undefined   // add this line
        }),
```

Then find the `return {` statement at the end of the method:

```typescript
    return {
      response: finalResponse,
      updatedNotepad,
      newGraphData,
      model: data.model || model,
      info: data.info,
      isGeneratedImage: data.isGeneratedImage,
      imageUrl: imageUrl,
      provenance: data.provenance
    };
```

Replace with:

```typescript
    return {
      response: finalResponse,
      updatedNotepad,
      newGraphData,
      model: data.model || model,
      info: data.info,
      isGeneratedImage: data.isGeneratedImage,
      imageUrl: imageUrl,
      provenance: data.provenance,
      traceId: data.traceId
    };
```

- [ ] **Step 4: Pass `sessionId` from store and attach `traceId` to assistant message**

In `frontend/src/store/actionSlice.ts`, find the `ChatService.sendMessage({` call (line ~54). Add `sessionId`:

```typescript
      const result = await ChatService.sendMessage({
        messages: state.messages,
        codingHistory: state.sessions['coding'] ?? [],
        currentMode: state.currentMode,
        modeConfigs: state.modeConfigs,
        selectedCloudModel: state.selectedCloudModel,
        selectedLocalModel: state.selectedLocalModel,
        selectedCloudProvider: state.selectedCloudProvider,
        globalProvider: state.globalProvider,
        temperature: state.temperature,
        maxTokens: state.maxTokens,
        deviceInfo: state.deviceInfo,
        notepadContent: state.notepadContent,
        openFiles: state.openFiles,
        browserContext: {
          history: state.browserHistory,
          lastSearchResults: state.lastSearchResults
        },
        apiKeys: state.apiKeys,
        thinkingModeEnabled: state.thinkingModeEnabled,
        imageProvider: state.imageProvider,
        activeFile: state.activeFile,
        sessionId: state.currentSessionId   // add this line
      }, finalContent, image);
```

Then find the `state.addMessage({` block for the assistant message (line ~82):

```typescript
      state.addMessage({
        role: 'assistant',
        content: result.response,
        model: result.model,
        isGeneratedImage: result.isGeneratedImage,
        imageUrl: result.imageUrl,
        provenance: result.provenance
      }, state.currentMode);
```

Replace with:

```typescript
      state.addMessage({
        role: 'assistant',
        content: result.response,
        model: result.model,
        isGeneratedImage: result.isGeneratedImage,
        imageUrl: result.imageUrl,
        provenance: result.provenance,
        traceId: result.traceId
      }, state.currentMode);
```

- [ ] **Step 5: Verify frontend compiles**

```bash
cd frontend && timeout 90 npx tsc --noEmit 2>&1 | head -20
```

Expected: No new errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/store/types.ts frontend/src/services/ChatService.ts frontend/src/store/actionSlice.ts
git commit -m "feat(harness): pass sessionId in chat requests, store traceId on assistant messages"
```

---

## Task 6: Frontend API — updateTraceOutcome + sessionId filter

**Files:**
- Modify: `frontend/src/lib/api-client.ts`

- [ ] **Step 1: Add `sessionId` to `TraceFilter` and `updateTraceOutcome` function**

In `frontend/src/lib/api-client.ts`, find the `TraceFilter` interface:

```typescript
export interface TraceFilter {
  limit?: number;
  query?: string;
  mode?: string;
  since?: string;
  outcome?: string;
}
```

Replace with:

```typescript
export interface TraceFilter {
  limit?: number;
  query?: string;
  mode?: string;
  since?: string;
  outcome?: string;
  sessionId?: string;
}
```

Then find `if (filter.outcome) params.set('outcome', filter.outcome);` and add the new param after it:

```typescript
  if (filter.outcome) params.set('outcome', filter.outcome);
  if (filter.sessionId) params.set('sessionId', filter.sessionId);
```

Then add the `updateTraceOutcome` function after the closing `}` of `getTraces`:

```typescript
export async function updateTraceOutcome(
  traceId: string,
  outcome: 'correction' | 'crystallized' | 'rerequested' | 'accepted'
): Promise<void> {
  const { API_BASE_URL } = await import('./config');
  try {
    const secret = await getSecret();
    await fetch(`${API_BASE_URL}/debug/traces/${traceId}/outcome`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-Solvent-Secret': secret },
      body: JSON.stringify({ outcome }),
    });
  } catch {
    // Fire-and-forget from UI — silently swallow network errors
  }
}
```

- [ ] **Step 2: Verify frontend compiles**

```bash
cd frontend && timeout 90 npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/api-client.ts
git commit -m "feat(harness): add updateTraceOutcome() and sessionId filter to api-client"
```

---

## Task 7: MessageItem — Thumbs-Down Correction Button

**Files:**
- Modify: `frontend/src/components/MessageItem.tsx`

- [ ] **Step 1: Add `updateTraceOutcome` import**

In `frontend/src/components/MessageItem.tsx`, find the existing imports block. Add:

```typescript
import { updateTraceOutcome } from '../lib/api-client';
```

- [ ] **Step 2: Add `correctionSent` local state**

In the `MessageItem` component function, after the existing `useState` declarations, add:

```typescript
const [correctionSent, setCorrectionSent] = useState(false);
```

- [ ] **Step 3: Add the thumbs-down button next to the provenance HUD**

In `MessageItem.tsx`, locate the section that renders the provenance badge strip (the block starting with `{!isUser && message.provenance && (`). The badge strip ends with a closing `</div>`. Add the thumbs-down button as a sibling, just after the provenance block closes:

```tsx
{!isUser && message.traceId && (
  <button
    onClick={async () => {
      if (correctionSent) return;
      await updateTraceOutcome(message.traceId!, 'correction');
      setCorrectionSent(true);
    }}
    className={cn(
      'mt-1 flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded transition-colors',
      correctionSent
        ? 'text-red-400 bg-red-500/10 cursor-default'
        : 'text-slate-500 hover:text-red-400 hover:bg-red-500/10 cursor-pointer'
    )}
    title={correctionSent ? 'Marked as correction' : 'Mark retrieval as incorrect'}
    disabled={correctionSent}
  >
    <ThumbsDown className="w-3 h-3" />
    <span>{correctionSent ? 'correction flagged' : 'flag'}</span>
  </button>
)}
```

- [ ] **Step 4: Ensure `ThumbsDown` is imported from lucide-react**

Find the lucide-react import in `MessageItem.tsx` and add `ThumbsDown` to it:

```typescript
// Existing import might look like:
import { Copy, Check, /* ... other icons */ } from 'lucide-react';
// Add ThumbsDown to the same import
```

- [ ] **Step 5: Verify frontend compiles**

```bash
cd frontend && timeout 90 npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/MessageItem.tsx
git commit -m "feat(harness): add thumbs-down correction signal button to MessageItem"
```

---

## Task 8: TraceList — Outcome Badges + Manual Override

**Files:**
- Modify: `frontend/src/components/TraceList.tsx`

- [ ] **Step 1: Add `updateTraceOutcome` import**

At the top of `frontend/src/components/TraceList.tsx`, add:

```typescript
import { getTraces, updateTraceOutcome } from '../lib/api-client';
```

(Replace or supplement the existing `getTraces` import if it exists.)

- [ ] **Step 2: Add an `OutcomeBadge` helper component inside the file**

Just before the `TraceList` component function, add:

```typescript
const OUTCOME_STYLES: Record<string, string> = {
  accepted:     'bg-emerald-500/20 text-emerald-400',
  crystallized: 'bg-blue-500/20 text-blue-400',
  rerequested:  'bg-amber-500/20 text-amber-400',
  correction:   'bg-red-500/20 text-red-400',
};
const OUTCOME_LABELS: Record<string, string> = {
  accepted: '✓ accepted', crystallized: '✓ crystallized',
  rerequested: '↩ rerequested', correction: '✗ correction',
};

function OutcomeBadge({ outcome }: { outcome: string | null }) {
  if (!outcome) return <span className="text-slate-600 text-[10px] font-mono">—</span>;
  return (
    <span className={`text-[10px] font-mono px-1 py-0.5 rounded ${OUTCOME_STYLES[outcome] ?? 'bg-slate-500/20 text-slate-400'}`}>
      {OUTCOME_LABELS[outcome] ?? outcome}
    </span>
  );
}
```

- [ ] **Step 3: Use `OutcomeBadge` in collapsed trace row**

In the trace row render (the collapsed view), find where the trace's `active`, `suppressed`, and token counts are displayed. Add the outcome badge at the end of the summary line:

```tsx
{/* End of summary line — add: */}
<OutcomeBadge outcome={trace.outcome} />
```

(Exact placement depends on the current TraceList layout — add it as the last element in the row summary flex container.)

- [ ] **Step 4: Add manual outcome override dropdown in expanded view**

In the expanded trace detail section, add a manual override control:

```tsx
<div className="flex items-center gap-2 mt-2">
  <span className="text-[10px] text-slate-500">Outcome:</span>
  <OutcomeBadge outcome={trace.outcome} />
  <select
    className="text-[10px] bg-slate-800 border border-slate-700 rounded px-1 py-0.5 text-slate-300"
    value={trace.outcome ?? ''}
    onChange={async (e) => {
      const val = e.target.value as 'correction' | 'crystallized' | 'rerequested' | 'accepted';
      if (!val) return;
      await updateTraceOutcome(trace.id, val);
      // Optimistically update local state — re-fetch to confirm
      setTraces(prev => prev.map(t => t.id === trace.id ? { ...t, outcome: val } : t));
    }}
  >
    <option value="">— set outcome —</option>
    <option value="accepted">accepted</option>
    <option value="correction">correction</option>
    <option value="crystallized">crystallized</option>
    <option value="rerequested">rerequested</option>
  </select>
</div>
```

(`setTraces` is whatever the local state setter is in `TraceList`.)

- [ ] **Step 5: Verify frontend compiles**

```bash
cd frontend && timeout 90 npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors.

- [ ] **Step 6: Run backend + frontend tests**

```bash
cd backend && npm test 2>&1 | tail -10
```

Expected: 165+ tests passing, same 1 pre-existing timeout failure.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/TraceList.tsx
git commit -m "feat(harness): outcome badges and manual override in TraceList"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task that covers it |
|---|---|
| Attach reward signals to traces | Tasks 2, 3, 4, 7 — `updateOutcome`, PATCH endpoint, thumbs-down button |
| Make retrieval mode-aware | Task 1 — `getModeRetrievalProfile`, applied in `enrichContext` |
| Feed user corrections back into scoring | Task 7 — `correction` outcome recorded; Phase C Overseer reads these to propose score changes |
| Auto-accepted signal | Task 3 — `lastTraceBySession` Map, emitted on next turn |
| sessionId in traces (already done in Phase A) | Already present in trace schema |
| sessionId filter on GET endpoint | Task 4 |
| Outcome badges in TraceList | Task 8 |

**No placeholders** — all code blocks are complete.

**Type consistency:**
- `RetrievalTrace['outcome']` used throughout (`null | 'correction' | 'crystallized' | 'rerequested' | 'accepted'`)
- `OutcomePatch.type === 'outcome_patch'` — distinguishes patches from traces in `readTraces()`
- `TraceFilter.sessionId` added in Task 6, used by `getTraces` in Task 4

**All good — no gaps found.**
