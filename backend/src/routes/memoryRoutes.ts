import { Router, Request, Response } from 'express';
import path from 'path';
import { vectorService } from '../services/vectorService';

const router = Router();

const MAX_MEMORY_LOAD = 2000;
const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;
const MAX_CONTENT_LENGTH = 100 * 1024; // 100KB
const MAX_SEARCH_LENGTH = 200;

function parseLimit(value: string | undefined, defaultVal: number, max: number): number {
  const parsed = parseInt(value || '', 10);
  if (isNaN(parsed) || parsed < 1) return defaultVal;
  return Math.min(parsed, max);
}

function parseOffset(value: string | undefined): number {
  const parsed = parseInt(value || '', 10);
  return isNaN(parsed) || parsed < 0 ? 0 : parsed;
}

// GET /api/v1/memory/stats
router.get('/memory/stats', (req: Request, res: Response) => {
  const allEntries = vectorService.getRecentEntries(MAX_MEMORY_LOAD);
  const active = allEntries.filter(e => !e.metadata?.deprecated);

  const byTier: Record<string, number> = {};
  const byType: Record<string, number> = {};

  for (const e of active) {
    const tier = e.metadata?.tier || 'unknown';
    const type = e.metadata?.type || 'unknown';
    byTier[tier] = (byTier[tier] || 0) + 1;
    byType[type] = (byType[type] || 0) + 1;
  }

  res.json({ total: active.length, byTier, byType });
});

// GET /api/v1/memory/entries?limit=20&offset=0&tier=&search=
router.get('/memory/entries', (req: Request, res: Response) => {
  const limit = parseLimit(req.query.limit as string, DEFAULT_LIMIT, MAX_LIMIT);
  const offset = parseOffset(req.query.offset as string);
  const tier = req.query.tier as string | undefined;
  const type = req.query.type as string | undefined;
  const rawSearch = req.query.search as string | undefined;
  if (rawSearch && (typeof rawSearch !== 'string' || rawSearch.length > MAX_SEARCH_LENGTH)) {
    return res.status(400).json({ error: `search must be a string with max ${MAX_SEARCH_LENGTH} characters` });
  }
  const search = rawSearch?.toLowerCase();

  let entries = vectorService.getRecentEntries(MAX_MEMORY_LOAD).filter(e => !e.metadata?.deprecated);

  if (tier) entries = entries.filter(e => e.metadata?.tier === tier);
  if (type) entries = entries.filter(e => e.metadata?.type === type);
  if (search) {
    entries = entries.filter(e => {
      const content = (e.metadata?.content || e.metadata?.summary || '').toLowerCase();
      return content.includes(search);
    });
  }

  const total = entries.length;
  const page = entries.slice(offset, offset + limit).map(e => ({
    id: e.id,
    type: e.metadata?.type || null,
    tier: e.metadata?.tier || null,
    content: e.metadata?.content || e.metadata?.summary || '',
    importance: e.metadata?.importance ?? null,
    confidence: e.metadata?.confidence ?? null,
    timestamp: e.metadata?.timestamp || e.metadata?.lastUpdated || null,
    tags: e.metadata?.tags || [],
  }));

  res.json({ entries: page, total, limit, offset });
});

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

// PATCH /api/v1/memory/entries/:id — update entry content
router.patch('/memory/entries/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { content } = req.body as { content?: string };
  if (!content?.trim()) return res.status(400).json({ error: 'content is required' });
  if (typeof content !== 'string' || content.length > MAX_CONTENT_LENGTH) {
    return res.status(400).json({ error: `content must be a string with max ${MAX_CONTENT_LENGTH} characters` });
  }
  const ok = await vectorService.updateEntry(id!, { content: content!.trim(), lastUpdated: new Date().toISOString() });
  if (!ok) return res.status(404).json({ error: 'Entry not found' });
  res.json({ success: true });
});

// DELETE /api/v1/memory/entries/:id — soft-delete one entry
router.delete('/memory/entries/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const ok = await vectorService.deprecateEntry(id!, 'Deleted by user');
  if (!ok) return res.status(404).json({ error: 'Entry not found' });
  res.json({ success: true });
});

// DELETE /api/v1/memory — soft-delete all entries (clear)
router.delete('/memory', async (req: Request, res: Response) => {
  const active = vectorService.getRecentEntries(MAX_MEMORY_LOAD).filter(e => !e.metadata?.deprecated);
  await Promise.all(active.map(e => vectorService.deprecateEntry(e.id, 'Cleared by user')));
  res.json({ success: true, cleared: active.length });
});

// POST /api/v1/index — trigger project re-index (was missing, called by frontend)
router.post('/index', (req: Request, res: Response) => {
  const projectRoot = path.join(__dirname, '../../..');
  // Fire-and-forget: indexProject can take minutes on large repos
  vectorService.indexProject(projectRoot).catch((err: Error) => {
    console.error('[Memory] Re-index failed:', err.message);
  });
  res.json({ success: true, message: 'Re-indexing started in background' });
});

export default router;
