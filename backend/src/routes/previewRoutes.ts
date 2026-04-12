// backend/src/routes/previewRoutes.ts
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { previewStashStore } from '../services/previewStashStore';

const router = Router();

const MAX_PAYLOAD_SIZE = 500 * 1024; // 500KB

const eventPayloadSchema = z.object({
  sessionId: z.string(),
  entries: z.array(z.object({
    level: z.enum(['log', 'warn', 'error']),
    message: z.string(),
    timestamp: z.number(),
  })).max(200),
  bodyHTML: z.string().nullable().optional(),
  bodyHash: z.string().nullable().optional(),
});

const toolResultSchema = z.object({
  callId: z.string(),
  result: z.unknown(),
});

// Pending call promises: Map<callId, { resolve, reject, timeout }>
const pendingCalls = new Map<string, {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}>();

/**
 * Create a pending call that will be resolved when POST /tool-result is called.
 * Times out after 8 seconds.
 */
export function createPendingCall(callId: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingCalls.delete(callId);
      resolve({ error: 'Screenshot capture timed out' });
    }, 8000);
    pendingCalls.set(callId, { resolve, reject, timeout });
  });
}

/**
 * Resolve a pending call with the tool result.
 */
function resolvePendingCall(callId: string, result: unknown): boolean {
  const entry = pendingCalls.get(callId);
  if (!entry) return false;
  clearTimeout(entry.timeout);
  pendingCalls.delete(callId);
  entry.resolve(result);
  return true;
}

// POST /api/preview/events — fire-and-forget
router.post('/events', (req: Request, res: Response) => {
  const rawBody = JSON.stringify(req.body);
  if (rawBody.length > MAX_PAYLOAD_SIZE) {
    return res.status(413).json({ error: 'Payload too large' });
  }

  const parseResult = eventPayloadSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parseResult.error.errors });
  }

  const { sessionId, entries, bodyHTML, bodyHash } = parseResult.data;
  previewStashStore.set(sessionId, {
    entries,
    bodyHTML: bodyHTML ?? null,
    bodyHash: bodyHash ?? null,
    updatedAt: Date.now(),
  });

  res.status(200).json({ status: 'ok' });
});

// POST /api/preview/tool-result — resolve pending promise
router.post('/tool-result', (req: Request, res: Response) => {
  const parseResult = toolResultSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  const { callId, result } = parseResult.data;
  const resolved = resolvePendingCall(callId, result);

  res.status(200).json({ status: resolved ? 'resolved' : 'ignored', reason: resolved ? undefined : 'unknown callId' });
});

export { pendingCalls };
export default router;
