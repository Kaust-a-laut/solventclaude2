import { config } from './config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { logger } from './utils/logger';

declare global {
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

// --- Import Routes ---
import fileRoutes from './routes/fileRoutes';
import aiRoutes from './routes/aiRoutes';
import debugRoutes from './routes/debugRoutes';
import settingsRoutes from './routes/settingsRoutes';
import memoryRoutes from './routes/memoryRoutes';
import agentRoutes from './routes/agentRoutes';
import healthRoutes from './routes/healthRoutes';

import { createServer } from 'http';
import { Server } from 'socket.io';
import { supervisorService } from './services/supervisorService';
import { pluginManager } from './services/pluginManager';
import { settingsService } from './services/settingsService';
import { taskService, TaskQueue } from './services/taskService';
import { SocketBatcher } from './lib/socketBatcher';
import { SocketRateLimiter } from './utils/socketRateLimiter';
import { codebaseIndexer } from './services/codebaseIndexer';

// Timing-safe secret comparison to prevent timing attacks
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

const app = express();
const httpServer = createServer(app);

// Security: Restrict CORS to configured origin(s) (not wildcard in production)
// CORS_ORIGIN supports comma-separated values: "http://localhost:5173,http://127.0.0.1:5173"
const allowedOrigins = config.CORS_ORIGIN.split(',').map(o => o.trim());
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin '${origin}' not allowed`));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-Solvent-Secret'],
  credentials: true
};

const io = new Server(httpServer, {
  cors: corsOptions
});

const port = config.PORT || 3001;

// --- Socket.io Security ---

// Zod schemas for socket event payloads
const syncNotesSchema = z.object({
  content: z.string().max(50_000, 'content exceeds 50KB limit'),
  graph: z.record(z.unknown()).optional(),
});

const crystallizeMemorySchema = z.object({
  content: z.string().max(50_000, 'content exceeds 50KB limit'),
});

// Rate limiter: per-socket, 1-minute sliding window
const socketLimiter = new SocketRateLimiter(60_000);
const RATE_LIMITS = {
  SYNC_NOTES: 10,          // max 10 per minute
  CRYSTALLIZE_MEMORY: 5,   // max 5 per minute
};

// Authentication middleware — validates the same secret used by REST API
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token || typeof token !== 'string' || !safeCompare(token, config.BACKEND_INTERNAL_SECRET)) {
    logger.warn('[Socket] Rejected unauthenticated connection', { id: socket.id });
    return next(new Error('Authentication required'));
  }
  next();
});

// --- Socket Connection ---
io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);
  // Join a session room so we can target emissions later
  const sessionRoom = `session:${socket.id}`;
  socket.join(sessionRoom);

  socket.on('SYNC_NOTES', async (data) => {
    // Rate limit check
    if (!socketLimiter.check(socket.id, 'SYNC_NOTES', RATE_LIMITS.SYNC_NOTES)) {
      socket.emit('rate-limited', { event: 'SYNC_NOTES', retryAfterMs: 60_000 });
      return;
    }

    // Input validation
    const parsed = syncNotesSchema.safeParse(data);
    if (!parsed.success) {
      socket.emit('error', { message: parsed.error.issues[0]?.message || 'Invalid payload', type: 'VALIDATION_ERROR' });
      return;
    }

    try {
      await supervisorService.supervise(parsed.data.content, parsed.data.graph ?? {});
      // Proactive Overseer think() — fire-and-forget with notepad as primary signal
      supervisorService.think({
        activity: 'notepad_change',
        data: { notepadContent: parsed.data.content }
      }).catch((err: unknown) => {
        logger.warn('[Overseer] notepad_change think() failed', { error: err instanceof Error ? err.message : String(err) });
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('[Socket] SYNC_NOTES handler error:', err);
      socket.emit('error', { message: err.message, type: 'SYNC_NOTES_FAILED' });
    }
  });

  // Memory crystallization event → trigger Overseer awareness
  socket.on('CRYSTALLIZE_MEMORY', (data) => {
    // Rate limit check
    if (!socketLimiter.check(socket.id, 'CRYSTALLIZE_MEMORY', RATE_LIMITS.CRYSTALLIZE_MEMORY)) {
      socket.emit('rate-limited', { event: 'CRYSTALLIZE_MEMORY', retryAfterMs: 60_000 });
      return;
    }

    // Input validation
    const parsed = crystallizeMemorySchema.safeParse(data);
    if (!parsed.success) {
      socket.emit('error', { message: parsed.error.issues[0]?.message || 'Invalid payload', type: 'VALIDATION_ERROR' });
      return;
    }

    supervisorService.think({
      activity: 'memory_crystallized',
      data: { focus: parsed.data.content, notepadContent: parsed.data.content }
    }).catch((err: unknown) => {
      logger.warn('[Overseer] memory_crystallized think() failed', { error: err instanceof Error ? err.message : String(err) });
    });
  });

  socket.on('disconnect', () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);
    socketLimiter.cleanup(socket.id);
  });
});

supervisorService.setIO(io);
const batcher = new SocketBatcher(io, 100);

// --- Mission Progress Bridge: BullMQ → Socket.io ---
// Workers can't access Socket.io directly; QueueEvents bridges the gap
try {
  const orchestrationEvents = taskService.getQueueEvents(TaskQueue.ORCHESTRATION);

  orchestrationEvents.on('progress', ({ jobId, data }: { jobId: string; data: unknown }) => {
    batcher.emit('MISSION_PROGRESS', { jobId, progress: data });
  });

  orchestrationEvents.on('completed', ({ jobId, returnvalue }: { jobId: string; returnvalue: unknown }) => {
    io.emit('MISSION_COMPLETE', { jobId, result: returnvalue });
    // Overseer: analyze the completed mission in context
    supervisorService.think({
      activity: 'mission_completed',
      data: { missionId: jobId, result: returnvalue }
    }).catch((err: unknown) => {
      logger.warn('[Overseer] mission_completed think() failed', { error: err instanceof Error ? err.message : String(err) });
    });
  });

  orchestrationEvents.on('failed', ({ jobId, failedReason }: { jobId: string; failedReason: string }) => {
    io.emit('MISSION_FAILED', { jobId, error: failedReason });
  });

  console.log('[Server] Mission progress bridge initialized');
} catch (err) {
  console.warn('[Server] Mission progress bridge unavailable (Redis may not be running):', err);
}

// --- Global Middleware ---
app.use(cors(corsOptions));

// Request ID middleware for tracing
app.use((req, res, next) => {
  req.id = (req.headers['x-request-id'] as string) || randomUUID();
  res.setHeader('x-request-id', req.id);
  next();
});

app.use(express.json({ limit: '10mb' }));

// --- Security Middleware ---
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? 2000 : 100, // Higher limit in dev mode
  message: { error: 'Too many requests, please try again later.' },
  skip: (req) => req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1', // Skip rate limit for localhost
});
app.use('/api/', limiter);

// --- Directory Setup ---
const generatedImagesDir = path.join(__dirname, '../generated_images');
const uploadDir = path.join(__dirname, '../uploads'); 

if (!fs.existsSync(generatedImagesDir)) fs.mkdirSync(generatedImagesDir, { recursive: true });
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// --- Static Files (Publicly Accessible for Frontend <img> tags) ---
app.use('/generated_images', express.static(generatedImagesDir));
app.use('/files', express.static(uploadDir));

const API_SECRET = config.BACKEND_INTERNAL_SECRET;

console.log(`[Server] API_SECRET initialized: ${API_SECRET === 'solvent_dev_insecure_default' ? '✓ Using default (dev mode)' : '✓ Using custom secret'}`);

// Dev-only secret exchange endpoint — mirrors what Electron's getSessionSecret() preload does.
// Allows the browser frontend (running at localhost:5173) to retrieve the session secret
// so that fetchWithRetry() works in npm run dev without any manual .env setup.
// Guarded by NODE_ENV check + localhost IP check. Never exists in production.
if (process.env.NODE_ENV === 'development') {
  app.get('/dev-secret', (req, res) => {
    const ip = req.ip || '';
    const isLocalhost = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
    if (!isLocalhost) {
      console.warn(`[Security] /dev-secret accessed from non-localhost IP: ${ip}`);
      return res.status(403).json({ error: 'Forbidden' });
    }
    res.json({ secret: API_SECRET });
  });
}

// Security Middleware
app.use((req, res, next) => {
  // Skip secret check for:
  // - Static files (images, uploads)
  // - Read-only informational endpoints (health, models, settings GET)
  // - API key validation (user-provided keys, no server secrets exposed)
  const isPublicPath =
    req.path.startsWith('/generated_images') ||
    req.path.startsWith('/files') ||
    req.path.startsWith('/api/files/raw') ||
    req.path === '/health' ||
    req.path === '/api/v1/health' ||
    req.path === '/api/v1/ready' ||
    req.path === '/api/v1/health/services' ||
    req.path === '/api/v1/models' ||
    (req.path === '/api/settings' && req.method === 'GET') ||
    req.path.match(/^\/api\/settings\/providers\/\w+\/validate-key$/);

  if (isPublicPath) return next();

  const clientSecret = req.headers['x-solvent-secret'];
  if (!clientSecret || typeof clientSecret !== 'string' || !safeCompare(clientSecret, API_SECRET)) {
    console.warn(`[SECURITY] Unauthorized request to ${req.path} from ${req.ip}`);
    return res.status(401).json({ error: 'Unauthorized: Invalid session secret' });
  }
  next();
});

// --- API Routes ---
app.use('/api/v1', aiRoutes);
app.use('/api/v1/agent', agentRoutes);
app.use('/api/v1', healthRoutes);
app.use('/api/v1', memoryRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/debug', debugRoutes);
app.use('/api/settings', settingsRoutes);

// --- Error Handling Middleware ---
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[Global Error Handler]', err);
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';
  res.status(status).json({
    error: {
      message,
      status,
      timestamp: new Date().toISOString()
    }
  });
});

// Track plugin initialization state
let pluginsInitialized = false;
let pluginsDegraded = false;

// Initialize the plugin manager - MUST complete before server accepts requests
async function initializePlugins(): Promise<void> {
  try {
    await pluginManager.initialize();
    pluginsInitialized = true;
    console.log('[Server] Plugin system initialized successfully');
  } catch (error) {
    console.error('[Server] Failed to initialize plugin system:', error);
    // Mark as degraded but don't exit - health check will reflect this
    pluginsDegraded = true;
  }
}

// Start codebase indexer in background (non-blocking)
async function startCodebaseIndexing(): Promise<void> {
  try {
    // Start file watcher for incremental indexing
    await codebaseIndexer.start({ rootPath: process.cwd() });
    console.log('[Server] Codebase indexer started with file watcher enabled');
  } catch (error) {
    console.error('[Server] Failed to start codebase indexer:', error);
    // Don't fail server - indexing is optional
  }
}

// Health check that reflects plugin state
app.get('/health', (req, res) => {
  const healthStatus = {
    status: pluginsDegraded ? 'degraded' : 'ok',
    plugins: pluginsInitialized ? 'ready' : pluginsDegraded ? 'failed' : 'initializing',
    timestamp: new Date().toISOString()
  };
  res.status(pluginsDegraded ? 503 : 200).json(healthStatus);
});

// Start server asynchronously
async function startServer(): Promise<void> {
  // Initialize settings before plugins
  try {
    await settingsService.initialize();
    console.log('[Server] Settings service initialized successfully');
  } catch (error) {
    console.error('[Server] Failed to initialize settings service:', error);
  }

  // Wait for plugins to initialize before accepting requests
  await initializePlugins();

  const host = process.env.HOST || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1');
  httpServer.listen(port, host, () => {
    console.log(`Server with Real-Time Overseer running on http://${host}:${port}`);
    if (pluginsDegraded) {
      console.warn('[Server] Running in degraded mode - some plugin features may be unavailable');
    }
  });

  // Start codebase indexing in background (non-blocking)
  startCodebaseIndexing().catch(error => {
    console.error('[Server] Background codebase indexing failed to start:', error);
  });
}

startServer().catch(error => {
  console.error('[Server] Failed to start server:', error);
  process.exit(1);
});

// Graceful shutdown handling
async function gracefulShutdown(signal: string): Promise<void> {
  logger.info(`[Server] Received ${signal}, starting graceful shutdown...`);
  
  httpServer.close(() => {
    logger.info('[Server] HTTP server closed');
    process.exit(0);
  });

  try {
    await codebaseIndexer.stop();
    logger.info('[Server] Codebase indexer stopped');
  } catch (error) {
    logger.warn('[Server] Error stopping codebase indexer', error);
  }

  setTimeout(() => {
    logger.warn('[Server] Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));