# Memory System Refinements Plan

> **Goal:** Address architectural gaps in the recently completed memory implementation

---

## Issues Identified

### 1. Core Memory is Global (Security/Privacy Leak)

**Current:** Single `.solvent_core_memory.json` shared across all users/sessions

**Impact:**
- User A sees User B's core memory
- All sessions share the same 10 slots
- No isolation between conversations

**Fix:** Per-session core memory stored in session context or user-scoped storage

---

### 2. Slot Count Too Restrictive

**Current:** 10 slots hardcoded

**Impact:** Real usage will hit limit quickly (user preferences, project context, active goals, etc.)

**Fix:** Increase to 50 slots, add value length limit (~500 chars)

---

### 3. No Value Length Enforcement

**Current:** User can write unlimited text to core memory

**Impact:** Massive values blow up context on every request, increasing costs and hitting token limits

**Fix:** Enforce max value length (e.g., 500 chars)

---

### 4. Handoff Chain Not Persisted

**Current:** Handoff metadata created but discarded after waterfall completes

**Impact:** Cannot surface past architectural decisions in future sessions

**Fix:** Optionally crystallize handoff chain to memory system

---

### 5. Reviewer Not Part of Handoff Chain

**Current:** Only architect→reasoner→executor produce handoffs

**Impact:** Reviewer's quality assessment is lost; future runs don't know what was fixed

**Fix:** Add reviewerHandoff to the chain

---

### 6. Decision Log Not Persisted Across Retries

**Current:** Each retry iteration gets a fresh decision log

**Impact:** Executor doesn't know what was already attempted/fixed in previous retries within the same run

**Fix:** Pass decisionLog through retry iterations (already done in-memory, but could surface to user)

---

## Proposed Changes

### Phase 1: Core Memory Fixes

| File | Change |
|------|--------|
| `backend/src/services/coreMemory.ts` | Add session-aware factory, key-based value limits, compression option |
| `backend/src/services/contextService.ts` | (no change yet - keep global for now) |
| `backend/src/services/coreMemory.test.ts` | Add tests for new features |

**Implementation - Session-Aware Design (built but not wired):**

```typescript
// Factory that can produce session-scoped or global instances
export class CoreMemoryFactory {
  static createForSession(sessionId: string, options?: CoreMemoryOptions): CoreMemory {
    const path = `.solvent_core_memory_${sessionId}.json`;
    return new CoreMemory(path, options);
  }
  
  static createGlobal(options?: CoreMemoryOptions): CoreMemory {
    return new CoreMemory('.solvent_core_memory.json', options);
  }
}
```

**Implementation - Smart Value Length Limits:**

Instead of a flat 500 char limit, use tiered limits:

```typescript
const KEY_VALUE_LIMITS: Record<string, number> = {
  // Blessed keys get more space - user identity, project context
  'user_name': 100,
  'user_email': 200,
  'project_name': 200,
  'project_context': 2000,      // Long-form project context
  'active_goals': 1500,
  'tech_stack': 1000,
  // Default for unknown keys
  'default': 500
};

set(key: string, value: string): void {
  const limit = KEY_VALUE_LIMITS[key] ?? KEY_VALUE_LIMITS['default'];
  
  if (value.length > limit) {
    // Auto-truncate with warning, or throw
    throw new Error(`Value exceeds max length ${limit} for key "${key}". Consider storing details in vector memory instead.`);
  }
  // ... rest
}
```

**Why this approach:**
- Blessed keys (project_context, active_goals) can be long when needed
- Unknown keys default to 500 chars (prevents abuse)
- Error message guides user toward vector memory for long-form content
- Could add compression later if needed

### Phase 2: Handoff Chain Enhancements

| File | Change |
|------|--------|
| `backend/src/services/waterfallService.ts` | Add reviewerHandoff after review step |
| `backend/src/types/memory.ts` | Update StageHandoff to optionally include crystallized version |

**Implementation:**

```typescript
const reviewerHandoff: StageHandoff = {
  stage: 'reviewer',
  confidence: (reviewer.score ?? 0) / 100,
  keyDecisions: [], // Reviewer doesn't make decisions, but keeps the chain
  constraints: reasonerHandoff.constraints,
  openQuestions: [],
  tokenCount: JSON.stringify(reviewer).length / 4
};
```

### Phase 3: Optional Handoff Persistence (Opt-In)

| File | Change |
|------|--------|
| `backend/src/services/waterfallService.ts` | Add flag to crystallize handoff chain after completion |
| `backend/src/services/memoryConsolidationService.ts` | Add method to store handoff as crystallized memory |

**Implementation:**

```typescript
// Option A: Store as architectural decision
if (options?.crystallizeHandoffs) {
  await memoryConsolidationService.crystallizeHandoffs(handoffChain);
}

// New method in memoryConsolidationService
async crystallizeHandoffs(chain: StageHandoff[]): Promise<void> {
  for (const handoff of chain) {
    await vectorService.addEntry(
      `${handoff.stage}: ${handoff.keyDecisions.join('; ')}`,
      {
        type: 'architectural_decision',
        importance: Math.round(handoff.confidence * 10),
        tags: ['waterfall', handoff.stage, 'handoff'],
        source: 'waterfall'
      }
    );
  }
}
```

---

## Files Summary

| File | Action | Purpose |
|------|--------|---------|
| `backend/src/services/coreMemory.ts` | Modify | Session ID support, value length limit, configurable slots |
| `backend/src/services/coreMemory.test.ts` | Modify | Add new test cases |
| `backend/src/services/contextService.ts` | Modify | Pass session context to core memory |
| `backend/src/services/waterfallService.ts` | Modify | Add reviewerHandoff, optional crystallization |
| `backend/src/services/memoryConsolidationService.ts` | Modify | Add crystallizeHandoffs method |
| `backend/src/types/memory.ts` | Modify | Optional fields on StageHandoff |

---

## Notes

- **Phase 1** builds multi-user infrastructure but keeps global instance as default
- When switching to multi-user later, only need to change `CoreMemoryFactory.createGlobal()` → `CoreMemoryFactory.createForSession(sessionId)` in contextService

## Backward Compatibility

- Core memory file path will change (include session ID) — old file can be ignored or migrated
- Handoff chain is new — existing code doesn't depend on it
- No breaking changes to existing tool interfaces

---

## Estimated Effort

- Phase 1: ~30 minutes
- Phase 2: ~20 minutes  
- Phase 3: ~45 minutes (if opted in)
- Tests + verification: ~30 minutes

**Total: ~2 hours**
