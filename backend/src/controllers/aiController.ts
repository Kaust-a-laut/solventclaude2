import { Request, Response } from 'express';
import { aiService } from '../services/aiService';
import { WaterfallStep } from '../services/waterfallService';
import { metaMemoryService } from '../services/metaMemoryService';
import { taskService } from '../services/taskService';
import { z } from 'zod';

// Zod schemas for request validation
const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system', 'model']),
  content: z.string(),
  image: z.string().nullable().optional()
});

const chatRequestSchema = z.object({
  provider: z.string(),
  model: z.string(),
  messages: z.array(chatMessageSchema),
  image: z.object({ data: z.string(), mimeType: z.string() }).nullable().optional(),
  mode: z.string().optional(),
  smartRouter: z.boolean().optional(),
  fallbackModel: z.string().optional(),
  imageProvider: z.string().optional(),
  temperature: z.number().optional(),
  maxTokens: z.number().optional(),
  apiKeys: z.record(z.string()).optional(),
  thinkingModeEnabled: z.boolean().optional(),
  deviceInfo: z.object({
    isMobile: z.boolean(),
    isTablet: z.boolean(),
    isDesktop: z.boolean(),
    windowSize: z.object({ width: z.number(), height: z.number() })
  }).optional(),
  notepadContent: z.string().optional(),
  openFiles: z.array(z.object({ path: z.string(), content: z.string() })).optional(),
  codingHistory: z.array(chatMessageSchema).optional(),
  browserContext: z.object({
    history: z.array(z.string()),
    lastSearchResults: z.array(z.object({
      title: z.string(),
      link: z.string(),
      snippet: z.string().optional()
    })).optional()
  }).optional()
});

const searchRequestSchema = z.object({
  query: z.string().min(1, 'Query is required'),
  page: z.number().int().min(1).optional(),
});

const compareRequestSchema = z.object({
  messages: z.array(chatMessageSchema),
  model1: z.string().optional(),
  provider1: z.string().optional(),
  model2: z.string().optional(),
  provider2: z.string().optional(),
});

const phaseSelectionSchema = z.union([
  z.enum(['A', 'B']),
  z.object({ model: z.string(), provider: z.string() })
]);

const modelSelectionSchema = z.object({
  architect: phaseSelectionSchema,
  reasoner: phaseSelectionSchema,
  executor: phaseSelectionSchema,
  reviewer: phaseSelectionSchema,
}).optional();

const waterfallRequestSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required'),
  globalProvider: z.string().optional(),
  notepadContent: z.string().optional(),
  openFiles: z.array(z.object({ path: z.string(), content: z.string() })).optional(),
  forceProceed: z.boolean().optional(),
  modelSelection: modelSelectionSchema,
});

const waterfallStepRequestSchema = z.object({
  step: z.enum([WaterfallStep.ARCHITECT, WaterfallStep.REASONER, WaterfallStep.EXECUTOR, WaterfallStep.REVIEWER]),
  input: z.string(),
  context: z.record(z.unknown()).nullable().optional(),
  globalProvider: z.string().optional()
});

export class AIController {
  static async chat(req: Request, res: Response) {
    try {
      const parseResult = chatRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        console.error('[AIController] Invalid request body:', JSON.stringify(req.body, null, 2));
        console.error('[AIController] Validation errors:', parseResult.error.errors);
        return res.status(400).json({
          error: 'Invalid request body',
          details: parseResult.error.errors
        });
      }
      const result = await aiService.processChat(parseResult.data);
      res.json(result);
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('[AIController] Chat Error:', err);
      const status = 'status' in err && typeof err.status === 'number' ? err.status : 500;
      const message = err.message || 'Chat processing failed';
      res.status(status).json({ error: message });
    }
  }

  static async generateImage(req: Request, res: Response) {
    try {
      const imageSchema = z.object({
        prompt: z.string(),
        model: z.string().optional(),
        provider: z.string().optional(),
        localUrl: z.string().optional(),
        apiKeys: z.record(z.string()).optional()
      });
      const { prompt, model, provider, localUrl, apiKeys } = imageSchema.parse(req.body);
      const result = await aiService.generateImage(prompt, model, apiKeys?.gemini, provider, { localUrl, apiKeys });
      res.json(result);
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('[AIController] Image Generation Error:', err);
      res.status(500).json({ error: err.message || 'Image generation failed' });
    }
  }

  static async search(req: Request, res: Response) {
    try {
      const parseResult = searchRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ 
          error: 'Invalid request body', 
          details: parseResult.error.errors 
        });
      }
      const { query, page } = parseResult.data;
      const result = await aiService.performSearch(query, page);
      res.json(result);
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      res.status(500).json({ error: err.message });
    }
  }

  static async compare(req: Request, res: Response) {
    try {
      const parseResult = compareRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ 
          error: 'Invalid request body', 
          details: parseResult.error.errors 
        });
      }
      const { messages, model1, provider1, model2, provider2 } = parseResult.data;
      const result = await aiService.compareModels(messages, {
        model1, provider1, model2, provider2,
      });
      res.json(result);
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      res.status(500).json({ error: err.message });
    }
  }

  static async waterfall(req: Request, res: Response) {
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
      const parseResult = waterfallRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.write(`data: ${JSON.stringify({ phase: 'error', message: 'Invalid request body', details: parseResult.error.errors })}\n\n`);
        res.end();
        return;
      }
      
      const { prompt, globalProvider, notepadContent, openFiles, forceProceed, modelSelection } = parseResult.data;

      const result = await aiService.runAgenticWaterfall(
        prompt,
        globalProvider,
        undefined,
        (phase, data) => {
          if (!controller.signal.aborted) {
            res.write(`data: ${JSON.stringify({ phase, ...data })}\n\n`);
          }
        },
        notepadContent,
        openFiles,
        controller.signal,
        forceProceed,
        undefined,
        modelSelection
      );

      if (!controller.signal.aborted) {
        res.write(`data: ${JSON.stringify({ phase: 'final', ...result })}\n\n`);
        res.end();
      }
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      if (!controller.signal.aborted) {
        // If cancelled, connection is already closed
        res.write(`data: ${JSON.stringify({ phase: 'error', message: err.message })}\n\n`);
        res.end();
      }
    }
  }

  static async waterfallStep(req: Request, res: Response) {
    try {
      const parseResult = waterfallStepRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ 
          error: 'Invalid request body', 
          details: parseResult.error.errors 
        });
      }
      const { step, input, context, globalProvider } = parseResult.data;
      const result = await aiService.runWaterfallStep(step, input, context, globalProvider);
      res.json(result);
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      res.status(500).json({ error: err.message });
    }
  }

  static async indexProject(req: Request, res: Response) {
    try {
      // Use the task service to dispatch the indexing job asynchronously
      const jobId = await taskService.dispatchIndexingJob(process.cwd());
      res.json({
        status: 'queued',
        jobId,
        message: 'Project indexing has been queued for processing'
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      res.status(500).json({ error: err.message });
    }
  }

  static async listModels(req: Request, res: Response) {
    try {
      const result = await aiService.listAvailableModels();
      res.json(result);
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      res.status(500).json({ error: err.message });
    }
  }

  static async checkLocalImageStatus(req: Request, res: Response) {
    try {
      const result = await aiService.checkLocalImageStatus();
      res.json(result);
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      res.status(500).json({ error: err.message });
    }
  }

  static async checkHealth(req: Request, res: Response) {
    try {
      const result = await aiService.checkHealth();
      res.json(result);
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      res.status(500).json({ error: err.message });
    }
  }

  /**
   * SSE endpoint for agent chat with real-time tool visibility.
   * Streams AgentEvent objects as SSE `data:` lines.
   */
  static async agentChat(req: Request, res: Response) {
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
      const parseResult = chatRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.write(`data: ${JSON.stringify({ type: 'error', message: 'Invalid request body' })}\n\n`);
        res.end();
        return;
      }

      const data = { ...parseResult.data, signal: controller.signal };

      await aiService.processAgentChat(
        data,
        (event) => {
          if (!controller.signal.aborted) {
            res.write(`data: ${JSON.stringify(event)}\n\n`);
          }
        }
      );

      if (!controller.signal.aborted) {
        res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
        res.end();
      }
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      if (!controller.signal.aborted) {
        res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`);
        res.end();
      }
    }
  }

  static async synthesizeMemory(req: Request, res: Response) {
    try {
      const summary = await metaMemoryService.synthesizeStateOfTheUnion();
      res.json({ status: 'success', summary });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      res.status(500).json({ error: err.message });
    }
  }
}
