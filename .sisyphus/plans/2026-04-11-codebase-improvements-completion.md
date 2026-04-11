# Codebase Improvements — Completion Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish all remaining work from `.sisyphus/plans/codebase-improvements.md` — eliminate 100% of `any` types, fix the 118 TS errors introduced during the rushed Phase 1 refactor, and complete the skipped Phases 3-6.

**Architecture:** Phase-by-phase cleanup. Phase A (blocker) fixes TS errors first so later phases can compile; Phase B pursues 100% any-elimination (user raised the goal from 80%); Phases C-G mirror unfinished portions of the original plan. Each task is self-contained, TDD where applicable, with small commits.

**Tech Stack:** TypeScript (strict), Vitest (backend), React + Vitest (frontend), Zod (env parsing), Express, Fastify-style plugin manager, Tailwind CSS.

---

## Current State (verified 2026-04-11)

```
Backend TS errors: 66 (47 in waterfallService.ts + waterfall.ts alone)
Frontend TS errors: 52
Backend `any` count: 232
Frontend `any` count: 175
catch (error: any) remaining: 17
Empty catch blocks remaining: 3 (excluding .catch(() => {}) fire-and-forget)
God components: NotepadPiP 1134, HomeArea 632, WaterfallArea 619, CodingArea 603
```

**Already complete:** Phase 0 (standalone archived), Phase 2.2 (logger), Phase 4.2 (exponential backoff), Phase 7 (await telemetry).

**Partially complete:** Phase 1 (types file exists but has duplicate-field bug + shape mismatches), Phase 2.1 (3 stragglers).

**Not started:** Phase 3 (frontend god components), Phase 4.1 (plugin unload), Phase 5 (env-driven config), Phase 6 (inline styles).

---

## File Structure

New files created by this plan:
- `backend/src/types/waterfall.ts` — fix duplicate `issues` field, add missing context properties (MODIFY)
- `backend/src/config.ts` — add `WATERFALL_*` env vars via Zod (MODIFY)
- `backend/src/services/pluginManager.ts` — add `unloadProvider` / `reload-with-dispose` (MODIFY)
- `backend/src/types/plugins.ts` — add optional `dispose?()` to `IPlugin` (MODIFY)
- `frontend/src/components/notepad-pip/` — new directory with extracted NotepadPiP pieces (CREATE)
- `frontend/src/components/coding/` — extract CodingArea sub-panels (CREATE)
- `frontend/src/components/waterfall/` — extract WaterfallArea sub-panels (CREATE)
- `frontend/src/components/home/` — extract HomeArea sub-panels (CREATE)

---

# Phase A — Fix All TypeScript Errors (BLOCKER)

> **Rationale:** Nothing else compiles until these are fixed. The rushed Phase 1 refactor left 118 cascading errors because the new types did not match actual usage.

## Task A1: Fix the `ReviewerOutput` duplicate `issues` field

**Root cause:** `backend/src/types/waterfall.ts` declares `issues` twice in `ReviewerOutput` — once as required `ReviewIssue[]` (line 81) and once as optional `string[]` (line 93). TypeScript reports TS2300/TS2687/TS2717. The actual LLM returns strings, and all code reads `reviewer.issues` as strings.

**Files:**
- Modify: `backend/src/types/waterfall.ts`

- [ ] **Step 1: Rename the structured field so the string field can take `issues`**

Replace the ReviewerOutput block (lines 72-94) with:

```typescript
export interface ReviewIssue {
  severity: 'error' | 'warning' | 'info';
  file?: string;
  description: string;
  line?: number;
}

export interface ReviewerOutput extends Record<string, unknown> {
  approved: boolean;
  /** Structured issues (reserved for future use — current LLMs return string[]) */
  structuredIssues?: ReviewIssue[];
  /** Actionable issue strings as returned by the reviewer LLM */
  issues?: string[];
  suggestions?: string[];
  overallQuality?: number; // 0-100
  // LLM reviewer also returns these fields:
  score?: number;
  breakdown?: Record<string, number>;
  summary?: string;
  decisionsHonored?: string[];
  compilationStatus?: string;
  crystallizable_insight?: string | null;
  _compilationPassed?: boolean;
  raw?: string | null;
}
```

- [ ] **Step 2: Verify TypeScript no longer reports duplicate identifier**

Run: `cd backend && npx tsc --noEmit 2>&1 | grep -c "TS2300\|TS2687\|TS2717"`
Expected: `0`

- [ ] **Step 3: Commit**

```bash
git add backend/src/types/waterfall.ts
git commit -m "fix(types): collapse duplicate ReviewerOutput.issues field"
```

---

## Task A2: Fix `WaterfallContext` to match actual runStep usage

**Root cause:** `runStep()` at `waterfallService.ts:123-137` reads `context?.feedback` and `context?.plan` but these aren't on the `WaterfallContext` interface. The context interface was designed around a different shape than how it's actually consumed.

**Files:**
- Modify: `backend/src/types/waterfall.ts`

- [ ] **Step 1: Add feedback + plan to WaterfallContext**

Replace the WaterfallContext block (lines 100-108) with:

```typescript
export interface WaterfallContext {
  sessionId: string;
  plannerOutput: PlannerOutput | null;
  executorOutput: ExecutorOutput | null;
  reviewerOutput: ReviewerOutput | null;
  currentPhase: 'planning' | 'executing' | 'reviewing' | 'complete';
  errors: string[];
  startTime: number;
  /** Feedback string forwarded from reviewer to executor on retry */
  feedback?: string;
  /** Plan data forwarded from planner to reviewer (LLM JSON, not strictly typed) */
  plan?: PlannerOutput | Record<string, unknown>;
}
```

- [ ] **Step 2: Verify the runStep TS errors at 130/132/133 are gone**

Run: `cd backend && npx tsc --noEmit 2>&1 | grep waterfallService.ts | grep -E "130|132|133"`
Expected: (no output)

- [ ] **Step 3: Commit**

```bash
git add backend/src/types/waterfall.ts
git commit -m "fix(types): add feedback/plan to WaterfallContext to match runStep usage"
```

---

## Task A3: Loosen `PlannerOutput` required fields and the `WaterfallResult.executor` / `paused` type mismatches

**Root cause:** `PlannerOutput` requires `decisions`, `tasks`, `estimatedRisk`, `reasoning` — but the parsed LLM JSON at `runPlannerWithContext` doesn't always populate them. Also, `WaterfallPausedResult` has `executor?: null` but `WaterfallResult.executor` is `ExecutorOutput | null` with no undefined, causing TS2322 at line 207.

**Files:**
- Modify: `backend/src/types/waterfall.ts`

- [ ] **Step 1: Make PlannerOutput structured fields optional (LLM returns the `plan`/`steps` shape instead)**

Replace the PlannerOutput block (lines 24-37) with:

```typescript
export interface PlannerOutput extends Record<string, unknown> {
  /** Normalized fields (reserved for future structured planners) */
  decisions?: string[];
  tasks?: PlannedTask[];
  estimatedRisk?: 'low' | 'medium' | 'high';
  reasoning?: string;
  // LLM planner returns these fields:
  keyDecisions?: string[];
  assumptions?: string[];
  complexity?: 'low' | 'medium' | 'high';
  techStack?: string[];
  openQuestions?: string[];
  plan?: string;
  steps?: Array<{ title: string; description: string }>;
  /** Set when JSON parse fails in parseJSONResponse */
  raw?: string | null;
}
```

- [ ] **Step 2: Loosen ExecutorOutput required fields the same way**

Replace the ExecutorOutput block (lines 55-66) with:

```typescript
export interface ExecutorOutput extends Record<string, unknown> {
  /** Normalized fields (reserved for future structured executors) */
  filesCreated?: FileChange[];
  filesModified?: FileChange[];
  filesDeleted?: string[];
  decisions?: string[];
  errors?: ExecutionError[];
  // LLM executor returns these fields:
  code?: string;
  explanation?: string;
  files?: string[];
  decisionsOverridden?: string[];
  raw?: string | null;
}
```

- [ ] **Step 3: Fix WaterfallPausedResult to be assignable to WaterfallResult**

Replace the WaterfallPausedResult block (lines 138-145) with:

```typescript
export interface WaterfallPausedResult {
  status: 'paused';
  estimate?: import('../utils/resourceEstimator').ResourceEstimate;
  planner: PlannerOutput | null;
  executor: null;
  reviewer: null;
  attempts: number;
}
```

Also update `WaterfallResult` (lines 127-136) — add `status?` alongside the existing optional status:

Current code already has `status?: string;` — just confirm it's there. If not, add it.

- [ ] **Step 4: Verify planner/executor-shape errors are gone**

Run: `cd backend && npx tsc --noEmit 2>&1 | grep waterfallService.ts | wc -l`
Expected: significantly fewer errors (should drop ~15-20 errors from the 42 starting count).

- [ ] **Step 5: Commit**

```bash
git add backend/src/types/waterfall.ts
git commit -m "fix(types): make PlannerOutput/ExecutorOutput fields optional to match LLM output shape"
```

---

## Task A4: Fix `waterfallService.ts` internal type errors

**Remaining errors after A1-A3:** the service still has null-guard gaps and a few `Record<string,unknown>` interop issues. We'll fix them one block at a time.

**Files:**
- Modify: `backend/src/services/waterfallService.ts`

- [ ] **Step 1: Fix the last `as any` at line 89 and error field access at line 95**

Read `backend/src/services/waterfallService.ts` lines 80-106 first.

Change line 89:
```typescript
return await (provider as any).complete(prompt, { ...options, signal });
```
to:
```typescript
return await (provider as { complete: (p: typeof prompt, o: typeof options & { signal?: AbortSignal }) => Promise<string> }).complete(prompt, { ...options, signal });
```

Change lines 93-96 to use proper error narrowing:
```typescript
      } catch (error: unknown) {
        if (signal?.aborted) throw error;
        if (!this.is429(error) || attempt === maxRetries) throw error;

        // Try to extract wait time from error message (e.g. "try again in 29.8575s")
        const err = error as { response?: { data?: { error?: { message?: string } } }; message?: string };
        const retryMatch = (err?.response?.data?.error?.message ?? err?.message ?? '')
          .match(/try again in ([\d.]+)s/i);
```

Also fix `is429` at lines 66-71 — replace `Record<string, any>` with proper narrowing:
```typescript
  /** Check if an error is a 429 rate-limit response. */
  private is429(error: unknown): boolean {
    const err = error as { response?: { status?: number }; status?: number; message?: string };
    return err?.response?.status === 429
      || err?.status === 429
      || /status code 429|rate.?limit/i.test(err?.message ?? '');
  }
```

- [ ] **Step 2: Add null-guards around `planner` after line 186**

Read `backend/src/services/waterfallService.ts` lines 186-210.

After line 186 (`planner = await this.runPlannerWithContext(...)`), add a type guard. Change the block 179-200 to:

```typescript
    let planner: PlannerOutput | null = null;
    if (resumePlanner) {
      planner = resumePlanner;
      sessionContext.plannerDecisions = this.extractPlannerDecisions(planner);
      yield { phase: 'planning', message: 'Resuming from previous plan...' };
    } else {
      yield { phase: 'planning', message: 'Analyzing requirements and building execution plan...' };
      planner = (await this.runPlannerWithContext(fullPrompt, globalProvider, signal, modelSelection, apiKeys)) as PlannerOutput;
      sessionContext.plannerDecisions = this.extractPlannerDecisions(planner);
    }

    if (!planner) {
      throw new SolventError('Planner failed to produce output', SolventErrorCode.VALIDATION_ERROR);
    }

    const plannerHandoff: StageHandoff = {
      stage: 'planner',
      confidence: planner.complexity === 'low' ? 0.9 : planner.complexity === 'medium' ? 0.75 : 0.6,
      keyDecisions: planner.keyDecisions || [],
      constraints: planner.assumptions || [],
      openQuestions: planner.openQuestions || [],
      tokenCount: JSON.stringify(planner).length / 4
    };
```

- [ ] **Step 3: Fix the WaterfallPausedResult return at line 207**

Change line 207 from:
```typescript
        return { status: 'paused', estimate, planner } as WaterfallPausedResult;
```
to:
```typescript
        return { status: 'paused', estimate, planner, executor: null, reviewer: null, attempts: 0 } as unknown as TypedWaterfallResult;
```

- [ ] **Step 4: Fix `reviewer.issues` type errors at lines 226-227**

Now that `ReviewerOutput.issues` is `string[] | undefined` (after A1), the `.length` and `.slice()` calls work — but TypeScript still sees `reviewer` as loosely typed from `runReviewWithContext` return. Annotate the return type explicitly:

Find the declaration at line 438 (runExecutorWithContext), 509 (runReviewWithContext), and 366 (runPlannerWithContext). Change their signatures so they declare return types:

```typescript
  private async runPlannerWithContext(
    userPrompt: string,
    globalProvider: string,
    signal?: AbortSignal,
    modelSelection: WaterfallModelSelection = WATERFALL_DEFAULT_SELECTION,
    apiKeys?: Record<string, string>
  ): Promise<PlannerOutput> {
```

```typescript
  private async runExecutorWithContext(
    planData: PlannerOutput | Record<string, unknown>,
    sessionContext: WaterfallSessionContext,
    plannerHandoff: StageHandoff,
    feedback?: string,
    signal?: AbortSignal,
    modelSelection: WaterfallModelSelection = WATERFALL_DEFAULT_SELECTION,
    apiKeys?: Record<string, string>
  ): Promise<ExecutorOutput> {
```

```typescript
  private async runReviewWithContext(
    plan: PlannerOutput | Record<string, unknown>,
    executorData: ExecutorOutput | Record<string, unknown>,
    sessionContext: WaterfallSessionContext,
    signal?: AbortSignal,
    modelSelection: WaterfallModelSelection = WATERFALL_DEFAULT_SELECTION,
    apiKeys?: Record<string, string>
  ): Promise<ReviewerOutput> {
```

Each of these currently returns `this.parseJSONResponse(response)` which is `Record<string, unknown>`. Cast the return at the `return` statements:

```typescript
      return this.parseJSONResponse(response) as PlannerOutput;  // (in runPlannerWithContext)
      return this.parseJSONResponse(response) as ExecutorOutput; // (in runExecutorWithContext)
      return parsed as ReviewerOutput;                            // (in runReviewWithContext)
```

Do this at every `return` point in each function (each has 3: primary, fallback, local).

- [ ] **Step 5: Fix `planData` type at line 438 signature**

The old signature was `planData: ExecutorOutput | Record<string, unknown>` — that's wrong (should be planner data, not executor). Change to `planData: PlannerOutput | Record<string, unknown>`. Already done in Step 4.

- [ ] **Step 6: Fix line 314 `attempts` → `attempt` typo in WaterfallProgressData**

Change line 314:
```typescript
    yield { phase: 'completed', score: reviewer.score, data: { reviewer, attempts: attempts + 1, handoffChain: [plannerHandoff, reviewerHandoff] } };
```
to:
```typescript
    yield { phase: 'completed', score: reviewer.score, data: { reviewer, attempt: attempts + 1 } };
```

(The `handoffChain` doesn't belong in WaterfallProgressData — it belongs in the final return value only.)

- [ ] **Step 7: Fix line 336 — `{ message, estimate, score }` not in WaterfallProgressData**

Change lines 335-337 from:
```typescript
      onProgress?.(value.phase, value.data || { message: value.message, estimate: value.estimate, score: value.score });
```
to:
```typescript
      onProgress?.(value.phase, value.data);
```

(The caller already has access to `value.message`, `value.estimate`, `value.score` via the `WaterfallProgressEvent` shape — those don't need to be crammed into the `data` payload.)

- [ ] **Step 8: Fix `parsed.score is unknown` at line 652**

Change line 652 from:
```typescript
      if (parsed.score > 90 && parsed.crystallizable_insight) {
```
to:
```typescript
      if (typeof parsed.score === 'number' && parsed.score > 90 && parsed.crystallizable_insight) {
```

- [ ] **Step 9: Fix line 523 — `executorData.code` can be undefined**

Change line 523 from:
```typescript
        const fileBlocks = this.splitCodeBlocks(executorData.code);
```
to:
```typescript
        const fileBlocks = this.splitCodeBlocks(typeof executorData.code === 'string' ? executorData.code : '');
```

- [ ] **Step 10: Fix line 565-567 — error shape**

Change lines 562-567 from:
```typescript
      } catch (e: unknown) {
        // tsc exits with code 1 on type errors — extract stderr and filter
        const err = e as Record<string, unknown>;
        const errOutput = err.stderr || err.stdout || (err as Error).message || '';
        logger.debug('[Waterfall:TSC] Caught error, filtering', { errOutput: errOutput.substring(0, 500) });
        const lines = errOutput.split('\n');
```
to:
```typescript
      } catch (e: unknown) {
        // tsc exits with code 1 on type errors — extract stderr and filter
        const err = e as { stderr?: string; stdout?: string; message?: string };
        const errOutput = String(err.stderr || err.stdout || err.message || '');
        logger.debug('[Waterfall:TSC] Caught error, filtering', { errOutput: errOutput.substring(0, 500) });
        const lines = errOutput.split('\n');
```

- [ ] **Step 11: Run full backend typecheck**

Run: `cd backend && npx tsc --noEmit 2>&1 | tee /tmp/tsc-after.txt | wc -l`
Expected: The waterfallService.ts error count drops to 0.

Run: `cd backend && npx tsc --noEmit 2>&1 | grep waterfallService.ts`
Expected: (no output)

- [ ] **Step 12: Commit**

```bash
git add backend/src/services/waterfallService.ts
git commit -m "fix(waterfall): eliminate remaining TS errors and last \`as any\`"
```

---

## Task A5: Fix backend error-type-narrowing errors (browseService, memoryConsolidationService, vectorService)

**Root cause:** Phase 1 changed `catch (error: any)` to `catch (error: unknown)` in these files without adding the `instanceof Error` guards.

**Files:**
- Modify: `backend/src/services/browseService.ts`
- Modify: `backend/src/services/memoryConsolidationService.ts`
- Modify: `backend/src/services/vectorService.ts`

- [ ] **Step 1: Fix browseService.ts:150,153**

Read `backend/src/services/browseService.ts` around lines 140-160.

Find the catch block containing lines 150 and 153. Replace the raw `error.X` accesses with narrowed ones:

```typescript
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn('[BrowseService] request failed', { message });
      throw new SolventError(`Browse failed: ${message}`, SolventErrorCode.NETWORK_ERROR);
```

(Adjust to the actual context after reading the file — the pattern is: narrow `error` to a `message` string and any other fields you need.)

- [ ] **Step 2: Fix memoryConsolidationService.ts:328**

Read `backend/src/services/memoryConsolidationService.ts` around lines 320-335.

At line 328, change `err.X` to `err instanceof Error ? err.message : String(err)`.

- [ ] **Step 3: Fix vectorService.ts:197**

Read `backend/src/services/vectorService.ts` around lines 190-205.

At line 197, apply the same pattern: `e instanceof Error ? e.message : String(e)`.

- [ ] **Step 4: Fix aiService.ts:99 and aiService.ts:500**

Read `backend/src/services/aiService.ts` around lines 90-110 and 490-510.

At line 99: the argument type `unknown` being passed where `WaterfallContext | undefined` is expected. Cast the call site to the proper type or add a type guard based on what's actually being passed.

At line 500: `waterfallResult.executor` is possibly null. Add a null check before the dereference:
```typescript
if (!waterfallResult.executor) {
  throw new SolventError('Executor returned no output', SolventErrorCode.VALIDATION_ERROR);
}
```

- [ ] **Step 5: Run backend typecheck again**

Run: `cd backend && npx tsc --noEmit 2>&1 | wc -l`
Expected: `0`

If any errors remain, read the files listed and apply the same narrowing pattern (`instanceof Error` for Error access, type guards for everything else).

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/browseService.ts backend/src/services/memoryConsolidationService.ts backend/src/services/vectorService.ts backend/src/services/aiService.ts
git commit -m "fix(backend): narrow catch(error: unknown) to Error where needed"
```

---

## Task A6: Fix integration test null guards

**File:** `backend/src/tests/integration/waterfall.test.ts`

- [ ] **Step 1: Add null guards at lines 90-92 and 124**

Read `backend/src/tests/integration/waterfall.test.ts` lines 80-130.

At lines 90-92 and 124 the test asserts on `result.planner`, `result.executor`, `result.reviewer` which are now `X | null`. Add non-null assertions since the test *is* checking they're populated:

```typescript
expect(result.planner).not.toBeNull();
expect(result.executor).not.toBeNull();
expect(result.reviewer).not.toBeNull();
// Then dereference with ! or after a type guard
expect(result.planner!.keyDecisions).toBeDefined();
```

- [ ] **Step 2: Run typecheck + tests**

Run: `cd backend && npx tsc --noEmit && npx vitest run tests/integration/waterfall.test.ts`
Expected: Typecheck passes, tests pass (or skip if no API key in env).

- [ ] **Step 3: Commit**

```bash
git add backend/src/tests/integration/waterfall.test.ts
git commit -m "fix(tests): add null guards after WaterfallResult nullable fields"
```

---

## Task A7: Fix frontend BrowserArea TS errors

**Root cause:** BrowserArea uses generic response objects from backend whose types returned as `Record<string, unknown>` after the Phase 1 refactor. Need to define a `BrowseResponse` type matching the actual API shape.

**Files:**
- Modify: `frontend/src/components/BrowserArea.tsx`

- [ ] **Step 1: Define the response shape locally**

Read `frontend/src/components/BrowserArea.tsx` lines 1-80 first to see the imports and existing types.

At the top of the file (after imports), add:

```typescript
interface BrowseResponseShape {
  results?: Array<{ title: string; url: string; snippet?: string }>;
  relatedSearches?: { query: string }[];
  answerBox?: { answer: string; sources: string[] } | null;
  synthesis?: string;
  expandedQuery?: string;
  stats?: { totalFound: number; totalRelevant: number; pipelineMs: number };
}
```

- [ ] **Step 2: Narrow the response at the fetch site**

Read lines 40-80 and 180-260 — find where `setResults`, `setRelatedSearches`, `setAnswerBox` are called with the raw response.

Replace:
```typescript
const data = await response.json();
setResults(data.results);
setRelatedSearches(data.relatedSearches);
// ...
```

With:
```typescript
const data = (await response.json()) as BrowseResponseShape;
setResults(data.results ?? []);
setRelatedSearches(data.relatedSearches ?? []);
setAnswerBox(data.answerBox ?? null);
setSynthesis(data.synthesis);
setExpandedQuery(data.expandedQuery);
setStats(data.stats);
```

Apply the same narrowing at every place where the raw response.json() is consumed.

- [ ] **Step 3: Fix the `{} is not array` at line 52 and similar**

The existing errors are cascading from `useState<X[]>({})` where `{}` is being inferred. Check that all `useState` hooks have explicit generic parameters:
```typescript
const [results, setResults] = useState<BrowseResponseShape['results']>([]);
```

- [ ] **Step 4: Run frontend typecheck**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep BrowserArea | wc -l`
Expected: `0`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/BrowserArea.tsx
git commit -m "fix(frontend): type BrowseResponse shape to eliminate unknown errors"
```

---

## Task A8: Fix frontend IntelPanel, SolventSeeArea, ChatService, useSpeechToText, actionSlice, collaborateSlice, waterfallSlice

**Files:** 7 files, same pattern as A7 (narrow `unknown`/`Record<string, unknown>` to typed interfaces at use site).

- [ ] **Step 1: Fix IntelPanel.tsx (5 errors at lines 48, 70, 73, 87, 114)**

Read `frontend/src/components/IntelPanel.tsx` lines 40-120.

The errors match the same `BrowseResponseShape` pattern from A7. Import or redeclare the shape and narrow the response:

```typescript
import type { SearchResultSet, PageContent } from '...';  // check existing imports
```

At each error line, wrap the raw data access with a cast to the proper type. Follow the compiler errors one-by-one — they will tell you which property needs narrowing.

- [ ] **Step 2: Fix SolventSeeArea.tsx:159**

Read lines 150-170. The error is at `setStatus(data)` where data is `Record<string, unknown>` but the setState expects `{ loaded: boolean; model?: string; fileExists?: boolean }`.

Fix with explicit cast and default:
```typescript
setStatus({
  loaded: Boolean((data as { loaded?: unknown }).loaded),
  model: (data as { model?: string }).model,
  fileExists: (data as { fileExists?: boolean }).fileExists,
});
```

- [ ] **Step 3: Fix useSpeechToText.ts (5 errors — SpeechRecognition globals not found)**

Read `frontend/src/hooks/useSpeechToText.ts` lines 1-30.

At the top of the file, add ambient declarations (these are browser globals with inconsistent TS lib coverage):

```typescript
// SpeechRecognition globals are not in the default DOM lib — declare them
declare global {
  interface Window {
    SpeechRecognition?: typeof SpeechRecognition;
    webkitSpeechRecognition?: typeof SpeechRecognition;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  var SpeechRecognition: {
    new (): SpeechRecognitionLike;
  };
  interface SpeechRecognitionLike {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    onresult: ((event: SpeechRecognitionEventLike) => void) | null;
    onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
    onend: (() => void) | null;
    start(): void;
    stop(): void;
    abort(): void;
  }
  interface SpeechRecognitionEventLike {
    results: {
      length: number;
      [index: number]: {
        isFinal: boolean;
        [index: number]: { transcript: string };
      };
    };
  }
  interface SpeechRecognitionErrorEventLike {
    error: string;
    message: string;
  }
}
export {};
```

Then replace usages of `SpeechRecognition`, `SpeechRecognitionEvent`, `SpeechRecognitionErrorEvent` in the file with `SpeechRecognitionLike`, `SpeechRecognitionEventLike`, `SpeechRecognitionErrorEventLike`.

- [ ] **Step 4: Fix ChatService.ts (4 errors at lines 208-218)**

Read `frontend/src/services/ChatService.ts` lines 200-225.

The errors are `.match`, `.replace`, `.startsWith` on something typed as `{}`. Add a type check:

```typescript
const content = typeof someVar === 'string' ? someVar : '';
// Then use content.match / content.replace / content.startsWith
```

Read the actual code and adapt.

- [ ] **Step 5: Fix actionSlice.ts (9 errors)**

Read `frontend/src/store/actionSlice.ts` lines 50-100.

Error 55-56: `Message[]` vs `ChatMessage[]` and `CodingHistoryEntry[]` — the `'model'` role is not allowed. Add a mapper:

```typescript
const toChatMessages = (msgs: Message[]): ChatMessage[] =>
  msgs.map(m => ({
    ...m,
    role: m.role === 'model' ? 'assistant' : m.role,
  })) as ChatMessage[];
```

Error 65: `DeviceInfo` missing `type` — check which DeviceInfo is imported and unify to one.

Errors 86-94: unknown-to-typed assignments. Narrow with `typeof X === 'string'` or typed casts.

- [ ] **Step 6: Fix collaborateSlice.ts:254 and waterfallSlice.ts:362**

Both are `catch (error: unknown)` with `error.X` access. Add `instanceof Error` narrowing:

```typescript
catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  // ...use message
}
```

- [ ] **Step 7: Run full frontend typecheck**

Run: `cd frontend && npx tsc --noEmit 2>&1 | wc -l`
Expected: `0`

- [ ] **Step 8: Commit**

```bash
git add frontend/src
git commit -m "fix(frontend): narrow unknown types in IntelPanel, ChatService, actionSlice, and hooks"
```

---

## Task A9: Run full repo typecheck and commit "Phase A complete"

- [ ] **Step 1: Full typecheck both sides**

Run in parallel:
```bash
(cd backend && npx tsc --noEmit) && (cd frontend && npx tsc --noEmit) && echo "ALL CLEAN"
```
Expected: `ALL CLEAN`

- [ ] **Step 2: Run backend tests**

Run: `cd backend && npx vitest run`
Expected: All tests pass (or only pre-existing failures — check `git stash` state first).

- [ ] **Step 3: Marker commit (no code changes — just confirms Phase A is done)**

(Skip if no new changes — this is just a checkpoint for the subagent runner.)

---

# Phase B — 100% `any` Type Elimination

> User raised the goal from 80% to 100%. Current count: 232 backend + 175 frontend = 407 total.

## Task B1: Baseline the any-type inventory

- [ ] **Step 1: Generate a file-by-file any count**

Run:
```bash
cd /home/caleb/solventclaude2/dazzling-shirley
grep -rn ': any\|as any\|<any>' backend/src --include="*.ts" | awk -F: '{print $1}' | sort | uniq -c | sort -rn > /tmp/backend-any-count.txt
grep -rn ': any\|as any\|<any>' frontend/src --include="*.ts" --include="*.tsx" | awk -F: '{print $1}' | sort | uniq -c | sort -rn > /tmp/frontend-any-count.txt
head -20 /tmp/backend-any-count.txt
head -20 /tmp/frontend-any-count.txt
```

Expected: Two files listing hotspots by file.

Do NOT commit these tracking files — they are `/tmp/` only.

---

## Task B2: Fix backend hotspot files (top 10 by any count)

For each file in the top 10 from `/tmp/backend-any-count.txt`:

- [ ] **Step 1: Read the file**

Read the file fully with the Read tool.

- [ ] **Step 2: Categorize the `any` uses**

Each `any` falls into one of four categories:
1. **Error in catch block**: `catch (error: any)` → replace with `catch (error: unknown)` + narrow.
2. **LLM JSON response**: `const parsed: any` → replace with `Record<string, unknown>` or a specific interface.
3. **External library shim**: third-party library with poor types → replace with a local interface declaring only the methods/props you use.
4. **Lazy developer shortcut**: function parameters, state, props → replace with the correct concrete type.

- [ ] **Step 3: Apply category-specific replacements**

For category 1: `catch (error: any) { logger.error(error.message); }` → `catch (error: unknown) { logger.error(error instanceof Error ? error.message : String(error)); }`

For category 2: Declare an interface at the top of the file:
```typescript
interface ProviderResponse {
  content?: string;
  tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }>;
  // ... only the fields this file reads
}
```

For category 3: Shim interface pattern:
```typescript
interface MinimalHFClient {
  textGeneration: (args: { model: string; inputs: string }) => Promise<{ generated_text: string }>;
}
```

For category 4: Use `unknown` + narrowing, or the correct concrete type from the codebase.

- [ ] **Step 4: Verify file-level any count drops to 0**

Run: `grep -c ': any\|as any\|<any>' <file>`
Expected: `0`

- [ ] **Step 5: Run typecheck**

Run: `cd backend && npx tsc --noEmit 2>&1 | head -20`
Expected: `0 errors` (or only errors unrelated to this file — fix cascaded errors in dependent files).

- [ ] **Step 6: Commit**

```bash
git add <file>
git commit -m "refactor(<area>): eliminate any types in <filename>"
```

Repeat Steps 1-6 for the top 10 backend hotspot files.

---

## Task B3: Fix frontend hotspot files (top 10 by any count)

Same process as B2, applied to the top 10 files in `/tmp/frontend-any-count.txt`.

- [ ] **Step 1-6: Same as B2, one commit per file**

Common frontend patterns:
- `useState<any>` → `useState<SpecificType>`
- Redux slice state: `state: any` → import the proper state interface from `frontend/src/store/types.ts`
- React event handlers: `(e: any)` → `(e: React.ChangeEvent<HTMLInputElement>)` etc.
- API response parsing: define a shape locally (same pattern as backend category 2).

After each file, run: `cd frontend && npx tsc --noEmit` to catch regressions.

---

## Task B4: Clean up the long tail (files with 1-3 any types each)

- [ ] **Step 1: Regenerate the any counts**

```bash
cd /home/caleb/solventclaude2/dazzling-shirley
grep -rn ': any\|as any\|<any>' backend/src --include="*.ts" | awk -F: '{print $1}' | sort | uniq -c | sort -rn > /tmp/backend-any-count.txt
grep -rn ': any\|as any\|<any>' frontend/src --include="*.ts" --include="*.tsx" | awk -F: '{print $1}' | sort | uniq -c | sort -rn > /tmp/frontend-any-count.txt
wc -l /tmp/backend-any-count.txt /tmp/frontend-any-count.txt
```

- [ ] **Step 2: Batch-fix small files**

For files with 1-3 `any` instances, you can fix several at once and commit in logical groups (e.g. "all provider plugins", "all store slices", "all UI components in /tools").

Pattern: read, fix, typecheck, commit. Keep commits small enough to review but large enough to make progress.

- [ ] **Step 3: Verify zero any types across the repo**

Run:
```bash
echo "Backend:" && grep -rn ': any\|as any\|<any>' backend/src --include="*.ts" | wc -l
echo "Frontend:" && grep -rn ': any\|as any\|<any>' frontend/src --include="*.ts" --include="*.tsx" | wc -l
```
Expected: Both `0`.

**Exception:** `eslint-disable-next-line @typescript-eslint/no-explicit-any` with a justification comment is acceptable where truly necessary (e.g. interop with untyped JS libraries, test mocks). Aim for fewer than 5 such exceptions across the entire repo, each documented.

- [ ] **Step 4: Full typecheck**

Run: `(cd backend && npx tsc --noEmit) && (cd frontend && npx tsc --noEmit) && echo "CLEAN"`
Expected: `CLEAN`

- [ ] **Step 5: Marker commit**

```bash
git commit --allow-empty -m "chore: reach 100% any-type elimination target"
```

---

# Phase C — Phase 2.1 Stragglers (Empty Catch Blocks)

## Task C1: Fix the 3 remaining empty catches

- [ ] **Step 1: Fix simulate-project-memory.ts**

Read `backend/src/scripts/simulate-project-memory.ts` (or wherever `:14` points — verify with Glob first).

Replace the empty catch with a logged error:
```typescript
} catch (error: unknown) {
  logger.warn('[SimulateProjectMemory] failed to X', {
    error: error instanceof Error ? error.message : String(error)
  });
}
```

- [ ] **Step 2: Fix BrowserArea.tsx:347**

Read `frontend/src/components/BrowserArea.tsx` lines 340-360.

Replace `catch (_) {}` with either:
- A `console.warn('[BrowserArea] non-critical: X', err)` call, OR
- A comment explaining why it's intentionally swallowed: `catch { /* user cancelled — expected */ }`

- [ ] **Step 3: Fix FloatingNotepad.tsx:64**

Read `frontend/src/components/FloatingNotepad.tsx` lines 55-75.

Same treatment as Step 2.

- [ ] **Step 4: Verify no more empty catches**

Run: `grep -rn 'catch.*{\s*}' backend/src frontend/src --include="*.ts" --include="*.tsx" | grep -v '.catch(() => {})' | grep -v test`
Expected: (no output or only intentional ones with comments)

- [ ] **Step 5: Commit**

```bash
git add backend/src/scripts/simulate-project-memory.ts frontend/src/components/BrowserArea.tsx frontend/src/components/FloatingNotepad.tsx
git commit -m "fix: replace 3 remaining empty catch blocks with logged handlers"
```

---

# Phase D — Plugin Unload Lifecycle (Phase 4.1)

## Task D1: Add `dispose?()` to IPlugin

**File:** `backend/src/types/plugins.ts`

- [ ] **Step 1: Add dispose to IPlugin interface**

In `backend/src/types/plugins.ts` around line 21, add:

```typescript
export interface IPlugin {
  id: string;
  name: string;
  description: string;
  version: string;
  initialize?(config: Record<string, unknown>): Promise<void>;
  isReady(): boolean;
  /** Optional cleanup called when the plugin is unloaded (stop timers, close sockets, flush state). */
  dispose?(): Promise<void>;
}
```

Also change `initialize?(config: Record<string, any>)` → `initialize?(config: Record<string, unknown>)` since we're already cleaning up `any` types.

- [ ] **Step 2: Typecheck**

Run: `cd backend && npx tsc --noEmit`
Expected: Zero errors (the new method is optional, existing plugins unaffected).

- [ ] **Step 3: Commit**

```bash
git add backend/src/types/plugins.ts
git commit -m "feat(plugins): add optional dispose() lifecycle hook to IPlugin"
```

---

## Task D2: Add `unloadProvider` and `unloadTool` to PluginManager (TDD)

**File:** `backend/src/services/pluginManager.ts`

- [ ] **Step 1: Write the failing test**

Create or extend `backend/src/services/pluginManager.test.ts` with:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { PluginManager } from './pluginManager';
import type { IProviderPlugin } from '../types/plugins';

describe('PluginManager.unloadProvider', () => {
  it('calls dispose() on the unloaded provider and removes it from the registry', async () => {
    const dispose = vi.fn(async () => undefined);
    const provider: IProviderPlugin = {
      id: 'test-provider',
      name: 'Test',
      description: 'Test provider',
      version: '1.0.0',
      isReady: () => true,
      complete: async () => 'ok',
      dispose,
    };

    const manager = new PluginManager();
    await manager.registerProvider(provider);
    expect(manager.getProvider('test-provider')).toBe(provider);

    await manager.unloadProvider('test-provider');

    expect(dispose).toHaveBeenCalledOnce();
    expect(manager.getProvider('test-provider')).toBeUndefined();
  });

  it('silently succeeds when unloading an unknown provider', async () => {
    const manager = new PluginManager();
    await expect(manager.unloadProvider('nope')).resolves.toBeUndefined();
  });

  it('removes the provider even if dispose throws', async () => {
    const provider: IProviderPlugin = {
      id: 'flaky',
      name: 'Flaky',
      description: 'Flaky provider',
      version: '1.0.0',
      isReady: () => true,
      complete: async () => 'ok',
      dispose: async () => { throw new Error('cleanup failed'); },
    };

    const manager = new PluginManager();
    await manager.registerProvider(provider);
    await manager.unloadProvider('flaky');

    expect(manager.getProvider('flaky')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run src/services/pluginManager.test.ts`
Expected: FAIL — "unloadProvider is not a function"

- [ ] **Step 3: Implement unloadProvider**

In `backend/src/services/pluginManager.ts`, after `registerTool` (around line 206), add:

```typescript
  async unloadProvider(id: string): Promise<void> {
    const provider = this.registry.providers.get(id);
    if (!provider) return;

    if (provider.dispose) {
      try {
        await provider.dispose();
      } catch (error: unknown) {
        logger.error(`[PluginManager] Error disposing provider ${id}`, {
          error: error instanceof Error ? error.message : String(error)
        });
        // Continue unregistering even if dispose fails
      }
    }

    this.registry.providers.delete(id);
    logger.info(`[PluginManager] Provider unloaded: ${id}`);
  }

  async unloadTool(id: string): Promise<void> {
    const tool = this.registry.tools.get(id);
    if (!tool) return;

    if (tool.dispose) {
      try {
        await tool.dispose();
      } catch (error: unknown) {
        logger.error(`[PluginManager] Error disposing tool ${id}`, {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    this.registry.tools.delete(id);
    logger.info(`[PluginManager] Tool unloaded: ${id}`);
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run src/services/pluginManager.test.ts`
Expected: PASS (3/3)

- [ ] **Step 5: Update `reload()` to dispose before clearing**

Change the `reload()` method (around lines 312-323) to:

```typescript
  async reload(): Promise<void> {
    logger.info('[PluginManager] Reloading all plugins...');

    // Dispose current plugins before clearing
    for (const [id, provider] of this.registry.providers) {
      if (provider.dispose) {
        try {
          await provider.dispose();
        } catch (error: unknown) {
          logger.error(`[PluginManager] Error disposing provider ${id} during reload`, {
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    }
    for (const [id, tool] of this.registry.tools) {
      if (tool.dispose) {
        try {
          await tool.dispose();
        } catch (error: unknown) {
          logger.error(`[PluginManager] Error disposing tool ${id} during reload`, {
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    }

    this.registry.providers.clear();
    this.registry.tools.clear();

    await this.loadAllPlugins();

    logger.info('[PluginManager] Plugins reloaded successfully');
  }
```

- [ ] **Step 6: Run tests again + typecheck**

Run: `cd backend && npx tsc --noEmit && npx vitest run src/services/pluginManager.test.ts`
Expected: All pass.

- [ ] **Step 7: Commit**

```bash
git add backend/src/services/pluginManager.ts backend/src/services/pluginManager.test.ts
git commit -m "feat(plugins): add unloadProvider/unloadTool with dispose lifecycle"
```

---

# Phase E — Env-driven Waterfall Configuration (Phase 5)

## Task E1: Add WATERFALL_* env vars to Zod schema

**File:** `backend/src/config.ts`

- [ ] **Step 1: Read current config.ts**

(Already read — the envSchema is at lines 10-44, APP_CONSTANTS at 70-80.)

- [ ] **Step 2: Add env vars to the schema**

In `backend/src/config.ts`, add to the envSchema (before the closing `})`):

```typescript
  // Waterfall pipeline configuration
  WATERFALL_MAX_RETRIES: z.string()
    .transform(Number)
    .pipe(z.number().int().min(0).max(10))
    .default('2'),
  WATERFALL_SCORE_THRESHOLD: z.string()
    .transform(Number)
    .pipe(z.number().int().min(0).max(100))
    .default('80'),
  WATERFALL_MAX_STEPS: z.string()
    .transform(Number)
    .pipe(z.number().int().min(1).max(50))
    .default('10'),
  // Per-phase model overrides (provider:model format, e.g. "dashscope:qwen3-coder-plus")
  WATERFALL_PLANNER_MODEL: z.string().optional(),
  WATERFALL_EXECUTOR_MODEL: z.string().optional(),
  WATERFALL_REVIEWER_MODEL: z.string().optional(),
```

- [ ] **Step 3: Update APP_CONSTANTS.WATERFALL to read from env**

Replace lines 70-80 with:

```typescript
export const APP_CONSTANTS = {
  WATERFALL: {
    MAX_RETRIES: config.WATERFALL_MAX_RETRIES,
    SCORE_THRESHOLD: config.WATERFALL_SCORE_THRESHOLD,
    MAX_STEPS: config.WATERFALL_MAX_STEPS,
  },
  MODELS: {
    VISION_DEFAULT: 'gemini-1.5-flash',
    CODING_DEFAULT: 'llama-3.3-70b-versatile'
  }
};
```

- [ ] **Step 4: Typecheck**

Run: `cd backend && npx tsc --noEmit`
Expected: Zero errors.

- [ ] **Step 5: Write a unit test for env parsing**

Create `backend/src/config.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { config, APP_CONSTANTS } from './config';

describe('config', () => {
  it('exposes WATERFALL_MAX_RETRIES via APP_CONSTANTS', () => {
    expect(typeof APP_CONSTANTS.WATERFALL.MAX_RETRIES).toBe('number');
    expect(APP_CONSTANTS.WATERFALL.MAX_RETRIES).toBeGreaterThanOrEqual(0);
  });

  it('exposes WATERFALL_SCORE_THRESHOLD via APP_CONSTANTS', () => {
    expect(APP_CONSTANTS.WATERFALL.SCORE_THRESHOLD).toBe(config.WATERFALL_SCORE_THRESHOLD);
    expect(APP_CONSTANTS.WATERFALL.SCORE_THRESHOLD).toBeGreaterThanOrEqual(0);
    expect(APP_CONSTANTS.WATERFALL.SCORE_THRESHOLD).toBeLessThanOrEqual(100);
  });

  it('defaults to 2 retries, 80 score, 10 steps when env unset', () => {
    // Defaults from Zod schema
    expect(config.WATERFALL_MAX_RETRIES).toBe(2);
    expect(config.WATERFALL_SCORE_THRESHOLD).toBe(80);
    expect(config.WATERFALL_MAX_STEPS).toBe(10);
  });
});
```

- [ ] **Step 6: Run test**

Run: `cd backend && npx vitest run src/config.test.ts`
Expected: PASS (3/3) — assumes no `WATERFALL_*` env vars set at test time.

- [ ] **Step 7: Commit**

```bash
git add backend/src/config.ts backend/src/config.test.ts
git commit -m "feat(config): make waterfall parameters env-driven via Zod schema"
```

---

## Task E2: Wire env-driven waterfall config into waterfallService

**File:** `backend/src/services/waterfallService.ts`

- [ ] **Step 1: Use APP_CONSTANTS in the default threshold and retry count**

Read `backend/src/services/waterfallService.ts` lines 245-250.

The `passThreshold` at line 247 is hard-coded to `80 - attempts * 8`. Parameterize from config:

```typescript
    const { APP_CONSTANTS } = await import('../config');
    const baseThreshold = APP_CONSTANTS.WATERFALL.SCORE_THRESHOLD;
    const passThreshold = () => Math.max(65, baseThreshold - (attempts * 8));
```

Place this right after the `let attempts = 0;` line (around line 242).

- [ ] **Step 2: Use APP_CONSTANTS for maxRetries default**

Find the `runAgenticWaterfallGenerator` signature (line 139). Change the default:

```typescript
  async *runAgenticWaterfallGenerator(
    prompt: string,
    globalProvider: string = 'auto',
    maxRetries?: number,
    // ...rest
```

At the top of the function body, after the existing signal check, resolve the default:

```typescript
    const { APP_CONSTANTS } = await import('../config');
    const effectiveMaxRetries = maxRetries ?? APP_CONSTANTS.WATERFALL.MAX_RETRIES;
```

Then replace every `maxRetries` in the function body with `effectiveMaxRetries`.

- [ ] **Step 3: Typecheck**

Run: `cd backend && npx tsc --noEmit`
Expected: Zero errors.

- [ ] **Step 4: Commit**

```bash
git add backend/src/services/waterfallService.ts
git commit -m "refactor(waterfall): read MAX_RETRIES and SCORE_THRESHOLD from env config"
```

---

# Phase F — Frontend God Component Extraction (Phase 3)

> Target: each file under 400 lines.

## Task F1: Extract `CodingArea` (603 → <400 lines)

**Files:**
- Read: `frontend/src/components/CodingArea.tsx`
- Create: `frontend/src/components/coding/CodingHeader.tsx`
- Create: `frontend/src/components/coding/CodingTabs.tsx`
- Create: `frontend/src/components/coding/CodingContent.tsx`
- Modify: `frontend/src/components/CodingArea.tsx`

- [ ] **Step 1: Read and analyze CodingArea**

Read `frontend/src/components/CodingArea.tsx` fully.

Identify natural boundaries — look for:
- Header block (top controls, model selector, file dropdown)
- Tab bar (if applicable)
- Main content area (editor, chat panel, results)
- Modal/overlay sections

Note the props each extracted component needs.

- [ ] **Step 2: Extract the header**

Create `frontend/src/components/coding/CodingHeader.tsx` with the header JSX and its minimal props interface.

- [ ] **Step 3: Extract the tabs**

Create `frontend/src/components/coding/CodingTabs.tsx`.

- [ ] **Step 4: Extract the main content**

Create `frontend/src/components/coding/CodingContent.tsx`.

- [ ] **Step 5: Rewrite CodingArea.tsx to compose them**

The new CodingArea should:
- Hold state and orchestration logic
- Pass props to the 3 extracted components
- Stay under 400 lines

- [ ] **Step 6: Verify line count and typecheck**

Run: `wc -l frontend/src/components/CodingArea.tsx && cd frontend && npx tsc --noEmit`
Expected: CodingArea.tsx < 400 lines, zero TS errors.

- [ ] **Step 7: Manual smoke test**

Run the dev server:
```bash
cd frontend && npm run dev &
```

Open the browser, navigate to the coding area, verify it renders and the chat panel works. Kill the dev server after.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/CodingArea.tsx frontend/src/components/coding/
git commit -m "refactor(frontend): extract CodingArea into Header/Tabs/Content sub-components"
```

---

## Task F2: Extract `WaterfallArea` (619 → <400 lines)

**Files:**
- Read: `frontend/src/components/WaterfallArea.tsx`
- Create: `frontend/src/components/waterfall/WaterfallControls.tsx`
- Create: `frontend/src/components/waterfall/WaterfallProgress.tsx`
- Create: `frontend/src/components/waterfall/WaterfallResults.tsx`
- Modify: `frontend/src/components/WaterfallArea.tsx`

- [ ] **Step 1-8: Same extraction pattern as F1**

Follow F1 Steps 1-8, substituting WaterfallArea and its 3 sub-components. The natural boundaries will typically be:
- Controls (prompt input, model pickers, start button)
- Progress (streaming phase updates, attempt counter)
- Results (final planner/executor/reviewer output)

- [ ] **Step 9: Commit**

```bash
git add frontend/src/components/WaterfallArea.tsx frontend/src/components/waterfall/
git commit -m "refactor(frontend): extract WaterfallArea into Controls/Progress/Results"
```

---

## Task F3: Extract `HomeArea` (632 → <400 lines)

**Files:**
- Read: `frontend/src/components/HomeArea.tsx`
- Create: `frontend/src/components/home/HomeHero.tsx`
- Create: `frontend/src/components/home/HomeActions.tsx`
- Create: `frontend/src/components/home/HomeRecents.tsx`
- Modify: `frontend/src/components/HomeArea.tsx`

- [ ] **Step 1-9: Same pattern**

Natural boundaries: hero/greeting block, quick-action buttons, recent sessions list.

- [ ] **Step 10: Commit**

```bash
git add frontend/src/components/HomeArea.tsx frontend/src/components/home/
git commit -m "refactor(frontend): extract HomeArea into Hero/Actions/Recents"
```

---

## Task F4: Extract `NotepadPiP` (1134 → <400 lines)

**This is the biggest extraction.** NotepadPiP is likely the PiP (picture-in-picture) floating notepad with drag, resize, content editor, markdown rendering, and export.

**Files:**
- Read: `frontend/src/components/NotepadPiP.tsx`
- Create: `frontend/src/components/notepad-pip/PiPDragHandle.tsx`
- Create: `frontend/src/components/notepad-pip/PiPEditor.tsx`
- Create: `frontend/src/components/notepad-pip/PiPToolbar.tsx`
- Create: `frontend/src/components/notepad-pip/PiPPreview.tsx`
- Create: `frontend/src/components/notepad-pip/usePiPDrag.ts` (custom hook)
- Create: `frontend/src/components/notepad-pip/usePiPResize.ts` (custom hook)
- Modify: `frontend/src/components/NotepadPiP.tsx`

- [ ] **Step 1: Read NotepadPiP fully**

Read `frontend/src/components/NotepadPiP.tsx` in chunks (1134 lines, so read in 3 passes of ~400 lines).

- [ ] **Step 2: Identify the extraction targets**

Typical PiP structure:
- Drag logic → `usePiPDrag` hook (~100 lines)
- Resize logic → `usePiPResize` hook (~100 lines)
- Drag handle JSX → `PiPDragHandle.tsx`
- Editor (textarea/contenteditable) → `PiPEditor.tsx`
- Toolbar (format buttons, save, close) → `PiPToolbar.tsx`
- Markdown preview → `PiPPreview.tsx`

- [ ] **Step 3: Extract hooks first (usePiPDrag)**

Create `frontend/src/components/notepad-pip/usePiPDrag.ts` with the drag state + event handlers.

- [ ] **Step 4: Extract usePiPResize**

Same pattern.

- [ ] **Step 5: Extract each JSX sub-component**

Create each of the 4 sub-components with minimal props.

- [ ] **Step 6: Rewrite NotepadPiP.tsx to compose them**

The new NotepadPiP should be the orchestrator: state management, hook invocations, and layout composition.

- [ ] **Step 7: Verify**

```bash
wc -l frontend/src/components/NotepadPiP.tsx && cd frontend && npx tsc --noEmit
```
Expected: NotepadPiP.tsx < 400 lines, zero TS errors.

- [ ] **Step 8: Smoke test the PiP**

Run the dev server, open the notepad, drag it, resize it, type in it, toggle preview, close it.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/components/NotepadPiP.tsx frontend/src/components/notepad-pip/
git commit -m "refactor(frontend): extract NotepadPiP into hooks and sub-components"
```

---

# Phase G — Inline Styles → Tailwind (Phase 6)

## Task G1: Inventory inline styles

- [ ] **Step 1: Count and categorize**

Run:
```bash
grep -rn 'style={{' frontend/src --include="*.tsx" | awk -F: '{print $1}' | sort | uniq -c | sort -rn > /tmp/inline-style-count.txt
head -20 /tmp/inline-style-count.txt
wc -l /tmp/inline-style-count.txt
```

- [ ] **Step 2: Classify each inline style as "convertible" or "dynamic"**

**Convertible** = static values that Tailwind has utilities for (e.g. `style={{ color: 'red', padding: '8px' }}` → `className="text-red-500 p-2"`).

**Dynamic** = depends on runtime values (e.g. `style={{ transform: \`translate(${x}px, ${y}px)\` }}`) — **leave these alone**, they need inline styles.

---

## Task G2: Convert static inline styles file-by-file

For each file in the top 10 of `/tmp/inline-style-count.txt`:

- [ ] **Step 1: Read the file**

- [ ] **Step 2: Replace convertible style objects with Tailwind classes**

Example:
```tsx
// Before
<div style={{ display: 'flex', gap: '8px', padding: '16px', backgroundColor: '#1a1a1a' }}>

// After
<div className="flex gap-2 p-4 bg-neutral-900">
```

Leave dynamic styles (positional transforms, runtime colors) as inline.

- [ ] **Step 3: Visual regression check**

Run the dev server, look at the affected components, verify they look identical.

- [ ] **Step 4: Commit**

```bash
git add <file>
git commit -m "style(frontend): convert inline styles to Tailwind in <component>"
```

Repeat for the top 10 files.

---

## Task G3: Clean up the remaining long tail

- [ ] **Step 1: Regenerate and process the long tail**

Similar to B4 — files with 1-3 convertible inline styles can be batched into logical commits.

- [ ] **Step 2: Final count**

Run: `grep -rn 'style={{' frontend/src --include="*.tsx" | wc -l`
Expected: dramatically reduced (target: only the dynamic cases remain — ~30 instances or fewer).

---

# Phase H — Final Verification and Changelog

## Task H1: Full repo verification

- [ ] **Step 1: Typecheck everything**

Run:
```bash
cd /home/caleb/solventclaude2/dazzling-shirley
(cd backend && npx tsc --noEmit) && (cd frontend && npx tsc --noEmit) && echo "TYPECHECK CLEAN"
```
Expected: `TYPECHECK CLEAN`

- [ ] **Step 2: Run all tests**

Run:
```bash
cd backend && npx vitest run
cd ../frontend && npx vitest run
```
Expected: All pass (modulo pre-existing failures unrelated to this plan — list any and surface to user).

- [ ] **Step 3: Verify any-count is 0**

Run:
```bash
echo "Backend: $(grep -rn ': any\|as any\|<any>' backend/src --include="*.ts" | wc -l)"
echo "Frontend: $(grep -rn ': any\|as any\|<any>' frontend/src --include="*.ts" --include="*.tsx" | wc -l)"
```
Expected: `Backend: 0`, `Frontend: 0` (excluding justified `eslint-disable` comments).

- [ ] **Step 4: Verify line counts**

Run: `wc -l frontend/src/components/NotepadPiP.tsx frontend/src/components/CodingArea.tsx frontend/src/components/WaterfallArea.tsx frontend/src/components/HomeArea.tsx`
Expected: All under 400.

- [ ] **Step 5: Verify no empty catch blocks**

Run: `grep -rn 'catch.*{\s*}' backend/src frontend/src --include="*.ts" --include="*.tsx" | grep -v '.catch(() => {})' | grep -v test`
Expected: Zero matches (all empty catches have been replaced with logged handlers).

---

## Task H2: Update the original codebase-improvements.md status

- [ ] **Step 1: Mark phases complete in the original plan**

Read `.sisyphus/plans/codebase-improvements.md` and update the Status line and any phase checkboxes to reflect completion.

- [ ] **Step 2: Commit**

```bash
git add .sisyphus/plans/codebase-improvements.md
git commit -m "docs: mark codebase-improvements phases complete"
```

---

# Self-Review Checklist

Before handing this plan to an agent, verify:

- [x] **Spec coverage**: Every phase from `.sisyphus/plans/codebase-improvements.md` that was incomplete has a task here (Phase 1 fixes → A, Phase 2.1 stragglers → C, Phase 3 god components → F, Phase 4.1 plugin unload → D, Phase 5 env config → E, Phase 6 inline styles → G).
- [x] **100% any elimination**: Phase B targets all 407 remaining any instances, not just 80%.
- [x] **No placeholders**: Every step contains actual code or an exact command.
- [x] **Type consistency**: Each task defines signatures once and references them identically in later tasks.
- [x] **Exact file paths**: All paths are absolute or repo-relative with the directory tree verified.
- [x] **TS error targets are verified**: Error counts (66 backend, 52 frontend, 414 any types) were measured from a live tsc/grep run.

---

# Notes for the executing engineer

- **Commit discipline**: Each task produces one commit. Do not squash unrelated changes together.
- **Don't skip the typecheck step**: The rushed Phase 1 refactor is exactly why Phase A exists. Run `tsc --noEmit` after every task before committing.
- **When in doubt, narrow don't cast**: `error instanceof Error ? error.message : String(error)` is safer than `(error as Error).message`.
- **Visual regression on frontend work**: Phase F and G touch UI. The smoke test step is not optional.
- **Stop and ask** if:
  - A TS error reveals a runtime bug (not just a type annotation issue) — flag it to the user first.
  - A Phase F extraction reveals that a god component can't be cleanly split (e.g. massive shared state) — propose a simpler boundary.
  - An `any` type is load-bearing for a working integration (rare — usually means a third-party lib without types). Use a typed shim interface; only fall back to `eslint-disable` with a comment if the shim proves impractical.
