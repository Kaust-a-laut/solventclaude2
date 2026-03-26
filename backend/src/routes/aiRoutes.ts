import { Router } from 'express';
import path from 'path';
import { z } from 'zod';
import { AIController } from '../controllers/aiController';
import { BrowseController } from '../controllers/browseController';
import { CollaborateController } from '../controllers/collaborateController';
import { aiService } from '../services/aiService';
import { debateService } from '../services/debateService';
import { supervisorService } from '../services/supervisorService';
import { orchestrationService } from '../services/orchestrationService';
import { ConversationStorageService } from '../services/conversationStorageService';

const router = Router();
const storageService = new ConversationStorageService();

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

// ── Session Persistence ────────────────────────────────────────────────────
router.get('/sessions', async (req, res) => {
  try {
    const { mode, search, limit = '50', offset = '0' } = req.query;
    let sessions = await storageService.listSessions(mode as string);
    
    if (search) {
      const query = search as string;
      sessions = sessions.filter(s => 
        s.title.toLowerCase().includes(query.toLowerCase()) ||
        s.messages.some(m => m.content.toLowerCase().includes(query.toLowerCase()))
      );
    }
    
    const parsedLimit = parseInt(limit as string, 10);
    const parsedOffset = parseInt(offset as string, 10);
    const paginated = sessions.slice(parsedOffset, parsedOffset + parsedLimit);
    
    res.json({ sessions: paginated, total: sessions.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/sessions/search', async (req, res) => {
  try {
    const { q, limit = '20' } = req.query;
    if (!q) {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }
    const results = await storageService.searchSessions(q as string, parseInt(limit as string, 10));
    res.json({ results });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/sessions/:id', async (req, res) => {
  try {
    const session = await storageService.loadSession(req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    res.json(session);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/sessions', async (req, res) => {
  try {
    const { id, mode, title, messages, parentMessageId, parentSessionId } = req.body;
    
    if (!id || !mode || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'id, mode, and messages are required' });
    }
    
    const storedMessages = storageService.toStoredMessages(messages);
    const now = Date.now();
    
    const session = {
      id,
      mode,
      title: title || storageService.generateTitle(messages[0]?.content || 'New Conversation'),
      messages: storedMessages,
      createdAt: now,
      updatedAt: now,
      parentMessageId,
      parentSessionId,
      metadata: {
        modelsUsed: [...new Set(messages.map(m => m.model).filter(Boolean))],
        messageCount: messages.length,
        tokenEstimate: messages.reduce((acc, m) => acc + m.content.length / 4, 0),
        tags: []
      }
    };
    
    await storageService.saveSession(session);
    res.json(session);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/sessions/:id', async (req, res) => {
  try {
    const existing = await storageService.loadSession(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    const { messages, title } = req.body;
    const updated = {
      ...existing,
      title: title || existing.title,
      messages: messages ? storageService.toStoredMessages(messages) : existing.messages,
      updatedAt: Date.now(),
      metadata: {
        ...existing.metadata,
        messageCount: messages ? messages.length : existing.metadata.messageCount,
        modelsUsed: messages
          ? [...new Set(messages.map((m: any) => m.model).filter(Boolean))] as string[]
          : existing.metadata.modelsUsed
      }
    };
    
    await storageService.saveSession(updated);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/sessions/:id', async (req, res) => {
  try {
    await storageService.deleteSession(req.params.id);
    res.json({ success: true, message: 'Session deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── Overseer Decision Review ────────────────────────────────────────────────
router.get('/overseer/pending', async (req, res) => {
  try {
    const pending = supervisorService.getPendingDecisions();
    res.json({ decisions: pending });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/overseer/history', async (req, res) => {
  try {
    const { limit = '50', offset = '0', trigger, status } = req.query;
    let history = supervisorService.getDecisionHistory(
      parseInt(limit as string, 10),
      parseInt(offset as string, 10)
    );

    if (trigger) {
      history = history.filter(h => h.trigger === trigger);
    }
    if (status) {
      history = history.filter(h => h.status === status);
    }

    res.json({ decisions: history, total: history.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/overseer/approve', async (req, res) => {
  try {
    const { decisionId } = req.body;
    if (!decisionId) {
      return res.status(400).json({ error: 'decisionId is required' });
    }

    const result = await supervisorService.approveDecision(decisionId);
    if (result.success) {
      res.json({ success: true, message: 'Decision approved' });
    } else {
      res.status(400).json({ error: result.error });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/overseer/reject', async (req, res) => {
  try {
    const { decisionId, reason } = req.body;
    if (!decisionId) {
      return res.status(400).json({ error: 'decisionId is required' });
    }

    const result = await supervisorService.rejectDecision(decisionId, reason);
    if (result.success) {
      res.json({ success: true, message: 'Decision rejected' });
    } else {
      res.status(400).json({ error: result.error });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── Codebase Indexing ────────────────────────────────────────────────────────
router.post('/codebase/index', async (req, res) => {
  try {
    const { rootPath = process.cwd() } = req.body;

    // Prevent arbitrary filesystem traversal — rootPath must be within cwd
    const resolved = path.resolve(rootPath);
    if (!resolved.startsWith(process.cwd())) {
      return res.status(400).json({ error: 'rootPath must be within the project directory' });
    }

    const { codebaseIndexer } = await import('../services/codebaseIndexer');

    // Perform full index
    await codebaseIndexer.indexProject(resolved);

    res.json({ success: true, message: 'Codebase indexing complete' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/codebase/status', async (req, res) => {
  try {
    const { codebaseIndexer } = await import('../services/codebaseIndexer');
    const status = codebaseIndexer.getStatus();
    res.json(status);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/codebase/watch', async (req, res) => {
  try {
    const { rootPath = process.cwd(), enabled } = req.body;
    const { codebaseIndexer } = await import('../services/codebaseIndexer');
    
    if (enabled) {
      await codebaseIndexer.start({ rootPath });
      res.json({ success: true, message: 'File watcher started' });
    } else {
      await codebaseIndexer.stop();
      res.json({ success: true, message: 'File watcher stopped' });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
