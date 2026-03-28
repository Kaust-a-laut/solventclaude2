export type MemoryConfidence = 'HIGH' | 'MEDIUM' | 'LOW';
export type MemoryStatus = 'active' | 'flagged_for_review' | 'deprecated';
export type ImportanceScore = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export type SemanticLinkType = 'import' | 'implements' | 'calls' | 'depends_on' | 'references';

export interface SemanticLink {
  targetId: string;
  type: SemanticLinkType;
  description?: string;
}

export interface BaseMemory {
  id?: string;
  createdAt: string;
  tags: string[];
  confidence: MemoryConfidence;
  source: 'chat' | 'waterfall' | 'supervisor' | 'user_override';
  status?: MemoryStatus;
  deprecatedBy?: string;
  links?: SemanticLink[];
}

export interface CrystallizedRule extends BaseMemory {
  type: 'permanent_rule';
  ruleText: string;
  context: string; // The situation where this rule applies
  enforcementLevel: 'strict' | 'suggestion';
}

export interface SuccessPattern extends BaseMemory {
  type: 'solution_pattern';
  problemDomain: string;
  solutionCode: string; // The "Secret Sauce" snippet
  effectivenessScore: number; // 0-100
}

export interface SupervisoryInsight extends BaseMemory {
  type: 'architectural_decision';
  decision: string;
  rationale: string;
  impactedModules: string[];
}

export interface UserPreference extends BaseMemory {
  type: 'user_preference';
  preference: string;
  value: string | boolean | number;
}

export type CrystallizedMemory = CrystallizedRule | SuccessPattern | SupervisoryInsight | UserPreference;

export interface StageHandoff {
  stage: 'architect' | 'reasoner' | 'executor' | 'reviewer';
  confidence: number;
  keyDecisions: string[];
  constraints: string[];
  openQuestions: string[];
  tokenCount: number;
}
