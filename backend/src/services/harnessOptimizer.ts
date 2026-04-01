import { EvaluationResult, OptimizationRun } from '../types/harness';
import { proposerAgent } from './proposerAgent';
import { harnessEvaluator } from './harnessEvaluator';
import { traceLogger } from './traceLogger';
import { randomUUID as uuidv4 } from 'crypto';
import { logger } from '../utils/logger';

type RunCallback = (run: OptimizationRun) => void;

/**
 * Meta-Harness outer loop optimizer.
 * Implements Algorithm 1 from the Meta-Harness paper:
 *   For each iteration:
 *     1. Proposer reads filesystem (traces) and proposes new config
 *     2. Evaluator runs proposed config against search set
 *     3. Results logged, Pareto frontier updated
 */
export class HarnessOptimizer {
  private runs = new Map<string, OptimizationRun>();
  private callbacks = new Map<string, RunCallback[]>();
  private activeRunId: string | null = null;

  /**
   * Starts a new optimization run.
   */
  async startRun(config: {
    maxIterations?: number;
    candidatesPerIteration?: number;
    searchSetQuery?: string;
    minTraceCount?: number;
  }): Promise<OptimizationRun> {
    const run: OptimizationRun = {
      id: uuidv4(),
      status: 'running',
      ts: new Date().toISOString(),
      config: {
        maxIterations: config.maxIterations || 10,
        candidatesPerIteration: config.candidatesPerIteration || 1,
        searchSetQuery: config.searchSetQuery,
        minTraceCount: config.minTraceCount || 10,
      },
      iterations: 0,
      proposals: [],
      evaluations: [],
      paretoFrontier: [],
    };

    this.runs.set(run.id, run);
    this.callbacks.set(run.id, []);
    this.activeRunId = run.id;

    // Run asynchronously — don't block the API call
    this.runLoop(run).catch(err => {
      run.status = 'failed';
      run.error = err.message;
      this.notifyCallbacks(run);
    });

    return run;
  }

  /**
   * Cancels a running optimization.
   */
  cancelRun(runId: string): boolean {
    const run = this.runs.get(runId);
    if (!run || run.status !== 'running') return false;
    run.status = 'cancelled';
    this.activeRunId = null;
    this.notifyCallbacks(run);
    return true;
  }

  /**
   * Gets the current state of a run.
   */
  getRun(runId: string): OptimizationRun | undefined {
    return this.runs.get(runId);
  }

  /**
   * Lists all runs.
   */
  listRuns(): OptimizationRun[] {
    return [...this.runs.values()].sort((a, b) =>
      new Date(b.ts).getTime() - new Date(a.ts).getTime()
    );
  }

  private async runLoop(run: OptimizationRun): Promise<void> {
    const traces = await traceLogger.readTraces();
    const minCount = run.config.minTraceCount || 10;

    if (traces.length < minCount) {
      run.status = 'completed';
      run.error = `Need at least ${minCount} traces to start optimization (have ${traces.length})`;
      this.notifyCallbacks(run);
      return;
    }

    for (let i = 1; i <= run.config.maxIterations && run.status === 'running'; i++) {
      run.iterations = i;
      logger.info(`[HarnessOptimizer] Iteration ${i}/${run.config.maxIterations}`);

      // Step 1: Propose
      const proposal = await proposerAgent.propose({
        runId: run.id,
        iteration: i,
        priorProposals: run.proposals,
        priorEvaluations: run.evaluations.map(e => ({ proposalId: e.proposalId, result: e })),
      });

      if (!proposal) {
        logger.info(`[HarnessOptimizer] No proposal at iteration ${i} — stopping`);
        break;
      }

      run.proposals.push(proposal);
      this.notifyCallbacks(run);

      // Step 2: Evaluate
      const result = await harnessEvaluator.evaluate(proposal, traces);

      // Step 3: Update Pareto frontier
      result.isParetoOptimal = this.updateParetoFrontier(run, result);
      run.evaluations.push(result);
      this.notifyCallbacks(run);

      // Small delay to avoid tight loops
      await new Promise(r => setTimeout(r, 100));
    }

    run.status = 'completed';
    this.activeRunId = null;
    this.notifyCallbacks(run);
  }

  /**
   * Updates the Pareto frontier.
   * A config is Pareto-optimal if no other config dominates it on both
   * acceptance rate AND token efficiency.
   */
  private updateParetoFrontier(run: OptimizationRun, newResult: EvaluationResult): boolean {
    const frontier = run.paretoFrontier;
    const newEval = run.evaluations.find(e => e.proposalId === newResult.proposalId);
    if (!newEval) return false;

    // Check if any existing frontier member dominates this one
    let isDominated = false;
    for (const fid of frontier) {
      const existing = run.evaluations.find(e => e.proposalId === fid);
      if (!existing) continue;
      // Dominates if strictly better on at least one axis and no worse on the other
      const betterAcceptance = existing.acceptanceRate > newEval.acceptanceRate;
      const betterTokens = existing.avgPromptTokens < newEval.avgPromptTokens;
      const equalAcceptance = Math.abs(existing.acceptanceRate - newEval.acceptanceRate) < 0.01;
      const equalTokens = Math.abs(existing.avgPromptTokens - newEval.avgPromptTokens) < 100;

      if ((betterAcceptance && (betterTokens || equalTokens)) ||
          (betterTokens && (betterAcceptance || equalAcceptance))) {
        isDominated = true;
        break;
      }
    }

    if (!isDominated) {
      // Remove any frontier members that this new one dominates
      const newFrontier = frontier.filter(fid => {
        const existing = run.evaluations.find(e => e.proposalId === fid);
        if (!existing) return true;
        const newBetterAcceptance = newEval.acceptanceRate > existing.acceptanceRate;
        const newBetterTokens = newEval.avgPromptTokens < existing.avgPromptTokens;
        const eqAccept = Math.abs(newEval.acceptanceRate - existing.acceptanceRate) < 0.01;
        const eqTokens = Math.abs(newEval.avgPromptTokens - existing.avgPromptTokens) < 100;
        return !((newBetterAcceptance && (newBetterTokens || eqTokens)) ||
                 (newBetterTokens && (newBetterAcceptance || eqAccept)));
      });
      newFrontier.push(newResult.proposalId);
      run.paretoFrontier = newFrontier;
    }

    return !isDominated;
  }

  onRunUpdate(runId: string, callback: RunCallback): void {
    const cbs = this.callbacks.get(runId) || [];
    cbs.push(callback);
    this.callbacks.set(runId, cbs);
  }

  private notifyCallbacks(run: OptimizationRun): void {
    const cbs = this.callbacks.get(run.id) || [];
    for (const cb of cbs) {
      try { cb(run); } catch { /* ignore callback errors */ }
    }
  }
}

export const harnessOptimizer = new HarnessOptimizer();
