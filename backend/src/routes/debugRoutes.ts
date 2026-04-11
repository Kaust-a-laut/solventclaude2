import { Router } from 'express';
import { memoryMetrics } from '../utils/memoryMetrics';
import { vectorService } from '../services/vectorService';

const router = Router();

router.get('/memory-stats', (_req, res) => {
  const stats = memoryMetrics.getStats();
  res.json(stats);
});

router.get('/metrics', (_req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send(memoryMetrics.toPrometheus());
});

router.get('/memory-sample', (req, res) => {
  const limit = parseInt(req.query.limit as string) || 10;
  const entries = vectorService.getRecentEntries(limit);

  // Redact vectors for readability
  const sanitized = entries.map(e => ({
    id: e.id,
    metadata: e.metadata,
    vectorDim: e.vector?.length || 0
  }));

  res.json(sanitized);
});

router.post('/reset-metrics', (_req, res) => {
  memoryMetrics.reset();
  res.json({ success: true, message: 'Metrics reset' });
});

export default router;
