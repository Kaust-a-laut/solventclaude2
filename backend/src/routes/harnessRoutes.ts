import { Router } from 'express';
import { HarnessController } from '../controllers/harnessController';

const router = Router();

router.post('/harness/optimize', HarnessController.startRun);
router.post('/harness/optimize/:id/cancel', HarnessController.cancelRun);
router.get('/harness/runs', HarnessController.listRuns);
router.get('/harness/runs/:id', HarnessController.getRun);
router.get('/harness/runs/:id/stream', HarnessController.streamRun);

export default router;
