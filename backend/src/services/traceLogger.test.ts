import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import path from 'path';

// We test the module by mocking fs operations
vi.mock('fs/promises');
vi.mock('fs');

const mockAppendFile = vi.mocked(fs.appendFile);
const mockRename = vi.mocked(fs.rename);
const mockUnlink = vi.mocked(fs.unlink);
const mockStat = vi.mocked(fs.stat);
const mockAccess = vi.mocked(fs.access);

describe('TraceLogger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: file does not exist (access throws) and stat shows small file
    mockAccess.mockRejectedValue(new Error('ENOENT'));
    mockStat.mockRejectedValue(new Error('ENOENT'));
    mockAppendFile.mockResolvedValue(undefined);
    mockRename.mockResolvedValue(undefined);
    mockUnlink.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('should append a JSON line to the trace file', async () => {
    const { traceLogger } = await import('./traceLogger');
    const trace = {
      id: 'test-id',
      ts: '2026-03-31T00:00:00.000Z',
      responseId: 'resp-1',
      sessionId: 'sess-1',
      mode: 'chat',
      provider: 'groq',
      model: 'llama-3.3-70b-versatile',
      query: 'test query',
      harnessSnapshot: {} as any,
      active: [],
      suppressed: [],
      promptTokens: { memory: 100, rules: 50, workspace: 0, conversationHistory: 200, systemPrompt: 300, total: 650, budget: 4096 },
      counts: { workspace: 0, local: 0, global: 0, rules: 0 },
      pipelineMs: 123,
      outcome: null,
    };

    await traceLogger.appendTrace(trace);

    expect(mockAppendFile).toHaveBeenCalledOnce();
    const [filePath, content] = mockAppendFile.mock.calls[0]!;
    expect(filePath).toContain('.solvent_retrieval_traces.jsonl');
    const parsed = JSON.parse((content as string).trim());
    expect(parsed.id).toBe('test-id');
    expect(parsed.query).toBe('test query');
  });

  it('should rotate the file when it exceeds 50MB', async () => {
    // File exists and is larger than 50MB
    mockAccess.mockResolvedValue(undefined);
    mockStat.mockResolvedValue({ size: 52_428_801 } as any); // > 50MB
    mockRename.mockResolvedValue(undefined);
    mockAppendFile.mockResolvedValue(undefined);

    const { traceLogger } = await import('./traceLogger');
    await traceLogger.appendTrace({
      id: 'x', ts: '', responseId: '', sessionId: '', mode: '', provider: '', model: '',
      query: '', harnessSnapshot: {} as any, active: [], suppressed: [],
      promptTokens: { memory: 0, rules: 0, workspace: 0, conversationHistory: 0, systemPrompt: 0, total: 0, budget: 0 },
      counts: { workspace: 0, local: 0, global: 0, rules: 0 },
      pipelineMs: 0, outcome: null,
    });

    expect(mockRename).toHaveBeenCalled();
    expect(mockAppendFile).toHaveBeenCalled();
  });

  it('should not throw if file write fails — fire and forget', async () => {
    mockAppendFile.mockRejectedValue(new Error('disk full'));

    const { traceLogger } = await import('./traceLogger');
    // Should not throw
    await expect(traceLogger.appendTrace({
      id: 'x', ts: '', responseId: '', sessionId: '', mode: '', provider: '', model: '',
      query: '', harnessSnapshot: {} as any, active: [], suppressed: [],
      promptTokens: { memory: 0, rules: 0, workspace: 0, conversationHistory: 0, systemPrompt: 0, total: 0, budget: 0 },
      counts: { workspace: 0, local: 0, global: 0, rules: 0 },
      pipelineMs: 0, outcome: null,
    })).resolves.toBeUndefined();
  });
});
