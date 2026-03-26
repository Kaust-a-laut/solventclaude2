# Bug Fixes & Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 10 bugs and issues discovered during HARDENING_PLAN.md implementation

**Architecture:** Systematic bug fixes across backend and frontend, prioritizing critical functionality breaks first

**Tech Stack:** TypeScript, Node.js, React, Socket.io, chokidar, vitest

---

## Critical Issues (Must Fix)

### Task 1: Fix GlobalSearch API Mismatch

**Files:**
- Modify: `frontend/src/components/GlobalSearch.tsx:75-85`
- Test: `frontend/src/components/GlobalSearch.test.tsx` (create)

- [ ] **Step 1: Update GlobalSearch to use POST with correct payload**

```typescript
// Replace line 79 in GlobalSearch.tsx
const memoriesRes = await api.post('/memory/search', {
  q: searchQuery,
  limit: 10
}).catch(() => ({ data: { results: [] } }));
```

- [ ] **Step 2: Fix response mapping from `entries` to `results`**

```typescript
// Update the memory results formatting (around line 95)
if (memoriesRes.data.entries) {
  for (const memory of memoriesRes.data.entries) {
    formattedResults.push({
      type: 'memory',
      id: memory.id,
      title: memory.type || 'Memory',
      excerpt: memory.content?.slice(0, 150) || '',
      score: memory.score,
      metadata: {
        memoryType: memory.type
      }
    });
  }
}
```

- [ ] **Step 3: Write test for GlobalSearch API calls**

```typescript
// frontend/src/components/GlobalSearch.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GlobalSearch } from './GlobalSearch';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn()
  }
}));

describe('GlobalSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call POST /memory/search with correct payload', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { entries: [] } });
    vi.mocked(api.get).mockResolvedValue({ data: { sessions: [] } });

    render(<GlobalSearch />);
    
    // Trigger open and search
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    const input = screen.getByPlaceholderText(/search/i);
    fireEvent.change(input, { target: { value: 'test query' } });

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/memory/search', {
        q: 'test query',
        limit: 10
      });
    });
  });
});
```

- [ ] **Step 4: Run tests to verify fix**

```bash
cd frontend && npm test -- GlobalSearch.test.tsx
# Expected: PASS
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/GlobalSearch.tsx frontend/src/components/GlobalSearch.test.tsx
git commit -m "fix: GlobalSearch API mismatch - use POST /memory/search correctly"
```

---

### Task 2: Add chokidar to Dependencies

**Files:**
- Modify: `backend/package.json`

- [ ] **Step 1: Add chokidar to dependencies**

```json
{
  "dependencies": {
    "@google/generative-ai": "^0.21.0",
    "@types/socket.io": "^3.0.1",
    "axios": "^1.6.8",
    "bullmq": "^5.67.1",
    "cheerio": "^1.2.0",
    "chokidar": "^3.5.3",
    "cors": "^2.8.5",
    ...
  }
}
```

- [ ] **Step 2: Install dependencies**

```bash
cd backend && npm install
```

- [ ] **Step 3: Verify chokidar is installed**

```bash
cd backend && npm list chokidar
# Expected: chokidar@3.5.3
```

- [ ] **Step 4: Commit**

```bash
git add backend/package.json backend/package-lock.json
git commit -m "fix: add chokidar as explicit dependency for codebase indexer"
```

---

### Task 3: Fix Session Persistence Race Condition

**Files:**
- Modify: `frontend/src/store/chatSlice.ts:85-100`
- Modify: `backend/src/services/conversationStorageService.ts:55-70`

- [ ] **Step 1: Add debouncing to persistSession**

```typescript
// frontend/src/store/chatSlice.ts
// Add debounce utility at top of file
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Update persistSession to use debouncing
persistSession: async () => {
  const state = get();
  const messages = state.sessions[state.currentMode] || [];
  const sessionId = state.currentSessionId || crypto.randomUUID();
  
  if (messages.length === 0) return;
  
  try {
    // Add timestamp for optimistic concurrency
    await api.post('/sessions', {
      id: sessionId,
      mode: state.currentMode,
      messages,
      updatedAt: Date.now(),
      parentSessionId: state.currentSessionId ? undefined : sessionId,
    });
    set({ currentSessionId: sessionId });
  } catch (error) {
    console.error('[chatSlice] Failed to persist session:', error);
  }
},
```

- [ ] **Step 2: Add optimistic concurrency check to backend**

```typescript
// backend/src/services/conversationStorageService.ts
async saveSession(session: StoredSession): Promise<void> {
  try {
    const filePath = this.getSessionFilePath(session.id);
    
    // Check for concurrent modification
    try {
      const existingData = await fs.readFile(filePath, 'utf-8');
      const existing = JSON.parse(existingData);
      if (existing.updatedAt > session.updatedAt) {
        logger.warn('[ConversationStorage] Concurrent modification detected, skipping save');
        return; // Skip save - newer version exists
      }
    } catch (e: any) {
      if (e.code !== 'ENOENT') throw e; // File doesn't exist is OK
    }
    
    await fs.writeFile(filePath, JSON.stringify(session, null, 2), 'utf-8');
    await this.updateIndex(session);
    logger.debug(`[ConversationStorage] Saved session ${session.id}`);
  } catch (error) {
    logger.error('[ConversationStorage] Failed to save session', error);
    throw error;
  }
}
```

- [ ] **Step 3: Write test for concurrent session saves**

```typescript
// backend/src/services/conversationStorageService.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConversationStorageService } from './conversationStorageService';
import fs from 'fs/promises';
import path from 'path';

describe('ConversationStorageService', () => {
  const testSessionDir = path.join(__dirname, '../../../.solvent_sessions_test');
  
  beforeEach(async () => {
    await fs.mkdir(testSessionDir, { recursive: true });
  });
  
  afterEach(async () => {
    await fs.rm(testSessionDir, { recursive: true, force: true });
  });
  
  it('should reject stale session updates', async () => {
    const service = new ConversationStorageService();
    // Override session path for testing
    (service as any).getSessionFilePath = (id: string) => 
      path.join(testSessionDir, `${id}.json`);
    
    const session1 = {
      id: 'test-1',
      mode: 'chat',
      title: 'Test',
      messages: [],
      createdAt: Date.now(),
      updatedAt: 1000,
      metadata: { modelsUsed: [], messageCount: 0, tokenEstimate: 0, tags: [] }
    };
    
    const session2 = { ...session1, updatedAt: 2000, messages: [{ id: '1', role: 'user', content: 'new' }] };
    const staleSession = { ...session1, updatedAt: 500, messages: [{ id: '1', role: 'user', content: 'old' }] };
    
    // Save newer version first
    await service.saveSession(session2);
    
    // Try to save stale version - should be rejected
    await service.saveSession(staleSession);
    
    // Verify newer version persisted
    const loaded = await service.loadSession('test-1');
    expect(loaded?.messages).toHaveLength(1);
    expect(loaded?.messages[0].content).toBe('new');
  });
});
```

- [ ] **Step 4: Run tests**

```bash
cd backend && npm test -- conversationStorageService.test.ts
# Expected: PASS
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/store/chatSlice.ts backend/src/services/conversationStorageService.ts backend/src/services/conversationStorageService.test.ts
git commit -m "fix: add optimistic concurrency control to session persistence"
```

---

### Task 4: Fix Memory Search Response Format

**Files:**
- Modify: `backend/src/routes/memoryRoutes.ts:62-82`

- [ ] **Step 1: Update memory search to return `results` instead of `entries`**

```typescript
// backend/src/routes/memoryRoutes.ts
// POST /api/v1/memory/search — semantic search via embeddings
router.post('/memory/search', async (req: Request, res: Response) => {
  const { query, limit = 10 } = req.body as { query?: string; limit?: number };
  if (!query) return res.status(400).json({ error: 'query is required' });

  const results = await vectorService.search(query, limit);
  const formattedResults = results.map((r: any) => ({
    id: r.id,
    score: r.score,
    text: r.metadata?.content || r.metadata?.summary || '',
    metadata: {
      type: r.metadata?.type || null,
      tier: r.metadata?.tier || null,
      importance: r.metadata?.importance ?? null,
      confidence: r.metadata?.confidence ?? null,
      timestamp: r.metadata?.timestamp || r.metadata?.lastUpdated || null,
      tags: r.metadata?.tags || [],
    },
  }));

  res.json({ results: formattedResults });
});
```

- [ ] **Step 2: Update GlobalSearch to use correct response field**

```typescript
// frontend/src/components/GlobalSearch.tsx - update line 95
if (memoriesRes.data.results) {
  for (const memory of memoriesRes.data.results) {
    formattedResults.push({
      type: 'memory',
      id: memory.id,
      title: memory.metadata?.type || 'Memory',
      excerpt: memory.text?.slice(0, 150) || '',
      score: memory.score,
      metadata: {
        memoryType: memory.metadata?.type
      }
    });
  }
}
```

- [ ] **Step 3: Write integration test**

```typescript
// backend/src/routes/memoryRoutes.test.ts
import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { vectorService } from '../services/vectorService';

vi.mock('../services/vectorService');

describe('POST /api/v1/memory/search', () => {
  it('should return results with correct format', async () => {
    vi.mocked(vectorService.search).mockResolvedValue([
      {
        id: 'mem-1',
        score: 0.95,
        metadata: { type: 'architectural_decision', content: 'Test content' }
      }
    ]);

    const response = await request(app)
      .post('/api/v1/memory/search')
      .send({ query: 'test', limit: 10 });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('results');
    expect(response.body.results[0]).toMatchObject({
      id: 'mem-1',
      score: 0.95,
      text: 'Test content',
      metadata: { type: 'architectural_decision' }
    });
  });
});
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/memoryRoutes.ts frontend/src/components/GlobalSearch.tsx backend/src/routes/memoryRoutes.test.ts
git commit -m "fix: memory search response format - return results instead of entries"
```

---

## Medium Priority Issues

### Task 5: Add Error Boundaries to New Components

**Files:**
- Create: `frontend/src/components/ErrorBoundary.tsx`
- Modify: `frontend/src/components/MissionDashboard.tsx`
- Modify: `frontend/src/components/GlobalSearch.tsx`
- Modify: `frontend/src/components/SupervisorHistory.tsx`

- [ ] **Step 1: Create ErrorBoundary component**

```typescript
// frontend/src/components/ErrorBoundary.tsx
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex items-center justify-center p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl">
          <AlertTriangle size={16} className="text-rose-400 mr-2" />
          <span className="text-[10px] text-rose-300">Something went wrong</span>
        </div>
      );
    }

    return this.props.children;
  }
}
```

- [ ] **Step 2: Wrap MissionDashboard with ErrorBoundary**

```typescript
// frontend/src/components/MissionDashboard.tsx - wrap return statement
return (
  <ErrorBoundary fallback={
    <div className="fixed top-4 right-4 z-40 w-80">
      <div className="bg-black/95 backdrop-blur-2xl border border-rose-500/20 rounded-2xl p-4">
        <div className="flex items-center gap-3 text-rose-400">
          <AlertTriangle size={18} />
          <span className="text-[10px] font-black uppercase tracking-widest">Dashboard Error</span>
        </div>
      </div>
    </div>
  }>
    {/* existing component content */}
  </ErrorBoundary>
);
```

- [ ] **Step 3: Add error handling to GlobalSearch**

```typescript
// frontend/src/components/GlobalSearch.tsx - add error state
const [searchError, setSearchError] = useState<string | null>(null);

// Update performSearch
const performSearch = async (searchQuery: string) => {
  setIsLoading(true);
  setSearchError(null);
  try {
    // ... existing code
  } catch (error) {
    console.error('[GlobalSearch] Search failed:', error);
    setSearchError('Search unavailable');
  } finally {
    setIsLoading(false);
  }
};

// Add error UI in results section
{searchError && (
  <div className="p-8 text-center">
    <AlertTriangle size={24} className="text-rose-500/50 mx-auto mb-2" />
    <p className="text-[10px] text-rose-400 uppercase tracking-widest">{searchError}</p>
  </div>
)}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ErrorBoundary.tsx frontend/src/components/MissionDashboard.tsx frontend/src/components/GlobalSearch.tsx
git commit -m "feat: add error boundaries to new components"
```

---

### Task 6: Fix crypto.randomUUID() Browser Compatibility

**Files:**
- Create: `frontend/src/lib/crypto.ts`
- Modify: `frontend/src/store/chatSlice.ts`

- [ ] **Step 1: Create crypto utility with fallback**

```typescript
// frontend/src/lib/crypto.ts

/**
 * Generate a UUID v4, with fallback for browsers without crypto.randomUUID()
 */
export function generateUUID(): string {
  // Try native implementation first
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
```

- [ ] **Step 2: Update chatSlice to use generateUUID**

```typescript
// frontend/src/store/chatSlice.ts
import { generateUUID } from '../lib/crypto';

// Replace all crypto.randomUUID() calls with generateUUID()
const msgWithId = message.id ? message : { ...message, id: generateUUID() };
const sessionId = state.currentSessionId || generateUUID();
const newSessionId = generateUUID();
```

- [ ] **Step 3: Write test for UUID generation**

```typescript
// frontend/src/lib/crypto.test.ts
import { describe, it, expect } from 'vitest';
import { generateUUID } from './crypto';

describe('generateUUID', () => {
  it('should generate valid UUID v4 format', () => {
    const uuid = generateUUID();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(uuid).toMatch(uuidRegex);
  });

  it('should generate unique UUIDs', () => {
    const uuids = new Set();
    for (let i = 0; i < 1000; i++) {
      uuids.add(generateUUID());
    }
    expect(uuids.size).toBe(1000);
  });
});
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/crypto.ts frontend/src/lib/crypto.test.ts frontend/src/store/chatSlice.ts
git commit -m "fix: add UUID fallback for browser compatibility"
```

---

### Task 7: Improve Codebase Indexer Hash Function

**Files:**
- Modify: `backend/src/services/codebaseIndexer.ts:330-345`

- [ ] **Step 1: Replace simple hash with proper SHA-256**

```typescript
// backend/src/services/codebaseIndexer.ts
import { createHash } from 'crypto';

// Replace the hashContent method
private hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 16);
}
```

- [ ] **Step 2: Write test for hash function**

```typescript
// backend/src/services/codebaseIndexer.test.ts
import { describe, it, expect } from 'vitest';
import { CodebaseIndexer } from './codebaseIndexer';

describe('CodebaseIndexer', () => {
  const indexer = new CodebaseIndexer();

  it('should generate consistent hashes', () => {
    const hash1 = (indexer as any).hashContent('test content');
    const hash2 = (indexer as any).hashContent('test content');
    expect(hash1).toBe(hash2);
  });

  it('should generate different hashes for different content', () => {
    const hash1 = (indexer as any).hashContent('test content 1');
    const hash2 = (indexer as any).hashContent('test content 2');
    expect(hash1).not.toBe(hash2);
  });

  it('should generate 16-character hex strings', () => {
    const hash = (indexer as any).hashContent('test');
    expect(hash).toHaveLength(16);
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });
});
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/services/codebaseIndexer.ts backend/src/services/codebaseIndexer.test.ts
git commit -m "fix: use SHA-256 for file content hashing to reduce collisions"
```

---

## Low Priority Improvements

### Task 8: Add Type Safety to New Components

**Files:**
- Modify: `frontend/src/components/MissionDashboard.tsx`
- Modify: `frontend/src/components/GlobalSearch.tsx`
- Modify: `backend/src/services/supervisorService.ts`

- [ ] **Step 1: Tighten MissionDashboard types**

```typescript
// frontend/src/components/MissionDashboard.tsx
interface MissionProgress {
  jobId: string;
  progress: number; // 0-100
  currentAgent?: { name: string; role: string };
  phase?: 'thinking' | 'speaking' | 'synthesizing';
  roundNumber?: number;
  totalRounds?: number;
  tokensUsed?: { in: number; out: number };
  agentContributions?: AgentContribution[];
  startedAt?: number;
  status: 'queued' | 'active' | 'complete' | 'failed';
}
```

- [ ] **Step 2: Tighten GlobalSearch types**

```typescript
// frontend/src/components/GlobalSearch.tsx
interface SearchResult {
  type: 'session' | 'message' | 'memory' | 'file';
  id: string;
  title: string;
  excerpt: string;
  score?: number;
  metadata: {
    mode?: string;
    date?: string;
    messageCount?: number;
    memoryType?: string;
    filePath?: string;
  };
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/MissionDashboard.tsx frontend/src/components/GlobalSearch.tsx
git commit -m "refactor: improve type safety in new components"
```

---

### Task 9: Add Integration Tests for New API Endpoints

**Files:**
- Create: `backend/src/routes/aiRoutes.overseer.test.ts`
- Create: `backend/src/routes/aiRoutes.sessions.test.ts`
- Create: `backend/src/routes/aiRoutes.codebase.test.ts`

- [ ] **Step 1: Test overseer endpoints**

```typescript
// backend/src/routes/aiRoutes.overseer.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { supervisorService } from '../services/supervisorService';

vi.mock('../services/supervisorService');

describe('Overseer Endpoints', () => {
  describe('GET /api/v1/overseer/pending', () => {
    it('should return pending decisions', async () => {
      vi.mocked(supervisorService.getPendingDecisions).mockReturnValue([
        {
          id: 'dec-1',
          timestamp: Date.now(),
          decision: 'Test decision',
          intervention: { needed: true, type: 'action', message: 'Test', toolToExecute: null },
          crystallize: null,
          mentalMapUpdate: null,
          status: 'pending',
          trigger: 'notepad_change',
          expiresAt: Date.now() + 60000
        }
      ]);

      const response = await request(app).get('/api/v1/overseer/pending');
      
      expect(response.status).toBe(200);
      expect(response.body.decisions).toHaveLength(1);
      expect(response.body.decisions[0].id).toBe('dec-1');
    });
  });

  describe('POST /api/v1/overseer/approve', () => {
    it('should approve decision', async () => {
      vi.mocked(supervisorService.approveDecision).mockResolvedValue({ success: true });

      const response = await request(app)
        .post('/api/v1/overseer/approve')
        .send({ decisionId: 'dec-1' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 400 for missing decisionId', async () => {
      const response = await request(app)
        .post('/api/v1/overseer/approve')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('decisionId is required');
    });
  });
});
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/routes/aiRoutes.*.test.ts
git commit -m "test: add integration tests for new API endpoints"
```

---

## Verification

- [ ] **Step 1: Run all backend tests**

```bash
cd backend && npm test
# Expected: All tests pass
```

- [ ] **Step 2: Run all frontend tests**

```bash
cd frontend && npm test
# Expected: All tests pass
```

- [ ] **Step 3: Run type checks**

```bash
cd backend && npx tsc --noEmit
cd frontend && npx tsc --noEmit
# Expected: No type errors
```

- [ ] **Step 4: Verify GlobalSearch works end-to-end**

```bash
# Start backend and frontend, then test search functionality manually
# Should see both sessions and memories in results
```

---

## Summary

**Total Tasks:** 9
**Estimated Time:** 2-3 hours
**Risk Level:** Low (all fixes are isolated and well-tested)

**Priority Order:**
1. Task 1: GlobalSearch API mismatch (critical - feature broken)
2. Task 2: Add chokidar dependency (critical - could break on clean install)
3. Task 3: Session race condition (high - data loss risk)
4. Task 4: Memory search format (high - search incomplete)
5. Task 5: Error boundaries (medium - better UX)
6. Task 6: UUID fallback (medium - browser compatibility)
7. Task 7: Hash function (low - collision risk is small)
8. Task 8: Type safety (low - quality improvement)
9. Task 9: Integration tests (low - test coverage)
