# Solvent AI v1 — Developer Quick Reference

**Quick links:** [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) | [HARDENING_PLAN.md](./HARDENING_PLAN.md) | [docs/bug-fixes-plan.md](./docs/bug-fixes-plan.md)

---

## New Features at a Glance

| Feature | Location | How to Use |
|---------|----------|------------|
| Session Persistence | `.solvent_sessions/` | Auto-saves on every message |
| Conversation Forking | Message hover | Click 🍴 icon on assistant messages |
| Global Search | Anywhere | `Cmd+K` / `Ctrl+K` |
| Browser Pin/Unpin | BrowserArea | Click "📌 Pin Page" button |
| Decision Review | Supervisor HUD | Approve/reject pending decisions |
| Mission Dashboard | Auto-shows during missions | Real-time agent activity |
| Codebase Indexing | Auto-starts on backend | Logs to `[CodebaseIndexer]` |

---

## API Quick Reference

### Sessions
```bash
# List sessions
curl http://localhost:3001/api/v1/sessions

# Get session
curl http://localhost:3001/api/v1/sessions/:id

# Create session
curl -X POST http://localhost:3001/api/v1/sessions \
  -H "Content-Type: application/json" \
  -d '{"id":"x","mode":"chat","messages":[]}'

# Search sessions
curl "http://localhost:3001/api/v1/sessions/search?q=query"
```

### Overseer Decisions
```bash
# Get pending decisions
curl http://localhost:3001/api/v1/overseer/pending

# Approve decision
curl -X POST http://localhost:3001/api/v1/overseer/approve \
  -H "Content-Type: application/json" \
  -d '{"decisionId":"x"}'

# Reject decision
curl -X POST http://localhost:3001/api/v1/overseer/reject \
  -H "Content-Type: application/json" \
  -d '{"decisionId":"x","reason":"not needed"}'
```

### Codebase Indexing
```bash
# Trigger full index
curl -X POST http://localhost:3001/api/v1/codebase/index \
  -H "Content-Type: application/json" \
  -d '{"rootPath":"/path/to/project"}'

# Get status
curl http://localhost:3001/api/v1/codebase/status

# Start/stop watcher
curl -X POST http://localhost:3001/api/v1/codebase/watch \
  -H "Content-Type: application/json" \
  -d '{"enabled":true}'
```

---

## Socket Events

### Listen for these events:
```typescript
// Decision review
socket.on('DECISION_PENDING', (decision) => {
  // Show approve/reject UI
});

socket.on('DECISION_RESOLVED', ({ id, status }) => {
  // Update UI
});

// Mission progress
socket.on('MISSION_PROGRESS', (data) => {
  // Update dashboard
});
```

---

## Frontend Store Actions

### Session Management
```typescript
const { 
  persistSession,      // Save current session
  loadSession,         // Load session by ID
  listSessions,        // List all sessions
  deleteSession,       // Delete session
  forkFromMessage,     // Fork from message ID
} = useAppStore();
```

### Browser Context
```typescript
const {
  browserPinnedUrls,      // Array of pinned URLs
  addBrowserPinnedUrl,    // (url, title, summary) => void
  removeBrowserPinnedUrl, // (url) => void
} = useAppStore();
```

---

## Backend Services

### ConversationStorageService
```typescript
import { conversationStorageService } from './services/conversationStorageService';

// Save session
await storageService.saveSession(session);

// Load session
const session = await storageService.loadSession(id);

// List sessions
const sessions = await storageService.listSessions(mode);

// Search sessions
const results = await storageService.searchSessions(query);

// Delete session
await storageService.deleteSession(id);
```

### CodebaseIndexer
```typescript
import { codebaseIndexer } from './services/codebaseIndexer';

// Start watching
await codebaseIndexer.start({ rootPath: process.cwd() });

// Stop watching
await codebaseIndexer.stop();

// Full index
await codebaseIndexer.indexProject(rootPath);

// Get status
const status = codebaseIndexer.getStatus();
// { isWatching, pendingChanges, isIndexing, cachedFiles }
```

### SupervisorService
```typescript
import { supervisorService } from './services/supervisorService';

// Get pending decisions
const pending = supervisorService.getPendingDecisions();

// Approve decision
const result = await supervisorService.approveDecision(id);

// Reject decision
const result = await supervisorService.rejectDecision(id, reason);

// Get history
const history = supervisorService.getDecisionHistory(limit, offset);
```

---

## Testing

### Run Tests
```bash
# Backend
cd backend && npm test

# Frontend
cd frontend && npm test

# Specific test file
cd backend && npm test -- bm25.test.ts
cd frontend && npm test -- GlobalSearch.test.tsx
```

### Test Coverage
```bash
# Backend with coverage
cd backend && npm test -- --coverage

# Frontend with coverage
cd frontend && npm test -- --coverage
```

Coverage reports in:
- `backend/coverage/`
- `frontend/coverage/`

---

## Configuration

### Environment Variables
```bash
# Backend (.env)
BACKEND_INTERNAL_SECRET=your_secret_key
GEMINI_API_KEY=your_key
OLLAMA_HOST=http://localhost:11434
```

### Coverage Thresholds
```typescript
// backend/vitest.config.ts
coverage: {
  thresholds: {
    global: {
      lines: 25,
      statements: 25,
      branches: 20,
      functions: 20
    }
  }
}
```

---

## Common Issues

### Session Not Saving
Check browser console for API errors. Verify backend is running and `.solvent_sessions/` directory exists.

### Global Search Not Finding Memories
Verify `POST /api/v1/memory/search` endpoint is working. Check embeddings are being generated.

### Codebase Indexer Not Starting
Check backend logs for `[CodebaseIndexer]` messages. Verify chokidar is installed: `npm list chokidar`

### Decision Review Not Showing
Check Socket.io connection is authenticated. Verify `DECISION_PENDING` event is being emitted.

---

## File Structure

```
.solvent_sessions/
├── index.json           # Session index
└── <sessionId>.json     # Individual sessions

.solvent_memory.json     # Vector memory
.solvent_embedding_cache.json  # Embedding cache
.solvent_hnsw.bin        # HNSW index
.solvent_file_hashes.json # Codebase indexer cache
```

---

## Git Workflow

```bash
# Current branch
git checkout fix/solvent-see-13-bugs

# View commits
git log --oneline -20

# See all changes
git diff main..fix/solvent-see-13-bugs --stat
```

---

## Need Help?

1. Check [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) for full details
2. Review [docs/bug-fixes-plan.md](./docs/bug-fixes-plan.md) for bug fix specifics
3. Search codebase for specific features
4. Check backend/frontend logs for errors
