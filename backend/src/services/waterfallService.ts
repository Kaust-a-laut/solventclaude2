import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { randomUUID } from 'node:crypto';
import { AIProviderFactory } from './aiProviderFactory';
import { WATERFALL_CONFIG, WATERFALL_DEFAULT_SELECTION, capMaxTokens } from '../constants/models';
import type { WaterfallModelSelection, WaterfallPhaseConfig, WaterfallPhaseSelection } from '../constants/models';
import { AppError } from '../utils/AppError';
import { ResourceEstimator, ResourceEstimate } from '../utils/resourceEstimator';
import { SolventError, SolventErrorCode } from '../utils/errors';
import { toolService } from './toolService';
import type { StageHandoff } from '../types/memory';

/**
 * Threaded context ledger passed through every waterfall step.
 * Each step reads prior decisions and appends its own so later agents
 * are never operating in a vacuum.
 */
interface WaterfallSessionContext {
  originalRequirement: string;
  architectDecisions: string;  // plain-English summary extracted after architect step
  reasonerDecisions: string;   // plain-English summary extracted after reasoner step
}

export enum WaterfallStep {
  ARCHITECT = 'architect',
  REASONER = 'reasoner',
  EXECUTOR = 'executor',
  REVIEWER = 'reviewer'
}

export interface WaterfallProgressEvent {
  phase: string;
  data?: any;
  message?: string;
  estimate?: ResourceEstimate;
  score?: number;
  attempts?: number;
}

export interface WaterfallResult {
  architect: any;
  reasoner: any;
  executor: any;
  reviewer: any;
  attempts: number;
  history?: any[];
  status?: string;
  estimate?: ResourceEstimate;
  handoffChain?: StageHandoff[];
}

export class WaterfallService {

  /** Rough token estimate for messages (1 token ≈ 4 chars). */
  private estimateTokens(messages: { role: string; content: string }[]): number {
    return Math.ceil(messages.reduce((sum, m) => sum + m.content.length, 0) / 4);
  }

  /** Resolve primary + fallback model/provider from the user's A/B selection or custom override for a phase. */
  private resolvePhase(phaseCfg: WaterfallPhaseConfig, choice: WaterfallPhaseSelection) {
    // Custom model override — use it as primary, fall back to OPTION_B
    if (typeof choice === 'object') {
      return {
        primary: { model: choice.model, provider: choice.provider, label: choice.model, score: 'custom' },
        fallback: phaseCfg.OPTION_B,
        local: phaseCfg.LOCAL
      };
    }
    const primary  = choice === 'A' ? phaseCfg.OPTION_A : phaseCfg.OPTION_B;
    const fallback = choice === 'A' ? phaseCfg.OPTION_B : phaseCfg.OPTION_A;
    return { primary, fallback, local: phaseCfg.LOCAL };
  }

  async runStep(step: WaterfallStep, input: string, context?: any, globalProvider: string = 'auto', signal?: AbortSignal) {
    if (signal?.aborted) throw new SolventError('Waterfall cancelled by user.', SolventErrorCode.OPERATION_CANCELLED);
    
    switch (step) {
      case WaterfallStep.ARCHITECT:
        return this.runArchitect(input, globalProvider, signal);
      case WaterfallStep.REASONER:
        return this.runReasoner(input, signal);
      case WaterfallStep.EXECUTOR:
        return this.runExecutor(input, context?.feedback, signal);
      case WaterfallStep.REVIEWER:
        if (!context?.plan) throw new SolventError('Reviewer requires the plan context.', SolventErrorCode.VALIDATION_ERROR);
        return this.runReview(context.plan, input, signal);
      default:
        throw new SolventError(`Unknown waterfall step: ${step}`, SolventErrorCode.VALIDATION_ERROR);
    }
  }

  async *runAgenticWaterfallGenerator(
    prompt: string,
    globalProvider: string = 'auto',
    maxRetries: number = 2,
    notepadContent?: string,
    openFiles?: any[],
    signal?: AbortSignal,
    forceProceed: boolean = false,
    resumeArchitect?: any,  // pre-computed architect result from a paused run
    modelSelection: WaterfallModelSelection = WATERFALL_DEFAULT_SELECTION
  ): AsyncGenerator<WaterfallProgressEvent, WaterfallResult, void> {
    
    let fullPrompt = notepadContent 
      ? `MISSION CONTEXT / NOTES:
${notepadContent}

USER REQUEST:
${prompt}`
      : prompt;

    if (openFiles && openFiles.length > 0) {
      const filesContext = openFiles.map((f: any) => `FILE: ${f.path}

${f.content}

`).join('\n\n');
      fullPrompt = `[OPEN FILES CONTEXT]:
${filesContext}

${fullPrompt}`;
    }

    if (signal?.aborted) throw new SolventError('Waterfall cancelled by user.', SolventErrorCode.OPERATION_CANCELLED);

    // Initialize the session context ledger — threads through all 4 steps so each
    // agent knows what the agents before it decided and why.
    const sessionContext: WaterfallSessionContext = {
      originalRequirement: fullPrompt,
      architectDecisions: '',
      reasonerDecisions: ''
    };

    let architect: any;
    if (resumeArchitect) {
      // Resume from a previously gated run — reuse the architect result to avoid re-running the step
      architect = resumeArchitect;
      sessionContext.architectDecisions = this.extractArchitectDecisions(architect);
      yield { phase: 'architecting', message: 'Resuming from previous analysis...' };
    } else {
      yield { phase: 'architecting', message: 'Analyzing project requirements...' };
      architect = await this.runArchitectWithContext(fullPrompt, globalProvider, signal, modelSelection);
      sessionContext.architectDecisions = this.extractArchitectDecisions(architect);
    }

    const architectHandoff: StageHandoff = {
      stage: 'architect',
      confidence: architect.complexity === 'low' ? 0.9 : architect.complexity === 'medium' ? 0.75 : 0.6,
      keyDecisions: architect.keyDecisions || [],
      constraints: architect.assumptions || [],
      openQuestions: [],
      tokenCount: JSON.stringify(architect).length / 4
    };

    // --- RESOURCE GOVERNANCE GATE ---
    const estimate = ResourceEstimator.estimate(architect.complexity || 'medium', fullPrompt.length);
    if (!forceProceed && estimate.riskLevel === 'critical') {
        yield {
            phase: 'gated',
            message: 'High resource usage detected. User confirmation required.',
            estimate
        };
        // Generator ends here. Caller resumes by passing forceProceed=true and resumeArchitect=architect.
        return { status: 'paused', estimate, architect } as any;
    }
    // --------------------------------

    if (signal?.aborted) throw new SolventError('Waterfall cancelled by user.', SolventErrorCode.OPERATION_CANCELLED);

    yield { phase: 'reasoning', message: 'Formulating technical implementation plan...' };
    const reasoner = await this.runReasonerWithContext(architect, sessionContext, architectHandoff, signal, modelSelection);
    sessionContext.reasonerDecisions = this.extractReasonerDecisions(reasoner);

    const reasonerHandoff: StageHandoff = {
      stage: 'reasoner',
      confidence: (reasoner.steps?.length || 0) >= 3 ? 0.85 : 0.65,
      keyDecisions: [...architectHandoff.keyDecisions, ...(reasoner.carriedDecisions || [])],
      constraints: architectHandoff.constraints,
      openQuestions: reasoner.openQuestions || [],
      tokenCount: JSON.stringify(reasoner).length / 4
    };

    if (signal?.aborted) throw new SolventError('Waterfall cancelled by user.', SolventErrorCode.OPERATION_CANCELLED);

    yield { phase: 'executing', message: 'Generating production-ready code...' };
    let executor = await this.runExecutorWithContext(reasoner, sessionContext, reasonerHandoff, undefined, signal, modelSelection);

    if (signal?.aborted) throw new SolventError('Waterfall cancelled by user.', SolventErrorCode.OPERATION_CANCELLED);

    yield { phase: 'reviewing', message: 'Principal Engineer is auditing the full decision chain...', attempts: 1 };
    let reviewer = await this.runReviewWithContext(reasoner, executor, sessionContext, signal, modelSelection);

    let reviewerHandoff: StageHandoff = {
      stage: 'reviewer',
      confidence: (reviewer.score ?? 0) / 100,
      keyDecisions: reasonerHandoff.keyDecisions,
      constraints: reasonerHandoff.constraints,
      openQuestions: [],
      tokenCount: JSON.stringify(reviewer).length / 4
    };

    let attempts = 0;
    const history = [{ executor, reviewer }];
    const decisionLog: string[] = [];

    // Hard gate: compilation failure forces retry regardless of score
    const needsRetry = () => (reviewer.score ?? 0) < 80 || reviewer._compilationPassed === false;

    while (needsRetry() && attempts < maxRetries) {
      if (signal?.aborted) throw new SolventError('Waterfall cancelled by user.', SolventErrorCode.OPERATION_CANCELLED);
      attempts++;

      const issues = Array.isArray(reviewer.issues) ? reviewer.issues : ['Review failed — please regenerate with higher quality'];

      // Inject compilation failure as a critical issue if not already captured by the reviewer
      if (reviewer._compilationPassed === false && reviewer.compilationStatus) {
        const alreadyCaptured = issues.some((i: string) => /compil/i.test(i));
        if (!alreadyCaptured) {
          issues.unshift(`COMPILATION FAILED: ${reviewer.compilationStatus}. Code must compile cleanly before it can be accepted.`);
        }
      }

      const criticalIssues = issues.filter((i: string) => /compil|error|crash|security|inject/i.test(i));
      const majorIssues = issues.filter((i: string) => !criticalIssues.includes(i) && /missing|wrong|incorrect|broken/i.test(i));
      const minorIssues = issues.filter((i: string) => !criticalIssues.includes(i) && !majorIssues.includes(i));

      const feedbackParts: string[] = [
        `Previous attempt scored ${reviewer.score ?? 0}/100.`,
        `Attempt ${attempts} of ${maxRetries}.`
      ];

      if (criticalIssues.length > 0) {
        feedbackParts.push(`\nCRITICAL (must fix):\n${criticalIssues.map((i: string) => `  - ${i}`).join('\n')}`);
      }
      if (majorIssues.length > 0) {
        feedbackParts.push(`\nMAJOR (should fix):\n${majorIssues.map((i: string) => `  - ${i}`).join('\n')}`);
      }
      if (minorIssues.length > 0) {
        feedbackParts.push(`\nMINOR (nice to fix):\n${minorIssues.map((i: string) => `  - ${i}`).join('\n')}`);
      }

      if (decisionLog.length > 0) {
        feedbackParts.push(`\nPREVIOUS FIXES (do NOT revert these):\n${decisionLog.map((d, i) => `  ${i + 1}. ${d}`).join('\n')}`);
      }

      const feedback = feedbackParts.join('\n');

      const compilNote = reviewer._compilationPassed === false ? ' (compilation failed)' : '';
      yield {
        phase: 'retrying',
        message: `Score ${reviewer.score}/100${compilNote}. ${criticalIssues.length} critical, ${majorIssues.length} major issues. Attempt ${attempts}...`,
        data: { issues: reviewer.issues, reviewer, attempt: attempts, criticalCount: criticalIssues.length, majorCount: majorIssues.length, compilationPassed: reviewer._compilationPassed }
      };

      executor = await this.runExecutorWithContext(reasoner, sessionContext, reasonerHandoff, feedback, signal, modelSelection);

      decisionLog.push(`Attempt ${attempts}: addressed ${criticalIssues.length} critical + ${majorIssues.length} major issues (score was ${reviewer.score})`);

      yield { phase: 'reviewing', message: 'Reviewing refined code...', attempts: attempts + 1 };
      reviewer = await this.runReviewWithContext(reasoner, executor, sessionContext, signal, modelSelection);

      history.push({ executor, reviewer });

      reviewerHandoff = {
        stage: 'reviewer',
        confidence: (reviewer.score ?? 0) / 100,
        keyDecisions: reasonerHandoff.keyDecisions,
        constraints: reasonerHandoff.constraints,
        openQuestions: [],
        tokenCount: JSON.stringify(reviewer).length / 4
      };
    }

    yield { phase: 'completed', score: reviewer.score, data: { reviewer, attempts: attempts + 1, handoffChain: [architectHandoff, reasonerHandoff, reviewerHandoff] } };
    
    return {
      architect,
      reasoner,
      executor,
      reviewer,
      attempts: attempts + 1,
      history: history.length > 1 ? history : undefined,
      handoffChain: [architectHandoff, reasonerHandoff, reviewerHandoff]
    };
  }

  // Wrapper for backward compatibility (AIController consumes this)
  // We will refactor AIController next to use the generator directly for streaming
  async runAgenticWaterfall(prompt: string, globalProvider: string = 'auto', maxRetries: number = 2, onProgress?: (phase: string, data?: any) => void, notepadContent?: string, openFiles?: any[], signal?: AbortSignal, forceProceed: boolean = false, resumeArchitect?: any, modelSelection?: WaterfallModelSelection) {
    const generator = this.runAgenticWaterfallGenerator(prompt, globalProvider, maxRetries, notepadContent, openFiles, signal, forceProceed, resumeArchitect, modelSelection || WATERFALL_DEFAULT_SELECTION);
    
    while (true) {
      const { value, done } = await generator.next();
      if (done) {
        return value as WaterfallResult;
      }
      onProgress?.(value.phase, value.data || { message: value.message, estimate: value.estimate, score: value.score });
    }
  }

  // --- Context-Aware Step Methods (used by the agentic generator) ---

  private extractArchitectDecisions(architect: any): string {
    if (!architect) return 'No structured decisions extracted.';

    // If parsing failed and we got {raw: "..."}, try to re-parse the raw string
    let data = architect;
    if (architect.raw && typeof architect.raw === 'string') {
      try {
        data = JSON.parse(architect.raw);
      } catch {
        // Raw string isn't valid JSON — use it as-is for context
        return architect.raw.substring(0, 800);
      }
    } else if (architect.raw === null || architect.raw === undefined) {
      return 'No structured decisions extracted.';
    }

    const parts: string[] = [];
    if (data.keyDecisions?.length) parts.push(`Key Decisions: ${data.keyDecisions.join('; ')}`);
    if (data.techStack?.length) parts.push(`Tech Stack: ${data.techStack.join(', ')}`);
    if (data.assumptions?.length) parts.push(`Assumptions: ${data.assumptions.join('; ')}`);
    if (data.complexity) parts.push(`Complexity: ${data.complexity}`);
    return parts.length > 0 ? parts.join('\n') : JSON.stringify(data).substring(0, 500);
  }

  private extractReasonerDecisions(reasoner: any): string {
    if (!reasoner) return 'No structured decisions extracted.';

    let data = reasoner;
    if (reasoner.raw && typeof reasoner.raw === 'string') {
      try {
        data = JSON.parse(reasoner.raw);
      } catch {
        return reasoner.raw.substring(0, 800);
      }
    } else if (reasoner.raw === null || reasoner.raw === undefined) {
      return 'No structured decisions extracted.';
    }

    const parts: string[] = [];
    if (data.carriedDecisions?.length) parts.push(`Carried Decisions: ${data.carriedDecisions.join('; ')}`);
    if (data.openQuestions?.length) parts.push(`Open Questions for Executor: ${data.openQuestions.join('; ')}`);
    if (data.plan) parts.push(`Plan Summary: ${String(data.plan).substring(0, 300)}`);
    return parts.length > 0 ? parts.join('\n') : JSON.stringify(data).substring(0, 500);
  }

  private async runArchitectWithContext(userPrompt: string, globalProvider: string, signal?: AbortSignal, modelSelection: WaterfallModelSelection = WATERFALL_DEFAULT_SELECTION) {
    const phase = this.resolvePhase(WATERFALL_CONFIG.PHASE_1_ARCHITECT!, modelSelection.architect);
    const providerName = globalProvider === 'local' ? 'ollama' : phase.primary.provider;
    const provider = await AIProviderFactory.getProvider(providerName);

    const prompt = [{
      role: 'user' as const,
      content: `You are the AI Systems Lead on a senior engineering team. You are Step 1 of a 4-step pipeline: Architect → Reasoner → Executor → Reviewer. Your job is NOT to write code. Your job is to analyze requirements and produce a precise implementation blueprint that the next three agents will execute against.

CRITICAL RULES:
1. The next 3 agents will read your output and build on it. State your key decisions and assumptions explicitly — they will carry them forward. Any ambiguity you leave here compounds across all subsequent steps.
2. Every keyDecision MUST include a specific "X over Y because Z" justification. Vague decisions like "use appropriate technology" are useless to downstream agents.
3. The logic field must name specific interfaces, classes, methods, and data flow — not abstract descriptions. The Executor will implement exactly what you describe.
4. Respond with ONLY the JSON object. No markdown fences, no preamble, no explanation outside the JSON.

DEPTH REQUIREMENTS — Your output quality directly determines the final score:
5. The "logic" field must be structured as NUMBERED SECTIONS — one per file or major component. For each section, specify: (a) the file path, (b) every class/interface with constructor parameters and method signatures, (c) how it connects to other components. Think of this as a spec document the Executor follows line by line.
6. You must produce at LEAST 6 keyDecisions. Every architectural choice is a decision — algorithm selection, data structure choice, error handling strategy, module boundaries, dependency choices, API surface design. If your task is non-trivial, 8-12 decisions is expected.
7. You must produce at LEAST 4 assumptions. If you're assuming anything about the runtime, existing code, available dependencies, or deployment environment, state it.
8. Address EDGE CASES explicitly in the logic field: what happens on failure, what happens under concurrency, what happens with invalid input at system boundaries. The Executor will not invent error handling you didn't specify.

REQUIREMENTS:
${userPrompt}

Output a JSON object with this exact shape:
{
  "logic": "NUMBERED SECTIONS, one per file/component. Each section: file path, classes with constructor params and method signatures, data flow, edge case handling.",
  "assumptions": ["Environment/dependency assumptions — minimum 4"],
  "keyDecisions": ["'X over Y because Z' — minimum 6, covering algorithm, data structure, error strategy, module boundary, dependency, API surface"],
  "complexity": "low|medium|high",
  "techStack": ["Specific packages with versions"]
}

Example keyDecision: "Redis sorted sets over in-memory Map because horizontal scaling requires shared state"
Example assumption: "Express 4.x with TypeScript strict mode enabled"
Example logic section: "1. FILE: src/rateLimiter.ts — class RateLimiter(redis: Redis, config: Config). Method check(key: string): Promise<Result> — sliding window via Lua ZREMRANGEBYSCORE+ZCARD+ZADD. 2. FILE: src/server.ts — register middleware before route mounts."
`
    }];

    const inputTokens = this.estimateTokens(prompt);
    const architectMaxTokens = 4096;

    try {
      const response = await provider.complete(prompt, {
        model: phase.primary.model,
        shouldSearch: false,
        jsonMode: true,
        maxTokens: capMaxTokens(phase.primary.model, inputTokens, architectMaxTokens),
        signal
      });
      return this.parseJSONResponse(response);
    } catch (error: any) {
      if (signal?.aborted) throw error;
      const fbProvider = await AIProviderFactory.getProvider(phase.fallback.provider);
      try {
        const res = await fbProvider.complete(prompt, { model: phase.fallback.model, jsonMode: true, maxTokens: capMaxTokens(phase.fallback.model, inputTokens, architectMaxTokens), signal });
        return this.parseJSONResponse(res);
      } catch (e) {
        if (signal?.aborted) throw e;
        const localProvider = await AIProviderFactory.getProvider('ollama');
        const res = await localProvider.complete(prompt, { model: phase.local, jsonMode: true, maxTokens: capMaxTokens(phase.local, inputTokens, architectMaxTokens), signal });
        return this.parseJSONResponse(res);
      }
    }
  }

  private async runReasonerWithContext(logicData: any, sessionContext: WaterfallSessionContext, architectHandoff: StageHandoff, signal?: AbortSignal, modelSelection: WaterfallModelSelection = WATERFALL_DEFAULT_SELECTION) {
    const phase = this.resolvePhase(WATERFALL_CONFIG.PHASE_2_REASONER!, modelSelection.reasoner);
    console.log(`[Waterfall] Reasoner resolved: primary=${phase.primary.model} (${phase.primary.provider}), fallback=${phase.fallback.model} (${phase.fallback.provider})`);
    const primaryProvider = await AIProviderFactory.getProvider(phase.primary.provider);
    const logicStr = typeof logicData === 'string' ? logicData : JSON.stringify(logicData);

    const handoffContext = `
UPSTREAM HANDOFF (from Architect):
- Confidence: ${architectHandoff.confidence}
- Key Decisions (MUST carry forward): ${architectHandoff.keyDecisions.map((d, i) => `\n  ${i + 1}. ${d}`).join('')}
- Constraints: ${architectHandoff.constraints.join(', ')}`;

    const prompt = `You are the Technical Architect on a senior engineering team. You are Step 2 of a 4-step pipeline: Architect → [YOU: Reasoner] → Executor → Reviewer.

The Architect (Step 1) has completed their analysis. You must read their decisions carefully and produce a detailed execution plan that the Senior Developer (Step 3) will implement directly.

CRITICAL RULES:
1. Every step MUST include specific file paths, class names, method signatures, or shell commands. Vague steps like "implement the logic" are useless to the Executor.
2. Copy forward ALL key decisions from the Architect into carriedDecisions — verbatim, word for word. The Executor relies on this list — if you drop a decision, it gets lost. Count the Architect's keyDecisions and verify your carriedDecisions has the SAME count.
3. Order steps by dependency — the Executor will implement them top-to-bottom in sequence.
4. Respond with ONLY the JSON object. No markdown fences, no preamble, no explanation outside the JSON.

DEPTH REQUIREMENTS — The Executor implements your plan as a literal spec:
5. Each step description must be SELF-CONTAINED — it should contain enough detail that the Executor can implement it without referring back to the Architect output. Include constructor parameters, method signatures with types, key algorithm details, and expected behavior.
6. For any step that creates a file, describe EVERY public export from that file: classes with constructor params, functions with signatures, types/interfaces with their fields. The Executor should not need to invent any API surface you didn't specify.
7. If the Architect specified Lua scripts, algorithms, or non-trivial logic, reproduce the KEY PARTS in your step description (pseudocode or actual code). The Executor should not need to re-derive algorithms.
8. You must produce at LEAST one step per file the Architect described. If the Architect described 8 files, you need at least 8 steps (plus any setup/test steps).

═══ ORIGINAL REQUIREMENT (for reference) ═══
${sessionContext.originalRequirement.substring(0, 400)}

${handoffContext}

═══ ARCHITECT OUTPUT ═══
${logicStr}

Translate the blueprint into an ordered execution plan. Carry forward every key decision verbatim. Flag open questions for the Executor.

Output JSON:
{
  "plan": "One-paragraph summary — what is being built, how many files, technologies, architecture pattern",
  "steps": [{"title": "Short action title", "description": "SELF-CONTAINED spec: file path, public classes/functions/types with signatures, algorithm details, expected behavior, connections to other components."}],
  "carriedDecisions": ["Every Architect key decision, copied VERBATIM — count must match"],
  "openQuestions": ["Max 2-3 items the Executor must decide locally"]
}

Example step: {"title": "Create RateLimiter class", "description": "src/middleware/rateLimiter.ts — export class RateLimiter(redis: Redis, config: Config). Method check(key: string): Promise<Result> uses Lua ZREMRANGEBYSCORE+ZCARD+ZADD. Fail-open on Redis errors per Architect decision."}
Example carriedDecision: "Redis sorted sets over in-memory Map because horizontal scaling requires shared state"`;

    const messages = [{ role: 'user' as const, content: prompt }];
    const inputTokens = this.estimateTokens(messages);
    const reasonerMaxTokens = 4096;

    try {
      const response = await primaryProvider.complete(messages, { model: phase.primary.model, jsonMode: true, maxTokens: capMaxTokens(phase.primary.model, inputTokens, reasonerMaxTokens), signal });
      return this.parseJSONResponse(response);
    } catch (error: any) {
      if (signal?.aborted) throw error;
      const fbProvider = await AIProviderFactory.getProvider(phase.fallback.provider);
      const fallback = await fbProvider.complete(messages, { model: phase.fallback.model, jsonMode: true, maxTokens: capMaxTokens(phase.fallback.model, inputTokens, reasonerMaxTokens), signal });
      return this.parseJSONResponse(fallback);
    }
  }

  private async runExecutorWithContext(planData: any, sessionContext: WaterfallSessionContext, reasonerHandoff: StageHandoff, feedback?: string, signal?: AbortSignal, modelSelection: WaterfallModelSelection = WATERFALL_DEFAULT_SELECTION) {
    const phase = this.resolvePhase(WATERFALL_CONFIG.PHASE_3_EXECUTOR!, modelSelection.executor);
    const planStr = typeof planData === 'string' ? planData : JSON.stringify(planData);

    const handoffContext = `
UPSTREAM HANDOFF:
- Architect Confidence: ${reasonerHandoff.confidence}
- Key Decisions (MUST carry forward): ${reasonerHandoff.keyDecisions.map((d, i) => `\n  ${i + 1}. ${d}`).join('')}
- Constraints: ${reasonerHandoff.constraints.join(', ')}
- Open Questions: ${reasonerHandoff.openQuestions.join(', ')}`;

    let prompt = `You are the Senior Developer on a senior engineering team. You are Step 3 of a 4-step pipeline: Architect → Reasoner → [YOU: Executor] → Reviewer.

Two senior engineers have already made explicit decisions about this task. You must implement their plan faithfully.

CRITICAL RULES:
1. Your code field MUST contain COMPLETE, COMPILABLE source code — every function body fully implemented, every import present. The Reviewer will check compilation. Truncated or placeholder code (e.g. "// ... implementation" or "// TODO") will score 0 on syntax.
2. Do NOT second-guess architectural choices — they were deliberate. If you must deviate, document it in decisionsOverridden with your justification.
3. Implement EVERY step from the Reasoner's plan. The Reviewer audits step-by-step compliance. Missing steps lose 10 points each from the compliance score.
4. The "code" field is a single string containing all source code. Use file-separator comments (e.g. "// ═══ src/foo.ts ═══") to delimit multiple files within the string.
5. Respond with ONLY the JSON object. No markdown fences, no preamble, no explanation outside the JSON.

${handoffContext}

═══ DECISION CHAIN ═══
[Architect] ${sessionContext.architectDecisions}
[Reasoner] ${sessionContext.reasonerDecisions}

═══ EXECUTION PLAN (from Reasoner) ═══
${planStr}`;

    if (feedback) {
      prompt += `

╔══════════════════════════════════════════╗
║  REVIEWER FEEDBACK — MUST BE ADDRESSED  ║
╚══════════════════════════════════════════╝
${feedback}

Every issue listed above must be explicitly fixed in this revision.`;
    }

    prompt += `

Output JSON:
{
  "code": "Complete, compilable source code. Use '// ═══ filename ═══' to separate files. No truncation, no '// ...' placeholders.",
  "explanation": "Brief summary of approach and non-obvious choices",
  "files": ["Files created or modified"],
  "decisionsOverridden": ["Deviations from carried decisions with justification — empty array if none"]
}`;

    const messages = [{ role: 'user' as const, content: prompt }];
    const inputTokens = this.estimateTokens(messages);
    const executorMaxTokens = 16384;

    try {
      const primaryProvider = await AIProviderFactory.getProvider(phase.primary.provider);
      const response = await primaryProvider.complete(messages, { model: phase.primary.model, jsonMode: true, maxTokens: capMaxTokens(phase.primary.model, inputTokens, executorMaxTokens), signal });
      return this.parseJSONResponse(response);
    } catch (error: any) {
      if (signal?.aborted) throw error;
      const fbProvider = await AIProviderFactory.getProvider(phase.fallback.provider);
      try {
        const res = await fbProvider.complete(messages, { model: phase.fallback.model, jsonMode: true, maxTokens: capMaxTokens(phase.fallback.model, inputTokens, executorMaxTokens), signal });
        return this.parseJSONResponse(res);
      } catch (err) {
        if (signal?.aborted) throw err;
        const localProvider = await AIProviderFactory.getProvider('ollama');
        const res = await localProvider.complete(messages, { model: phase.local, jsonMode: true, maxTokens: capMaxTokens(phase.local, inputTokens, executorMaxTokens), signal });
        return this.parseJSONResponse(res);
      }
    }
  }

  private async runReviewWithContext(plan: any, executorData: any, sessionContext: WaterfallSessionContext, signal?: AbortSignal, modelSelection: WaterfallModelSelection = WATERFALL_DEFAULT_SELECTION) {
    const phase = this.resolvePhase(WATERFALL_CONFIG.PHASE_4_REVIEWER!, modelSelection.reviewer);

    let compilationStatus = 'Not tested';
    let compilationPassed = true;
    if (executorData.code) {
      if (signal?.aborted) throw new SolventError('Waterfall cancelled by user.', SolventErrorCode.OPERATION_CANCELLED);

      // Split multi-file code blocks into separate temp files so cross-file
      // imports resolve correctly. Falls back to single-file for non-split code.
      const tempDir = path.join(os.tmpdir(), `solvent_review_${randomUUID()}`);

      try {
        await fs.mkdir(tempDir, { recursive: true });
        const fileBlocks = this.splitCodeBlocks(executorData.code);

        for (const block of fileBlocks) {
          const filePath = path.join(tempDir, block.filename);
          await fs.mkdir(path.dirname(filePath), { recursive: true });
          await fs.writeFile(filePath, block.code, 'utf-8');
        }

        // Minimal tsconfig for the temp directory
        await fs.writeFile(path.join(tempDir, 'tsconfig.json'), JSON.stringify({
          compilerOptions: {
            noEmit: true, strict: true, esModuleInterop: true, skipLibCheck: true,
            module: 'commonjs', target: 'ES2020', moduleResolution: 'node',
            resolveJsonModule: true, allowJs: true
          },
          include: ['**/*.ts']
        }), 'utf-8');

        const check = await toolService.executeTool('run_shell', { command: `cd ${tempDir} && npx tsc --noEmit` });
        if (check.stderr) {
          compilationStatus = `Type Error: ${check.stderr}`;
          compilationPassed = false;
        } else {
          compilationStatus = `Syntax Validated (tsc --noEmit, ${fileBlocks.length} files)`;
        }
      } catch (e: any) {
        compilationStatus = `Check Failed: ${e.message}`;
        compilationPassed = false;
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
      }
    }

    // Extract only the code and files list from executor — skip redundant explanation/decisions
    const executorCode = executorData.code || '';
    const executorFiles = Array.isArray(executorData.files) ? executorData.files.join(', ') : '';

    // Extract carried decisions from reasoner for compliance checking
    const carriedDecisions = Array.isArray(plan.carriedDecisions)
      ? plan.carriedDecisions.map((d: string, i: number) => `  ${i + 1}. ${d}`).join('\n')
      : sessionContext.reasonerDecisions;

    const prompt = [{
      role: 'user' as const,
      content: `You are the Principal Engineer reviewing Step 3 (Executor) output in a 4-step pipeline: Architect → Reasoner → Executor → [YOU].

Audit whether the code faithfully implements the decision chain AND is correct, secure, and efficient.

RULES:
1. Be HONEST. Score 95+ = near-perfect (rare). Most real code scores 70-90.
2. Every issue MUST cite the exact code. Quote the function name or line that is wrong and explain the fix. If you cannot point to specific code, the issue is not real — do NOT include it.
3. Before claiming something is MISSING, search the code for it. If the code contains try/catch, do not claim "no error handling." If it has a validation function, do not claim "no validation." False claims invalidate your review.
4. Check every carried decision — missed decision = compliance deduction.
5. Truncated code or "// ..." placeholders = syntax score 0, compliance halved.
6. Respond with ONLY the JSON object. No markdown fences, no preamble.

SCORING: 90-100 production-ready | 75-89 good with minor issues | 50-74 significant bugs | 25-49 fundamentally broken | 0-24 no usable code

═══ ORIGINAL REQUIREMENT ═══
${sessionContext.originalRequirement.substring(0, 400)}

═══ DECISION CHAIN ═══
[Architect] ${sessionContext.architectDecisions}
[Reasoner] ${sessionContext.reasonerDecisions}

═══ CARRIED DECISIONS (check each one) ═══
${carriedDecisions}

═══ IMPLEMENTED CODE ═══
Files: ${executorFiles}

${executorCode}

═══ COMPILATION CHECK ═══
${compilationStatus}

RUBRIC (100 pts): Compliance (40) — each missed decision -5, each missing step -10. Security (20) — secrets, injection, unsafe imports. Efficiency (20) — performance, idiom. Syntax (20) — compilation, imports, references.

Output JSON:
{
  "score": <0-100>,
  "breakdown": { "compliance": <0-40>, "security": <0-20>, "efficiency": <0-20>, "syntax": <0-20> },
  "issues": ["Actionable: 'Function X has bug Y — fix by doing Z'"],
  "decisionsHonored": ["Each carried decision and whether it was implemented"],
  "summary": "One-paragraph verdict — lead with most critical finding",
  "compilationStatus": "${compilationStatus}",
  "crystallizable_insight": "If score > 90: reusable pattern from this success. Otherwise null."
}`
    }];

    const inputTokens = this.estimateTokens(prompt);
    const reviewerMaxTokens = 4096;

    try {
      const primaryProvider = await AIProviderFactory.getProvider(phase.primary.provider);
      const response = await primaryProvider.complete(prompt, { model: phase.primary.model, jsonMode: true, maxTokens: capMaxTokens(phase.primary.model, inputTokens, reviewerMaxTokens), signal });
      const parsed = this.parseJSONResponse(response);
      parsed._compilationPassed = compilationPassed;

      if (parsed.score > 90 && parsed.crystallizable_insight) {
        try {
          await toolService.executeTool('crystallize_memory', {
            content: parsed.crystallizable_insight,
            type: 'solution_pattern',
            tags: ['waterfall_success', 'high_fidelity_code']
          });
          console.log(`[Waterfall] Crystallized success pattern: ${parsed.crystallizable_insight}`);
        } catch (e) {
          console.error('[Waterfall] Failed to crystallize memory:', e);
        }
      }

      return parsed;
    } catch (error: any) {
      console.error(`[Waterfall:Reviewer] Primary (${phase.primary.provider}/${phase.primary.model}) failed:`, error.message);
      if (signal?.aborted) throw error;
      const fbProvider = await AIProviderFactory.getProvider(phase.fallback.provider);
      try {
        const res = await fbProvider.complete(prompt, { model: phase.fallback.model, jsonMode: true, maxTokens: capMaxTokens(phase.fallback.model, inputTokens, reviewerMaxTokens), signal });
        const parsed = this.parseJSONResponse(res);
        parsed._compilationPassed = compilationPassed;
        return parsed;
      } catch (e: any) {
        console.error(`[Waterfall:Reviewer] Fallback (${phase.fallback.provider}/${phase.fallback.model}) failed:`, e.message);
        if (signal?.aborted) throw e;
        const localProvider = await AIProviderFactory.getProvider('ollama');
        const res = await localProvider.complete(prompt, { model: phase.local, jsonMode: true, maxTokens: capMaxTokens(phase.local, inputTokens, reviewerMaxTokens), signal });
        const parsed = this.parseJSONResponse(res);
        parsed._compilationPassed = compilationPassed;
        return parsed;
      }
    }
  }

  // --- Private Steps (Architect, Reasoner, etc.) ---
  // (These methods are largely unchanged but use SolventError now)

  // --- Legacy step methods (used by runStep for manual execution, default to OPTION_A) ---

  private async runArchitect(userPrompt: string, globalProvider: string, signal?: AbortSignal) {
    return this.runArchitectWithContext(userPrompt, globalProvider, signal);
  }

  private async runReasoner(logicData: any, signal?: AbortSignal) {
    const sessionContext: WaterfallSessionContext = { originalRequirement: '', architectDecisions: '', reasonerDecisions: '' };
    const defaultHandoff: StageHandoff = { stage: 'architect', confidence: 0.75, keyDecisions: [], constraints: [], openQuestions: [], tokenCount: 0 };
    return this.runReasonerWithContext(logicData, sessionContext, defaultHandoff, signal);
  }

  private async runExecutor(planData: any, feedback?: string, signal?: AbortSignal) {
    const sessionContext: WaterfallSessionContext = { originalRequirement: '', architectDecisions: '', reasonerDecisions: '' };
    const defaultHandoff: StageHandoff = { stage: 'reasoner', confidence: 0.75, keyDecisions: [], constraints: [], openQuestions: [], tokenCount: 0 };
    return this.runExecutorWithContext(planData, sessionContext, defaultHandoff, feedback, signal);
  }

  private async runReview(plan: any, executorData: any, signal?: AbortSignal) {
    const sessionContext: WaterfallSessionContext = { originalRequirement: '', architectDecisions: '', reasonerDecisions: '' };
    return this.runReviewWithContext(plan, executorData, sessionContext, signal);
  }

  /**
   * Split executor code output into individual file blocks.
   * Handles "// ═══ path/to/file.ts ═══" separator comments.
   * Falls back to a single file if no separators are found.
   */
  private splitCodeBlocks(code: string): { filename: string; code: string }[] {
    const lines = code.split('\n');
    const blocks: { filename: string; lines: string[] }[] = [];
    let current: { filename: string; lines: string[] } | null = null;
    const sepPattern = /^\/\/\s*═+\s*(.+?)\s*═+\s*$/;

    for (const line of lines) {
      const match = line.match(sepPattern);
      if (match) {
        if (current) blocks.push(current);
        current = { filename: match[1]!.trim(), lines: [] };
      } else if (current) {
        current.lines.push(line);
      }
    }
    if (current) blocks.push(current);

    if (blocks.length === 0) {
      return [{ filename: 'index.ts', code }];
    }

    return blocks.map(b => ({ filename: b.filename, code: b.lines.join('\n').trim() }));
  }

  private parseJSONResponse(response: string): any {
    if (!response || typeof response !== 'string') {
      console.warn('[WaterfallService] Empty or non-string response from provider:', typeof response);
      return { raw: null, _parseError: 'Provider returned empty or non-string response' };
    }

    try {
      let cleaned = response.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
      cleaned = cleaned.replace(/```json/g, '').replace(/```/g, '').trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      const jsonToParse = jsonMatch ? jsonMatch[0] : cleaned;
      return JSON.parse(jsonToParse);
    } catch (e) {
      console.warn('[WaterfallService] Failed to parse JSON response (length=%d):', response.length, response.substring(0, 200));
      return { raw: response };
    }
  }
}
