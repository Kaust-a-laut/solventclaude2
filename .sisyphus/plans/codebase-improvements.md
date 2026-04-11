# Comprehensive Codebase Improvement Plan

**Date**: 2026-04-10
**Status**: Draft
**Scope**: Frontend + Backend

---

## Executive Summary

A systematic cleanup of the Solvent codebase addressing 12 identified issue categories. The centerpiece is **eliminating the `waterfall-standalone/` code duplication** and establishing consistent **type safety** across the codebase.

**Total Issues**: 12
- Critical: 3
- High Priority: 4  
- Moderate: 5

---

## Phase 0: Foundation (Prerequisite)

### 0.1: Archive `waterfall-standalone/`

**Issue**: 114 file differences between `backend/src` and `waterfall-standalone/backend/src`. Main uses 3-stage (planner/executor/reviewer), standalone uses 4-stage (architect/reasoner/planner/executor). Active development is in main only.

**Resolution**:
```bash
# Create archive branch
git branch waterfall-standalone-backup HEAD~0

# Remove standalone directories
rm -rf /home/caleb/solventclaude2/dazzling-shirley/waterfall-standalone/

# Commit removal
git add -A
git commit -m "chore: remove waterfall-standalone duplicate

The main codebase correctly implements the 3-stage waterfall
(planner → executor → reviewer). The standalone directory was
a diverged duplicate that accumulated 114 differences over time.
All active development now happens in a single location."
```

**Verification**:
- [ ] `waterfall-standalone/` directory no longer exists
- [ ] All references to waterfall-standalone paths removed from imports/configs
- [ ] Main waterfall pipeline still functional

**Estimated Effort**: 1 hour

---

## Phase 1: Type Safety (Critical)

### 1.1: Define Waterfall Domain Interfaces

**Issue**: `waterfallService.ts` has 40+ `any` types obscuring planner/executor/reviewer data contracts.

**Files Affected**:
- `backend/src/services/waterfallService.ts`
- `backend/src/types/memory.ts`

**Resolution**:
Create typed interfaces in `backend/src/types/waterfall.ts`:

```typescript
// Types for planner stage output
export interface PlannerOutput {
  decisions: string[];
  tasks: PlannedTask[];
  estimatedRisk: 'low' | 'medium' | 'high';
  reasoning: string;
}

export interface PlannedTask {
  id: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  dependencies: string[];
  estimatedEffort: number; // minutes
}

// Types for executor stage output
export interface ExecutorOutput {
  filesCreated: FileChange[];
  filesModified: FileChange[];
  filesDeleted: string[];
  decisions: string[];
  errors: ExecutionError[];
}

export interface FileChange {
  path: string;
  operation: 'create' | 'modify' | 'delete';
  summary: string;
}

export interface ExecutionError {
  file?: string;
  message: string;
  recoverable: boolean;
}

// Types for reviewer stage output
export interface ReviewerOutput {
  approved: boolean;
  issues: ReviewIssue[];
  suggestions: string[];
  overallQuality: number; // 0-100
}

export interface ReviewIssue {
  severity: 'error' | 'warning' | 'info';
  file?: string;
  description: string;
  line?: number;
}

// Waterfall session context
export interface WaterfallContext {
  sessionId: string;
  plannerOutput: PlannerOutput | null;
  executorOutput: ExecutorOutput | null;
  reviewerOutput: ReviewerOutput | null;
  currentPhase: 'planning' | 'executing' | 'reviewing' | 'complete';
  errors: string[];
  startTime: number;
}
```

**Verification**:
- [ ] `waterfallService.ts` uses typed interfaces instead of `any`
- [ ] No `let planner: any` declarations remain
- [ ] All stage handoff data is properly typed

**Estimated Effort**: 4 hours

---

### 1.2: Type ChatService

**Issue**: `ChatService.ts` uses `messages: any[]`, `modeConfigs: Record<string, any>`, and untyped catch blocks.

**Files Affected**:
- `frontend/src/services/ChatService.ts`

**Resolution**:
```typescript
// Define ChatParams interface
export interface ChatParams {
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp?: number;
  }>;
  modeConfigs?: Record<string, ModeConfig>;
  deviceInfo?: {
    type: 'desktop' | 'mobile' | 'tablet';
    browser?: string;
    os?: string;
  };
  codingHistory?: Array<{
    task: string;
    outcome: 'success' | 'failure' | 'partial';
    timestamp: number;
  }>;
  lastSearchResults?: SearchResult[];
  notepadContent?: string;
  openFiles?: string[];
}

export interface ModeConfig {
  provider: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  score?: number;
}

// Replace catch blocks
// BEFORE: catch (err: any)
// AFTER: catch (err: unknown)
```

**Verification**:
- [ ] `ChatParams` interface defined and used
- [ ] No `messages: any[]` declarations
- [ ] Catch blocks use `unknown` instead of `any`

**Estimated Effort**: 2 hours

---

### 1.3: Type Speech Recognition Hook

**Issue**: `useSpeechToText.ts` uses `useRef<any>`, `event: any` without proper DOM types.

**Files Affected**:
- `frontend/src/hooks/useSpeechToText.ts`

**Resolution**:
```typescript
// BEFORE
const recognitionRef = useRef<any>(null);
recognitionRef.current.onresult = (event: any) => { ... }

// AFTER
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

const recognitionRef = useRef<SpeechRecognition | null>(null);
recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => { ... }
```

**Verification**:
- [ ] No `useRef<any>` in the file
- [ ] All event handlers properly typed
- [ ] `SpeechRecognition` interface properly imported

**Estimated Effort**: 1 hour

---

### 1.4: Replace Remaining `catch (error: any)` Patterns

**Issue**: Catch blocks throughout codebase use `error: any` instead of `error: unknown`.

**Files Affected** (production code only):
- `backend/src/plugins/providers/*.ts`
- `backend/src/services/*.ts`
- `frontend/src/store/*.ts`

**Resolution**:
```typescript
// Pattern to replace
catch (error: any) { ... }

// Replacement pattern
catch (error: unknown) {
  if (error instanceof Error) {
    logger.error(error.message, { stack: error.stack });
  } else {
    logger.error('Unknown error', { error });
  }
}
```

**Verification**:
- [ ] All catch blocks use `unknown`
- [ ] Errors are properly logged

**Estimated Effort**: 2 hours

---

## Phase 2: Error Handling (High Priority)

### 2.1: Fix Swallowed Errors

**Issue**: 7 empty/silent catch blocks across codebase.

**Locations**:

| File | Line | Current | Fix |
|------|------|---------|-----|
| `backend/src/utils/fileSystem.ts` | 30 | `catch (e) {}` | `catch (e) { logger.debug('Cleanup failed', { path: tempPath }); }` |
| `backend/src/utils/fileSystem.ts` | 42 | `catch (e) {}` | `catch (e) { logger.debug('Cleanup failed', { path: tempPath }); }` |
| `electron/main.ts` | 239 | `catch (e) {}` | `catch (e) { logger.error('IPC handler failed', { error: e }); }` |
| `electron/ModelManager.ts` | 53 | `catch (e) {}` | `catch (e) { logger.error('Model execution failed', { error: e }); }` |

**Resolution**: Add logging to all empty catch blocks.

**Verification**:
- [ ] No more empty `catch {}` blocks
- [ ] All catch blocks log failures at appropriate level

**Estimated Effort**: 1 hour

---

### 2.2: Centralize Logging

**Issue**: 333 `console.*` calls across 88 files instead of using centralized `logger.ts`.

**Files to Update**:
- `backend/src/plugins/providers/*.ts` — Replace `console.error` with `logger.error`
- `backend/src/server.ts` — Replace `console.log` with `logger.info`

**Resolution**:
```bash
# Find all console.* in providers
grep -r "console\." backend/src/plugins/providers/

# Replace pattern:
# console.log([Provider]) -> logger.info([Provider])
# console.error([Provider]) -> logger.error([Provider])
# console.warn([Provider]) -> logger.warn([Provider])
```

**Verification**:
- [ ] No `console.*` in provider files
- [ ] Server startup uses logger

**Estimated Effort**: 2 hours

---

## Phase 3: Frontend Architecture (High Priority)

### 3.1: Extract NotepadPiP Subcomponents

**Issue**: `NotepadPiP.tsx` is 1,134 lines doing PiP overlay, overseer panel, mission dashboard, and terminal sub-panels.

**Current Structure**:
```
NotepadPiP.tsx (1134 lines)
├── PiP overlay rendering
├── Overseer panel
│   ├── Mission controls
│   └── Activity feed
├── Mission dashboard
│   ├── Progress bars
│   └── Expert opinions
└── Terminal sub-panels
```

**Resolution**: Extract into separate components:

```
components/
├── NotepadPiP.tsx (container - ~200 lines)
├── NotepadPiPOverseer.tsx (overseer panel logic)
├── NotepadPiPMissionDashboard.tsx (mission tracking)
└── NotepadPiPActivityFeed.tsx (activity list)
```

**Verification**:
- [ ] `NotepadPiP.tsx` reduced to <400 lines
- [ ] All functionality preserved
- [ ] No broken imports

**Estimated Effort**: 4 hours

---

### 3.2: Extract CodingArea Subcomponents

**Issue**: `CodingArea.tsx` is 603 lines with WebContainer boot, file tree, terminal, and editor logic.

**Resolution**:
```
components/coding/
├── CodingArea.tsx (container - ~200 lines)
├── WebContainerManager.tsx (container lifecycle)
├── FileTreePanel.tsx (extracted)
├── TerminalPanel.tsx (extracted)
└── EditorPanel.tsx (extracted)
```

**Verification**:
- [ ] `CodingArea.tsx` reduced to <400 lines
- [ ] File tree, terminal, editor as separate imports
- [ ] All functionality preserved

**Estimated Effort**: 4 hours

---

### 3.3: Extract WaterfallArea Subcomponents

**Issue**: `WaterfallArea.tsx` is 619 lines with stage management, detail panel, and preset picker.

**Resolution**:
```
components/waterfall/
├── WaterfallArea.tsx (container - ~200 lines)
├── WaterfallStageCard.tsx (already exists)
├── WaterfallDetailPanel.tsx (already exists)
├── WaterfallPresetPicker.tsx (already exists - move from root)
└── WaterfallProgress.tsx (new - progress tracking)
```

**Verification**:
- [ ] `WaterfallArea.tsx` reduced to <400 lines
- [ ] Waterfall components properly organized

**Estimated Effort**: 3 hours

---

### 3.4: Extract HomeArea Subcomponents

**Issue**: `HomeArea.tsx` is 632 lines with feature cards, mode switching, and layout composition.

**Resolution**:
```
components/
├── HomeArea.tsx (container - ~200 lines)
├── FeatureCard.tsx (extract repeated patterns)
├── ModeSwitcher.tsx (extract mode logic)
└── LayoutGrid.tsx (extract grid layout)
```

**Verification**:
- [ ] `HomeArea.tsx` reduced to <400 lines
- [ ] Feature cards as reusable component

**Estimated Effort**: 3 hours

---

## Phase 4: Backend Services (High Priority)

### 4.1: Add Plugin Unload Lifecycle

**Issue**: `pluginManager.ts` has `load()` and `reload()` but no `unload()`.

**Files Affected**:
- `backend/src/services/pluginManager.ts`
- `backend/src/types/plugins.ts`

**Resolution**:
```typescript
// In IProviderPlugin interface, add:
interface IProviderPlugin {
  // ... existing methods ...
  
  /** Optional cleanup when plugin is unloaded */
  dispose?(): Promise<void>;
}

// In pluginManager.ts, add:
async unloadProvider(providerId: string): Promise<void> {
  const provider = this.providers.get(providerId);
  if (!provider) {
    throw new Error(`Provider ${providerId} not found`);
  }
  
  // Call dispose if available
  if (provider.dispose) {
    await provider.dispose();
  }
  
  this.providers.delete(providerId);
  logger.info(`Provider ${providerId} unloaded`);
}
```

**Verification**:
- [ ] `unloadProvider()` method exists
- [ ] Dispose hooks called on unload
- [ ] Memory/resources cleaned up

**Estimated Effort**: 2 hours

---

### 4.2: Implement Exponential Backoff

**Issue**: `waterfallService.ts` uses fixed 15s delay for 429 errors.

**Resolution**:
```typescript
// In waterfallService.ts, replace fixed delay with:
function exponentialBackoff(attempt: number, baseDelay: number = 1000): number {
  const delay = Math.min(baseDelay * Math.pow(2, attempt), 30000); // max 30s
  const jitter = Math.random() * 0.3 * delay; // 0-30% jitter
  return delay + jitter;
}
```

**Verification**:
- [ ] Retries use exponential backoff
- [ ] Jitter present to prevent thundering herd
- [ ] Max delay capped at 30 seconds

**Estimated Effort**: 1 hour

---

## Phase 5: Configuration (Moderate)

### 5.1: Env-Driven Waterfall Constants

**Issue**: `MAX_RETRIES`, `SCORE_THRESHOLD`, `MAX_STEPS` hardcoded in `config.ts`.

**Resolution**:
```typescript
// In config.ts, add to envSchema:
WATERFALL_MAX_RETRIES: z.number().min(0).max(10).default(2),
WATERFALL_SCORE_THRESHOLD: z.number().min(0).max(100).default(80),
WATERFALL_MAX_STEPS: z.number().min(1).max(50).default(10),

// In APP_CONSTANTS, use env values:
WATERFALL: {
  MAX_RETRIES: parseInt(process.env.WATERFALL_MAX_RETRIES || '2'),
  SCORE_THRESHOLD: parseInt(process.env.WATERFALL_SCORE_THRESHOLD || '80'),
  MAX_STEPS: parseInt(process.env.WATERFALL_MAX_STEPS || '10'),
}
```

**Verification**:
- [ ] Constants readable from environment
- [ ] Zod validation in place
- [ ] Defaults match existing behavior

**Estimated Effort**: 1 hour

---

### 5.2: Model Lists as Config

**Issue**: 485-line `models.ts` with hardcoded model lists.

**Resolution**:
```typescript
// Keep models.ts for TypeScript access
// Add .env support for overrides
WATERFALL_PLANNER_MODEL=qwen3-coder-plus
WATERFALL_EXECUTOR_MODEL=kimi-k2
WATERFALL_REVIEWER_MODEL=glm-4.7

// In config.ts:
export const WATERFALL_MODELS = {
  planner: process.env.WATERFALL_PLANNER_MODEL || WATERFALL_DEFAULT_SELECTION.planner.model,
  executor: process.env.WATERFALL_EXECUTOR_MODEL || WATERFALL_DEFAULT_SELECTION.executor.model,
  reviewer: process.env.WATERFALL_REVIEWER_MODEL || WATERFALL_DEFAULT_SELECTION.reviewer.model,
};
```

**Verification**:
- [ ] Model selections overridable via env
- [ ] TypeScript still gets type safety
- [ ] Defaults preserved

**Estimated Effort**: 2 hours

---

## Phase 6: Frontend Styling (Moderate)

### 6.1: Convert Inline Styles to Tailwind

**Issue**: 47+ inline `style={{}}` instances, mostly in `Logo.tsx` (9), `KnowledgeMap.tsx` (3).

**Priority Conversions**:

| File | Lines | Reason |
|------|-------|--------|
| `Logo.tsx` | 9 | SVG gradients - keep as inline |
| `KnowledgeMap.tsx` | 3 | `touchAction: 'none'` → `touch-none` |
| `MissionDashboard.tsx` | 1 | `height: 100%` → `h-full` |

**Resolution**:
```tsx
// BEFORE (KnowledgeMap.tsx)
<div style={{ touchAction: 'none' }}>

// AFTER
<div className="touch-none">
```

**Verification**:
- [ ] Inline styles reduced where equivalent Tailwind exists
- [ ] Complex gradients/transforms preserved as inline
- [ ] No visual regressions

**Estimated Effort**: 2 hours

---

## Phase 7: Telemetry (Moderate)

### 7.1: Await Telemetry Calls

**Issue**: `aiService.ts` fires telemetry without awaiting, causing potential drops.

**Resolution**:
```typescript
// BEFORE
telemetryService.recordChat(response);

// AFTER
await telemetryService.recordChat(response);
```

**Verification**:
- [ ] Telemetry calls awaited
- [ ] No telemetry drops in normal operation

**Estimated Effort**: 1 hour

---

## Execution Order

```
Phase 0 (Foundation)
└── 0.1 Archive waterfall-standalone

Phase 1 (Type Safety)
├── 1.1 Waterfall interfaces
├── 1.2 ChatService types
├── 1.3 Speech recognition types
└── 1.4 Catch block types

Phase 2 (Error Handling)
├── 2.1 Fix swallowed errors
└── 2.2 Centralize logging

Phase 3 (Frontend Architecture)
├── 3.1 NotepadPiP extraction
├── 3.2 CodingArea extraction
├── 3.3 WaterfallArea extraction
└── 3.4 HomeArea extraction

Phase 4 (Backend Services)
├── 4.1 Plugin unload lifecycle
└── 4.2 Exponential backoff

Phase 5 (Configuration)
├── 5.1 Env-driven constants
└── 5.2 Model lists as config

Phase 6 (Styling)
└── 6.1 Convert inline styles

Phase 7 (Telemetry)
└── 7.1 Await telemetry calls
```

---

## Acceptance Criteria

### Must Pass
- [ ] `waterfall-standalone/` removed
- [ ] No regressions in waterfall pipeline
- [ ] TypeScript compiles without errors
- [ ] All existing tests pass
- [ ] New tests added for refactored components

### Should Pass
- [ ] `any` occurrences in waterfallService.ts reduced by 80%
- [ ] No empty catch blocks in production code
- [ ] God components reduced to <500 lines each

### Nice to Have
- [ ] All console.* calls in providers replaced
- [ ] Inline styles reduced by 50%
- [ ] Env-driven configuration functional

---

## Effort Summary

| Phase | Estimated Hours | Priority |
|-------|----------------|----------|
| Phase 0 | 1 | Critical |
| Phase 1 | 12 (+tests) | Critical |
| Phase 2 | 3 | High |
| Phase 3 | 18 (+tests) | High |
| Phase 4 | 3 | High |
| Phase 5 | 3 | Moderate |
| Phase 6 | 2 | Moderate |
| Phase 7 | 1 | Moderate |
| **Total** | **~45 hours** | |

---

## Decisions Made

1. **Archive/Delete**: DELETE — `waterfall-standalone/` removed entirely
2. **Breaking Changes**: OK — Type signatures will change, downstream imports updated
3. **Tests**: ADD — Each refactored component gets tests using existing vitest

---

## Appendix: File Change Summary

| File | Action | Lines Changed |
|------|--------|---------------|
| `waterfall-standalone/` | DELETE | ~2000 |
| `backend/src/types/waterfall.ts` | CREATE | ~100 |
| `backend/src/services/waterfallService.ts` | MODIFY | ~100 |
| `frontend/src/services/ChatService.ts` | MODIFY | ~30 |
| `frontend/src/hooks/useSpeechToText.ts` | MODIFY | ~15 |
| `backend/src/utils/fileSystem.ts` | MODIFY | ~10 |
| `electron/main.ts` | MODIFY | ~5 |
| `electron/ModelManager.ts` | MODIFY | ~5 |
| `backend/src/plugins/providers/*.ts` | MODIFY | ~50 |
| `frontend/src/components/NotepadPiP.tsx` | MODIFY | -700 |
| `frontend/src/components/CodingArea.tsx` | MODIFY | -350 |
| `frontend/src/components/WaterfallArea.tsx` | MODIFY | -350 |
| `frontend/src/components/HomeArea.tsx` | MODIFY | -400 |
| `backend/src/services/pluginManager.ts` | MODIFY | ~50 |
| `backend/src/config.ts` | MODIFY | ~20 |
| `frontend/src/components/**/*.tsx` | MODIFY | ~50 |
