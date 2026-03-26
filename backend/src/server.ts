import { config } from './config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import path from 'path';
import { logger } from './utils/logger';

// --- Import Routes ---
import fileRoutes from './routes/fileRoutes';
import aiRoutes from './routes/aiRoutes';
import debugRoutes from './routes/debugRoutes';
import settingsRoutes from './routes/settingsRoutes';
import memoryRoutes from './routes/memoryRoutes';
import agentRoutes from './routes/agentRoutes';

import { createServer } from 'http';
import { Server } from 'socket.io';
import { supervisorService } from './services/supervisorService';
import { pluginManager } from './services/pluginManager';
import { settingsService } from './services/settingsService';
import { taskService, TaskQueue } from './services/taskService';

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

// --- Socket Connection ---
io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);

  socket.on('SYNC_NOTES', async (data) => {
    try {
      await supervisorService.supervise(data.content, data.graph);
      // Proactive Overseer think() — fire-and-forget with notepad as primary signal
      supervisorService.think({
        activity: 'notepad_change',
        data: { notepadContent: data.content }
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
    supervisorService.think({
      activity: 'memory_crystallized',
      data: { focus: data.content, notepadContent: data.content }
    }).catch((err: unknown) => {
      logger.warn('[Overseer] memory_crystallized think() failed', { error: err instanceof Error ? err.message : String(err) });
    });
  });

  socket.on('disconnect', () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);
  });
});

supervisorService.setIO(io);

// --- Mission Progress Bridge: BullMQ → Socket.io ---
// Workers can't access Socket.io directly; QueueEvents bridges the gap
try {
  const orchestrationEvents = taskService.getQueueEvents(TaskQueue.ORCHESTRATION);

  orchestrationEvents.on('progress', ({ jobId, data }: { jobId: string; data: unknown }) => {
    io.emit('MISSION_PROGRESS', { jobId, progress: data });
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
app.use(express.json({ limit: '50mb' }));

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
    req.path === '/api/v1/health/services' ||
    req.path === '/api/v1/models' ||
    (req.path === '/api/settings' && req.method === 'GET') ||
    req.path.match(/^\/api\/settings\/providers\/\w+\/validate-key$/);

  if (isPublicPath) return next();

  const clientSecret = req.headers['x-solvent-secret'];
  if (clientSecret !== API_SECRET) {
    console.warn(`[SECURITY] Unauthorized request to ${req.path} from ${req.ip}`);
    return res.status(401).json({ error: 'Unauthorized: Invalid session secret' });
  }
  next();
});

// --- API Routes ---
app.use('/api/v1', aiRoutes);
app.use('/api/v1/agent', agentRoutes);
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
  
  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`Server with Real-Time Overseer running on http://0.0.0.0:${port}`);
    if (pluginsDegraded) {
      console.warn('[Server] Running in degraded mode - some plugin features may be unavailable');
    }
  });
}

startServer().catch(error => {
  console.error('[Server] Failed to start server:', error);
  process.exit(1);
});