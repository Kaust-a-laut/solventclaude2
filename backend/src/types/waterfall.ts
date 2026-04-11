/**
 * Waterfall domain type definitions
 * 
 * These interfaces define the data contracts between waterfall stages
 * (planner → executor → reviewer) and replace `any` types throughout
 * waterfallService.ts.
 * 
 * NOTE: LLM outputs may contain additional fields beyond the core spec.
 * All interfaces extend Record<string, unknown> to accommodate this.
 */

// ============================================================================
// Planner Stage Types
// ============================================================================

export interface PlannedTask {
  id: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  dependencies: string[];
  estimatedEffort: number; // minutes
}

export interface PlannerOutput extends Record<string, unknown> {
  /** Normalized fields (reserved for future structured planners) */
  decisions?: string[];
  tasks?: PlannedTask[];
  estimatedRisk?: 'low' | 'medium' | 'high';
  reasoning?: string;
  // LLM planner returns these fields:
  keyDecisions?: string[];
  assumptions?: string[];
  complexity?: 'low' | 'medium' | 'high';
  techStack?: string[];
  openQuestions?: string[];
  plan?: string;
  steps?: Array<{ title: string; description: string }>;
  /** Set when JSON parse fails in parseJSONResponse */
  raw?: string | null;
}

// ============================================================================
// Executor Stage Types
// ============================================================================

export interface FileChange {
  path: string;
  operation: 'create' | 'modify' | 'delete';
  summary: string;
}

export interface ExecutionError {
  file?: string;
  message: string;
  recoverable: boolean;
}

export interface ExecutorOutput extends Record<string, unknown> {
  /** Normalized fields (reserved for future structured executors) */
  filesCreated?: FileChange[];
  filesModified?: FileChange[];
  filesDeleted?: string[];
  decisions?: string[];
  errors?: ExecutionError[];
  // LLM executor returns these fields:
  code?: string;
  explanation?: string;
  files?: string[];
  decisionsOverridden?: string[];
  raw?: string | null;
}

// ============================================================================
// Reviewer Stage Types
// ============================================================================

export interface ReviewIssue {
  severity: 'error' | 'warning' | 'info';
  file?: string;
  description: string;
  line?: number;
}

export interface ReviewerOutput extends Record<string, unknown> {
  approved: boolean;
  /** Structured issues (reserved for future use — current LLMs return string[]) */
  structuredIssues?: ReviewIssue[];
  /** Actionable issue strings as returned by the reviewer LLM */
  issues?: string[];
  suggestions?: string[];
  overallQuality?: number; // 0-100
  // LLM reviewer also returns these fields:
  score?: number;
  breakdown?: Record<string, number>;
  summary?: string;
  decisionsHonored?: string[];
  compilationStatus?: string;
  crystallizable_insight?: string | null;
  _compilationPassed?: boolean;
  raw?: string | null;
}

// ============================================================================
// Waterfall Session Context
// ============================================================================

export interface WaterfallContext {
  sessionId: string;
  plannerOutput: PlannerOutput | null;
  executorOutput: ExecutorOutput | null;
  reviewerOutput: ReviewerOutput | null;
  currentPhase: 'planning' | 'executing' | 'reviewing' | 'complete';
  errors: string[];
  startTime: number;
  /** Feedback string forwarded from reviewer to executor on retry */
  feedback?: string;
  /** Plan data forwarded from planner to reviewer (LLM JSON, not strictly typed) */
  plan?: PlannerOutput | Record<string, unknown>;
}

// ============================================================================
// Progress and Result Types
// ============================================================================

export interface WaterfallProgressData {
  tasks?: PlannedTask[];
  filesChanged?: FileChange[];
  errors?: ExecutionError[];
  reviewIssues?: string[];
  issues?: string[];
  attempt?: number;
  criticalCount?: number;
  majorCount?: number;
  compilationPassed?: boolean;
  reviewer?: Record<string, unknown>;
  /** Fields passed through by onProgress wrapper in runAgenticWaterfall */
  message?: string;
  estimate?: import('../utils/resourceEstimator').ResourceEstimate;
  score?: number;
  handoffChain?: import('./memory').StageHandoff[];
}

export interface WaterfallResult {
  planner: PlannerOutput | null;
  executor: ExecutorOutput | Record<string, unknown> | null;
  reviewer: ReviewerOutput | Record<string, unknown> | null;
  attempts: number;
  history?: Array<{ executor: ExecutorOutput | Record<string, unknown>; reviewer: ReviewerOutput | Record<string, unknown> }>;
  status?: string;
  estimate?: import('../utils/resourceEstimator').ResourceEstimate;
  handoffChain?: import('./memory').StageHandoff[];
}

export interface WaterfallPausedResult {
  status: 'paused';
  estimate?: import('../utils/resourceEstimator').ResourceEstimate;
  planner: PlannerOutput | null;
  executor: null;
  reviewer: null;
  attempts: number;
}

// ============================================================================
// Open File Context
// ============================================================================

export interface OpenFileContext {
  path: string;
  content: string;
  language?: string;
}
