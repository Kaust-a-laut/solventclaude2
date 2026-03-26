import { Request, Response } from 'express';
import { z } from 'zod';
import { runConversation, injectUserMessage, getSession, triggerSynthesis } from '../services/conversationService';

const streamRequestSchema = z.object({
  goal: z.string().min(1, 'Goal is required'),
  missionType: z.string().default('consultation'),
});

const injectRequestSchema = z.object({
  sessionId: z.string().min(1),
  message: z.string().min(1),
});

export class CollaborateController {
  static async streamConversation(req: Request, res: Response) {
    const controller = new AbortController();

    // SSE Setup
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    req.on('close', () => {
      controller.abort();
      res.end();
    });

    try {
      const parseResult = streamRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.write(`data: ${JSON.stringify({ event: 'error', data: { message: 'Invalid request body', details: parseResult.error.errors } })}\n\n`);
        res.end();
        return;
      }

      const { goal, missionType } = parseResult.data;

      const generator = runConversation(goal, missionType, controller.signal);

      for await (const event of generator) {
        if (controller.signal.aborted) break;
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }

      if (!controller.signal.aborted) {
        res.end();
      }
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      if (!controller.signal.aborted) {
        res.write(`data: ${JSON.stringify({ event: 'error', data: { message: err.message } })}\n\n`);
        res.end();
      }
    }
  }

  static async injectMessage(req: Request, res: Response) {
    try {
      const parseResult = injectRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: 'Invalid request body', details: parseResult.error.errors });
      }

      const { sessionId, message } = parseResult.data;
      const success = injectUserMessage(sessionId, message);

      if (!success) {
        return res.status(404).json({ error: 'Session not found or not active' });
      }

      res.json({ status: 'injected' });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      res.status(500).json({ error: err.message });
    }
  }

  static async getSessionState(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const session = getSession(id);

      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      res.json(session);
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      res.status(500).json({ error: err.message });
    }
  }

  static async synthesizeNow(req: Request, res: Response) {
    try {
      const { sessionId } = req.body;
      if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });

      const success = triggerSynthesis(sessionId);
      if (!success) {
        return res.status(404).json({ error: 'Session not found or not active' });
      }

      res.json({ status: 'synthesis_triggered' });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      res.status(500).json({ error: err.message });
    }
  }
}
