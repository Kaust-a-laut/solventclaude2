import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('fs/promises');
vi.mock('./traceLogger', () => ({
  traceLogger: { readTraces: vi.fn(), appendTrace: vi.fn().mockResolvedValue(undefined), updateOutcome: vi.fn().mockResolvedValue(undefined) },
}));

describe('ProposerAgent', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns null with fewer than 10 traces', async () => {
    const { traceLogger } = await import('./traceLogger');
    (traceLogger.readTraces as any).mockResolvedValue([]);
    const { proposerAgent } = await import('./proposerAgent');
    const result = await proposerAgent.propose({ runId: 'r1', iteration: 1, priorProposals: [], priorEvaluations: [] });
    expect(result).toBeNull();
  }, 10000);

  it('proposes raising min score when correction rate is high', async () => {
    const { traceLogger } = await import('./traceLogger');
    const traces = Array.from({ length: 20 }, (_, i) => ({
      id: `t${i}`,
      outcome: i < 5 ? 'correction' : 'accepted',
      active: [{ score: 0.55 }],
      suppressed: [],
      promptTokens: { total: 2000, budget: 4096 },
      mode: 'chat',
      pipelineMs: 100,
    }));
    (traceLogger.readTraces as any).mockResolvedValue(traces);
    const { proposerAgent } = await import('./proposerAgent');
    const result = await proposerAgent.propose({ runId: 'r1', iteration: 1, priorProposals: [], priorEvaluations: [] });
    expect(result).not.toBeNull();
    expect(result!.deltas.MIN_SCORE_STANDARD_CONTEXT).toBeGreaterThan(0.60);
    expect(result!.targetsFailureModes).toContain('outcome_degradation');
  });

  it('proposes reducing retrieval count when suppression is high', async () => {
    const { traceLogger } = await import('./traceLogger');
    const traces = Array.from({ length: 20 }, (_, i) => ({
      id: `t${i}`,
      outcome: 'accepted',
      active: [{ score: 0.7 }],
      suppressed: [{ score: 0.3 }, { score: 0.25 }, { score: 0.2 }],
      promptTokens: { total: 2000, budget: 4096 },
      mode: 'chat',
      pipelineMs: 100,
    }));
    (traceLogger.readTraces as any).mockResolvedValue(traces);
    const { proposerAgent } = await import('./proposerAgent');
    const result = await proposerAgent.propose({ runId: 'r1', iteration: 1, priorProposals: [], priorEvaluations: [] });
    expect(result).not.toBeNull();
    expect(result!.deltas.RETRIEVAL_COUNT_DEFAULT).toBeLessThan(8);
    expect(result!.targetsFailureModes).toContain('high_suppression');
  });
});

describe('HarnessEvaluator', () => {
  it('evaluates a proposal with acceptance and token metrics', async () => {
    const { harnessEvaluator } = await import('./harnessEvaluator');
    const traces = Array.from({ length: 10 }, (_, i) => ({
      id: `t${i}`,
      outcome: i < 7 ? 'accepted' : 'correction',
      active: [{ score: 0.7 }],
      suppressed: [{ score: 0.4 }],
      promptTokens: { total: 2000 + i * 100, budget: 4096 },
      mode: 'chat',
      pipelineMs: 100 + i * 10,
    }));

    const result = await harnessEvaluator.evaluate({
      id: 'p1', runId: 'r1', iteration: 1, ts: '', deltas: {},
      rationale: 'test', targetsFailureModes: [],
    }, traces);

    expect(result.acceptanceRate).toBe(0.7);
    expect(result.avgActiveItems).toBeGreaterThan(0);
    expect(result.searchSetSize).toBe(10);
  });
});

describe('HarnessOptimizer', () => {
  it('starts a run and completes when no proposals are made', async () => {
    const { proposerAgent } = await import('./proposerAgent');
    vi.spyOn(proposerAgent, 'propose').mockResolvedValue(null);

    const { harnessOptimizer } = await import('./harnessOptimizer');
    const run = await harnessOptimizer.startRun({ maxIterations: 3 });

    await new Promise(r => setTimeout(r, 500));

    const updated = harnessOptimizer.getRun(run.id);
    expect(updated?.status).toBe('completed');
    expect(updated?.iterations).toBe(1);
  });

  it('cancels a running run', async () => {
    const { proposerAgent } = await import('./proposerAgent');
    vi.spyOn(proposerAgent, 'propose').mockImplementation(() => new Promise(() => {}));

    const { harnessOptimizer } = await import('./harnessOptimizer');
    const run = await harnessOptimizer.startRun({ maxIterations: 3 });
    expect(run.status).toBe('running');

    const cancelled = harnessOptimizer.cancelRun(run.id);
    expect(cancelled).toBe(true);

    const updated = harnessOptimizer.getRun(run.id);
    expect(updated?.status).toBe('cancelled');
  });
});
