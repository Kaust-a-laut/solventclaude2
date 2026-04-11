import { Request, Response } from 'express';
import { harnessOptimizer } from '../services/harnessOptimizer';
import { z } from 'zod';

export class HarnessController {
  static async startRun(req: Request, res: Response) {
    const ip = req.ip || req.socket?.remoteAddress || '';
    const isLocal = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
    if (!isLocal) {
      res.status(403).json({ error: 'This endpoint is only accessible from localhost.' });
      return;
    }

    const schema = z.object({
      maxIterations: z.number().min(1).max(50).optional(),
      candidatesPerIteration: z.number().min(1).max(5).optional(),
      searchSetQuery: z.string().optional(),
      minTraceCount: z.number().min(5).max(100).optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const run = await harnessOptimizer.startRun(parsed.data);
    res.json(run);
  }

  static async cancelRun(req: Request, res: Response) {
    const id = req.params.id as string;
    const cancelled = harnessOptimizer.cancelRun(id);
    if (!cancelled) {
      res.status(400).json({ error: 'Run not found or not running' });
      return;
    }
    res.json({ success: true });
  }

  static async getRun(req: Request, res: Response) {
    const id = req.params.id as string;
    const run = harnessOptimizer.getRun(id);
    if (!run) {
      res.status(404).json({ error: 'Run not found' });
      return;
    }
    res.json(run);
  }

  static async listRuns(_req: Request, res: Response) {
    res.json(harnessOptimizer.listRuns());
  }

  static async streamRun(req: Request, res: Response) {
    const id = req.params.id as string;
    const run = harnessOptimizer.getRun(id);
    if (!run) {
      res.status(404).json({ error: 'Run not found' });
      return;
    }

    // SSE stream
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Send initial state
    res.write(`data: ${JSON.stringify(run)}\n\n`);

    // Subscribe to updates
    harnessOptimizer.onRunUpdate(id, (updatedRun) => {
      res.write(`data: ${JSON.stringify(updatedRun)}\n\n`);
      if (updatedRun.status !== 'running') {
        res.write(`data: [DONE]\n\n`);
        res.end();
      }
    });

    req.on('close', () => {
      res.end();
    });
  }
}
