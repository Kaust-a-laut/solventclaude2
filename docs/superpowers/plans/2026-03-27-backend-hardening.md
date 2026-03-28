# Backend Hardening Plan

**Date**: 2026-03-27
**Goal**: Comprehensive security and reliability hardening for the Solvent AI backend

---

## Phase 1: Critical Security Fixes

### 1.1 Error Message Leakage
**Files**: `aiRoutes.ts`, `memoryRoutes.ts`, `fileRoutes.ts`, `sessionRoutes.ts`, etc.

**Issue**: Routes return `error.message` directly to clients, exposing internals (stack traces, file paths, DB errors)

**Fix**:
- Create unified error transformation middleware
- Replace all `catch (error: any) { res.status(500).json({ error: error.message }) }` with safe handlers
- Log full error internally, return generic message to client

**Pattern to implement**:
```typescript
function handleError(res: Response, error: unknown, context: string) {
  const id = crypto.randomUUID();
  logger.error(`[${context}] ${id}`, error);
  res.status(500).json({ error: 'An unexpected error occurred', reference: id });
}
```

### 1.2 File Service Path Traversal
**File**: `fileService.ts:82-83`

**Issue**: `deleteFile` and potentially other methods don't validate paths

**Fix**:
```typescript
async deleteFile(fileName: string) {
  // Validate: prevent ../../../etc/passwd
  if (fileName.includes('..') || path.isAbsolute(fileName)) {
    throw new Error('Invalid filename');
  }
  const filePath = path.join(this.uploadDir, fileName);
  // Verify resolved path is within uploadDir
  if (!filePath.startsWith(this.uploadDir)) {
    throw new Error('Path escape attempt detected');
  }
  await fs.unlink(filePath);
}
```

### 1.3 Session ID Validation
**File**: `aiRoutes.ts:215-224`

**Issue**: Any string accepted as session ID — potential for injection/storage abuse

**Fix**: Add UUID validation
```typescript
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

router.get('/sessions/:id', async (req, res) => {
  const { id } = req.params;
  if (!uuidRegex.test(id)) {
    return res.status(400).json({ error: 'Invalid session ID format' });
  }
  // ...
});
```

---

## Phase 2: Input Validation & Sanitization

### 2.1 Request Body Validation
**Files**: All route files

**Fix**: Audit all endpoints for missing Zod schemas:
- `aiRoutes.ts:58-65` (debate): Validate `proponentModel`, `criticModel`
- `aiRoutes.ts:79` (collaborate): Add max length on `goal` (e.g., 5000 chars)
- `aiRoutes.ts:115-131` (analyze): Validate all fields
- `aiRoutes.ts:367-386` (codebase/index): Validate `rootPath` format
- `memoryRoutes.ts:29`: Validate `limit` is positive integer
- `memoryRoutes.ts:87`: Add max length on `content` (e.g., 100KB)

### 2.2 Query Parameter Validation
**Files**: `memoryRoutes.ts`, `healthRoutes.ts`

**Fix**: Validate all `req.query` params with Zod
```typescript
const querySchema = z.object({
  limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().min(1).max(100)),
  offset: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().min(0)),
  search: z.string().max(200).optional(),
});
```

### 2.3 Upload File Validation
**Files**: `fileRoutes.ts`

**Fix**:
- Validate file extensions against allowlist
- Validate MIME types (don't trust client)
- Limit file size (e.g., 10MB max)
- Sanitize filenames (remove special chars, normalize Unicode)

---

## Phase 3: Rate Limiting & DoS Protection

### 3.1 Per-User Rate Limiting
**File**: `server.ts:199-205`

**Issue**: Global rate limit only, no per-user isolation

**Fix**: Implement Redis-backed per-user rate limiting
```typescript
const userRateLimiter = new RateLimiter({
  store: new RedisStore({ prefix: 'rl:user:' }),
  max: 100,
  windowMs: 15 * 60 * 1000,
  keyGenerator: (req) => req.headers['x-solvent-secret'] || req.ip
});
```

### 3.2 Memory Load Protection
**File**: `memoryRoutes.ts:7`

**Issue**: `MAX_MEMORY_LOAD = 2000` loads unbounded data per request

**Fix**: Add streaming or pagination
```typescript
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100; // Hard cap
const limit = Math.min(Math.max(parseInt(req.query.limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);
```

### 3.3 API Payload Size Limits
**File**: `server.ts:191`

**Issue**: Global 10MB limit may be too large for some endpoints

**Fix**: Endpoint-specific limits
```typescript
app.use('/api/chat', express.json({ limit: '1mb' }));
app.use('/api/waterfall', express.json({ limit: '2mb' }));
app.use('/api/files/upload', express.raw({ limit: '10mb', type: 'multipart/form-data' }));
```

---

## Phase 4: Observability & Debugging

### 4.1 Request Correlation IDs
**File**: `server.ts`

**Issue**: No way to trace requests through logs

**Fix**: Add request ID middleware
```typescript
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] as string || crypto.randomUUID();
  res.setHeader('x-request-id', req.id);
  logger.addContext('requestId', req.id);
  next();
});
```

### 4.2 Structured Logging
**Files**: Throughout codebase

**Issue**: Mix of `console.error`, `console.log`, `logger`

**Fix**: Replace all with structured logger
```typescript
// Before
console.error('[Socket] SYNC_NOTES handler error:', err);

// After
logger.error('[Socket] SYNC_NOTES handler failed', { error: err.message, stack: err.stack, requestId: req.id });
```

### 4.3 Health Check Enhancement
**File**: `server.ts:319-326`

**Issue**: Basic health check doesn't show dependency status

**Fix**: Add dependency checks
```typescript
app.get('/health', async (req, res) => {
  const checks = {
    redis: await redis.isReady,
    plugins: pluginsInitialized,
    memory: vectorService.isHealthy(),
  };
  const healthy = Object.values(checks).every(v => v);
  res.status(healthy ? 200 : 503).json({ status: healthy ? 'ok' : 'degraded', checks });
});
```

---

## Phase 5: Reliability & Resilience

### 5.1 Circuit Breaker Enhancement
**File**: `circuitBreaker.ts`

**Issue**: No half-open state for testing recovery

**Fix**: Implement full state machine
```typescript
enum CircuitState { CLOSED, OPEN, HALF_OPEN }

class CircuitBreakerService {
  private state: CircuitState = CircuitState.CLOSED;
  // ... half-open allows test requests through
}
```

### 5.2 Graceful Shutdown
**File**: `server.ts`

**Issue**: No cleanup on SIGTERM/SIGINT

**Fix**:
```typescript
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await pluginManager.shutdown();
  httpServer.close(() => process.exit(0));
});
```

### 5.3 Retry Logic Standardization
**Files**: AI provider services

**Issue**: Inconsistent retry handling

**Fix**: Create unified retry utility with exponential backoff

---

## Phase 6: Dev/Prod Parity

### 6.1 Dev Secret Endpoint Hardening
**File**: `server.ts:226-236`

**Issue**: Only guarded by NODE_ENV, doesn't check for insecure default

**Fix**:
```typescript
if (process.env.NODE_ENV === 'development' && config.BACKEND_INTERNAL_SECRET !== OLD_INSECURE_DEFAULT) {
  app.get('/dev-secret', ...);
}
```

### 6.2 Environment Validation
**File**: `config.ts`

**Issue**: Some configs lack validation (e.g., URL formats, port ranges)

**Fix**: Add more Zod validators
```typescript
PORT: z.string().transform(Number).pipe(z.number().min(1).max(65535)),
OLLAMA_HOST: z.string().url(),
```

---

## Phase 7: Audit & Compliance

### 7.1 Security Headers Review
**File**: `server.ts:194-197`

**Issue**: CSP disabled, some headers may be too permissive

**Fix**: Enable and configure CSP properly

### 7.2 Authentication Audit
**Files**: `server.ts`, route files

**Issue**: Inconsistent auth middleware application

**Fix**: Create decorator/utility for consistent auth
```typescript
const requireAuth = (req, res, next) => {
  const secret = req.headers['x-solvent-secret'];
  if (!safeCompare(secret, config.BACKEND_INTERNAL_SECRET)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};
```

### 7.3 API Versioning
**Issue**: All endpoints under `/api/v1`, no deprecation path

**Fix**: Implement API versioning strategy

---

## Implementation Order

| Phase | Priority | Effort | Items |
|-------|----------|--------|-------|
| 1 | Critical | Medium | 3 |
| 2 | High | Medium | 3 |
| 3 | High | Medium | 3 |
| 4 | Medium | Low | 3 |
| 5 | Medium | Medium | 3 |
| 6 | Low | Low | 2 |
| 7 | Low | Medium | 3 |

**Estimated Total**: 20 items, ~2-3 sessions to complete

---

## Files to Modify

### Core Files
- `server.ts` — middleware, auth, rate limiting, shutdown
- `config.ts` — enhanced validation
- `utils/errors.ts` — add error transformation utilities
- `utils/logger.ts` — ensure full coverage

### Route Files
- `aiRoutes.ts` — validation, error handling
- `memoryRoutes.ts` — validation, limits
- `fileRoutes.ts` — validation, path handling
- `sessionRoutes.ts` (if exists) — validation
- `settingsRoutes.ts` — validation

### Service Files
- `fileService.ts` — path validation
- `circuitBreaker.ts` — enhanced state machine
- `storageService.ts` — add health check

---

## Testing Strategy

1. **Security tests**: Path traversal attempts, injection payloads
2. **Validation tests**: Invalid inputs rejected
3. **Load tests**: Rate limiting enforced
4. **Integration tests**: Error messages don't leak internals
