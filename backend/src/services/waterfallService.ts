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
import type {
  PlannerOutput,
  ExecutorOutput,
  ReviewerOutput,
  WaterfallContext,
  WaterfallProgressData,
  WaterfallResult as TypedWaterfallResult,
  OpenFileContext,
  FileChange,
  ExecutionError,
  ReviewIssue,
  PlannedTask
} from '../types/waterfall';
import type { WaterfallPausedResult as TypedWaterfallPausedResult } from '../types/waterfall';
import { logger } from '../utils/logger';

/**
 * Threaded context ledger passed through every waterfall step.
 * Each step reads prior decisions and appends its own so later agents
 * are never operating in a vacuum.
 */
interface WaterfallSessionContext {
  originalRequirement: string;
  plannerDecisions: string;
}

export enum WaterfallStep {
  PLANNER = 'planner',
  EXECUTOR = 'executor',
  REVIEWER = 'reviewer'
}

export interface WaterfallProgressEvent {
  phase: string;
  data?: WaterfallProgressData;
  message?: string;
  estimate?: ResourceEstimate;
  score?: number;
  attempts?: number;
}

export interface WaterfallResult extends TypedWaterfallResult {}

export interface WaterfallPausedResult extends TypedWaterfallPausedResult {}

export class WaterfallService {

  /** Rough token estimate for messages (1 token ≈ 4 chars). */
  private estimateTokens(messages: { role: string; content: string }[]): number {
    return Math.ceil(messages.reduce((sum, m) => sum + m.content.length, 0) / 4);
  }

  /** Check if an error is a 429 rate-limit response. */
  private is429(error: unknown): boolean {
    const err = error as Record<string, any>;
    return err?.response?.status === 429
      || err?.status === 429
      || /status code 429|rate.?limit/i.test(err?.message ?? '');
  }

  /** Call provider.complete with retry-on-429. Parses Retry-After / "try again in Xs" from error. */
  private async completeWithRetry(
    provider: unknown,
    prompt: string | Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
    options: Record<string, unknown>,
    { maxRetries = 3, baseDelay = 15_000, label = 'unknown', signal }: { maxRetries?: number; baseDelay?: number; label?: string; signal?: AbortSignal } = {},
  ): Promise<string> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await (provider as any).complete(prompt, { ...options, signal });
      } catch (error: unknown) {
        if (signal?.aborted) throw error;
        if (!this.is429(error) || attempt === maxRetries) throw error;

        // Try to extract wait time from error message (e.g. "try again in 29.8575s")
        const retryMatch = (error?.response?.data?.error?.message ?? error?.message ?? '')
          .match(/try again in ([\d.]+)s/i);
        const delay = retryMatch
          ? Math.ceil(parseFloat(retryMatch[1]) * 1000) + 2000  // parsed + 2s buffer
          : baseDelay * (attempt + 1);

        logger.info(`[Waterfall:${label}] 429 rate-limited, retrying`, { delay: (delay / 1000).toFixed(1), attempt: attempt + 1, maxRetries });
        await new Promise(r => setTimeout(r, delay));
      }
    }
    throw new Error('Unreachable');
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

  async runStep(step: WaterfallStep, input: string, context?: WaterfallContext, globalProvider: string = 'auto', signal?: AbortSignal) {
    if (signal?.aborted) throw new SolventError('Waterfall cancelled by user.', SolventErrorCode.OPERATION_CANCELLED);
    
    switch (step) {
      case WaterfallStep.PLANNER:
        return this.runPlanner(input, globalProvider, signal);
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
    openFiles?: OpenFileContext[],
    signal?: AbortSignal,
    forceProceed: boolean = false,
    resumePlanner?: PlannerOutput | null,
    modelSelection: WaterfallModelSelection = WATERFALL_DEFAULT_SELECTION,
    apiKeys?: Record<string, string>
  ): AsyncGenerator<WaterfallProgressEvent, TypedWaterfallResult, void> {
    
    let fullPrompt = notepadContent 
      ? `MISSION CONTEXT / NOTES:
${notepadContent}

USER REQUEST:
${prompt}`
      : prompt;

    if (openFiles && openFiles.length > 0) {
      const filesContext = openFiles.map((f: OpenFileContext) => `FILE: ${f.path}

${f.content}

`).join('\n\n');
      fullPrompt = `[OPEN FILES CONTEXT]:
${filesContext}

${fullPrompt}`;
    }

    if (signal?.aborted) throw new SolventError('Waterfall cancelled by user.', SolventErrorCode.OPERATION_CANCELLED);

    const sessionContext: WaterfallSessionContext = {
      originalRequirement: fullPrompt,
      plannerDecisions: ''
    };

    let planner: PlannerOutput | null = null;
    if (resumePlanner) {
      planner = resumePlanner;
      sessionContext.plannerDecisions = this.extractPlannerDecisions(planner);
      yield { phase: 'planning', message: 'Resuming from previous plan...' };
    } else {
      yield { phase: 'planning', message: 'Analyzing requirements and building execution plan...' };
      planner = await this.runPlannerWithContext(fullPrompt, globalProvider, signal, modelSelection, apiKeys);
      sessionContext.plannerDecisions = this.extractPlannerDecisions(planner);
    }

    const plannerHandoff: StageHandoff = {
      stage: 'planner',
      confidence: planner.complexity === 'low' ? 0.9 : planner.complexity === 'medium' ? 0.75 : 0.6,
      keyDecisions: planner.keyDecisions || [],
      constraints: planner.assumptions || [],
      openQuestions: planner.openQuestions || [],
      tokenCount: JSON.stringify(planner).length / 4
    };

    // --- RESOURCE GOVERNANCE GATE ---
    const estimate = ResourceEstimator.estimate(planner.complexity || 'medium', fullPrompt.length);
    if (!forceProceed && estimate.riskLevel === 'critical') {
        yield {
            phase: 'gated',
            message: 'High resource usage detected. User confirmation required.',
            estimate
        };
        return { status: 'paused', estimate, planner } as WaterfallPausedResult;
    }
    // --------------------------------

    if (signal?.aborted) throw new SolventError('Waterfall cancelled by user.', SolventErrorCode.OPERATION_CANCELLED);

    yield { phase: 'executing', message: 'Generating production-ready code...' };
    let executor = await this.runExecutorWithContext(planner, sessionContext, plannerHandoff, undefined, signal, modelSelection, apiKeys);

    if (signal?.aborted) throw new SolventError('Waterfall cancelled by user.', SolventErrorCode.OPERATION_CANCELLED);

    yield { phase: 'reviewing', message: 'Auditing the full decision chain...', attempts: 1 };
    let reviewer = await this.runReviewWithContext(planner, executor, sessionContext, signal, modelSelection, apiKeys);

    logger.debug('[Waterfall:Reviewer] Review results', {
      score: reviewer.score ?? 'MISSING',
      compilationPassed: reviewer._compilationPassed ?? 'N/A',
      compilationStatus: reviewer.compilationStatus ?? 'N/A',
      breakdown: reviewer.breakdown ?? {},
      issueCount: (reviewer.issues || []).length,
      issues: (reviewer.issues || []).slice(0, 3)
    });
    if (reviewer.raw) {
      logger.debug('[Waterfall:Reviewer] RAW PARSE FAIL', { rawFirst500: typeof reviewer.raw === 'string' ? reviewer.raw.substring(0, 500) : 'non-string raw' });
    }

    let reviewerHandoff: StageHandoff = {
      stage: 'reviewer',
      confidence: (reviewer.score ?? 0) / 100,
      keyDecisions: plannerHandoff.keyDecisions,
      constraints: plannerHandoff.constraints,
      openQuestions: [],
      tokenCount: JSON.stringify(reviewer).length / 4
    };

    let attempts = 0;
    const history = [{ executor, reviewer }];
    const decisionLog: string[] = [];

    // Decay threshold: 80 → 72 → 65 so borderline scores don't loop forever
    const passThreshold = () => Math.max(65, 80 - (attempts * 8));
    const needsRetry = () => (reviewer.score ?? 0) < passThreshold() || reviewer._compilationPassed === false;

    while (needsRetry() && attempts < maxRetries) {
      if (signal?.aborted) throw new SolventError('Waterfall cancelled by user.', SolventErrorCode.OPERATION_CANCELLED);
      attempts++;

      const issues = Array.isArray(reviewer.issues) ? reviewer.issues : ['Review failed — please regenerate with higher quality'];

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

      executor = await this.runExecutorWithContext(planner, sessionContext, plannerHandoff, feedback, signal, modelSelection, apiKeys);

      decisionLog.push(`Attempt ${attempts}: addressed ${criticalIssues.length} critical + ${majorIssues.length} major issues (score was ${reviewer.score})`);

      yield { phase: 'reviewing', message: 'Reviewing refined code...', attempts: attempts + 1 };
      reviewer = await this.runReviewWithContext(planner, executor, sessionContext, signal, modelSelection, apiKeys);

      history.push({ executor, reviewer });

      reviewerHandoff = {
        stage: 'reviewer',
        confidence: (reviewer.score ?? 0) / 100,
        keyDecisions: plannerHandoff.keyDecisions,
        constraints: plannerHandoff.constraints,
        openQuestions: [],
        tokenCount: JSON.stringify(reviewer).length / 4
      };
    }

    yield { phase: 'completed', score: reviewer.score, data: { reviewer, attempts: attempts + 1, handoffChain: [plannerHandoff, reviewerHandoff] } };

    return {
      planner,
      executor,
      reviewer,
      attempts: attempts + 1,
      history: history.length > 1 ? history : undefined,
      handoffChain: [plannerHandoff, reviewerHandoff]
    };
  }

  // Wrapper for backward compatibility (AIController consumes this)
  // We will refactor AIController next to use the generator directly for streaming
  async runAgenticWaterfall(prompt: string, globalProvider: string = 'auto', maxRetries: number = 2, onProgress?: (phase: string, data?: WaterfallProgressData) => void, notepadContent?: string, openFiles?: OpenFileContext[], signal?: AbortSignal, forceProceed: boolean = false, resumePlanner?: PlannerOutput | null, modelSelection?: WaterfallModelSelection, apiKeys?: Record<string, string>) {
    const generator = this.runAgenticWaterfallGenerator(prompt, globalProvider, maxRetries, notepadContent, openFiles, signal, forceProceed, resumePlanner, modelSelection || WATERFALL_DEFAULT_SELECTION, apiKeys);
    
    while (true) {
      const { value, done } = await generator.next();
      if (done) {
        return value as WaterfallResult;
      }
      onProgress?.(value.phase, value.data || { message: value.message, estimate: value.estimate, score: value.score });
    }
  }

  // --- Context-Aware Step Methods (used by the agentic generator) ---

  private extractPlannerDecisions(planner: PlannerOutput | Record<string, unknown> | null): string {
    if (!planner) return 'No structured decisions extracted.';

    let data = planner;
    if (planner.raw && typeof planner.raw === 'string') {
      try {
        data = JSON.parse(planner.raw);
      } catch {
        return planner.raw.substring(0, 800);
      }
    } else if (planner.raw === null || planner.raw === undefined) {
      return 'No structured decisions extracted.';
    }

    const parts: string[] = [];
    if (data.keyDecisions?.length) parts.push(`Key Decisions: ${data.keyDecisions.join('; ')}`);
    if (data.techStack?.length) parts.push(`Tech Stack: ${data.techStack.join(', ')}`);
    if (data.assumptions?.length) parts.push(`Assumptions: ${data.assumptions.join('; ')}`);
    if (data.complexity) parts.push(`Complexity: ${data.complexity}`);
    if (data.plan) parts.push(`Plan Summary: ${String(data.plan).substring(0, 300)}`);
    if (data.openQuestions?.length) parts.push(`Open Questions: ${data.openQuestions.join('; ')}`);
    return parts.length > 0 ? parts.join('\n') : JSON.stringify(data).substring(0, 500);
  }

  private async runPlannerWithContext(userPrompt: string, globalProvider: string, signal?: AbortSignal, modelSelection: WaterfallModelSelection = WATERFALL_DEFAULT_SELECTION, apiKeys?: Record<string, string>) {
    const phase = this.resolvePhase(WATERFALL_CONFIG.PHASE_1_PLANNER!, modelSelection.planner);
    const providerName = globalProvider === 'local' ? 'ollama' : phase.primary.provider;
    const provider = await AIProviderFactory.getProvider(providerName);

    const prompt = [{
      role: 'user' as const,
      content: `You are the AI Systems Lead on a senior engineering team. You are Step 1 (Planner) of a 3-step pipeline: [YOU] → Executor → Reviewer. Your job is NOT to write code. Your job is to analyze requirements, make architectural decisions, and produce an ordered execution plan that the Executor will implement directly.

CRITICAL RULES:
1. The Executor and Reviewer will read your output and build on it. State your key decisions and assumptions explicitly — any ambiguity you leave here compounds across subsequent steps.
2. Every keyDecision MUST include a specific "X over Y because Z" justification. Vague decisions are useless to the Executor.
3. Respond with ONLY the JSON object. No markdown fences, no preamble.

ARCHITECTURE REQUIREMENTS:
4. The "steps" array must be ordered by dependency — Executor implements top-to-bottom.
5. Each step MUST be SELF-CONTAINED: file path, every class/interface with constructor params and method signatures, algorithm details, data flow, edge case handling. The Executor should not need to re-derive anything.
6. For each file, describe EVERY public export: classes, functions, types with full signatures.
7. Reproduce key algorithms/logic in step descriptions (pseudocode or code).
8. Address EDGE CASES explicitly: failure modes, concurrency, invalid input at system boundaries.

DEPTH REQUIREMENTS — Your output quality directly determines the final score:
9. You must produce at LEAST 6 keyDecisions covering algorithm selection, data structure choice, error handling strategy, module boundaries, dependency choices, API surface design. Non-trivial tasks: 8-12 decisions.
10. You must produce at LEAST 4 assumptions about runtime, existing code, dependencies, or deployment environment.

REQUIREMENTS:
${userPrompt}

Output a JSON object with this exact shape:
{
  "plan": "One-paragraph summary — what is being built, files, technologies, pattern",
  "steps": [{"title": "Action title", "description": "SELF-CONTAINED spec: file path, classes/functions/types with signatures, algorithm details, behavior, connections."}],
  "keyDecisions": ["'X over Y because Z' — minimum 6"],
  "assumptions": ["Environment/dependency assumptions — minimum 4"],
  "complexity": "low|medium|high",
  "techStack": ["Specific packages with versions"],
  "openQuestions": ["Max 2-3 items the Executor must decide locally"]
}

Example keyDecision: "Redis sorted sets over in-memory Map because horizontal scaling requires shared state"
Example assumption: "Express 4.x with TypeScript strict mode enabled"
Example step: {"title": "Rate limiter module", "description": "FILE: src/rateLimiter.ts — class RateLimiter(redis: Redis, config: Config). Method check(key: string): Promise<Result> — sliding window via Lua ZREMRANGEBYSCORE+ZCARD+ZADD. On failure: return {allowed: true} (fail-open). On Redis disconnect: log warning, degrade to in-memory counter."}
`
    }];

    const inputTokens = this.estimateTokens(prompt);
    const plannerMaxTokens = 6144;

    try {
      const response = await this.completeWithRetry(provider, prompt, {
        model: phase.primary.model,
        shouldSearch: false,
        jsonMode: true,
        maxTokens: capMaxTokens(phase.primary.model, inputTokens, plannerMaxTokens),
        apiKey: apiKeys?.[phase.primary.provider],
      }, { label: 'Planner', signal });
      return this.parseJSONResponse(response);
    } catch (error: unknown) {
      if (signal?.aborted) throw error;
      const fbProvider = await AIProviderFactory.getProvider(phase.fallback.provider);
      try {
        const res = await this.completeWithRetry(fbProvider, prompt, { model: phase.fallback.model, jsonMode: true, maxTokens: capMaxTokens(phase.fallback.model, inputTokens, plannerMaxTokens), apiKey: apiKeys?.[phase.fallback.provider] }, { label: 'Planner-FB', signal });
        return this.parseJSONResponse(res);
      } catch (e: unknown) {
        if (signal?.aborted) throw e;
        const localProvider = await AIProviderFactory.getProvider('ollama');
        const res = await localProvider.complete(prompt, { model: phase.local, jsonMode: true, maxTokens: capMaxTokens(phase.local, inputTokens, plannerMaxTokens), signal, apiKey: apiKeys?.ollama });
        return this.parseJSONResponse(res);
      }
    }
  }

  private async runExecutorWithContext(planData: ExecutorOutput | Record<string, unknown>, sessionContext: WaterfallSessionContext, plannerHandoff: StageHandoff, feedback?: string, signal?: AbortSignal, modelSelection: WaterfallModelSelection = WATERFALL_DEFAULT_SELECTION, apiKeys?: Record<string, string>) {
    const phase = this.resolvePhase(WATERFALL_CONFIG.PHASE_2_EXECUTOR!, modelSelection.executor);
    const planStr = typeof planData === 'string' ? planData : JSON.stringify(planData);

    const handoffContext = `
UPSTREAM HANDOFF (from Planner):
- Planner Confidence: ${plannerHandoff.confidence}
- Key Decisions (MUST honor): ${plannerHandoff.keyDecisions.map((d, i) => `\n  ${i + 1}. ${d}`).join('')}
- Constraints: ${plannerHandoff.constraints.join(', ')}
- Open Questions: ${plannerHandoff.openQuestions.join(', ')}`;

    let prompt = `You are Step 2 (Executor) in a 3-step pipeline: Planner → [YOU] → Reviewer.

Implement the Planner's steps faithfully. The key decisions below were made deliberately by the Planner.

RULES:
1. Code MUST be COMPLETE and COMPILABLE — every function body implemented, every import present. Truncated or placeholder code scores 0.
2. Do NOT second-guess architectural choices. If you must deviate, document it in decisionsOverridden.
3. Implement EVERY step from the plan. Missing steps lose 10 points each.
4. Use file-separator comments (e.g. "// ═══ src/foo.ts ═══") to delimit files in the code string.
5. Respond with ONLY the JSON object. No markdown fences, no preamble.

${handoffContext}

═══ EXECUTION PLAN (from Planner) ═══
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
  "decisionsOverridden": ["Deviations from key decisions with justification — empty array if none"]
}`;

    const messages = [{ role: 'user' as const, content: prompt }];
    const inputTokens = this.estimateTokens(messages);
    const executorMaxTokens = 16384;

    try {
      const primaryProvider = await AIProviderFactory.getProvider(phase.primary.provider);
      const response = await this.completeWithRetry(primaryProvider, messages, { model: phase.primary.model, jsonMode: true, maxTokens: capMaxTokens(phase.primary.model, inputTokens, executorMaxTokens), apiKey: apiKeys?.[phase.primary.provider] }, { label: 'Executor', signal });
      return this.parseJSONResponse(response);
    } catch (error: unknown) {
      if (signal?.aborted) throw error;
      const fbProvider = await AIProviderFactory.getProvider(phase.fallback.provider);
      try {
        const res = await this.completeWithRetry(fbProvider, messages, { model: phase.fallback.model, jsonMode: true, maxTokens: capMaxTokens(phase.fallback.model, inputTokens, executorMaxTokens), apiKey: apiKeys?.[phase.fallback.provider] }, { label: 'Executor-FB', signal });
        return this.parseJSONResponse(res);
      } catch (err: unknown) {
        if (signal?.aborted) throw err;
        const localProvider = await AIProviderFactory.getProvider('ollama');
        const res = await localProvider.complete(messages, { model: phase.local, jsonMode: true, maxTokens: capMaxTokens(phase.local, inputTokens, executorMaxTokens), signal, apiKey: apiKeys?.ollama });
        return this.parseJSONResponse(res);
      }
    }
  }

  private async runReviewWithContext(plan: PlannerOutput | Record<string, unknown>, executorData: ExecutorOutput | Record<string, unknown>, sessionContext: WaterfallSessionContext, signal?: AbortSignal, modelSelection: WaterfallModelSelection = WATERFALL_DEFAULT_SELECTION, apiKeys?: Record<string, string>) {
    const phase = this.resolvePhase(WATERFALL_CONFIG.PHASE_3_REVIEWER!, modelSelection.reviewer);

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

        const check = await toolService.executeTool('run_shell', { command: `npx tsc --noEmit --project ${tempDir}/tsconfig.json` });
        if (check.stderr) {
          // Filter out "Cannot find module" errors — expected since temp dir has no node_modules
          const lines = check.stderr.split('\n');
          const realErrors = lines.filter((l: string) =>
            l.includes('error TS') &&
            !l.includes('TS2307') &&  // Cannot find module
            !l.includes('TS2304') &&  // Cannot find name (global types like NodeJS, Buffer)
            !l.includes('TS2305') &&  // Module has no exported member (partial type info)
            !l.includes('TS7016')     // Could not find declaration file
          );
          if (realErrors.length > 0) {
            compilationStatus = `Type Error: ${realErrors.join('\n')}`;
            compilationPassed = false;
          } else {
            const moduleErrors = lines.filter((l: string) => l.includes('TS2307') || l.includes('TS2304') || l.includes('TS2305') || l.includes('TS7016')).length;
            compilationStatus = `Syntax Validated (tsc --noEmit, ${fileBlocks.length} files${moduleErrors > 0 ? `, ${moduleErrors} import-only errors ignored` : ''})`;
          }
        } else {
          compilationStatus = `Syntax Validated (tsc --noEmit, ${fileBlocks.length} files)`;
        }
      } catch (e: unknown) {
        // tsc exits with code 1 on type errors — extract stderr and filter
        const err = e as Record<string, unknown>;
        const errOutput = err.stderr || err.stdout || (err as Error).message || '';
        logger.debug('[Waterfall:TSC] Caught error, filtering', { errOutput: errOutput.substring(0, 500) });
        const lines = errOutput.split('\n');
        const realErrors = lines.filter((l: string) =>
          l.includes('error TS') &&
          !l.includes('TS2307') &&  // Cannot find module
          !l.includes('TS2304') &&  // Cannot find name
          !l.includes('TS2305') &&  // Module has no exported member
          !l.includes('TS7016')     // Could not find declaration file
        );
        if (realErrors.length > 0) {
          compilationStatus = `Type Error: ${realErrors.slice(0, 5).join('\n')}`;
          compilationPassed = false;
        } else {
          // Only import/module resolution errors — code structure is fine
          const moduleErrors = lines.filter((l: string) => l.includes('TS2307') || l.includes('TS2304') || l.includes('TS2305') || l.includes('TS7016')).length;
          compilationStatus = moduleErrors > 0
            ? `Syntax Validated (${moduleErrors} import-only errors ignored — no node_modules in sandbox)`
            : 'Syntax Validated';
        }
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
      }
    }

    // Extract only the code and files list from executor — skip redundant explanation/decisions
    const executorCode = executorData.code || '';
    const executorFiles = Array.isArray(executorData.files) ? executorData.files.join(', ') : '';

    // Extract key decisions from planner for compliance checking
    const keyDecisions = Array.isArray(plan.keyDecisions)
      ? plan.keyDecisions.map((d: string, i: number) => `  ${i + 1}. ${d}`).join('\n')
      : sessionContext.plannerDecisions;

    const prompt = [{
      role: 'user' as const,
      content: `You are Step 3 (Reviewer) in a 3-step pipeline: Planner → Executor → [YOU].

Audit whether the code implements the key decisions and is correct, secure, and efficient.

RULES:
1. Be HONEST. Score 95+ = near-perfect (rare). Most real code scores 70-90.
2. Every issue MUST cite exact code — quote the function/line and explain the fix. No vague claims.
3. Before claiming something is MISSING, search the code for it. False claims invalidate your review.
4. Check every key decision — missed decision = compliance deduction.
5. Truncated code or placeholders = syntax score 0, compliance halved.
6. Respond with ONLY the JSON object. No markdown fences, no preamble.

SCORING: 90-100 production-ready | 75-89 minor issues | 50-74 significant bugs | 25-49 broken | 0-24 no usable code

═══ REQUIREMENT ═══
${sessionContext.originalRequirement.substring(0, 400)}

═══ KEY DECISIONS (check each one) ═══
${keyDecisions}

═══ CODE ═══
Files: ${executorFiles}

${executorCode}

═══ COMPILATION ═══
${compilationStatus}

RUBRIC (100 pts): Compliance (40) — missed decision -5, missing step -10. Security (20). Efficiency (20). Syntax (20).

Output JSON:
{
  "score": <0-100>,
  "breakdown": { "compliance": <0-40>, "security": <0-20>, "efficiency": <0-20>, "syntax": <0-20> },
  "issues": ["Actionable: 'Function X has bug Y — fix by doing Z'"],
  "decisionsHonored": ["Each key decision and whether it was implemented"],
  "summary": "One-paragraph verdict — lead with most critical finding",
  "compilationStatus": "${compilationStatus}",
  "crystallizable_insight": "If score > 90: reusable pattern. Otherwise null."
}`
    }];

    const inputTokens = this.estimateTokens(prompt);
    const reviewerMaxTokens = 16384;

    try {
      const primaryProvider = await AIProviderFactory.getProvider(phase.primary.provider);
      const response = await this.completeWithRetry(primaryProvider, prompt, { model: phase.primary.model, jsonMode: true, maxTokens: capMaxTokens(phase.primary.model, inputTokens, reviewerMaxTokens), apiKey: apiKeys?.[phase.primary.provider] }, { label: 'Reviewer', signal });
      const parsed = this.parseJSONResponse(response);
      parsed._compilationPassed = compilationPassed;

      if (parsed.score > 90 && parsed.crystallizable_insight) {
        try {
          await toolService.executeTool('crystallize_memory', {
            content: parsed.crystallizable_insight,
            type: 'solution_pattern',
            tags: ['waterfall_success', 'high_fidelity_code']
          });
          logger.info('[Waterfall] Crystallized success pattern', { pattern: parsed.crystallizable_insight });
        } catch (e: unknown) {
          logger.error('[Waterfall] Failed to crystallize memory', { error: e });
        }
      }

      return parsed;
    } catch (error: unknown) {
      const err = error as Error;
      logger.error(`[Waterfall:Reviewer] Primary (${phase.primary.provider}/${phase.primary.model}) failed`, { message: err.message });
      if (signal?.aborted) throw error;
      const fbProvider = await AIProviderFactory.getProvider(phase.fallback.provider);
      try {
        const res = await this.completeWithRetry(fbProvider, prompt, { model: phase.fallback.model, jsonMode: true, maxTokens: capMaxTokens(phase.fallback.model, inputTokens, reviewerMaxTokens), apiKey: apiKeys?.[phase.fallback.provider] }, { label: 'Reviewer-FB', signal });
        const parsed = this.parseJSONResponse(res);
        parsed._compilationPassed = compilationPassed;
        return parsed;
      } catch (e: unknown) {
        const err2 = e as Error;
        logger.error(`[Waterfall:Reviewer] Fallback (${phase.fallback.provider}/${phase.fallback.model}) failed`, { message: err2.message });
        if (signal?.aborted) throw e;
        const localProvider = await AIProviderFactory.getProvider('ollama');
        const res = await localProvider.complete(prompt, { model: phase.local, jsonMode: true, maxTokens: capMaxTokens(phase.local, inputTokens, reviewerMaxTokens), signal, apiKey: apiKeys?.ollama });
        const parsed = this.parseJSONResponse(res);
        parsed._compilationPassed = compilationPassed;
        return parsed;
      }
    }
  }

  // --- Legacy step methods (used by runStep for manual execution, default to OPTION_A) ---

  private async runPlanner(userPrompt: string, globalProvider: string, signal?: AbortSignal) {
    return this.runPlannerWithContext(userPrompt, globalProvider, signal);
  }

  private async runExecutor(planData: ExecutorOutput | Record<string, unknown>, feedback?: string, signal?: AbortSignal) {
    const sessionContext: WaterfallSessionContext = { originalRequirement: '', plannerDecisions: '' };
    const defaultHandoff: StageHandoff = { stage: 'planner', confidence: 0.75, keyDecisions: [], constraints: [], openQuestions: [], tokenCount: 0 };
    return this.runExecutorWithContext(planData, sessionContext, defaultHandoff, feedback, signal);
  }

  private async runReview(plan: PlannerOutput | Record<string, unknown>, executorData: ExecutorOutput | Record<string, unknown>, signal?: AbortSignal) {
    const sessionContext: WaterfallSessionContext = { originalRequirement: '', plannerDecisions: '' };
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

  private parseJSONResponse(response: string): Record<string, unknown> {
    if (!response || typeof response !== 'string') {
      logger.warn('[WaterfallService] Empty or non-string response from provider', { responseType: typeof response });
      return { raw: null, _parseError: 'Provider returned empty or non-string response' };
    }

    let cleaned = response.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    cleaned = cleaned.replace(/```json/g, '').replace(/```/g, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    const jsonToParse = jsonMatch ? jsonMatch[0] : cleaned;

    // Attempt 1: direct parse
    try {
      return JSON.parse(jsonToParse);
    } catch (e1: unknown) {
      const err = e1 as Error;
      const pos = typeof err.message === 'string' && err.message.match(/position (\d+)/)?.[1];
      logger.warn('[WaterfallService] JSON parse failed', { position: pos ?? '?', length: jsonToParse.length, message: err.message });

      // Attempt 2: repair common LLM JSON issues
      try {
        let repaired = jsonToParse
          // Fix unescaped control characters inside string values
          .replace(/[\x00-\x1f]/g, (ch: string) => {
            if (ch === '\n') return '\\n';
            if (ch === '\r') return '\\r';
            if (ch === '\t') return '\\t';
            return '';
          })
          // Remove trailing commas before } or ]
          .replace(/,\s*([}\]])/g, '$1');
        return JSON.parse(repaired);
      } catch (e2) {
        // Attempt 3: truncation repair — close unclosed strings/brackets
        try {
          let truncated = jsonToParse;
          // If we're inside a string, close it
          const quoteCount = (truncated.match(/(?<!\\)"/g) || []).length;
          if (quoteCount % 2 !== 0) truncated += '"';
          // Close any open brackets/braces
          const opens = (truncated.match(/[\[{]/g) || []).length;
          const closes = (truncated.match(/[\]}]/g) || []).length;
          for (let i = 0; i < opens - closes; i++) {
            // Guess which closer is needed based on last unclosed opener
            const lastOpen = truncated.lastIndexOf('[') > truncated.lastIndexOf('{') ? ']' : '}';
            truncated += lastOpen;
          }
          const result = JSON.parse(truncated);
          logger.info('[WaterfallService] JSON truncation repair succeeded');
          return result;
        } catch (e3) {
          logger.warn('[WaterfallService] JSON repair also failed, returning raw', { rawLength: jsonToParse.substring(0, 300) });
          return { raw: response };
        }
      }
    }
  }
}
