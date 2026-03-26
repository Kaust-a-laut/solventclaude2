import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import aiRoutes from './aiRoutes';
import { supervisorService } from '../services/supervisorService';

vi.mock('../services/supervisorService');

const app = express();
app.use(express.json());
app.use('/api/v1', aiRoutes);

describe('Overseer Endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/v1/overseer/pending', () => {
    it('should return pending decisions', async () => {
      vi.mocked(supervisorService.getPendingDecisions).mockReturnValue([
        {
          id: 'dec-1',
          timestamp: Date.now(),
          decision: 'Test decision',
          intervention: { needed: true, type: 'action', message: 'Test', toolToExecute: null },
          crystallize: null,
          mentalMapUpdate: null,
          status: 'pending',
          trigger: 'notepad_change',
          expiresAt: Date.now() + 60000
        }
      ]);

      const response = await request(app).get('/api/v1/overseer/pending');

      expect(response.status).toBe(200);
      expect(response.body.decisions).toHaveLength(1);
      expect(response.body.decisions[0].id).toBe('dec-1');
    });

    it('should return empty array when no pending decisions', async () => {
      vi.mocked(supervisorService.getPendingDecisions).mockReturnValue([]);

      const response = await request(app).get('/api/v1/overseer/pending');

      expect(response.status).toBe(200);
      expect(response.body.decisions).toEqual([]);
    });
  });

  describe('POST /api/v1/overseer/approve', () => {
    it('should approve decision', async () => {
      vi.mocked(supervisorService.approveDecision).mockResolvedValue({ success: true });

      const response = await request(app)
        .post('/api/v1/overseer/approve')
        .send({ decisionId: 'dec-1' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 400 for missing decisionId', async () => {
      const response = await request(app)
        .post('/api/v1/overseer/approve')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('decisionId is required');
    });

    it('should return 400 when approveDecision fails', async () => {
      vi.mocked(supervisorService.approveDecision).mockResolvedValue({
        success: false,
        error: 'Decision not found'
      });

      const response = await request(app)
        .post('/api/v1/overseer/approve')
        .send({ decisionId: 'non-existent' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Decision not found');
    });

    it('should return 500 on unexpected error', async () => {
      vi.mocked(supervisorService.approveDecision).mockRejectedValue(new Error('Unexpected error'));

      const response = await request(app)
        .post('/api/v1/overseer/approve')
        .send({ decisionId: 'dec-1' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Unexpected error');
    });
  });

  describe('POST /api/v1/overseer/reject', () => {
    it('should reject decision', async () => {
      vi.mocked(supervisorService.rejectDecision).mockResolvedValue({ success: true });

      const response = await request(app)
        .post('/api/v1/overseer/reject')
        .send({ decisionId: 'dec-1', reason: 'Not needed' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should reject decision without reason', async () => {
      vi.mocked(supervisorService.rejectDecision).mockResolvedValue({ success: true });

      const response = await request(app)
        .post('/api/v1/overseer/reject')
        .send({ decisionId: 'dec-1' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 400 for missing decisionId', async () => {
      const response = await request(app)
        .post('/api/v1/overseer/reject')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('decisionId is required');
    });

    it('should return 400 when rejectDecision fails', async () => {
      vi.mocked(supervisorService.rejectDecision).mockResolvedValue({
        success: false,
        error: 'Decision not found'
      });

      const response = await request(app)
        .post('/api/v1/overseer/reject')
        .send({ decisionId: 'non-existent' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Decision not found');
    });

    it('should return 500 on unexpected error', async () => {
      vi.mocked(supervisorService.rejectDecision).mockRejectedValue(new Error('Unexpected error'));

      const response = await request(app)
        .post('/api/v1/overseer/reject')
        .send({ decisionId: 'dec-1' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Unexpected error');
    });
  });
});
