import { traceLogger } from './traceLogger';
import { HarnessProposal, EvaluationResult } from '../types/harness';

/**
 * Evaluates a proposed harness configuration against the existing trace data.
 *
 * In Phase C, this is a retrospective evaluation: it simulates how the proposed
 * parameters would have filtered the existing traces. In Phase C+, this would
 * run the proposed config live against a held-out search set of real queries.
 */
export class HarnessEvaluator {
  /**
   * Evaluates a proposal by simulating its parameter changes against
   * the recent trace history.
   */
  async evaluate(proposal: HarnessProposal, allTraces?: any[]): Promise<EvaluationResult> {
    const traces = allTraces || await traceLogger.readTraces();
    if (traces.length === 0) {
      return this.emptyResult(proposal);
    }

    // Use the most recent 50 traces as the search set
    const searchSet = traces.slice(0, 50);

    // Simulate: apply the proposed deltas and re-evaluate which items would have been active/suppressed
    const simulated = this.simulateProposal(searchSet, proposal);

    // Compute metrics
    const accepted = simulated.filter(t => t.outcome === 'accepted').length;
    const corrections = simulated.filter(t => t.outcome === 'correction').length;
    const total = simulated.length;

    const avgActive = simulated.reduce((s, t) => s + t.active.length, 0) / total;
    const avgSuppressed = simulated.reduce((s, t) => s + t.suppressed.length, 0) / total;
    const avgTokens = simulated.reduce((s, t) => s + (t.promptTokens?.total || 0), 0) / total;
    const avgMs = simulated.reduce((s, t) => s + t.pipelineMs, 0) / total;

    // Per-mode breakdown
    const byMode: Record<string, { count: number; acceptanceRate: number; avgTokens: number }> = {};
    for (const t of simulated) {
      const mode = t.mode || 'unknown';
      if (!byMode[mode]) byMode[mode] = { count: 0, acceptanceRate: 0, avgTokens: 0 };
      byMode[mode].count++;
      if (t.outcome === 'accepted') byMode[mode].acceptanceRate++;
      byMode[mode].avgTokens += t.promptTokens?.total || 0;
    }
    for (const mode of Object.keys(byMode)) {
      const entry = byMode[mode]!;
      entry.acceptanceRate /= entry.count;
      entry.avgTokens /= entry.count;
    }

    return {
      proposalId: proposal.id,
      runId: proposal.runId,
      ts: new Date().toISOString(),
      searchSetSize: searchSet.length,
      acceptanceRate: accepted / total,
      correctionRate: corrections / total,
      avgActiveItems: avgActive,
      avgSuppressedItems: avgSuppressed,
      avgPromptTokens: avgTokens,
      avgPipelineMs: avgMs,
      byMode,
      isParetoOptimal: true, // Will be updated by the optimizer
      traceIds: searchSet.map(t => t.id),
    };
  }

  private simulateProposal(traces: any[], proposal: HarnessProposal): any[] {
    const { deltas } = proposal;
    return traces.map(trace => {
      const newActive = trace.active.filter((item: any) => {
        const score = item.score || 0;
        if (deltas.MIN_SCORE_STANDARD_CONTEXT !== undefined) {
          const oldMin = 0.60;
          const newMin = deltas.MIN_SCORE_STANDARD_CONTEXT;
          if (score < newMin && score >= oldMin) return false;
        }
        return true;
      });

      const newSuppressed = trace.active.filter((item: any) => {
        const score = item.score || 0;
        if (deltas.MIN_SCORE_STANDARD_CONTEXT !== undefined) {
          const oldMin = 0.60;
          const newMin = deltas.MIN_SCORE_STANDARD_CONTEXT;
          if (score < newMin && score >= oldMin) return true;
        }
        return false;
      }).concat(trace.suppressed);

      let finalActive = newActive;
      if (deltas.RETRIEVAL_COUNT_DEFAULT !== undefined) {
        finalActive = newActive.slice(0, deltas.RETRIEVAL_COUNT_DEFAULT);
      }

      return {
        ...trace,
        active: finalActive,
        suppressed: newSuppressed,
      };
    });
  }

  private emptyResult(proposal: HarnessProposal): EvaluationResult {
    return {
      proposalId: proposal.id,
      runId: proposal.runId,
      ts: new Date().toISOString(),
      searchSetSize: 0,
      acceptanceRate: 0,
      correctionRate: 0,
      avgActiveItems: 0,
      avgSuppressedItems: 0,
      avgPromptTokens: 0,
      avgPipelineMs: 0,
      byMode: {},
      isParetoOptimal: false,
      traceIds: [],
    };
  }
}

export const harnessEvaluator = new HarnessEvaluator();
