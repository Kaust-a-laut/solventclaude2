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
