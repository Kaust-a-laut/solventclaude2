# Solvent AI - Comprehensive Improvement Plan

**Date:** March 26, 2026  
**Status:** Draft  
**Version:** 1.0

---

## Executive Summary

This document outlines a phased approach to improve code quality, documentation, monitoring, and developer experience across the Solvent AI project. Items are prioritized by impact and effort required.

---

## Prioritization Matrix

| Priority | Area | Impact | Effort |
|----------|------|--------|--------|
| P0 | Type Safety | High | Medium |
| P1 | ESLint & Code Style | High | Low |
| P2 | API Documentation | Medium | Medium |
| P3 | Structured Logging | Medium | Medium |
| P4 | Health Checks | Medium | Low |
| P5 | Containerization | Low | High |
| P6 | Architecture Records | Low | Low |

---

## Phase 1: Code Quality (Weeks 1-2)

### 1.1 Type Safety Improvements

**Goal:** Enable strict mode across entire codebase

#### Actions

| Item | Description | Files Affected | Effort |
|------|-------------|-----------------|--------|
| 1.1.1 | Enable `strict: true` in both tsconfigs | `backend/tsconfig.json`, `frontend/tsconfig.json` | 2 hrs |
| 1.1.2 | Fix strict mode errors (any types, implicit any) | All .ts/.tsx files | 8 hrs |
| 1.1.3 | Add strict null checks | All service files | 4 hrs |
| 1.1.4 | Create base type definitions for common interfaces | `backend/src/types/`, `frontend/src/types/` | 3 hrs |

#### Implementation Details

```json
// backend/tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "strictNullChecks": true,
    "noImplicitAny": true,
    "noUncheckedIndexedAccess": true
  }
}
```

#### Affected Files (estimated)
- ~40 backend files
- ~30 frontend files

#### Verification
```bash
cd backend && npx tsc --strict
cd frontend && npx tsc --strict
```

---

### 1.2 ESLint Integration

**Goal:** Consistent code style and catch common errors

#### Actions

| Item | Description | Effort |
|------|-------------|--------|
| 1.2.1 | Install ESLint and plugins | 1 hr |
| 1.2.2 | Create base configs (backend/frontend) | 2 hrs |
| 1.2.3 | Add lint scripts to package.json | 1 hr |
| 1.2.4 | Fix lint errors | 4 hrs |

#### Dependencies

**Backend:**
```bash
npm install --save-dev eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
```

**Frontend:**
```bash
npm install --save-dev eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin eslint-plugin-react eslint-plugin-react-hooks
```

#### Config Files

**`.eslintrc.backend.json`:**
```json
{
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "ecmaVersion": 2022,
    "sourceType": "module"
  },
  "plugins": ["@typescript-eslint"],
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  "rules": {
    "@typescript-eslint/explicit-function-return-type": "warn",
    "@typescript-eslint/no-unused-vars": "error",
    "no-console": "warn"
  }
}
```

**`.eslintrc.frontend.json`:**
```json
{
  "parser": "@typescript-eslint/parser",
  "plugins": ["@typescript-eslint", "react", "react-hooks"],
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended"
  ],
  "rules": {
    "react/react-in-jsx-scope": "off",
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn"
  }
}
```

#### Package.json Updates

```json
{
  "scripts": {
    "lint": "eslint src --ext ts,tsx",
    "lint:fix": "eslint src --ext ts,tsx --fix"
  }
}
```

---

## Phase 2: Documentation (Weeks 2-3)

### 2.1 API Documentation (OpenAPI/Swagger)

**Goal:** Generate and serve API documentation

#### Actions

| Item | Description | Effort |
|------|-------------|--------|
| 2.1.1 | Install swagger-ui-express and swagger-jsdoc | 1 hr |
| 2.1.2 | Create OpenAPI config and annotations | 4 hrs |
| 2.1.3 | Add /api-docs endpoint | 1 hr |
| 2.1.4 | Document all 20+ endpoints | 6 hrs |

#### Dependencies

```bash
cd backend
npm install swagger-ui-express swagger-jsdoc
```

#### Implementation

**`src/utils/swagger.ts`:**
```typescript
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Solvent AI API',
      version: '1.0.0',
      description: 'Smart hierarchical AI assistant API',
    },
    servers: [
      { url: 'http://localhost:3001', description: 'Development' }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: ['./src/routes/*.ts'],
};

export const specs = swaggerJsdoc(options);
export const swaggerServe = swaggerUi.serve;
export const swaggerSetup = swaggerUi.setup(specs);
```

**`src/server.ts`:**
```typescript
import { specs, swaggerServe, swaggerSetup } from './utils/swagger';

app.use('/api-docs', swaggerServe, swaggerSetup);
```

#### Example Route Annotation

```typescript
/**
 * @swagger
 * /api/v1/ai/chat:
 *   post:
 *     summary: Send a chat message
 *     tags: [AI]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: string
 *               mode:
 *                 type: string
 *                 enum: [fast, balanced, deep_thought]
 *     responses:
 *       200:
 *         description: Chat response
 */
app.post('/api/v1/ai/chat', aiController.chat);
```

---

### 2.2 Architecture Decision Records (ADRs)

**Goal:** Document key architectural decisions

#### Actions

| Item | Description | Effort |
|------|-------------|--------|
| 2.2.1 | Create ADR template | 1 hr |
| 2.2.2 | Document 10 key decisions | 4 hrs |

#### ADR Template (`docs/adr/template.md`)

```markdown
# ADR-001: Decision Title

## Status
Proposed | Accepted | Deprecated | Superseded

## Context
What is the issue that we're seeing that is motivating this decision?

## Decision
What is the change that we're proposing and/or doing?

## Consequences
What becomes easier or more difficult to do because of this change?
```

#### Key Decisions to Document

1. **ADR-001:** Provider fallback chain (Gemini → Ollama → zero vector)
2. **ADR-002:** Session storage format (JSON files with optimistic locking)
3. **ADR-003:** Socket.io authentication strategy
4. **ADR-004:** Plugin architecture for providers and tools
5. **ADR-005:** Codebase indexing strategy (SHA-256 + chokidar)
6. **ADR-006:** Decision approval timeout (60s auto-expire)
7. **ADR-007:** HNSW vector index for memory search
8. **ADR-008:** BM25 hybrid search with RRF
9. **ADR-009:** Redis-backed async task queue (BullMQ)
10. **ADR-010:** Frontend state management (Zustand)

---

## Phase 3: Observability (Weeks 3-4)

### 3.1 Structured Logging

**Goal:** Replace console.log with proper logging

#### Actions

| Item | Description | Effort |
|------|-------------|--------|
| 3.1.1 | Install Winston or Pino | 1 hr |
| 3.1.2 | Create logger utility with transports | 2 hrs |
| 3.1.3 | Replace console.log calls | 6 hrs |
| 3.1.4 | Add log rotation and file transport | 2 hrs |

#### Dependencies

```bash
cd backend
npm install pino pino-pretty
```

#### Implementation

**`src/utils/logger.ts`:**
```typescript
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development' 
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
});

export default logger;
```

**Usage:**
```typescript
import logger from './utils/logger';

logger.info({ userId, sessionId }, 'User connected');
logger.error({ err, stack: err.stack }, 'Request failed');
```

#### Migration Guide

| Old | New |
|-----|-----|
| `console.log('User connected')` | `logger.info('User connected')` |
| `console.error(err)` | `logger.error({ err }, 'Error message')` |

---

### 3.2 Health Check Endpoints

**Goal:** Production-ready health checks

#### Actions

| Item | Description | Effort |
|------|-------------|--------|
| 3.2.1 | Create /health endpoint | 1 hr |
| 3.2.2 | Add dependency checks (Redis, Ollama, etc.) | 2 hrs |
| 3.2.3 | Add /ready endpoint for k8s probes | 1 hr |
| 3.2.4 | Add to debug routes in dev mode | 1 hr |

#### Implementation

**`src/routes/healthRoutes.ts`:**
```typescript
import { Router } from 'express';
import Redis from 'ioredis';
import axios from 'axios';

const router = Router();

const redis = new Redis(process.env.REDIS_URL);

router.get('/health', async (req, res) => {
  const checks = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {
      redis: false,
      ollama: false,
      memory: false,
    }
  };

  try {
    await redis.ping();
    checks.checks.redis = true;
  } catch (e) { /* handled */ }

  try {
    const ollama = await axios.get(`${process.env.OLLAMA_URL}/api/tags`, { 
      timeout: 2000 
    });
    checks.checks.ollama = ollama.status === 200;
  } catch (e) { /* handled */ }

  try {
    const mem = process.memoryUsage();
    checks.checks.memory = mem.heapUsed < mem.heapLimit * 0.9;
  } catch (e) { /* handled */ }

  const allHealthy = Object.values(checks.checks).every(v => v);
  res.status(allHealthy ? 200 : 503).json(checks);
});

router.get('/ready', async (req, res) => {
  // Simplified for load balancer
  res.status(200).json({ ready: true });
});

export default router;
```

---

## Phase 4: Infrastructure (Weeks 4-6)

### 4.1 Docker Containerization

**Goal:** Enable easy deployment with Docker

#### Actions

| Item | Description | Effort |
|------|-------------|--------|
| 4.1.1 | Create Dockerfile for backend | 2 hrs |
| 4.1.2 | Create Dockerfile for frontend | 2 hrs |
| 4.1.3 | Create docker-compose.yml | 2 hrs |
| 4.1.4 | Add nginx config for production | 2 hrs |

#### Files

**`Dockerfile.backend`:**
```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist/ ./dist/
COPY package.json ./

EXPOSE 3001

CMD ["node", "dist/server.js"]
```

**`Dockerfile.frontend`:**
```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**`docker-compose.yml`:**
```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis

  frontend:
    build: ./frontend
    ports:
      - "5173:80"

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  redis_data:
```

---

## Phase 5: Developer Experience (Ongoing)

### 5.1 Git Hooks

**Goal:** Automate quality checks on commit

#### Actions

| Item | Description | Effort |
|------|-------------|--------|
| 5.1.1 | Install husky | 1 hr |
| 5.1.2 | Create pre-commit hook | 2 hrs |
| 5.1.3 | Configure lint-staged | 1 hr |

#### Implementation

```bash
npm install -D husky lint-staged
npx husky init
```

**`.husky/pre-commit`:**
```bash
npx lint-staged
```

**`package.json`:**
```json
{
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "vitest --run"],
    "*.{json,md}": "prettier --write"
  }
}
```

---

## Summary Timeline

| Phase | Duration | Key Deliverables |
|-------|----------|------------------|
| Phase 1 | Week 1-2 | Strict TypeScript + ESLint |
| Phase 2 | Week 2-3 | OpenAPI docs + ADRs |
| Phase 3 | Week 3-4 | Structured logging + Health checks |
| Phase 4 | Week 4-6 | Docker setup |
| Phase 5 | Ongoing | Git hooks |

---

## Appendix: Estimated Costs

| Item | Time (hrs) |
|------|------------|
| Phase 1 | 25 |
| Phase 2 | 18 |
| Phase 3 | 15 |
| Phase 4 | 12 |
| Phase 5 | 5 |
| **Total** | **75 hrs** |

---

## Next Steps

1. **Review this plan** and adjust priorities based on project goals
2. **Create issues** in issue tracker for each action item
3. **Start with Phase 1** - enabling strict TypeScript for immediate quality gains
4. **Iterate** - revisit plan quarterly and adjust based on progress