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

describe('TraceLogger.updateOutcome', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAccess.mockRejectedValue(new Error('ENOENT'));
    mockStat.mockRejectedValue(new Error('ENOENT'));
    mockAppendFile.mockResolvedValue(undefined);
    mockRename.mockResolvedValue(undefined);
    mockUnlink.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('should append an outcome_patch JSON line', async () => {
    mockStat.mockResolvedValue({ size: 100 } as any);
    mockAccess.mockResolvedValue(undefined);
    mockAppendFile.mockResolvedValue(undefined);

    const { traceLogger } = await import('./traceLogger');
    await traceLogger.updateOutcome('trace-abc', 'correction');

    expect(mockAppendFile).toHaveBeenCalledOnce();
    const writtenLine = mockAppendFile.mock.calls[0]![1] as string;
    const patch = JSON.parse(writtenLine.trim());
    expect(patch.type).toBe('outcome_patch');
    expect(patch.traceId).toBe('trace-abc');
    expect(patch.outcome).toBe('correction');
    expect(patch.ts).toBeDefined();
  });
});

describe('TraceLogger.readTraces', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAccess.mockRejectedValue(new Error('ENOENT'));
    mockStat.mockRejectedValue(new Error('ENOENT'));
    mockAppendFile.mockResolvedValue(undefined);
    mockRename.mockResolvedValue(undefined);
    mockUnlink.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('should return parsed traces from file content', async () => {
    const mockReadFile = vi.mocked(fs.readFile);
    mockReadFile.mockResolvedValue(JSON.stringify({
      id: 'trace-1', ts: '2026-01-01T00:00:00Z', responseId: 'r1',
      sessionId: 'sess-1', mode: 'chat', provider: 'groq', model: 'llama',
      query: 'hello', harnessSnapshot: {} as any, active: [], suppressed: [],
      promptTokens: { memory: 0, rules: 0, workspace: 0, conversationHistory: 0, systemPrompt: 0, total: 0, budget: 0 },
      counts: { workspace: 0, local: 0, global: 0, rules: 0 },
      pipelineMs: 100, outcome: null,
    }) as any);

    const { traceLogger } = await import('./traceLogger');
    const traces = await traceLogger.readTraces('/fake/path.jsonl');
    expect(traces).toHaveLength(1);
    expect(traces[0]!.id).toBe('trace-1');
    expect(traces[0]!.outcome).toBeNull();
  });

  it('should merge outcome_patch records into the corresponding trace', async () => {
    const mockReadFile = vi.mocked(fs.readFile);
    const traceLine = JSON.stringify({
      id: 'trace-2', ts: '2026-01-01T00:00:00Z', responseId: 'r2',
      sessionId: 'sess-2', mode: 'chat', provider: 'groq', model: 'llama',
      query: 'test', harnessSnapshot: {} as any, active: [], suppressed: [],
      promptTokens: { memory: 0, rules: 0, workspace: 0, conversationHistory: 0, systemPrompt: 0, total: 0, budget: 0 },
      counts: { workspace: 0, local: 0, global: 0, rules: 0 },
      pipelineMs: 50, outcome: null,
    });
    const patchLine = JSON.stringify({
      type: 'outcome_patch', traceId: 'trace-2', outcome: 'correction', ts: '2026-01-01T00:01:00Z'
    });
    mockReadFile.mockResolvedValue((traceLine + '\n' + patchLine) as any);

    const { traceLogger } = await import('./traceLogger');
    const traces = await traceLogger.readTraces('/fake/path.jsonl');
    expect(traces).toHaveLength(1);
    expect(traces[0]!.outcome).toBe('correction');
  });
});
