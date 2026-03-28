# Solvent AI — Hardening, Autonomy & Intelligence Plan

**Date:** 2026-03-26
**Scope:** Areas 1 (Hardening & Quality), 2 (Agent Autonomy UX), 3 (Context Intelligence)
**Deferred:** Areas 4 (Collaboration & Sharing), 5 (Plugin Ecosystem)

---

## Current State Summary

| Metric | Value | Target |
|--------|-------|--------|
| Test coverage | 13% (25/199 files) | 60%+ critical paths |
| Memory leaks | 5 confirmed | 0 |
| Socket.io auth | None | Token-based middleware |
| CI checks | Unit tests only | Tests + lint + types + coverage + E2E |
| Supervisor approval UI | None | Full approve/reject flow |
| Session persistence | In-memory only | Disk-backed with search |
| Embedding service | Broken (404s) | Working with fallback |
| Conversation branching | None | Fork from any message |

---

## Phase 1: Hardening & Quality (Area 1)

### 1A — Fix Memory Leaks (5 issues)

**Effort:** Small | **Risk:** Low | **Impact:** Eliminates setState-on-unmounted warnings

| # | File | Issue | Fix |
|---|------|-------|-----|
| 1 | `ChatArea.tsx:70-73` | setTimeout without cleanup in useEffect (graph pulse) | Store timeout ID in ref, clear on cleanup |
| 2 | `ChatArea.tsx:101` | setTimeout in onSupervisorNudge callback (10s dismiss) | Track timeout ID in ref, clear on unmount |
| 3 | `FloatingNotepad.tsx:78-82` | PiP `pagehide` listener never removed | Store listener ref, remove on unmount |
| 4 | `BrowserArea.tsx:290-294` | PiP `pagehide` listener never removed | Same pattern as #3 |
| 5 | `CodingArea.tsx:143-147` | WebContainer `on('server-ready')` / `on('error')` accumulate | Track listeners, remove before re-attaching and on unmount |

### 1B — Socket.io Security

**Effort:** Medium | **Risk:** Medium (breaking change for clients) | **Impact:** Critical security gap closed

**Current state:** Zero auth on connections, no input validation, no rate limiting, all events broadcast to all clients.

#### Step 1: Authentication Middleware
- Add `io.use()` middleware that validates `socket.handshake.auth.token`
- Token = `X-Solvent-Secret` from config (same as REST API uses)
- Frontend: pass `auth: { token }` in `io()` connection options
- Reject unauthenticated connections with `Error('Authentication required')`

**Files to modify:**
- `backend/src/server.ts` — add auth middleware
- `frontend/src/lib/socket.ts` — pass auth token
- `frontend/src/lib/config.ts` — expose secret for socket auth

#### Step 2: Input Validation
- Add Zod schemas for `SYNC_NOTES` and `CRYSTALLIZE_MEMORY` payloads
- Enforce `content` max length (50KB)
- Enforce `graph` max depth (5 levels) and max keys (500)
- Reject malformed payloads with error event

**Files to modify:**
- `backend/src/server.ts` — add validation before handler calls

#### Step 3: Rate Limiting
- Per-socket rate limiter: max 10 `SYNC_NOTES` / minute, max 5 `CRYSTALLIZE_MEMORY` / minute
- Simple sliding window counter per socket ID
- Emit `rate-limited` event on exceed

**Files to create:**
- `backend/src/utils/socketRateLimiter.ts`

#### Step 4: Room-Based Emission
- Join each authenticated socket to a room based on session/user ID
- Replace `io.emit()` with `io.to(room).emit()` for sensitive events
- This prevents cross-client data leakage

### 1C — Test Coverage Expansion

**Effort:** Large | **Risk:** Low | **Impact:** Confidence in deployments, regression prevention

**Current state:** 25 test files for 199 source files. Frontend at 4% (3/73 components). All controllers, routes, and 76% of services untested.

#### Priority Tier 1 — Critical Path Tests (target: 15 new test files)

These cover the paths where bugs cause data loss, security issues, or broken core flows:

| # | File to Test | Why Critical |
|---|-------------|--------------|
| 1 | `aiProviderFactory.ts` | All AI calls route through here |
| 2 | `waterfallService.ts` | Core multi-model evaluation pipeline |
| 3 | `conversationService.ts` | War Room turn management, consensus |
| 4 | `supervisorService.ts` | Autonomous decision-making |
| 5 | `bm25.ts` | Search ranking algorithm |
| 6 | `conversationWindow.ts` | Context windowing for token limits |
| 7 | `tokenEstimator.ts` | Prevents context overflow |
| 8 | `messageUtils.ts` | Message formatting for all providers |
| 9 | `aiController.ts` | Request validation, routing |
| 10 | `collaborateController.ts` | War Room HTTP layer |
| 11 | `chatSlice.ts` | Core frontend state |
| 12 | `settingsSlice.ts` | User preferences state |
| 13 | `waterfallSlice.ts` | Pipeline state management |
| 14 | `collaborateSlice.ts` | Multi-agent conversation state |
| 15 | `ChatService.ts` | Frontend ↔ Backend communication |

#### Priority Tier 2 — Provider & Integration Tests (target: 8 new test files)

| # | File to Test | Why |
|---|-------------|-----|
| 1 | `groqService.ts` | Primary fast provider |
| 2 | `geminiService.ts` | Used by Supervisor |
| 3 | `ollamaService.ts` | Local inference path |
| 4 | `openRouterService.ts` | Multi-model routing |
| 5 | `debateService.ts` | Adversarial flow correctness |
| 6 | `memoryConsolidationService.ts` | Memory integrity |
| 7 | `browseService.ts` | Search/extract reliability |
| 8 | `fileService.ts` | File operations safety |

#### Priority Tier 3 — Frontend Component Tests (target: 6 new test files)

| # | Component | Why |
|---|-----------|-----|
| 1 | `ChatInput.tsx` | User's primary interaction point |
| 2 | `MessageList.tsx` | Message rendering correctness |
| 3 | `SettingsModal.tsx` | Settings must save correctly |
| 4 | `CollaborateArea.tsx` | War Room SSE parsing |
| 5 | `WaterfallVisualizer.tsx` | Pipeline state visualization |
| 6 | `ModelSelector.tsx` | Model selection correctness |

### 1D — CI Pipeline Improvements

**Effort:** Small | **Risk:** Low | **Impact:** Prevents broken merges

**Current state:** CI only runs `npm test` for frontend and backend. No lint, no type checking, no coverage, no E2E.

#### Add to `.github/workflows/ci.yml`:

```yaml
# Backend job additions:
- run: npx tsc --noEmit              # Type checking
- run: npm run test -- --coverage     # Coverage report
  env:
    COVERAGE_THRESHOLD: 40            # Start low, ratchet up

# Frontend job additions:
- run: npm run lint                   # ESLint (script exists, not in CI)
- run: npx tsc --noEmit              # Type checking
- run: npm run test -- --coverage     # Coverage report

# New job: E2E
e2e:
  needs: [backend, frontend]
  steps:
    - run: npx playwright install
    - run: npm run test:e2e
```

#### Add coverage configuration:
- `backend/vitest.config.ts` — add `coverage: { provider: 'v8', thresholds: { lines: 40 } }`
- `frontend/vite.config.ts` — same

---

## Phase 2: Agent Autonomy UX (Area 2)

### 2A — Decision Review UI (Approve/Reject)

**Effort:** Medium | **Risk:** Low | **Impact:** Users control autonomous actions before execution

**Current state:** Supervisor executes tool calls immediately. Users see decisions in a read-only log after the fact.

#### Backend Changes

**New: Decision Queue**

Add a pending decision queue to `supervisorService.ts`:

```
supervisorService.ts changes:
- Add pendingDecisions: Map<string, PendingDecision>
- When think() produces intervention.needed + toolToExecute:
  - Don't execute immediately
  - Store as PendingDecision { id, decision, tool, args, timestamp, status: 'pending' }
  - Emit OVERSEER_DECISION with status: 'pending_approval'
  - Start 60s auto-expire timer (configurable)

- New method: approveDecision(id) → executes the tool, marks 'approved'
- New method: rejectDecision(id) → marks 'rejected', logs reason
- New method: getPendingDecisions() → returns all pending
```

**New: API Endpoints** (add to `aiRoutes.ts`):

```
POST /api/v1/overseer/approve    { decisionId }
POST /api/v1/overseer/reject     { decisionId, reason? }
GET  /api/v1/overseer/pending
```

**New: Socket Events:**
- `DECISION_PENDING` — new decision awaiting approval
- `DECISION_RESOLVED` — decision approved/rejected/expired

#### Frontend Changes

**Modify `SupervisorHistory.tsx`:**
- Add approve/reject buttons on pending decisions
- Pending decisions highlighted with amber border + pulsing indicator
- Show tool name + args preview before approval
- Countdown timer showing auto-expire
- Toast notification when new pending decision arrives

**Modify `NotepadPiP.tsx` Overseer tab:**
- Filter view: All | Pending | Approved | Rejected
- Batch approve/reject for multiple pending decisions
- Decision stats: approved/rejected/expired counts

**New: graphSlice additions:**
```typescript
pendingDecisions: PendingDecision[]
addPendingDecision(d: PendingDecision): void
resolveDecision(id: string, resolution: 'approved' | 'rejected'): void
```

#### Configuration

Add to settings:
- `autoApproveReadOnly: boolean` — auto-approve read_file/list_files (safe ops)
- `autoApproveCrystallize: boolean` — auto-approve memory crystallization
- `approvalTimeoutSec: number` — seconds before auto-expire (default 60)
- `requireApprovalForActions: boolean` — master toggle (default true)

### 2B — Mission Progress Dashboard

**Effort:** Medium | **Risk:** Low | **Impact:** Real-time visibility into what agents are doing

**Current state:** Basic progress percentage in PiP window Missions tab. No agent-level detail, no timeline, no resource usage.

#### New Component: `MissionDashboard.tsx`

A dedicated panel (accessible from Collaborate area or PiP) showing:

**Active Mission Card:**
- Mission type badge (consultation/refinement/research/code-review)
- Goal text
- Started timestamp + elapsed time
- Overall progress bar (from BullMQ progress events)

**Agent Activity Timeline:**
- Vertical timeline showing each agent's contributions in order
- Agent avatar + name + role
- Status indicator: thinking → speaking → waiting
- Token count per agent response
- Expandable to show full response

**Resource Usage:**
- Total tokens used (in + out)
- Provider calls made (with provider name)
- Memory entries accessed
- Tools executed (with results)

**Live Consensus Meter** (for conversational missions):
- Gauge from 0-100 showing current consensus score
- History sparkline showing score progression across rounds
- Labels: Divergent (0-30) → Debating (30-60) → Converging (60-80) → Consensus (80+)

#### Backend Changes

Enhance socket emissions to include richer metadata:

```typescript
// Enhance MISSION_PROGRESS event payload:
{
  jobId: string,
  progress: number,
  currentAgent: { name: string, role: string },
  phase: 'thinking' | 'speaking' | 'synthesizing',
  roundNumber: number,
  totalRounds: number,
  tokensUsed: { in: number, out: number },
  agentContributions: Array<{ agent: string, tokenCount: number, messageCount: number }>
}
```

### 2C — Interactive Decision Ledger

**Effort:** Small-Medium | **Risk:** Low | **Impact:** Decision history becomes navigable and useful

**Current state:** Decision ledger is an in-memory array of strings in supervisorService. Frontend shows a flat chronological list.

#### Backend: Structured Decision Records

Replace `decisionLedger: string[]` with:

```typescript
interface DecisionRecord {
  id: string;
  timestamp: number;
  trigger: 'notepad_change' | 'memory_crystallization' | 'mission_complete' | 'manual' | 'guidance';
  decision: string;
  intervention: { needed: boolean; type?: string; message?: string } | null;
  toolExecuted: { name: string; args: any; result: any } | null;
  status: 'auto_approved' | 'pending' | 'approved' | 'rejected' | 'expired';
  contextSnapshot: { notepadExcerpt: string; recentMessages: number; memoriesQueried: number };
  relatedDecisions: string[];  // IDs of decisions this one references
}
```

- Persist to vectorService with `overseer_decision` tag
- Add REST endpoint: `GET /api/v1/overseer/history?limit=50&offset=0&trigger=&status=`

#### Frontend: Interactive Ledger View

Enhance `SupervisorHistory.tsx` to support:
- **Filter by trigger type** — dropdown: notepad / memory / mission / manual
- **Filter by status** — pending / approved / rejected / all
- **Search decisions** — full-text search across decision text
- **Decision detail expansion** — click to see: context snapshot, tool execution result, related decisions
- **Decision threading** — related decisions linked as a chain (e.g., "this supersedes decision X")
- **Export** — download decision history as JSON

---

## Phase 3: Context Intelligence (Area 3)

### 3A — Fix Embedding Service + Add Fallback

**Effort:** Small | **Risk:** Medium | **Impact:** Restores semantic search (currently degraded to keyword-only)

**Current state:** Gemini embedding API returns 404. No fallback. All memory retrieval falls back to BM25 keyword matching only.

#### Fix Primary: Gemini Embeddings
- Verify API endpoint URL and model name (`text-embedding-004` or `embedding-001`)
- Check API key scoping (embedding API may require different auth)
- Add error logging with full URL + response body for debugging

#### Add Fallback: Ollama Embeddings
- When Gemini embedding fails, fall back to local Ollama `nomic-embed-text` model
- Ollama is already a configured provider in the system
- Add to `vectorService.ts`:
  ```typescript
  private async getEmbedding(text: string): Promise<number[]> {
    try {
      return await this.geminiEmbed(text);
    } catch {
      return await this.ollamaEmbed(text); // fallback
    }
  }
  ```
- Cache embeddings regardless of source (already have LRU cache)

#### Add Fallback: Lightweight Local Embeddings
- If both Gemini and Ollama fail, use a minimal local embedding
- Consider `@xenova/transformers` for browser-compatible local embeddings
- Or a simple TF-IDF vector as last resort (better than nothing)

**Files to modify:**
- `backend/src/services/vectorService.ts` — embedding method with fallback chain
- `backend/src/services/ollamaService.ts` — add `embed()` method

### 3B — Session Persistence

**Effort:** Medium | **Risk:** Medium | **Impact:** Conversations survive restarts, enables search & branching

**Current state:** All conversations in Zustand in-memory store. Lost on page reload.

#### Storage Layer

Add `conversationStorageService.ts`:

```typescript
interface StoredSession {
  id: string;
  mode: string;
  title: string;                    // Auto-generated from first message
  messages: StoredMessage[];
  createdAt: number;
  updatedAt: number;
  parentMessageId?: string;         // For branching: which message this forks from
  parentSessionId?: string;         // For branching: which session this forks from
  metadata: {
    modelUsed: string[];
    messageCount: number;
    tokenEstimate: number;
    tags: string[];
  };
}
```

**Storage backend:** JSON files in `.solvent_sessions/` directory
- One file per session: `{sessionId}.json`
- Index file: `.solvent_sessions/index.json` with session summaries
- Auto-save on every message (debounced 2s)
- Load on app start: restore last active session per mode

#### Frontend Integration

**Modify `chatSlice.ts`:**
- Add `persistSession()` action — debounced save to backend
- Add `loadSession(id)` action — fetch from backend
- Add `listSessions(mode?)` action — get session index
- Auto-persist after each `addMessage` / `updateLastMessage`

**Enhance `SessionHistory.tsx`:**
- Show all saved sessions grouped by mode
- Search across session titles and message content
- Sort by: recent, most messages, mode
- Delete session option
- Session metadata display (model used, message count, date range)

**New API Endpoints:**
```
GET    /api/v1/sessions?mode=&search=&limit=&offset=
GET    /api/v1/sessions/:id
POST   /api/v1/sessions              (create)
PUT    /api/v1/sessions/:id          (update)
DELETE /api/v1/sessions/:id
GET    /api/v1/sessions/search?q=    (full-text search across messages)
```

### 3C — Browser → Chat Context Injection Enhancement

**Effort:** Small | **Risk:** Low | **Impact:** Browsed content automatically enriches AI responses

**Current state:** Browser search results and visited URLs are injected into the next chat message, then cleared. No persistence. No user control over what gets injected.

#### Improvements:

1. **Persistent browse context panel** — sidebar in chat showing what web context is active
2. **Pin/unpin sources** — user can pin important URLs to keep them in context across messages
3. **Auto-summarize on visit** — when user visits a URL, auto-generate 2-3 sentence summary stored in memory
4. **Browse history in memory** — save visited URLs + summaries to vectorService for cross-session retrieval
5. **Citation markers** — when AI uses browse context, show `[1]` inline citations linking back to source URL

**Files to modify:**
- `frontend/src/components/BrowserArea.tsx` — add pin/unpin, context panel
- `frontend/src/components/ChatInput.tsx` — show active context sources
- `backend/src/services/browseService.ts` — auto-summarize, persist to memory
- `backend/src/services/contextService.ts` — include pinned browse context

### 3D — Conversation Branching / Forking

**Effort:** Medium | **Risk:** Medium | **Impact:** Explore multiple reasoning paths from any message

**Depends on:** 3B (Session Persistence)

#### Data Model

Each session gets a `parentMessageId` and `parentSessionId` field. Forking creates a new session that copies messages up to the fork point.

```typescript
// In chatSlice:
forkFromMessage(messageId: string): string  // Returns new sessionId
// Copies messages[0..indexOf(messageId)] into a new session
// Sets parentSessionId and parentMessageId
// Switches to new session
```

#### Frontend

**Fork button on messages:**
- Hover on any assistant message → show fork icon
- Click → creates branch with all messages up to that point
- New branch opens in same view with breadcrumb showing lineage

**Branch navigator:**
- Tree visualization showing session lineage
- Click any node to switch to that branch
- Branch labels auto-generated or user-editable
- Merge option: take a branch's last message and inject it back into parent

### 3E — Cross-Session Memory Search

**Effort:** Medium | **Risk:** Low | **Impact:** Find relevant context from any past conversation

**Depends on:** 3B (Session Persistence)

#### Search Engine

Extend `vectorService.ts` to index conversation messages:
- On session save, index key messages (user queries + AI responses over 100 tokens)
- Tag with session ID, mode, timestamp
- BM25 + semantic hybrid search across messages

#### Search UI

**New component: `GlobalSearch.tsx`**
- Cmd+K shortcut to open
- Search across: memories, sessions, messages, files
- Results grouped by type with source links
- Click result → navigate to session + scroll to message
- Filter by: mode, date range, model used

**Integration points:**
- Header search bar
- Context panel in chat (showing relevant past conversations)
- Memory tab in settings (unified view)

### 3F — Codebase Indexing Agent

**Effort:** Medium | **Risk:** Low | **Impact:** AI understands project structure without manual context

**Current state:** Batch indexing exists via `vectorService.indexProject()` but requires manual trigger, no incremental updates, regex-based symbol extraction.

#### Improvements:

1. **File watcher for incremental indexing**
   - Use `chokidar` (already available in Node ecosystem) to watch workspace
   - On file change: re-index only that file
   - Debounce to 5s to avoid thrashing
   - Track file hashes to skip unchanged files

2. **Smarter symbol extraction**
   - TypeScript: Use `ts-morph` or TypeScript compiler API for accurate AST parsing
   - Extract: exports, imports, function signatures, type definitions, class hierarchies
   - Build import graph: which files depend on which

3. **Project summary generation**
   - On first index or major change, generate a 500-word project summary
   - Include: tech stack, directory structure, key patterns, entry points
   - Store as a high-priority memory entry
   - Inject into context for all coding mode conversations

4. **Dependency analysis**
   - Parse package.json / requirements.txt for dependency list
   - Flag outdated or vulnerable packages (npm audit integration)
   - Include in project context

---

## Execution Order

The phases are ordered by dependency and impact:

```
Phase 1A: Memory Leaks         ─── Can start immediately (standalone)
Phase 1B: Socket Security       ─── Can start immediately (standalone)
Phase 1C: Test Coverage (Tier 1)─── Can start immediately (standalone)
Phase 1D: CI Improvements       ─── After some tests exist (after 1C starts)
    │
    ▼
Phase 2A: Decision Review UI    ─── After socket auth exists (after 1B)
Phase 2B: Mission Dashboard     ─── Can start after 2A pattern established
Phase 2C: Interactive Ledger    ─── Can start after 2A pattern established
    │
    ▼
Phase 3A: Fix Embeddings        ─── Can start immediately (standalone)
Phase 3B: Session Persistence   ─── Can start immediately (standalone)
Phase 3C: Browser Context       ─── After 3B exists
Phase 3D: Conversation Branching─── After 3B exists
Phase 3E: Cross-Session Search  ─── After 3B exists
Phase 3F: Codebase Indexing     ─── Can start immediately (standalone)
```

### Parallelizable Work Streams

**Stream A (Security + Hardening):** 1A → 1B → 1D
**Stream B (Testing):** 1C (ongoing, can run throughout)
**Stream C (Autonomy):** 2A → 2B + 2C
**Stream D (Intelligence):** 3A + 3B → 3C + 3D + 3E + 3F

Streams A, B, C, D can all run in parallel.

---

## Files Manifest (All Files to Create or Modify)

### New Files
| File | Purpose |
|------|---------|
| `backend/src/utils/socketRateLimiter.ts` | Per-socket rate limiting |
| `backend/src/services/conversationStorageService.ts` | Session persistence |
| `frontend/src/components/MissionDashboard.tsx` | Agent activity dashboard |
| `frontend/src/components/GlobalSearch.tsx` | Cross-session search UI |
| ~29 new test files | Test coverage expansion |

### Modified Files
| File | Changes |
|------|---------|
| `frontend/src/components/ChatArea.tsx` | Fix 2 timeout leaks |
| `frontend/src/components/FloatingNotepad.tsx` | Fix pagehide listener leak |
| `frontend/src/components/BrowserArea.tsx` | Fix pagehide leak + context enhancement |
| `frontend/src/components/CodingArea.tsx` | Fix WebContainer listener leak |
| `backend/src/server.ts` | Socket auth middleware, validation, rate limiting, room-based emit |
| `frontend/src/lib/socket.ts` | Pass auth token |
| `backend/src/services/supervisorService.ts` | Decision queue, approval flow, structured records |
| `backend/src/routes/aiRoutes.ts` | New endpoints (approval, sessions, search) |
| `backend/src/services/vectorService.ts` | Embedding fallback, message indexing |
| `backend/src/services/ollamaService.ts` | Add embed() method |
| `frontend/src/store/chatSlice.ts` | Session persistence, fork support |
| `frontend/src/store/graphSlice.ts` | Pending decisions, mission dashboard state |
| `frontend/src/components/SupervisorHistory.tsx` | Approve/reject UI, filters, search |
| `frontend/src/components/NotepadPiP.tsx` | Enhanced overseer tab, mission detail |
| `frontend/src/components/SessionHistory.tsx` | Saved sessions, search |
| `.github/workflows/ci.yml` | Add lint, types, coverage, E2E |
| `backend/vitest.config.ts` | Coverage config |
| `frontend/vite.config.ts` | Coverage config |
