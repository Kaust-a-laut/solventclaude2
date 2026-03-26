import { Request, Response } from 'express';
import { z } from 'zod';
import { browseService } from '../services/browseService';

const extractContentSchema = z.object({
  url: z.string().url('A valid URL is required'),
});

const summarizeSchema = z.object({
  url: z.string().url().optional(),
  content: z.string().min(1, 'Content is required'),
  instruction: z.string().optional(),
});

export class BrowseController {
  static async extractContent(req: Request, res: Response) {
    try {
      const parseResult = extractContentSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: 'Invalid request body',
          details: parseResult.error.errors,
        });
      }

      const pageContent = await browseService.fetchPage(parseResult.data.url);
      res.json(pageContent);
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('[BrowseController] Extract Error:', err.message);
      res.status(500).json({ error: err.message });
    }
  }

  static async summarize(req: Request, res: Response) {
    try {
      const parseResult = summarizeSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: 'Invalid request body',
          details: parseResult.error.errors,
        });
      }

      const { content, instruction } = parseResult.data;
      const summary = await browseService.summarizePage(content, instruction);
      res.json({ summary });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('[BrowseController] Summarize Error:', err.message);
      res.status(500).json({ error: err.message });
    }
  }
}
