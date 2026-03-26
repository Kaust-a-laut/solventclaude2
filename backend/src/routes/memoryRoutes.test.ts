import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import memoryRoutes from './memoryRoutes';
import { vectorService } from '../services/vectorService';

vi.mock('../services/vectorService');

const app = express();
app.use(express.json());
app.use('/api/v1', memoryRoutes);

describe('POST /api/v1/memory/search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return results with correct format', async () => {
    vi.mocked(vectorService.search).mockResolvedValue([
      {
        id: 'mem-1',
        score: 0.95,
        vector: [],
        metadata: { type: 'architectural_decision', content: 'Test content' }
      }
    ]);

    const response = await request(app)
      .post('/api/v1/memory/search')
      .send({ query: 'test', limit: 10 });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('results');
    expect(response.body.results[0]).toMatchObject({
      id: 'mem-1',
      score: 0.95,
      text: 'Test content',
      metadata: { type: 'architectural_decision' }
    });
  });

  it('should return 400 if query is missing', async () => {
    const response = await request(app)
      .post('/api/v1/memory/search')
      .send({ limit: 10 });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error', 'query is required');
  });

  it('should handle empty results', async () => {
    vi.mocked(vectorService.search).mockResolvedValue([]);

    const response = await request(app)
      .post('/api/v1/memory/search')
      .send({ query: 'test', limit: 10 });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('results');
    expect(response.body.results).toEqual([]);
  });

  it('should use summary if content is not available', async () => {
    vi.mocked(vectorService.search).mockResolvedValue([
      {
        id: 'mem-2',
        score: 0.87,
        vector: [],
        metadata: { type: 'conversation', summary: 'Summarized content' }
      }
    ]);

    const response = await request(app)
      .post('/api/v1/memory/search')
      .send({ query: 'test', limit: 10 });

    expect(response.status).toBe(200);
    expect(response.body.results[0].text).toBe('Summarized content');
  });

  it('should include all metadata fields', async () => {
    vi.mocked(vectorService.search).mockResolvedValue([
      {
        id: 'mem-3',
        score: 0.92,
        vector: [],
        metadata: {
          type: 'decision',
          tier: 'high',
          importance: 0.8,
          confidence: 0.9,
          timestamp: '2024-01-01T00:00:00Z',
          tags: ['important', 'reviewed'],
          content: 'Full metadata test'
        }
      }
    ]);

    const response = await request(app)
      .post('/api/v1/memory/search')
      .send({ query: 'test', limit: 10 });

    expect(response.status).toBe(200);
    expect(response.body.results[0]).toMatchObject({
      id: 'mem-3',
      score: 0.92,
      text: 'Full metadata test',
      metadata: {
        type: 'decision',
        tier: 'high',
        importance: 0.8,
        confidence: 0.9,
        timestamp: '2024-01-01T00:00:00Z',
        tags: ['important', 'reviewed']
      }
    });
  });
});
