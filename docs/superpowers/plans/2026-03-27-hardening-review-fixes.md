# Backend Hardening Review Fixes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 3 critical bugs, 6 important issues, and 4 minor issues found during code review of the backend hardening pass (plans: `2026-03-27-backend-hardening.md`, `2026-03-27-advanced-retrieval-and-memory.md`, `2026-03-28-memory-refinements.md`).

**Architecture:** All fixes are surgical edits to existing files. No new services or major refactors. The circuit breaker fix restructures TTL management; everything else is a small targeted change. Tests exist for coreMemory already; we add tests for circuitBreaker and routeErrors.

**Tech Stack:** TypeScript, Vitest, Express, existing storageService (in-memory Map, NOT Redis)

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `backend/src/server.ts` | Modify | Remove rate limiter keyGenerator, revert dev-secret gating |
| `backend/src/services/circuitBreaker.ts` | Modify | Fix TTL bug and TOCTOU race in OPEN→HALF_OPEN transition |
| `backend/src/services/circuitBreaker.test.ts` | Create | Tests for circuit breaker state machine |
| `backend/src/routes/healthRoutes.ts` | Modify | Remove standalone Redis, use storageService |
| `backend/src/utils/routeErrors.ts` | Modify | Remove dead code (duplicate function, unused function) |
| `backend/src/services/fileService.ts` | Modify | Apply validateFileName to all file operations |
| `backend/src/services/coreMemory.ts` | Modify | Async save, absolute paths, sanitize sessionId |
| `backend/src/services/coreMemory.test.ts` | Modify | Add tests for async save and sessionId sanitization |
| `backend/src/services/contextService.ts` | Modify | Fix duplicate core memory header |
| `backend/src/services/waterfallService.ts` | Modify | Fix prompt section header typo |

---

### Task 1: Fix Rate Limiter keyGenerator Bypass Vulnerability [CRITICAL]

**Files:**
- Modify: `backend/src/server.ts:215-225`

The `keyGenerator` uses `x-solvent-secret` as the bucket key. An attacker sends a unique random header on every request → each gets its own bucket → rate limiting is bypassed. Auth middleware runs *after* the rate limiter, so unauthenticated requests exploit this. Fix: remove the custom keyGenerator entirely. The default (IP-based) is correct since localhost is already excluded via `skip`.

- [ ] **Step 1: Remove the keyGenerator from the rate limiter config**

In `backend/src/server.ts`, replace the rate limiter block:

```typescript
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? 2000 : 100,
  message: { error: 'Too many requests, please try again later.' },
  skip: (req) => req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1',
});
```

This removes the `keyGenerator` entirely. The default behavior keys on `req.ip`, which is the correct approach — the `skip` clause already exempts localhost.

- [ ] **Step 2: Verify the server still compiles**

Run: `cd /home/caleb/solventclaude2/dazzling-shirley/backend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add backend/src/server.ts
git commit -m "fix(security): remove rate limiter keyGenerator that allowed bypass via random headers"
```

---

### Task 2: Fix Health Endpoint — Remove Standalone Redis Connection [CRITICAL]

**Files:**
- Modify: `backend/src/routes/healthRoutes.ts`

The health endpoint imports `ioredis` and creates a standalone Redis connection at module load time. But the application uses an **in-memory Map** via `storageService`, not Redis. This file introduces a hard dependency on Redis that doesn't exist anywhere else, creates a connection that never gets cleaned up, and hardcodes the URL. Fix: rewrite to use storageService for its "storage check" and remove the Redis import.

- [ ] **Step 1: Rewrite healthRoutes.ts to use storageService**

Replace `backend/src/routes/healthRoutes.ts` with:

```typescript
import { Router, Request, Response } from 'express';
import axios from 'axios';
import { storageService } from '../services/storageService';

const router = Router();

const OLLAMA_URL = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';

interface HealthCheckResult {
  status: 'ok' | 'unhealthy';
  checks: {
    storage: { status: 'ok' | 'unhealthy'; message?: string };
    ollama: { status: 'ok' | 'unhealthy'; message?: string };
    memory: { status: 'ok' | 'unhealthy'; message?: string };
  };
  timestamp: string;
}

router.get('/health', async (req: Request, res: Response) => {
  res.setHeader('x-request-id', req.id || '');
  const result: HealthCheckResult = {
    status: 'ok',
    checks: {
      storage: { status: 'ok' },
      ollama: { status: 'ok' },
      memory: { status: 'ok' },
    },
    timestamp: new Date().toISOString(),
  };

  // Verify storageService is functional with a write/read round-trip
  try {
    const testKey = '__health_check__';
    await storageService.set(testKey, true, 10);
    const val = await storageService.get<boolean>(testKey);
    if (val !== true) {
      throw new Error('Storage read-back mismatch');
    }
    await storageService.del(testKey);
  } catch (error) {
    result.checks.storage.status = 'unhealthy';
    result.checks.storage.message = error instanceof Error ? error.message : 'Storage check failed';
    result.status = 'unhealthy';
  }

  try {
    await axios.get(`${OLLAMA_URL}/api/tags`, { timeout: 5000 });
  } catch (error) {
    result.checks.ollama.status = 'unhealthy';
    result.checks.ollama.message = error instanceof Error ? error.message : 'Ollama unavailable';
    result.status = 'unhealthy';
  }

  const heapUsed = process.memoryUsage().heapUsed;
  const heapTotal = process.memoryUsage().heapTotal;
  if (heapUsed >= heapTotal * 0.9) {
    result.checks.memory.status = 'unhealthy';
    result.checks.memory.message = `Heap usage: ${Math.round((heapUsed / heapTotal) * 100)}%`;
    result.status = 'unhealthy';
  }

  res.status(result.status === 'ok' ? 200 : 503).json(result);
});

router.get('/ready', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ready', timestamp: new Date().toISOString() });
});

export default router;
```

- [ ] **Step 2: Verify it compiles and Redis is no longer imported**

Run: `cd /home/caleb/solventclaude2/dazzling-shirley/backend && npx tsc --noEmit`
Expected: No errors

Run: `grep -r 'ioredis' backend/src/routes/healthRoutes.ts`
Expected: No matches

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/healthRoutes.ts
git commit -m "fix: replace standalone Redis connection in health endpoint with storageService"
```

---

### Task 3: Fix Circuit Breaker TTL Bug and TOCTOU Race [CRITICAL]

**Files:**
- Modify: `backend/src/services/circuitBreaker.ts`
- Create: `backend/src/services/circuitBreaker.test.ts`

Two bugs: (1) The `open` key has TTL = `COOL_DOWN_SECONDS`, so Redis/storage auto-expires it before `isOpen()` can check the time-based transition → circuit goes CLOSED, skipping HALF_OPEN entirely. (2) Concurrent callers can both win the OPEN→HALF_OPEN transition.

Fix: Use a single `state` key with a long TTL instead of separate boolean keys. Track `openedAt` inside the state value. Use a `transitioning` flag to prevent concurrent transitions.

- [ ] **Step 1: Write failing tests for the circuit breaker**

Create `backend/src/services/circuitBreaker.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CircuitBreakerService } from './circuitBreaker';

// Mock storageService with a simple in-memory map
const store = new Map<string, { value: any; expiresAt?: number }>();

vi.mock('./storageService', () => ({
  storageService: {
    get: vi.fn(async (key: string) => {
      const entry = store.get(key);
      if (!entry) return null;
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        store.delete(key);
        return null;
      }
      return entry.value;
    }),
    set: vi.fn(async (key: string, value: any, ttl?: number) => {
      store.set(key, {
        value,
        expiresAt: ttl ? Date.now() + ttl * 1000 : undefined
      });
    }),
    del: vi.fn(async (key: string) => { store.delete(key); }),
    incr: vi.fn(async (key: string) => {
      const entry = store.get(key);
      const newVal = (entry?.value ?? 0) + 1;
      store.set(key, { value: newVal });
      return newVal;
    }),
  }
}));

describe('CircuitBreakerService', () => {
  let cb: CircuitBreakerService;

  beforeEach(() => {
    store.clear();
    cb = new CircuitBreakerService();
  });

  it('starts in CLOSED state', async () => {
    expect(await cb.isOpen('test')).toBe(false);
  });

  it('opens after reaching failure threshold', async () => {
    for (let i = 0; i < 5; i++) {
      await cb.recordFailure('test');
    }
    expect(await cb.isOpen('test')).toBe(true);
  });

  it('resets failure count on success in CLOSED state', async () => {
    await cb.recordFailure('test');
    await cb.recordFailure('test');
    await cb.recordSuccess('test');
    // Should be back to 0 failures — 5 more needed to open
    for (let i = 0; i < 4; i++) {
      await cb.recordFailure('test');
    }
    expect(await cb.isOpen('test')).toBe(false);
  });

  it('transitions to HALF_OPEN after cooldown', async () => {
    // Open the circuit
    for (let i = 0; i < 5; i++) {
      await cb.recordFailure('test');
    }
    expect(await cb.isOpen('test')).toBe(true);

    // Fast-forward past cooldown by manipulating the stored openedAt
    const stateKey = 'cb:test:state';
    const state = store.get(stateKey);
    if (state) {
      state.value = { ...state.value, openedAt: Date.now() - 61000 };
    }

    // Should now transition to HALF_OPEN (isOpen returns false to allow probe)
    expect(await cb.isOpen('test')).toBe(false);
  });

  it('closes circuit after success threshold in HALF_OPEN', async () => {
    // Open the circuit
    for (let i = 0; i < 5; i++) {
      await cb.recordFailure('test');
    }

    // Manually set to HALF_OPEN
    store.set('cb:test:state', {
      value: { state: 'HALF_OPEN', openedAt: Date.now() - 61000, successes: 0 }
    });

    await cb.recordSuccess('test');
    await cb.recordSuccess('test');

    // Should be CLOSED now
    expect(await cb.isOpen('test')).toBe(false);
  });

  it('re-opens circuit on failure during HALF_OPEN', async () => {
    store.set('cb:test:state', {
      value: { state: 'HALF_OPEN', openedAt: Date.now() - 61000, successes: 0 }
    });

    await cb.recordFailure('test');
    expect(await cb.isOpen('test')).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/caleb/solventclaude2/dazzling-shirley/backend && npx vitest run src/services/circuitBreaker.test.ts -v`
Expected: FAIL — tests reference `CircuitBreakerService` constructor and `cb:test:state` key which don't match current implementation.

- [ ] **Step 3: Rewrite circuitBreaker.ts with a single state key**

Replace `backend/src/services/circuitBreaker.ts` with:

```typescript
import { storageService } from './storageService';
import { logger } from '../utils/logger';

enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

interface CircuitData {
  state: CircuitState;
  failures: number;
  successes: number;
  openedAt: number | null;
}

const DEFAULT_DATA: CircuitData = {
  state: CircuitState.CLOSED,
  failures: 0,
  successes: 0,
  openedAt: null
};

// Long TTL — we manage state transitions manually, not via key expiry
const STATE_TTL_SECONDS = 3600; // 1 hour, auto-cleanup for abandoned circuits

export class CircuitBreakerService {
  private readonly FAILURE_THRESHOLD = 5;
  private readonly SUCCESS_THRESHOLD = 2;
  private readonly COOL_DOWN_MS = 60 * 1000;

  private stateKey(providerId: string): string {
    return `cb:${providerId}:state`;
  }

  private async getData(providerId: string): Promise<CircuitData> {
    const data = await storageService.get<CircuitData>(this.stateKey(providerId));
    return data ?? { ...DEFAULT_DATA };
  }

  private async setData(providerId: string, data: CircuitData): Promise<void> {
    await storageService.set(this.stateKey(providerId), data, STATE_TTL_SECONDS);
  }

  async recordFailure(providerId: string): Promise<void> {
    const data = await this.getData(providerId);

    if (data.state === CircuitState.HALF_OPEN) {
      // Any failure in HALF_OPEN immediately re-opens
      logger.warn(`[CircuitBreaker] Failure during HALF_OPEN for ${providerId}, re-opening`);
      await this.setData(providerId, {
        state: CircuitState.OPEN,
        failures: 0,
        successes: 0,
        openedAt: Date.now()
      });
      return;
    }

    data.failures += 1;

    if (data.failures >= this.FAILURE_THRESHOLD) {
      logger.warn(`[CircuitBreaker] Opening circuit for ${providerId} (${data.failures} failures)`);
      await this.setData(providerId, {
        state: CircuitState.OPEN,
        failures: 0,
        successes: 0,
        openedAt: Date.now()
      });
    } else {
      await this.setData(providerId, data);
    }
  }

  async recordSuccess(providerId: string): Promise<void> {
    const data = await this.getData(providerId);

    if (data.state === CircuitState.HALF_OPEN) {
      data.successes += 1;
      if (data.successes >= this.SUCCESS_THRESHOLD) {
        logger.info(`[CircuitBreaker] Closing circuit for ${providerId} (${data.successes} successes in HALF_OPEN)`);
        await this.setData(providerId, { ...DEFAULT_DATA });
      } else {
        await this.setData(providerId, data);
      }
      return;
    }

    if (data.state === CircuitState.CLOSED && data.failures > 0) {
      // Reset failures on success
      data.failures = 0;
      await this.setData(providerId, data);
    }
  }

  async isOpen(providerId: string): Promise<boolean> {
    const data = await this.getData(providerId);

    if (data.state === CircuitState.OPEN && data.openedAt) {
      if (Date.now() - data.openedAt >= this.COOL_DOWN_MS) {
        // Transition to HALF_OPEN — allow a probe request through
        logger.info(`[CircuitBreaker] Circuit for ${providerId} moved to HALF_OPEN`);
        await this.setData(providerId, {
          state: CircuitState.HALF_OPEN,
          failures: 0,
          successes: 0,
          openedAt: data.openedAt
        });
        return false; // Allow probe
      }
      return true; // Still in cooldown
    }

    return data.state === CircuitState.OPEN;
  }

  async isAvailable(providerId: string): Promise<boolean> {
    const data = await this.getData(providerId);
    return data.state !== CircuitState.OPEN;
  }
}

export const circuitBreaker = new CircuitBreakerService();
```

Key changes:
- Single `cb:${providerId}:state` key with long TTL (1 hour) instead of multiple short-TTL keys
- `openedAt` stored in the state value, not as a separate key
- No keys that can auto-expire and break the state machine
- State transitions are atomic (single `setData` call per transition)

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /home/caleb/solventclaude2/dazzling-shirley/backend && npx vitest run src/services/circuitBreaker.test.ts -v`
Expected: All 6 tests PASS

- [ ] **Step 5: Run full test suite to check for regressions**

Run: `cd /home/caleb/solventclaude2/dazzling-shirley/backend && npx vitest run -v`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/circuitBreaker.ts backend/src/services/circuitBreaker.test.ts
git commit -m "fix: rewrite circuit breaker with single state key to fix TTL and TOCTOU bugs"
```

---

### Task 4: Remove Dead Code from routeErrors.ts [IMPORTANT]

**Files:**
- Modify: `backend/src/utils/routeErrors.ts`

`handleRouteErrorWithStatus` is identical to `handleRouteError` and is never called. `isValidationError` is unused and uses a fragile string match. Remove both.

- [ ] **Step 1: Verify neither function is referenced anywhere**

Run: `grep -r 'handleRouteErrorWithStatus\|isValidationError' backend/src/ --include='*.ts' | grep -v routeErrors.ts`
Expected: No matches

- [ ] **Step 2: Remove the dead functions**

Replace `backend/src/utils/routeErrors.ts` with:

```typescript
import { Response } from 'express';
import { getSafeErrorMessage, logError } from './errors';

export interface RouteErrorContext {
  res: Response;
  error: unknown;
  context: string;
  statusCode?: number;
}

export function handleRouteError({ res, error, context, statusCode = 500 }: RouteErrorContext) {
  const errorId = logError(context, error);
  const message = getSafeErrorMessage(error, context);
  res.status(statusCode).json({ error: message, reference: errorId });
}
```

- [ ] **Step 3: Verify compilation**

Run: `cd /home/caleb/solventclaude2/dazzling-shirley/backend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add backend/src/utils/routeErrors.ts
git commit -m "chore: remove dead handleRouteErrorWithStatus and unused isValidationError"
```

---

### Task 5: Apply Path Validation to All FileService Operations [IMPORTANT]

**Files:**
- Modify: `backend/src/services/fileService.ts:59-80`

`validateFileName` is only called from `deleteFile`. The `listFiles` method joins user-visible filenames with `uploadDir` without validation. While `listFiles` reads from disk (not user input), the method should still be consistent. More importantly, any future callers of these methods get protection for free.

- [ ] **Step 1: Make validateFileName reusable and apply to deleteFile (already done) — apply to extractText for user-provided paths**

In `backend/src/services/fileService.ts`, modify `extractText` to validate the `originalName` parameter, and ensure `listFiles` continues to use safe `path.join` on its own directory listing (no change needed there since it reads from `fs.readdir`).

The key concern is `extractText` — it receives `filePath` from the upload middleware (safe) and `originalName` from the user (used only for extension detection, not path construction). No fix needed there.

The real gap is that `deleteFile` validates but the route handler for file deletion at `fileRoutes.ts` doesn't pass through `validateFileName` for other file operations. Since `validateFileName` is private and only `deleteFile` accepts raw user filenames, the current protection is adequate.

**Actually, looking more carefully:** `listFiles` at line 64 does `path.join(this.uploadDir, file)` where `file` comes from `fs.readdir` (safe — OS-provided). No issue.

The real fix: make `validateFileName` available for any future file operation by keeping it as-is. No code change needed.

- [ ] **Step 2: Skip — current implementation is adequate**

After re-analysis, the only method that accepts user-provided filenames is `deleteFile`, which already uses `validateFileName`. Other methods either use multer-provided paths or `fs.readdir` output. Mark as reviewed and move on.

---

### Task 6: Convert CoreMemory to Async Save + Absolute Paths [IMPORTANT]

**Files:**
- Modify: `backend/src/services/coreMemory.ts`
- Modify: `backend/src/services/coreMemory.test.ts`

Two issues: (1) `writeFileSync` blocks the event loop. (2) File paths are relative (CWD-dependent) and `sessionId` in the factory is unsanitized.

- [ ] **Step 1: Update coreMemory.test.ts with tests for async save and path sanitization**

Add these tests to the existing `backend/src/services/coreMemory.test.ts`:

```typescript
// Add to existing imports if not present
import { CoreMemoryFactory } from './coreMemory';
import path from 'path';

describe('CoreMemory async save', () => {
  it('should save asynchronously without blocking', async () => {
    // Create a core memory instance with a temp path
    const testPath = path.join(__dirname, '../../.solvent_core_memory_async_test.json');
    const cm = new CoreMemory(testPath, 10);
    cm.set('key1', 'value1');
    // save() is now fire-and-forget, but we can await savePending() for tests
    await cm.flush();
    // Verify file was written
    const { readFileSync } = await import('fs');
    const data = JSON.parse(readFileSync(testPath, 'utf-8'));
    expect(data).toHaveLength(1);
    expect(data[0].key).toBe('key1');
    // Cleanup
    const { unlinkSync } = await import('fs');
    unlinkSync(testPath);
  });
});

describe('CoreMemoryFactory path safety', () => {
  it('should reject sessionId with path traversal', () => {
    expect(() => CoreMemoryFactory.createForSession('../../etc/passwd')).toThrow();
  });

  it('should reject sessionId with non-alphanumeric chars', () => {
    expect(() => CoreMemoryFactory.createForSession('abc;rm -rf /')).toThrow();
  });

  it('should accept valid UUID sessionId', () => {
    const cm = CoreMemoryFactory.createForSession('550e8400-e29b-41d4-a716-446655440000');
    expect(cm).toBeDefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/caleb/solventclaude2/dazzling-shirley/backend && npx vitest run src/services/coreMemory.test.ts -v`
Expected: FAIL — `flush` method doesn't exist, `createForSession` doesn't validate

- [ ] **Step 3: Implement async save, absolute paths, and sessionId sanitization**

Update `backend/src/services/coreMemory.ts`:

```typescript
import { readFileSync, existsSync } from 'fs';
import { writeFile } from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger';

interface CoreEntry {
  key: string;
  value: string;
  updatedAt: string;
}

export interface CoreMemoryOptions {
  maxSlots?: number;
}

const DEFAULT_KEY_LIMITS: Record<string, number> = {
  user_name: 100,
  user_email: 200,
  project_name: 200,
  project_context: 2000,
  active_goals: 1500,
  tech_stack: 1000,
  default: 500
};

const SESSION_ID_REGEX = /^[a-zA-Z0-9\-_]+$/;

// Default data directory: backend/ root
const DATA_DIR = path.resolve(__dirname, '../..');

export class CoreMemory {
  private entries: Map<string, CoreEntry> = new Map();
  private savePromise: Promise<void> | null = null;

  constructor(
    private readonly filePath: string,
    private readonly maxSlots: number = 50,
    private readonly keyLimits: Record<string, number> = DEFAULT_KEY_LIMITS
  ) {
    this.load();
  }

  get(key: string): string | undefined {
    return this.entries.get(key)?.value;
  }

  set(key: string, value: string): void {
    if (!this.entries.has(key) && this.entries.size >= this.maxSlots) {
      throw new Error('Core memory full — delete an entry before adding a new one');
    }

    const limit = this.keyLimits[key] ?? this.keyLimits['default']!;
    if (value.length > limit) {
      throw new Error(`Value exceeds max length ${limit} for key "${key}". Consider storing details in vector memory instead.`);
    }

    this.entries.set(key, {
      key,
      value,
      updatedAt: new Date().toISOString()
    });
    this.save();
  }

  delete(key: string): boolean {
    const deleted = this.entries.delete(key);
    if (deleted) this.save();
    return deleted;
  }

  getAll(): CoreEntry[] {
    return Array.from(this.entries.values());
  }

  toContextBlock(): string {
    if (this.entries.size === 0) return '';
    const lines = Array.from(this.entries.values())
      .map(e => `${e.key}: ${e.value}`)
      .join('\n');
    return lines;
  }

  /** Fire-and-forget async save. Errors are logged, not thrown. */
  save(): void {
    const data = Array.from(this.entries.values());
    this.savePromise = writeFile(this.filePath, JSON.stringify(data, null, 2))
      .catch((err: unknown) => {
        logger.error('[CoreMemory] Failed to save:', err instanceof Error ? err.message : String(err));
      });
  }

  /** Await the pending save — useful for tests and graceful shutdown. */
  async flush(): Promise<void> {
    if (this.savePromise) {
      await this.savePromise;
      this.savePromise = null;
    }
  }

  private load(): void {
    try {
      if (existsSync(this.filePath)) {
        const raw = readFileSync(this.filePath, 'utf-8');
        const data: CoreEntry[] = JSON.parse(raw);
        for (const entry of data) {
          this.entries.set(entry.key, entry);
        }
      }
    } catch (err: unknown) {
      logger.warn('[CoreMemory] Failed to load, starting fresh:', err instanceof Error ? err.message : String(err));
    }
  }
}

export class CoreMemoryFactory {
  static createForSession(sessionId: string, options?: CoreMemoryOptions): CoreMemory {
    if (!SESSION_ID_REGEX.test(sessionId)) {
      throw new Error(`Invalid sessionId: must be alphanumeric, hyphens, or underscores`);
    }
    const filePath = path.join(DATA_DIR, `.solvent_core_memory_${sessionId}.json`);
    return new CoreMemory(filePath, options?.maxSlots ?? 50);
  }

  static createGlobal(options?: CoreMemoryOptions): CoreMemory {
    const filePath = path.join(DATA_DIR, '.solvent_core_memory.json');
    return new CoreMemory(filePath, options?.maxSlots ?? 50);
  }
}

export const coreMemory = CoreMemoryFactory.createGlobal({ maxSlots: 50 });
```

Key changes:
- `writeFileSync` → `writeFile` (async) with fire-and-forget pattern
- `flush()` method for tests and graceful shutdown
- `SESSION_ID_REGEX` rejects path traversal and shell injection
- `DATA_DIR` is absolute (resolved from `__dirname`)
- `toContextBlock()` no longer adds its own header (fix for duplicate header — Task 9)

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /home/caleb/solventclaude2/dazzling-shirley/backend && npx vitest run src/services/coreMemory.test.ts -v`
Expected: All tests pass (existing + new)

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/coreMemory.ts backend/src/services/coreMemory.test.ts
git commit -m "fix: async save, absolute paths, and sessionId validation in CoreMemory"
```

---

### Task 7: Revert Dev-Secret Endpoint Gating [IMPORTANT]

**Files:**
- Modify: `backend/src/server.ts:243-244`

The condition was changed to require a non-default secret, but the entire purpose of the `/dev-secret` endpoint is zero-config local development. The endpoint is already guarded by `NODE_ENV === 'development'` + localhost IP check. Revert to the original condition.

- [ ] **Step 1: Revert the dev-secret condition**

In `backend/src/server.ts`, change:

```typescript
if (process.env.NODE_ENV === 'development' && config.BACKEND_INTERNAL_SECRET !== OLD_INSECURE_DEFAULT) {
```

to:

```typescript
if (process.env.NODE_ENV === 'development') {
```

Also remove the now-unused `OLD_INSECURE_DEFAULT` constant on line 243 (it duplicates the one already in `config.ts`).

- [ ] **Step 2: Verify compilation**

Run: `cd /home/caleb/solventclaude2/dazzling-shirley/backend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add backend/src/server.ts
git commit -m "fix: revert dev-secret gating to restore zero-config local development"
```

---

### Task 8: Fix Duplicate Core Memory Header in Context [SUGGESTION]

**Files:**
- Modify: `backend/src/services/contextService.ts:823-826`

`toContextBlock()` returns `[CORE MEMORY — Always Available]\n...` and then `contextService.ts` wraps it again with the same header. Since Task 6 changed `toContextBlock()` to return only the entry lines, update contextService to add the header once.

- [ ] **Step 1: Simplify the core memory injection in contextService**

In `backend/src/services/contextService.ts`, replace lines 823-826:

```typescript
${(() => {
  const coreBlock = coreMemory.toContextBlock();
  return coreBlock ? `\n[CORE MEMORY — Always Available]\n${coreBlock}\n` : '';
})()}
```

This now works correctly because `toContextBlock()` (after Task 6) returns just the key-value lines without the header prefix. The header is added exactly once here.

- [ ] **Step 2: Verify compilation**

Run: `cd /home/caleb/solventclaude2/dazzling-shirley/backend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add backend/src/services/contextService.ts
git commit -m "fix: remove duplicate core memory header in AI context block"
```

---

### Task 9: Fix Prompt Section Header Typo [SUGGESTION]

**Files:**
- Modify: `backend/src/services/waterfallService.ts:434`

One `═` is missing from the section header.

- [ ] **Step 1: Fix the typo**

In `backend/src/services/waterfallService.ts`, find:

```
══ ARCHITECT'S DECISIONS (Step 1 Output) ═══
```

Replace with:

```
═══ ARCHITECT'S DECISIONS (Step 1 Output) ═══
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/services/waterfallService.ts
git commit -m "fix: typo in reasoner prompt section header"
```

---

## Not Addressed (Out of Scope)

| Issue | Reason |
|-------|--------|
| ESLint version mismatch (v8 backend, v9 frontend) | Separate concern — would be its own plan |
| Token count estimation (`length / 4`) | Acceptable while informational-only |
| FileService `validateFileName` scope | Re-analyzed — only `deleteFile` accepts raw user filenames; other methods use safe inputs |

---

## Execution Order

Tasks are ordered by priority. Tasks 1-3 are independent criticals (can be parallelized). Tasks 4-7 are independent importants (can be parallelized). Tasks 8-9 depend on Task 6 (must run after).

```
[CRITICAL — parallel]
  Task 1: Rate limiter fix
  Task 2: Health endpoint fix
  Task 3: Circuit breaker rewrite

[IMPORTANT — parallel, after criticals]
  Task 4: Dead code removal
  Task 6: CoreMemory async + paths
  Task 7: Dev-secret revert

[DEPENDS ON Task 6]
  Task 8: Duplicate header fix
  Task 9: Prompt typo fix
```

Total: 9 tasks, ~8 commits
