import { Router } from 'express';
import { z } from 'zod';
import { AIController } from '../controllers/aiController';
import { BrowseController } from '../controllers/browseController';
import { CollaborateController } from '../controllers/collaborateController';
import { aiService } from '../services/aiService';
import { debateService } from '../services/debateService';
import { supervisorService } from '../services/supervisorService';
import { orchestrationService } from '../services/orchestrationService';

const router = Router();

// ── Core Chat ──────────────────────────────────────────────────────────────
router.post('/chat', AIController.chat);

// ── Intent Detection (single authoritative implementation) ─────────────────
// The frontend calls this to determine routing before sending a message.
// Keeps image intent logic in one place (aiService) instead of duplicating
// the regex in the frontend's actionSlice.
const detectIntentSchema = z.object({
  message: z.string().min(1),
  mode: z.string().optional()
});

router.post('/detect-intent', (req, res) => {
  const parseResult = detectIntentSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid request body', details: parseResult.error.errors });
  }
  const { message, mode } = parseResult.data;
  const result = aiService.detectImageIntent(message, mode);
  res.json(result);
});

// ── Waterfall (SSE streaming) ──────────────────────────────────────────────
router.post('/waterfall', AIController.waterfall);

// ── Image Generation ──────────────────────────────────────────────────────
router.post('/generate-image', AIController.generateImage);

// ── Web Search ────────────────────────────────────────────────────────────
router.post('/search', AIController.search);

// ── Browse (Page Extraction + Summarization) ─────────────────────────────
router.post('/browse', BrowseController.extractContent);
router.post('/browse/summarize', BrowseController.summarize);

// ── Model / Health Discovery ──────────────────────────────────────────────
router.get('/models', AIController.listModels);
router.get('/health/services', AIController.checkHealth);
router.get('/local-image-status', AIController.checkLocalImageStatus);

// ── Adversarial Debate ─────────────────────────────────────────────────────
router.post('/debate', async (req, res) => {
  const { topic, proponentModel, proponentProvider, criticModel, criticProvider } = req.body;
  if (!topic) return res.status(400).json({ error: 'topic is required' });
  try {
    const result = await debateService.conductDebate(topic, proponentModel, criticModel, proponentProvider, criticProvider);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── Agentic Compare ───────────────────────────────────────────────────────
router.post('/compare', AIController.compare);

// ── Multi-Agent Collaborate (Conversational Roundtable — SSE) ────────────
router.post('/collaborate/stream', CollaborateController.streamConversation);
router.post('/collaborate/inject', CollaborateController.injectMessage);
router.get('/collaborate/session/:id', CollaborateController.getSessionState);
router.post('/collaborate/synthesize', CollaborateController.synthesizeNow);

// ── Multi-Agent Collaborate (Legacy parallel mode) ───────────────────────
router.post('/collaborate', async (req, res) => {
  const { goal, missionType = 'consultation', async: isAsync, provider, model } = req.body;
  if (!goal) return res.status(400).json({ error: 'Goal is required' });

  try {
    const result = await orchestrationService.runMission(missionType, goal, {
      async: isAsync,
      providerOverride: provider,
      modelOverride: model
    });

    // Return 202 Accepted for async requests
    if (isAsync && 'jobId' in result) {
      return res.status(202).json(result);
    }

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Task Status Polling Endpoint
router.get('/tasks/:jobId', async (req, res) => {
  const { jobId } = req.params;

  try {
    const { taskService } = await import('../services/taskService');
    const status = await taskService.getJobStatus(jobId);
    res.json(status);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Conclusive Analysis Endpoint
// Re-synthesizes agent opinions + user context into a deeper actionable analysis
router.post('/analyze', async (req, res) => {
  const { opinions, synthesis, userContext, missionType } = req.body;
  if (!opinions || !synthesis) {
    return res.status(400).json({ error: 'opinions and synthesis are required' });
  }

  try {
    const analysis = await orchestrationService.analyzeFindings(
      opinions,
      synthesis,
      userContext,
      missionType
    );
    res.json({ analysis });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Manual Overseer Trigger Endpoint
// Allows the Command Center to fire a live-context think() cycle on demand
router.post('/overseer/trigger', async (req, res) => {
  const { focus, notepadContent, recentMessages } = req.body;
  // Fire-and-forget — respond immediately, let think() run async
  supervisorService.think({
    activity: 'manual_trigger',
    data: { focus, notepadContent, recentMessages }
  }).catch((err: unknown) => {
    console.warn('[Overseer] manual_trigger think() failed', err instanceof Error ? err.message : err);
  });
  res.json({ status: 'triggered', message: 'Overseer is analyzing...' });
});

// Plugin Discovery Endpoint
router.get('/plugins', async (req, res) => {
  try {
    const { pluginManager } = await import('../services/pluginManager');
    await pluginManager.initialize(); // Ensure plugins are loaded

    const registry = pluginManager.getRegistry();
    const pluginsInfo = {
      providers: Array.from(registry.providers.values()).map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        version: p.version,
        defaultModel: p.defaultModel
      })),
      tools: Array.from(registry.tools.values()).map(t => ({
        id: t.id,
        name: t.name,
        description: t.description,
        version: t.version,
        schema: t.schema
      }))
    };

    res.json(pluginsInfo);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
