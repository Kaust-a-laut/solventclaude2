# Changelog

All notable changes to Solvent AI v1.

## [Unreleased] - 2026-03-26

### Added

#### Hardening & Quality
- Memory leak fixes for 5 useEffect cleanup issues
- Socket.io authentication middleware with token validation
- Socket.io rate limiting (10 SYNC_NOTES/min, 5 CRYSTALLIZE_MEMORY/min)
- Socket.io input validation with Zod schemas
- Room-based socket isolation by session
- Test coverage thresholds (25% lines/statements)
- E2E testing with Playwright in CI

#### Agent Autonomy UX
- Decision Review UI with approve/reject workflow
- Pending decisions queue with 60s auto-expiration
- Auto-approval for safe tools (`read_file`, `list_files`, `crystallize_memory`)
- Mission Dashboard component with agent activity timeline
- Consensus meter with sparkline history
- Interactive decision ledger with trigger types and status tracking
- Socket events: `DECISION_PENDING`, `DECISION_RESOLVED`, `DECISION_EXPIRED`

#### Context Intelligence
- Embedding fallback chain: Gemini → Ollama → zero vector
- Session persistence with disk-backed JSON storage
- Session API endpoints (CRUD + search)
- Conversation branching/forking from any message
- Browser context pin/unpin with summary panel
- Global Search component (Cmd+K shortcut)
- Codebase indexer with chokidar file watcher
- Incremental indexing with SHA-256 content hashing
- Auto-start codebase indexing on backend initialization

#### Bug Fixes
- GlobalSearch API mismatch (GET → POST /memory/search)
- Missing chokidar dependency in package.json
- Session persistence race condition (optimistic concurrency)
- Memory search response format (`entries` → `results`)
- Missing error boundaries on new components
- crypto.randomUUID() browser compatibility fallback
- Weak hash function (djb2 → SHA-256)
- Type safety improvements in new components
- Integration tests for overseer API endpoints

### Changed

#### Backend
- `ollamaService.ts` - Added `embed()` method for Ollama embeddings
- `vectorService.ts` - Added fallback chain, `deleteByFilePath()`, `addLinks()`, `getSymbolIndex()`
- `supervisorService.ts` - Added pending decisions queue, approve/reject methods, decision history
- `aiRoutes.ts` - Added 12 new endpoints for sessions, overseer, codebase
- `server.ts` - Auto-start codebase indexer
- `memoryRoutes.ts` - Changed response format from `{entries}` to `{results}`
- `conversationStorageService.ts` - Added optimistic concurrency control
- `codebaseIndexer.ts` - Changed hash function from djb2 to SHA-256

#### Frontend
- `settingsSlice.ts` - Added `browserPinnedUrls`, `addBrowserPinnedUrl()`, `removeBrowserPinnedUrl()`
- `chatSlice.ts` - Added `persistSession()`, `loadSession()`, `listSessions()`, `deleteSession()`, `forkFromMessage()`, debouncing, UUID fallback
- `SessionHistory.tsx` - Updated to load/save from disk-backed storage
- `SupervisorHistory.tsx` - Added approve/reject UI, pending decisions display
- `BrowserArea.tsx` - Added pin/unpin functionality, pinned URLs panel
- `MessageItem.tsx` - Added fork button on assistant messages
- `GlobalSearch.tsx` - Fixed API calls, added error handling
- `MissionDashboard.tsx` - Added error boundary, improved types

#### Configuration
- `backend/vitest.config.ts` - Added coverage thresholds
- `frontend/vite.config.ts` - Added coverage thresholds
- `backend/package.json` - Added chokidar dependency
- `.github/workflows/ci.yml` - Added E2E job, coverage uploads

#### Tests
- Created 9 new test files with 25+ tests
- Backend: 112 tests passing
- Frontend: 36 tests passing

### Files Created (15)

**Backend:**
- `src/services/conversationStorageService.ts`
- `src/services/codebaseIndexer.ts`
- `src/utils/bm25.test.ts`
- `src/services/aiProviderFactory.test.ts`
- `src/services/conversationStorageService.test.ts`
- `src/services/codebaseIndexer.test.ts`
- `src/routes/memoryRoutes.test.ts`
- `src/routes/aiRoutes.overseer.test.ts`

**Frontend:**
- `src/lib/api.ts`
- `src/lib/crypto.ts`
- `src/lib/crypto.test.ts`
- `src/components/ErrorBoundary.tsx`
- `src/components/MissionDashboard.tsx`
- `src/components/GlobalSearch.tsx`
- `src/components/GlobalSearch.test.tsx`

### Files Modified (22)

**Backend:**
- `src/services/ollamaService.ts`
- `src/services/vectorService.ts`
- `src/services/supervisorService.ts`
- `src/routes/aiRoutes.ts`
- `src/server.ts`
- `package.json`
- `vitest.config.ts`
- `src/routes/memoryRoutes.ts`

**Frontend:**
- `src/store/settingsSlice.ts`
- `src/store/chatSlice.ts`
- `src/components/SessionHistory.tsx`
- `src/components/SupervisorHistory.tsx`
- `src/components/BrowserArea.tsx`
- `src/components/MessageItem.tsx`
- `src/components/MissionDashboard.tsx`
- `src/components/GlobalSearch.tsx`
- `vite.config.ts`

**CI/CD:**
- `.github/workflows/ci.yml`

### API Changes

#### New Endpoints
```
GET    /api/v1/sessions
GET    /api/v1/sessions/:id
POST   /api/v1/sessions
PUT    /api/v1/sessions/:id
DELETE /api/v1/sessions/:id
GET    /api/v1/sessions/search?q=

GET    /api/v1/overseer/pending
GET    /api/v1/overseer/history
POST   /api/v1/overseer/approve
POST   /api/v1/overseer/reject

POST   /api/v1/codebase/index
GET    /api/v1/codebase/status
POST   /api/v1/codebase/watch
```

#### Changed Endpoints
```
POST   /api/v1/memory/search  # Response: {entries} → {results}
```

### Breaking Changes

None - all changes are additive or bug fixes.

### Migration Notes

#### Session Storage
Existing in-memory sessions will be migrated to disk on first save. No manual migration needed.

#### Embedding Fallback
If Gemini embeddings fail, system automatically falls back to Ollama. Ensure Ollama is running with `nomic-embed-text` model for best results.

#### Codebase Indexing
Starts automatically on backend startup. To disable, don't call `codebaseIndexer.start()`.

---

## [Previous] - Before 2026-03-26

See git history for earlier changes.
