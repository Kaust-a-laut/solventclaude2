/**
 * A single proposed harness configuration.
 * Each field is a delta from the current harness constants.
 */
export interface HarnessProposal {
  id: string;
  iteration: number;
  runId: string;
  ts: string;
  deltas: Partial<{
    MIN_SCORE_STANDARD_CONTEXT: number;
    MIN_SCORE_MASSIVE_CONTEXT: number;
    RETRIEVAL_COUNT_DEFAULT: number;
    RETRIEVAL_COUNT_MASSIVE: number;
    RETRIEVAL_COUNT_CONSTRAINED: number;
    DEDUP_SIMILARITY_THRESHOLD: number;
    SCORE_BOOST_UNIVERSAL: number;
    SCORE_BOOST_KEYWORD_MATCH: number;
    SCORE_BOOST_TAG_MATCH: number;
    SCORE_BOOST_PER_RETRIEVAL: number;
    SCORE_BOOST_PER_IMPORTANCE: number;
    SCORE_PENALTY_STALE_CODE: number;
  }>;
  rationale: string;
  targetsFailureModes: string[];
}

/** Evaluation result for a single proposed config */
export interface EvaluationResult {
  proposalId: string;
  runId: string;
  ts: string;
  searchSetSize: number;
  acceptanceRate: number;
  correctionRate: number;
  avgActiveItems: number;
  avgSuppressedItems: number;
  avgPromptTokens: number;
  avgPipelineMs: number;
  byMode: Record<string, { count: number; acceptanceRate: number; avgTokens: number }>;
  isParetoOptimal: boolean;
  traceIds: string[];
}

/** Full optimization run state */
export interface OptimizationRun {
  id: string;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'cancelled' | 'failed';
  ts: string;
  config: {
    maxIterations: number;
    candidatesPerIteration: number;
    searchSetQuery?: string;
    minTraceCount: number;
  };
  iterations: number;
  proposals: HarnessProposal[];
  evaluations: EvaluationResult[];
  paretoFrontier: string[];
  error?: string;
}

/** A diagnostic pattern the proposer identifies in traces */
export interface TracePattern {
  type: 'low_score_noise' | 'high_suppression' | 'token_overspend' | 'mode_mismatch' | 'duplicate_retrieval' | 'stale_code_leak' | 'outcome_degradation';
  description: string;
  evidence: { traceIds: string[]; metric: string; value: number; threshold: number };
  severity: 'low' | 'medium' | 'high';
}
