import { traceLogger, RetrievalTrace } from './traceLogger';
import { getHarnessSnapshot } from './contextService';
import { EvaluationResult, HarnessProposal, TracePattern } from '../types/harness';
import { randomUUID as uuidv4 } from 'crypto';

interface ProposerContext {
  runId: string;
  iteration: number;
  priorProposals: HarnessProposal[];
  priorEvaluations: { proposalId: string; result: EvaluationResult }[];
}

/**
 * Analyzes retrieval traces to identify failure patterns and propose
 * harness parameter changes. This is the "coding agent" from Meta-Harness,
 * but implemented as a deterministic diagnostic engine for Phase C.
 *
 * Phase C+ will replace this with an LLM-based proposer that reads
 * raw trace files via filesystem tools.
 */
export class ProposerAgent {
  /**
   * Analyzes recent traces and proposes a new harness configuration.
   * Returns null if no clear improvement direction is identified.
   */
  async propose(ctx: ProposerContext): Promise<HarnessProposal | null> {
    const traces = await traceLogger.readTraces();
    if (traces.length < 10) return null; // Need minimum signal

    const patterns = this.detectPatterns(traces);
    const highSeverity = patterns.filter(p => p.severity === 'high');
    const mediumSeverity = patterns.filter(p => p.severity === 'medium');

    // Prioritize high-severity patterns
    const targetPattern = highSeverity[0] ?? mediumSeverity[0];
    if (!targetPattern) return null;

    const deltas = this.generateDeltas(targetPattern, traces);
    if (!deltas || Object.keys(deltas).length === 0) return null;

    return {
      id: uuidv4(),
      iteration: ctx.iteration,
      runId: ctx.runId,
      ts: new Date().toISOString(),
      deltas,
      rationale: this.buildRationale(targetPattern, deltas),
      targetsFailureModes: [targetPattern.type],
    };
  }

  private detectPatterns(traces: RetrievalTrace[]): TracePattern[] {
    const patterns: TracePattern[] = [];
    const recent = traces.slice(0, 50); // Most recent 50 traces

    // Pattern: High correction rate — too many false positives
    const corrections = recent.filter(t => t.outcome === 'correction');
    if (corrections.length / recent.length > 0.15) {
      patterns.push({
        type: 'outcome_degradation',
        description: `${corrections.length}/${recent.length} traces marked as correction — retrieval is surfacing irrelevant items`,
        evidence: {
          traceIds: corrections.slice(0, 10).map(t => t.id),
          metric: 'correctionRate',
          value: corrections.length / recent.length,
          threshold: 0.15,
        },
        severity: 'high',
      });
    }

    // Pattern: Low average score on active items — min score threshold too low
    const avgActiveScore = recent.reduce(
      (sum, t) => sum + (t.active.reduce((s: number, a) => s + (a.score || 0), 0) / Math.max(t.active.length, 1)), 0
    ) / Math.max(recent.length, 1);
    if (avgActiveScore < 0.55) {
      patterns.push({
        type: 'low_score_noise',
        description: `Average active item score is ${avgActiveScore.toFixed(2)} — min score threshold may be too permissive`,
        evidence: {
          traceIds: recent.slice(0, 5).map(t => t.id),
          metric: 'avgActiveScore',
          value: avgActiveScore,
          threshold: 0.55,
        },
        severity: 'medium',
      });
    }

    // Pattern: High suppression rate — too many items being filtered
    const avgSuppressionRatio = recent.reduce(
      (sum, t) => {
        const total = t.active.length + t.suppressed.length;
        return sum + (total > 0 ? t.suppressed.length / total : 0);
      }, 0
    ) / Math.max(recent.length, 1);
    if (avgSuppressionRatio > 0.60) {
      patterns.push({
        type: 'high_suppression',
        description: `${(avgSuppressionRatio * 100).toFixed(0)}% of retrieved items are suppressed — retrieval is over-fetching`,
        evidence: {
          traceIds: recent.slice(0, 5).map(t => t.id),
          metric: 'suppressionRatio',
          value: avgSuppressionRatio,
          threshold: 0.60,
        },
        severity: 'medium',
      });
    }

    // Pattern: Token overspend — consistently near budget limit
    const avgBudgetUtil = recent.reduce(
      (sum, t) => sum + (t.promptTokens?.total || 0) / Math.max(t.promptTokens?.budget || 1, 1), 0
    ) / Math.max(recent.length, 1);
    if (avgBudgetUtil > 0.90) {
      patterns.push({
        type: 'token_overspend',
        description: `Average budget utilization is ${(avgBudgetUtil * 100).toFixed(0)}% — context is too full, risking truncation`,
        evidence: {
          traceIds: recent.slice(0, 5).map(t => t.id),
          metric: 'budgetUtilization',
          value: avgBudgetUtil,
          threshold: 0.90,
        },
        severity: 'high',
      });
    }

    // Pattern: Duplicate retrieval — same items appearing across traces
    const itemFreq = new Map<string, number>();
    recent.forEach(t => {
      const seen = new Set<string>();
      t.active?.forEach((a) => { if (!seen.has(a.id)) { itemFreq.set(a.id, (itemFreq.get(a.id) || 0) + 1); seen.add(a.id); } });
    });
    const repeatedItems = [...itemFreq.entries()].filter(([, count]) => count > recent.length * 0.5);
    if (repeatedItems.length > 3) {
      patterns.push({
        type: 'duplicate_retrieval',
        description: `${repeatedItems.length} items appear in >50% of traces — retrieval lacks diversity`,
        evidence: {
          traceIds: recent.slice(0, 5).map(t => t.id),
          metric: 'repeatedItemCount',
          value: repeatedItems.length,
          threshold: 3,
        },
        severity: 'medium',
      });
    }

    return patterns;
  }

  private generateDeltas(pattern: TracePattern, traces: any[]): HarnessProposal['deltas'] | null {
    const snapshot = getHarnessSnapshot();

    switch (pattern.type) {
      case 'outcome_degradation':
      case 'low_score_noise':
        // Raise the minimum score threshold to filter out noise
        return {
          MIN_SCORE_STANDARD_CONTEXT: Math.min(0.80, snapshot.MIN_SCORE_STANDARD + 0.05),
          DEDUP_SIMILARITY_THRESHOLD: Math.min(0.97, snapshot.DEDUP_SIMILARITY_THRESHOLD + 0.02),
        };

      case 'high_suppression':
        // Reduce retrieval count to avoid over-fetching
        return {
          RETRIEVAL_COUNT_DEFAULT: Math.max(3, snapshot.RETRIEVAL_COUNT_DEFAULT - 2),
          RETRIEVAL_COUNT_MASSIVE: Math.max(5, snapshot.RETRIEVAL_COUNT_MASSIVE - 3),
        };

      case 'token_overspend':
        // Aggressively reduce retrieval to save tokens
        return {
          RETRIEVAL_COUNT_DEFAULT: Math.max(3, snapshot.RETRIEVAL_COUNT_DEFAULT - 3),
          RETRIEVAL_COUNT_MASSIVE: Math.max(5, snapshot.RETRIEVAL_COUNT_MASSIVE - 5),
          MIN_SCORE_STANDARD_CONTEXT: Math.min(0.80, snapshot.MIN_SCORE_STANDARD + 0.05),
        };

      case 'duplicate_retrieval':
        // Increase dedup threshold to catch more near-duplicates
        return {
          DEDUP_SIMILARITY_THRESHOLD: Math.min(0.97, snapshot.DEDUP_SIMILARITY_THRESHOLD + 0.03),
        };

      default:
        return null;
    }
  }

  private buildRationale(pattern: TracePattern, deltas: HarnessProposal['deltas']): string {
    const deltaDescriptions = Object.entries(deltas).map(
      ([key, val]) => `${key} → ${val}`
    ).join(', ');

    return `Detected ${pattern.type}: ${pattern.description}. Proposed changes: ${deltaDescriptions}.`;
  }
}

export const proposerAgent = new ProposerAgent();
