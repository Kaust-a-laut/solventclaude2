import { Router } from 'express';
import { AIController } from '../controllers/aiController';

const router = Router();

// POST /agent/chat — SSE streaming agent with tool visibility
router.post('/chat', AIController.agentChat);

export default router;
