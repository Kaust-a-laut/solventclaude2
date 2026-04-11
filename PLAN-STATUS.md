# Codebase Improvements Plan — Status Report

**Last updated:** 2026-04-11
**Branch:** `feat/intelligent-search-pipeline`
**Plan file:** `.sisyphus/plans/2026-04-11-codebase-improvements-completion.md`
**Original plan:** `.sisyphus/plans/codebase-improvements.md`

---

## Summary

Systematic cleanup of the Solvent codebase: type safety, error handling, god component extraction, plugin lifecycle, env-driven config, and inline style migration.

---

## What's Done

### Phase A — Fix All TypeScript Errors (COMPLETE)

All 118 TS errors eliminated. Backend and frontend both compile with 0 errors.

| Task | Description | Commit |
|------|-------------|--------|
| A1 | Fix ReviewerOutput duplicate `issues` field | `a32f855` |
| A2 | Add feedback/plan to WaterfallContext | `635f13e` |
| A3 | Loosen PlannerOutput/ExecutorOutput required fields | `85aade1` |
| A4 | Fix waterfallService.ts 27 internal TS errors | `4a8aeaa` |
| A5 | Fix backend error narrowing in browse/memory/vector/ai services | `991502b` |
| A6 | Fix waterfall integration test null guards | `991502b` |
| A7 | Fix frontend BrowserArea.tsx TS errors | `84eef0e` |
| A8 | Fix frontend stores, ChatService, useSpeechToText | `0e74c44`, `84eef0e` |
| A9 | Full repo typecheck verification (0 errors) | verified |

### Phase B — Eliminate `any` Types (IN PROGRESS — ~60% done)

Started at 414 total `any` occurrences (232 backend + 182 frontend).

| Task | Description | Status | Commit |
|------|-------------|--------|--------|
| B1 | Baseline inventory | Done | — |
| B2 | Backend top 10 hotspot files | **~80% done** | `87b5eaf`, `2b5783c`, `08f1004` |
| B3 | Frontend top 10 hotspot files | Not started | — |
| B4 | Clean up long tail, reach 0 | Not started | — |

**Current counts:**
- Backend non-test: **34 remaining** (down from 232)
- Backend tests: ~70 (mostly `as any` in mocks — low priority)
- Frontend: **143 remaining** (not yet started)

**Backend files still with `any` (non-test, 34 total):**
```
3  pluginManager.ts
3  plugins/tools/testRunner.ts
3  lib/socketBatcher.ts
3  jobs/memoryMaintenanceJob.ts
2  localImageService.ts
2  contextService.ts
2  jobs/orchestrationJob.ts
2  jobs/indexProjectJob.ts
2  jobs/imageGenJob.ts
2  constants/tools.ts
1  utils/hnswIndex.ts, fileSystem.ts, conversationWindow.ts
1  toolService.ts, telemetryService.ts, providerSelector.ts
1  fileService.ts, server.ts, routes/memoryRoutes.ts
1  plugins/tools/fileOperations.ts
```

---

## What's Left

### Phase B (remaining) — Eliminate `any` Types

- **B2 tail:** Fix remaining 34 `any` in backend non-test files (20 files, 1-3 each)
- **B3:** Frontend top 10 hotspot files (~143 instances)
- **B4:** Long tail cleanup to reach 0

### Phase C — Empty Catch Blocks

| Task | Description | Status |
|------|-------------|--------|
| C1 | Replace 3 remaining empty catch blocks with logger.debug | Not started |

The 3 targets: `memoryConsolidationService.ts`, `conversationStorageService.ts`, and one more.
(Many `catch {}` blocks are intentional fire-and-forget — only truly empty ones without comments are targets.)

### Phase D — Plugin Unload Lifecycle

| Task | Description | Status |
|------|-------------|--------|
| D1 | Add `dispose()` to IPlugin interface | Not started |
| D2 | Add `unloadProvider`/`unloadTool` to PluginManager (TDD) | Not started |

### Phase E — Env-Driven Config

| Task | Description | Status |
|------|-------------|--------|
| E1 | Add WATERFALL_* env vars to Zod config schema | Not started |
| E2 | Wire env config into waterfallService | Not started |

### Phase F — God Component Extraction

| Task | Component | Lines | Status |
|------|-----------|-------|--------|
| F1 | CodingArea | 603 | Not started |
| F2 | WaterfallArea | 619 | Not started |
| F3 | HomeArea | 632 | Not started |
| F4 | NotepadPiP | 1,134 | Not started |

Goal: Each component under 400 lines.

### Phase G — Inline Styles to Tailwind

| Task | Description | Status |
|------|-------------|--------|
| G1 | Inventory inline styles | Not started |
| G2 | Convert static inline styles in top 10 files | Not started |
| G3 | Clean up long tail | Not started |

### Phase H — Final Verification

| Task | Description | Status |
|------|-------------|--------|
| H1 | Final verification pass (0 errors, 0 any, components < 400 lines) | Not started |
| H2 | Mark original codebase-improvements.md as complete | Not started |

---

## Commits (chronological)

```
a32f855 fix(types): collapse duplicate ReviewerOutput.issues field
635f13e fix(types): add feedback/plan to WaterfallContext to match runStep usage
85aade1 fix(types): make PlannerOutput/ExecutorOutput fields optional to match LLM output shape
4a8aeaa fix(waterfall): eliminate remaining TS errors and last `as any` in waterfallService
991502b fix(backend): error narrowing + waterfall result null guards
0e74c44 fix(ChatService): type search/browse/processChat returns properly
84eef0e fix(frontend): eliminate remaining TS errors; full repo now at 0 errors
87b5eaf refactor(aiService): eliminate all any types (15→0)
2b5783c fix(types): eliminate all `any` in vectorService + cascade fixes
08f1004 fix(types): eliminate `any` across 17 backend hotspot files
```

---

## How to Resume

Pick up at **Phase B remaining**: fix the 34 backend non-test `any` instances across 20 small files, then move to B3 (frontend). After B is done, Phases C-G are independent and can be done in any order. Run `cd backend && npx tsc --noEmit` and `cd frontend && npx tsc --noEmit` after each batch to verify zero errors are maintained.
