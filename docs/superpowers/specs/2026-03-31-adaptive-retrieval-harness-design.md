# Adaptive Retrieval Harness — Design Spec

**Date:** 2026-03-31
**Inspired by:** Meta-Harness: End-to-End Optimization of Model Harnesses (arXiv:2603.28052)

---

## Overview

Solvent's retrieval system (`contextService.enrichContext()`) is already adaptive — it uses hybrid vector+BM25 search, cross-encoder reranking, temporal decay, and token-budget gating. However, its scoring parameters are hardcoded, it produces no persistent execution traces, and it has no feedback loop. The model cannot improve what it cannot observe.

This spec defines a **three-phase harness improvement system** modeled directly on the Meta-Harness methodology:

- **Phase A (this spec):** Instrument the retrieval pipeline with persistent execution traces and surface them in the UI. Build the filesystem the automated proposer will eventually read.
- **Phase B (next spec):** Attach reward signals to traces. Make retrieval mode-aware. Feed user corrections back into scoring.
- **Phase C (future spec):** Wire the Overseer as an automated proposer that reads traces, diagnoses failure modes, and proposes harness improvements. Coding Suite agent executes approved changes. Human role: observe and approve.

**The end state (Phase C):** The Overseer periodically reads `.solvent_retrieval_traces.jsonl`, identifies patterns (e.g., "MIN_SCORE_STANDARD is suppressing memories users later re-request"), proposes specific edits to `contextService.ts` scoring constants, surfaces them as pending approvals in SupervisorHistory, and the Coding Suite agent applies approved changes. Human in the loop only for observation and refinement — not for every decision.

---

## Background: The Meta-Harness Methodology

The paper's core finding (Table 3, ablation study):

| Feedback type | Median accuracy | Best accuracy |
|---|---|---|
| Scores only | 34.6 | 41.3 |
| Scores + LLM summary | 34.9 | 38.7 |
| Full execution traces | **50.0** | **56.7** |

**Access to raw execution traces is the key ingredient.** Summaries and scalar scores compress away the diagnostic information needed to understand *why* a retrieval decision was wrong. The proposer needs to read the actual code, scores, and traces to form causal hypotheses.

For Solvent, the "harness" is `contextService.enrichContext()` — the code that determines what context the model sees at each step. The "execution traces" are the per-request retrieval decisions: what was selected, what was suppressed, why, and with what parameter configuration.

---

## Phase A Design

### 1. Backend — Retrieval Trace Logging

**File:** `backend/src/services/aiService.ts`
**Change:** After `enrichContext()` returns, append one entry to `.solvent_retrieval_traces.jsonl` before the model call proceeds.

**No changes to `contextService.ts` retrieval logic.** The provenance object is already computed — we persist it rather than discarding it.

#### JSONL Schema

One JSON object per line. Each entry:

```typescript
interface RetrievalTrace {
  id: string;                    // uuid-v4
  ts: string;                    // ISO 8601 timestamp
  responseId: string;            // Links to the message this trace produced
  sessionId: string;
  mode: string;                  // chat | coding | waterfall | debate | browser | etc.
  provider: string;              // groq | gemini | ollama | etc.
  model: string;

  // The user's message (query into the retrieval pipeline)
  query: string;

  // Harness snapshot — parameter values active at time of this trace.
  // This is the "source code" equivalent in Meta-Harness terminology.
  // Without this, we cannot correlate parameter configurations with retrieval outcomes.
  harnessSnapshot: {
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
  };

  // Items selected for the prompt
  active: Array<{
    id: string;
    text: string;               // Truncated to 200 chars for log size
    type: string;               // episodic | crystallized | permanent_rule | etc.
    tier: string;
    score: number;              // Final composite score
    source: string;             // local | global | workspace
    status: 'active';
  }>;

  // Items rejected during retrieval
  suppressed: Array<{
    id: string;
    text: string;               // Truncated to 200 chars
    type: string;
    tier: string;
    score: number;
    reason: string;             // below_min_score | duplicate | stale_code | token_budget | conflict
    status: 'suppressed';
  }>;

  // Token budget breakdown — how much of the context window each section consumed
  promptTokens: {
    memory: number;
    rules: number;
    workspace: number;
    conversationHistory: number;
    systemPrompt: number;
    total: number;
    budget: number;
  };

  counts: {
    workspace: number;
    local: number;
    global: number;
    rules: number;
  };

  pipelineMs: number;           // Total enrichContext() time

  // Reward signal — null in Phase A, populated in Phase B.
  // Used by the Overseer proposer (Phase C) to evaluate harness quality.
  outcome: null | 'correction' | 'crystallized' | 'rerequested' | 'accepted';
}
```

**File location:** `backend/.solvent_retrieval_traces.jsonl`
**Format:** Append-only. One JSON object per line. No pretty-printing (grep-friendly).
**Size management:** Cap at 50MB. When exceeded, rotate: rename to `.solvent_retrieval_traces.1.jsonl`, start fresh. Keep 2 rotated files max.

**Why agent-readable format matters:** In Phase C, the Overseer reads this file directly using grep/jq patterns — the same way the Meta-Harness proposer queries its filesystem. Consistent field names, flat structure, and ISO timestamps make this possible without a custom parser.

---

### 2. Backend — Debug API Endpoint

**File:** `backend/src/controllers/aiController.ts` — new route added alongside existing AI routes
**Route:** `GET /api/debug/traces`

**Query params:**
- `limit` (default 50, max 200)
- `query` — text search against the `query` field
- `mode` — filter by mode
- `since` — ISO timestamp, return entries after this time
- `outcome` — filter by outcome value

**Implementation:** Read the JSONL file tail-first (newest first), apply filters, return JSON array. No database. ~50 lines.

**Response:** Array of `RetrievalTrace` objects.

**Security note:** This endpoint exposes internal retrieval state including memory content. The route handler must check that the request originates from `localhost` / `127.0.0.1` and return 403 otherwise. This check belongs in the route handler itself, not middleware, so it is explicitly visible.

---

### 3. Frontend — Enhanced MessageItem Provenance HUD

**File:** `frontend/src/components/MessageItem.tsx`

The existing badge strip (WORKSPACE · PROJECT · GLOBAL · RULES) at the bottom of each assistant message gains richer hover content and two new indicators.

**Changes per badge:**

- **PROJECT badge** (crystallized memories) — add per-item composite score and signal breakdown in hover panel: `score: 0.87 · tag_match +0.20 · importance:8 +0.32`
- **GLOBAL badge** (universal patterns) — same score breakdown; suppressed items already shown, add clearer reason codes: `suppressed: below_min_score (0.41 < 0.60)`
- **WORKSPACE badge** — add token count: `3 files · 480 tok`
- **RULES badge** — currently count-only; expand hover to show rule text, consistent with other badges

**Two new indicators (right side of badge strip):**

- **TIMING chip** — `312ms` pill. Hover expands to per-stage breakdown when available.
- **BUDGET bar** — thin horizontal progress bar showing `4022 / 4096 tokens`. Shifts orange above 85%, red above 95%.

**Type changes:** `ContextProvenance` in `frontend/src/store/types.ts` gains `promptTokens` field. `harnessSnapshot` is backend-only and not sent to frontend (no user-facing value in raw parameter values).

**Note on `promptTokens` computation:** The existing `ContextProvenance` tracks `tokenBudget` and `tokensUsed` totals but not per-section breakdowns. `contextService.ts` requires a minor addition: track tokens consumed by each section (memory, rules, workspace, conversationHistory, systemPrompt) as the prompt is assembled, and include the breakdown in the returned provenance object. This is a bookkeeping change only — no retrieval logic changes.

---

### 4. Frontend — IntelPanel Traces Tab

**File:** `frontend/src/components/IntelPanel.tsx`
**New file:** `frontend/src/components/TraceList.tsx`
**API client:** `frontend/src/lib/api-client.ts` — add `getTraces(params)` method

A new "Traces" tab added to IntelPanel alongside Search. Only rendered when in the intel/browser view.

#### Tab structure

```
[ Search ]  [ Traces ]
```

#### Traces view (top to bottom)

**1. Filter bar**
- Text input: search against `query` field
- Mode dropdown: All / Chat / Coding / Waterfall / Browser / etc.
- Time range: Last hour / Today / This week
- Calls `GET /api/debug/traces` on change, debounced 300ms

**2. Trace list**
Each row (collapsed):
```
14:23  chat · groq  "how does the auth middleware work"
8 active  3 suppressed  4022/4096 tok  312ms
```
Color-coded budget indicator on left edge: green / orange / red.

**3. Expanded trace detail** (click row to expand inline)
- **Active items** — memory text (truncated), composite score, signal breakdown chips
- **Suppressed items** — memory text, score, reason badge (`below_min_score`, `duplicate`, `stale_code`, `token_budget`, `conflict`)
- **Prompt budget bar** — horizontal stacked bar: memory (blue) / rules (purple) / workspace (green) / history (orange) / system (gray)
- **Harness snapshot** — collapsed accordion, shows parameter values at time of trace. This is what Phase C's Overseer will read to correlate parameter configs with outcomes.
- **Outcome badge** — Phase A shows `—` (null). Phase B populates with `correction`, `crystallized`, etc.

**4. Compare mode**
Select two trace rows (checkbox), press "Compare" — renders a side-by-side diff of active/suppressed items between the two traces. Highlights items that moved from suppressed→active or active→suppressed. This is the "diff code and results between pairs of runs" capability from Meta-Harness Appendix D.

#### TraceList component
~150 lines. Owns filter state and API call. IntelPanel renders it conditionally when `activeTab === 'traces'`.

---

## Phase C Direction (For Architectural Awareness)

Documented here so Phase A and B are designed to enable it from the start.

**Overseer as proposer:** The Overseer gains a new scheduled task type: `harness_review`. Triggered every N sessions or when a degradation pattern is detected in recent traces (e.g., budget utilization consistently >90%, or high suppression rate). The Overseer reads `.solvent_retrieval_traces.jsonl` via grep/jq, analyzes outcome distributions across harness snapshots, and forms a causal hypothesis.

**Coding Suite as executor:** When the Overseer produces a proposal, it's handed to the Coding Suite agent as a targeted edit: "Change `MIN_SCORE_STANDARD` from `0.60` to `0.55` in `contextService.ts` lines 14-52." The Coding Suite runs `npx tsc --noEmit` as lightweight validation before surfacing for approval.

**SupervisorHistory as review gate:** The proposal appears as a pending approval card in SupervisorHistory — same UI pattern as existing intervention messages:
```
[HARNESS PROPOSAL]
Based on 47 traces: MIN_SCORE_STANDARD = 0.60 is suppressing
memories that users re-request within 2 turns (12 instances).
Proposed change: 0.60 → 0.55 for episodic tier.
[View traces] [View diff] [Approve] [Reject]
```

Human role: review and approve/reject. No other required action. After approval, the Coding Suite applies the change, and subsequent traces begin recording the new `harnessSnapshot` values. The Overseer evaluates improvement in the next review cycle.

---

## File Summary

| File | Action | Purpose |
|------|--------|---------|
| `backend/src/services/contextService.ts` | Modify | Add per-section token tracking to provenance output (bookkeeping only) |
| `backend/src/services/aiService.ts` | Modify | Add trace logging after `enrichContext()` returns |
| `backend/src/services/traceLogger.ts` | New | `appendTrace(trace)` — handles file write, rotation, size cap |
| `backend/src/controllers/aiController.ts` | Modify | Add `GET /api/debug/traces` route |
| `frontend/src/store/types.ts` | Modify | Add `promptTokens` to `ContextProvenance` |
| `frontend/src/components/MessageItem.tsx` | Modify | Richer provenance HUD: scores, signals, timing, budget bar |
| `frontend/src/components/IntelPanel.tsx` | Modify | Add Traces tab |
| `frontend/src/components/TraceList.tsx` | New | Trace list + filter + expand + compare |
| `frontend/src/lib/api-client.ts` | Modify | Add `getTraces(params)` method |

---

## What This Is Not

- This spec does not implement the automated proposer loop (Phase C)
- This spec does not change any retrieval logic in `contextService.ts`
- This spec does not add mode-aware retrieval (Phase B)
- This spec does not implement feedback signal collection (Phase B)

Phase A is purely observability. The retrieval system runs identically to today — we just stop throwing away the data it already produces.
