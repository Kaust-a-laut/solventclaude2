import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { AIProviderFactory } from './aiProviderFactory';
import { WATERFALL_CONFIG, WATERFALL_DEFAULT_SELECTION } from '../constants/models';
import type { WaterfallModelSelection, WaterfallPhaseConfig, WaterfallPhaseSelection } from '../constants/models';
import { AppError } from '../utils/AppError';
import { ResourceEstimator, ResourceEstimate } from '../utils/resourceEstimator';
import { SolventError, SolventErrorCode } from '../utils/errors';
import { toolService } from './toolService';

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
}

export class WaterfallService {

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
    const reasoner = await this.runReasonerWithContext(architect, sessionContext, signal, modelSelection);
    sessionContext.reasonerDecisions = this.extractReasonerDecisions(reasoner);

    if (signal?.aborted) throw new SolventError('Waterfall cancelled by user.', SolventErrorCode.OPERATION_CANCELLED);

    yield { phase: 'executing', message: 'Generating production-ready code...' };
    let executor = await this.runExecutorWithContext(reasoner, sessionContext, undefined, signal, modelSelection);

    if (signal?.aborted) throw new SolventError('Waterfall cancelled by user.', SolventErrorCode.OPERATION_CANCELLED);

    yield { phase: 'reviewing', message: 'Principal Engineer is auditing the full decision chain...', attempts: 1 };
    let reviewer = await this.runReviewWithContext(reasoner, executor, sessionContext, signal, modelSelection);

    let attempts = 0;
    const history = [{ executor, reviewer }];

    while ((reviewer.score ?? 0) < 80 && attempts < maxRetries) {
      if (signal?.aborted) throw new SolventError('Waterfall cancelled by user.', SolventErrorCode.OPERATION_CANCELLED);
      attempts++;
      yield {
        phase: 'retrying',
        message: `Score ${reviewer.score}/100 too low. Refining code (Attempt ${attempts})...`,
        data: { issues: reviewer.issues, reviewer, attempt: attempts }
      };

      const issuesList = Array.isArray(reviewer.issues) ? reviewer.issues : ['Review failed — please regenerate with higher quality'];
      const feedback = `Previous attempt scored ${reviewer.score ?? 0}/100. Issues to address:\n${issuesList.map((issue: string) => `• ${issue}`).join('\n')}`;
      executor = await this.runExecutorWithContext(reasoner, sessionContext, feedback, signal, modelSelection);

      yield { phase: 'reviewing', message: 'Reviewing refined code...', attempts: attempts + 1 };
      reviewer = await this.runReviewWithContext(reasoner, executor, sessionContext, signal, modelSelection);

      history.push({ executor, reviewer });
    }

    yield { phase: 'completed', score: reviewer.score, data: { reviewer, attempts: attempts + 1 } };
    
    return {
      architect,
      reasoner,
      executor,
      reviewer,
      attempts: attempts + 1,
      history: history.length > 1 ? history : undefined
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
    const phase = this.resolvePhase(WATERFALL_CONFIG.PHASE_1_ARCHITECT, modelSelection.architect);
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
  "logic": "NUMBERED SECTIONS, one per file/component. Each section names the file path, every class with constructor params and method signatures (name, params, return type), data flow between components, and edge case handling. This is a spec — the Executor implements it verbatim.",
  "assumptions": ["Every assumption about the environment, existing code, or requirements — minimum 4 items"],
  "keyDecisions": ["Each decision as 'X over Y because Z' — minimum 6 items covering algorithm, data structure, error strategy, module boundary, dependency, and API surface choices"],
  "complexity": "low|medium|high",
  "techStack": ["Technologies, frameworks, and libraries — include specific packages with versions if known, not just categories"]
}

── Example output (for a different task: "Add rate-limiting middleware") ──
{
  "logic": "1. FILE STRUCTURE — Create src/middleware/rateLimiter.ts containing all rate limiting logic, plus registration in src/server.ts.\\n\\n2. TYPES AND INTERFACES — Define interface RateLimitResult { allowed: boolean; remaining: number; retryAfter: number } and interface RateLimiterConfig { windowMs: number; maxRequests: number; keyPrefix?: string }. Export both for consumer use.\\n\\n3. RATELIMITER CLASS (src/middleware/rateLimiter.ts) — export class RateLimiter with constructor(private redis: Redis, private config: RateLimiterConfig). Method async check(key: string): Promise<RateLimitResult> — implements sliding window via a Lua script that atomically calls ZREMRANGEBYSCORE to prune expired entries, ZCARD to count current, conditionally ZADD if under limit, and PEXPIRE to set TTL. The Lua script returns [allowed (0|1), count, oldestTimestamp]. Method builds RateLimitResult from the Lua return values.\\n\\n4. LUA SCRIPT — Store as const SLIDING_WINDOW_LUA at module scope. Script takes KEYS[1]=rateLimit key, ARGV[1]=now, ARGV[2]=windowMs, ARGV[3]=maxRequests, ARGV[4]=memberId. Prune: ZREMRANGEBYSCORE key 0 (now-windowMs). Count: ZCARD key. If count < max: ZADD key now memberId, PEXPIRE key windowMs. Return {1, max-count-1, 0}. Else: get oldest via ZRANGE key 0 0 WITHSCORES, compute retryAfter = oldest+windowMs-now. Return {0, 0, retryAfter}.\\n\\n5. MIDDLEWARE FACTORY — export function createRateLimiter(config: Partial<RateLimiterConfig>): RequestHandler. Reads RATE_LIMIT_WINDOW_MS and RATE_LIMIT_MAX from process.env with config overrides. Creates Redis connection via new Redis(process.env.REDIS_URL). Instantiates RateLimiter. Returns async (req, res, next) that calls limiter.check(req.ip), sets X-RateLimit-Remaining header, responds 429 with Retry-After header and JSON {error, retryAfter} on denial.\\n\\n6. ERROR HANDLING — If Redis is unreachable, the middleware MUST fail open (call next()) and log the error via winston. This prevents a Redis outage from taking down the API. The RateLimiter.check() method wraps the eval call in try/catch and returns {allowed: true, remaining: -1, retryAfter: 0} on Redis errors.\\n\\n7. REGISTRATION — In src/server.ts, import createRateLimiter and add app.use('/api/', createRateLimiter()) BEFORE route mounts. This ensures all API routes are rate-limited but static assets are not.",
  "assumptions": ["Redis 6+ already available as session store on REDIS_URL", "API gateway does not already handle rate limiting", "Express 4.x with TypeScript, strict mode enabled", "winston logger already configured in src/utils/logger.ts", "The application runs behind a reverse proxy, so req.ip is the real client IP (trust proxy is set)"],
  "keyDecisions": ["Redis sorted sets over in-memory Map because horizontal scaling across service instances requires shared state", "Lua script over MULTI/EXEC pipeline because Lua executes atomically on the Redis thread, eliminating TOCTOU between ZCARD check and ZADD insert", "Sliding window over fixed window because fixed windows allow burst-boundary abuse (2x burst at window edges)", "Middleware factory pattern over decorator to stay consistent with existing Express middleware chain in src/server.ts", "Fail-open on Redis errors over fail-closed because a Redis outage should not make the entire API unavailable", "req.ip over custom header extraction because Express trust proxy is already configured and handles X-Forwarded-For parsing"],
  "complexity": "medium",
  "techStack": ["Express.js 4.x", "ioredis 5.x (already in package.json)", "TypeScript 5.x (strict mode)", "Lua scripting (Redis EVAL)", "winston (existing logger)"]
}`
    }];

    // Architect needs more tokens with enhanced prompts — detailed logic field can be 3000+ tokens
    const architectMaxTokens = 4096;

    try {
      const response = await provider.complete(prompt, {
        model: phase.primary.model,
        shouldSearch: false,
        jsonMode: true,
        maxTokens: architectMaxTokens,
        signal
      });
      return this.parseJSONResponse(response);
    } catch (error: any) {
      if (signal?.aborted) throw error;
      const fbProvider = await AIProviderFactory.getProvider(phase.fallback.provider);
      try {
        const res = await fbProvider.complete(prompt, { model: phase.fallback.model, jsonMode: true, maxTokens: architectMaxTokens, signal });
        return this.parseJSONResponse(res);
      } catch (e) {
        if (signal?.aborted) throw e;
        const localProvider = await AIProviderFactory.getProvider('ollama');
        const res = await localProvider.complete(prompt, { model: phase.local, jsonMode: true, maxTokens: architectMaxTokens, signal });
        return this.parseJSONResponse(res);
      }
    }
  }

  private async runReasonerWithContext(logicData: any, sessionContext: WaterfallSessionContext, signal?: AbortSignal, modelSelection: WaterfallModelSelection = WATERFALL_DEFAULT_SELECTION) {
    const phase = this.resolvePhase(WATERFALL_CONFIG.PHASE_2_REASONER, modelSelection.reasoner);
    console.log(`[Waterfall] Reasoner resolved: primary=${phase.primary.model} (${phase.primary.provider}), fallback=${phase.fallback.model} (${phase.fallback.provider})`);
    const primaryProvider = await AIProviderFactory.getProvider(phase.primary.provider);
    const logicStr = typeof logicData === 'string' ? logicData : JSON.stringify(logicData);

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

═══ ORIGINAL REQUIREMENT ═══
${sessionContext.originalRequirement.substring(0, 1000)}

═══ ARCHITECT'S DECISIONS (Step 1 Output) ═══
${sessionContext.architectDecisions}

═══ FULL ARCHITECT OUTPUT ═══
${logicStr}

Your job: Translate the Architect's blueprint into a precise, ordered execution plan. Flag any open questions the Executor needs to resolve. Carry forward every key decision — the Executor should not need to re-derive anything you already know.

Output JSON:
{
  "plan": "One-paragraph summary of the full implementation — what is being built, how many files, which technologies, and the overall architecture pattern",
  "steps": [{"title": "Short action title", "description": "SELF-CONTAINED spec: file path, every public class/function/type with signatures, algorithm details or pseudocode for non-trivial logic, expected behavior, and how it connects to other components. The Executor reads this as the sole source of truth for this file."}],
  "carriedDecisions": ["Every key decision from the Architect, copied VERBATIM — do not paraphrase, do not drop any. Count must match the Architect's keyDecisions count."],
  "openQuestions": ["Anything the Executor must decide locally — keep this list short, max 2-3 items"]
}

── Example output (for a different task: "Add rate-limiting middleware") ──
{
  "plan": "Implement Redis-backed sliding-window rate limiter as Express middleware across 2 files (src/middleware/rateLimiter.ts, src/server.ts) using ioredis and a Lua script for atomic check-and-increment, with env-var configuration, 429 response with Retry-After header, fail-open error handling, and an integration test.",
  "steps": [
    {"title": "Install dependencies", "description": "npm install ioredis && npm install -D @types/ioredis — do NOT use express-rate-limit (Architect chose custom Lua implementation over the library for atomic Lua-based counting)"},
    {"title": "Create RateLimiter class and types", "description": "src/middleware/rateLimiter.ts — Define and export interface RateLimitResult { allowed: boolean; remaining: number; retryAfter: number }. Define and export interface RateLimiterConfig { windowMs: number; maxRequests: number; keyPrefix?: string }. Export class RateLimiter with constructor(private redis: Redis, private config: RateLimiterConfig). Method async check(key: string): Promise<RateLimitResult> — builds Redis key as config.keyPrefix + ':' + key, calls this.redis.eval(SLIDING_WINDOW_LUA, 1, redisKey, Date.now(), config.windowMs, config.maxRequests, uniqueMemberId). The Lua script (const at module scope): ZREMRANGEBYSCORE key 0 (now-windowMs) to prune, ZCARD key to count, if count < max then ZADD key now memberId and PEXPIRE key windowMs and return {1, max-count-1, 0}, else ZRANGE key 0 0 WITHSCORES to get oldest and return {0, 0, oldest+windowMs-now}. Wrap the eval call in try/catch — on Redis error, log via console.error and return {allowed: true, remaining: -1, retryAfter: 0} (fail-open per Architect decision)."},
    {"title": "Create middleware factory", "description": "Same file — export function createRateLimiter(config?: Partial<RateLimiterConfig>): RequestHandler. Merge config with env-var defaults: windowMs = config?.windowMs ?? parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), maxRequests = config?.maxRequests ?? parseInt(process.env.RATE_LIMIT_MAX || '100'). Create Redis connection: new Redis(process.env.REDIS_URL). Instantiate RateLimiter(redis, mergedConfig). Return async (req, res, next) => { const result = await limiter.check(req.ip); res.set('X-RateLimit-Remaining', String(result.remaining)); if (!result.allowed) { res.set('Retry-After', String(Math.ceil(result.retryAfter / 1000))); return res.status(429).json({error: 'Too Many Requests', retryAfter: result.retryAfter}); } next(); }"},
    {"title": "Register in server", "description": "src/server.ts — import { createRateLimiter } from './middleware/rateLimiter'. Add app.use('/api/', createRateLimiter()) BEFORE app.use('/api', routes) — this ensures all API routes are rate-limited but static asset routes are not."},
    {"title": "Add env vars", "description": ".env.example — add RATE_LIMIT_WINDOW_MS=900000 and RATE_LIMIT_MAX=100 with inline comments explaining defaults (15-minute window, 100 requests)"},
    {"title": "Integration test", "description": "tests/rateLimiter.test.ts — import { RateLimiter } from '../src/middleware/rateLimiter'. Test 1: send maxRequests+1 calls to limiter.check('test-ip'), assert first maxRequests return allowed=true, last returns allowed=false with retryAfter > 0. Test 2: verify Retry-After header is present on 429 response. Test 3: mock Redis.eval to throw, verify check() returns allowed=true (fail-open). Use a test Redis instance on REDIS_URL_TEST."}
  ],
  "carriedDecisions": ["Redis sorted sets over in-memory Map because horizontal scaling across service instances requires shared state", "Lua script over MULTI/EXEC pipeline because Lua executes atomically on the Redis thread, eliminating TOCTOU between ZCARD check and ZADD insert", "Sliding window over fixed window because fixed windows allow burst-boundary abuse (2x burst at window edges)", "Middleware factory pattern over decorator to stay consistent with existing Express middleware chain in src/server.ts", "Fail-open on Redis errors over fail-closed because a Redis outage should not make the entire API unavailable", "req.ip over custom header extraction because Express trust proxy is already configured"],
  "openQuestions": ["Should 429 body include remaining retry time in milliseconds in addition to Retry-After header (which is in seconds)?"]
}`;

    const messages = [{ role: 'user' as const, content: prompt }];
    const reasonerMaxTokens = 4096;

    try {
      const response = await primaryProvider.complete(messages, { model: phase.primary.model, jsonMode: true, maxTokens: reasonerMaxTokens, signal });
      return this.parseJSONResponse(response);
    } catch (error: any) {
      if (signal?.aborted) throw error;
      const fbProvider = await AIProviderFactory.getProvider(phase.fallback.provider);
      const fallback = await fbProvider.complete(messages, { model: phase.fallback.model, jsonMode: true, maxTokens: reasonerMaxTokens, signal });
      return this.parseJSONResponse(fallback);
    }
  }

  private async runExecutorWithContext(planData: any, sessionContext: WaterfallSessionContext, feedback?: string, signal?: AbortSignal, modelSelection: WaterfallModelSelection = WATERFALL_DEFAULT_SELECTION) {
    const phase = this.resolvePhase(WATERFALL_CONFIG.PHASE_3_EXECUTOR, modelSelection.executor);
    const planStr = typeof planData === 'string' ? planData : JSON.stringify(planData);

    let prompt = `You are the Senior Developer on a senior engineering team. You are Step 3 of a 4-step pipeline: Architect → Reasoner → [YOU: Executor] → Reviewer.

Two senior engineers have already made explicit decisions about this task. You must implement their plan faithfully.

CRITICAL RULES:
1. Your code field MUST contain COMPLETE, COMPILABLE source code — every function body fully implemented, every import present. The Reviewer will check compilation. Truncated or placeholder code (e.g. "// ... implementation" or "// TODO") will score 0 on syntax.
2. Do NOT second-guess architectural choices — they were deliberate. If you must deviate, document it in decisionsOverridden with your justification.
3. Implement EVERY step from the Reasoner's plan. The Reviewer audits step-by-step compliance. Missing steps lose 10 points each from the compliance score.
4. The "code" field is a single string containing all source code. Use file-separator comments (e.g. "// ═══ src/foo.ts ═══") to delimit multiple files within the string.
5. Respond with ONLY the JSON object. No markdown fences, no preamble, no explanation outside the JSON.

═══ ORIGINAL REQUIREMENT ═══
${sessionContext.originalRequirement.substring(0, 800)}

═══ DECISION CHAIN SUMMARY ═══
[Architect] ${sessionContext.architectDecisions}
[Reasoner] ${sessionContext.reasonerDecisions}

═══ FULL EXECUTION PLAN (from Reasoner) ═══
${planStr}`;

    if (feedback) {
      prompt += `

╔══════════════════════════════════════════╗
║  REVIEWER FEEDBACK — MUST BE ADDRESSED  ║
╚══════════════════════════════════════════╝
${feedback}

Every issue listed above must be explicitly fixed in this revision. Do not resubmit code with unresolved reviewer findings.`;
    }

    prompt += `

Output JSON:
{
  "code": "Complete, production-ready source code — not illustrative snippets",
  "explanation": "Brief summary of implementation approach and any non-obvious choices",
  "files": ["List of files created or modified"],
  "decisionsOverridden": ["If you deviated from any carried decision, document it here with justification — empty array if none"]
}

IMPORTANT: The "code" field must contain COMPLETE source code. Do NOT truncate with "// ..." or "// TODO". Every function must have a full implementation body. Use "// ═══ filename ═══" comments to separate multiple files within the single code string.

── Example output (for a different task: "Add rate-limiting middleware") ──
{
  "code": "// ═══ src/middleware/rateLimiter.ts ═══\nimport Redis from 'ioredis';\nimport { RequestHandler } from 'express';\n\nconst LUA_SLIDING_WINDOW = [\n  'local key = KEYS[1]',\n  'local now = tonumber(ARGV[1])',\n  'local windowMs = tonumber(ARGV[2])',\n  'local max = tonumber(ARGV[3])',\n  'redis.call(\"ZREMRANGEBYSCORE\", key, 0, now - windowMs)',\n  'redis.call(\"ZADD\", key, now, now .. \"-\" .. math.random(1000000))',\n  'local count = redis.call(\"ZCARD\", key)',\n  'redis.call(\"PEXPIRE\", key, windowMs)',\n  'return count'\n].join('\\n');\n\nexport class RateLimiter {\n  constructor(private redis: Redis) {}\n  async check(key: string, windowMs: number, max: number) {\n    const now = Date.now();\n    const count = await this.redis.call('EVAL', LUA_SLIDING_WINDOW, '1', key, String(now), String(windowMs), String(max)) as number;\n    return { allowed: count <= max, remaining: Math.max(0, max - count), retryAfter: count <= max ? 0 : Math.ceil(windowMs / 1000) };\n  }\n}\n\nexport function createRateLimiter(config: {windowMs?: number; max?: number} = {}): RequestHandler {\n  const windowMs = config.windowMs ?? parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10);\n  const max = config.max ?? parseInt(process.env.RATE_LIMIT_MAX || '100', 10);\n  const redis = new Redis(process.env.REDIS_URL);\n  const limiter = new RateLimiter(redis);\n  return async (req, res, next) => {\n    const result = await limiter.check('rl:' + req.ip, windowMs, max);\n    res.set('X-RateLimit-Remaining', String(result.remaining));\n    if (!result.allowed) { res.set('Retry-After', String(result.retryAfter)); return res.status(429).json({error: 'Too Many Requests', retryAfter: result.retryAfter}); }\n    next();\n  };\n}",
  "explanation": "Redis-backed sliding window rate limiter using Lua script for atomic ZADD+ZREMRANGEBYSCORE+ZCARD. Factory function returns Express middleware. Config from env vars with sensible defaults. Returns 429 with Retry-After header.",
  "files": ["src/middleware/rateLimiter.ts", "src/server.ts"],
  "decisionsOverridden": []
}`;

    const messages = [{ role: 'user' as const, content: prompt }];

    // Executor needs a much higher token limit to produce complete code for complex tasks
    const executorMaxTokens = 16384;

    try {
      const primaryProvider = await AIProviderFactory.getProvider(phase.primary.provider);
      const response = await primaryProvider.complete(messages, { model: phase.primary.model, jsonMode: true, maxTokens: executorMaxTokens, signal });
      return this.parseJSONResponse(response);
    } catch (error: any) {
      if (signal?.aborted) throw error;
      const fbProvider = await AIProviderFactory.getProvider(phase.fallback.provider);
      try {
        const res = await fbProvider.complete(messages, { model: phase.fallback.model, jsonMode: true, maxTokens: executorMaxTokens, signal });
        return this.parseJSONResponse(res);
      } catch (err) {
        if (signal?.aborted) throw err;
        const localProvider = await AIProviderFactory.getProvider('ollama');
        const res = await localProvider.complete(messages, { model: phase.local, jsonMode: true, maxTokens: executorMaxTokens, signal });
        return this.parseJSONResponse(res);
      }
    }
  }

  private async runReviewWithContext(plan: any, executorData: any, sessionContext: WaterfallSessionContext, signal?: AbortSignal, modelSelection: WaterfallModelSelection = WATERFALL_DEFAULT_SELECTION) {
    const phase = this.resolvePhase(WATERFALL_CONFIG.PHASE_4_REVIEWER, modelSelection.reviewer);

    let compilationStatus = 'Not tested';
    if (executorData.code) {
      if (signal?.aborted) throw new SolventError('Waterfall cancelled by user.', SolventErrorCode.OPERATION_CANCELLED);
      const tempFile = path.join(os.tmpdir(), `solvent_review_${crypto.randomUUID()}.ts`);

      try {
        await fs.writeFile(tempFile, executorData.code, 'utf-8');
        const check = await toolService.executeTool('run_shell', { command: `npx tsc --noEmit --allowJs --esModuleInterop --skipLibCheck ${tempFile}` });
        compilationStatus = check.stderr ? `Type Error: ${check.stderr}` : 'Syntax Validated (tsc --noEmit)';
      } catch (e: any) {
        compilationStatus = `Check Failed: ${e.message}`;
      } finally {
        await fs.unlink(tempFile).catch(() => {});
      }
    }

    const prompt = [{
      role: 'user' as const,
      content: `You are the Principal Engineer on a senior engineering team. You are Step 4 of a 4-step pipeline: Architect → Reasoner → Executor → [YOU: Reviewer].

You have visibility into the full decision chain. Your job is to audit whether the Executor faithfully implemented what the Architect and Reasoner designed, AND whether the code itself is correct, secure, and efficient.

CRITICAL RULES:
1. Be HONEST and SPECIFIC. A score of 95+ means near-perfect code with at most cosmetic issues. Most real implementations score 70-90.
2. Every issue MUST be actionable: name the exact function, line, or pattern that is wrong and what the fix should be.
3. Check every carriedDecision from the Reasoner — if the Executor dropped one, that is a compliance deduction.
4. If the code is truncated or contains "// ..." placeholders, the syntax score is 0 and compliance is halved.
5. Respond with ONLY the JSON object. No markdown fences, no preamble, no explanation outside the JSON.

SCORING CALIBRATION:
- 90-100: Production-ready. All requirements met, all decisions honored, no bugs. Rare.
- 75-89: Good implementation with minor issues (missing edge cases, non-critical bugs).
- 50-74: Incomplete or has significant bugs. Missing major requirements.
- 25-49: Fundamentally broken. Most requirements unmet, compilation fails.
- 0-24: No usable code produced.

═══ ORIGINAL REQUIREMENT ═══
${sessionContext.originalRequirement.substring(0, 600)}

═══ FULL DECISION CHAIN ═══
[Step 1 — Architect] ${sessionContext.architectDecisions}
[Step 2 — Reasoner] ${sessionContext.reasonerDecisions}

═══ EXECUTION PLAN (Step 2 Full Output) ═══
${JSON.stringify(plan)}

═══ IMPLEMENTED CODE (Step 3 Output) ═══
${JSON.stringify(executorData)}

═══ COMPILATION CHECK ═══
${compilationStatus}

RUBRIC (100 pts total):
1. Decision Chain Compliance (40 pts): Does the code implement EVERY Architect key decision AND EVERY Reasoner carried decision? Check them one by one. Each missed decision = -5 pts. Each missing Reasoner step = -10 pts.
2. Security (20 pts): Hardcoded secrets, injection risks, unsafe imports, exposed internals, or missing input validation on external boundaries?
3. Efficiency (20 pts): Is the code performant and idiomatic? Are there unnecessary allocations, missing caching, or O(n²) where O(n) is possible?
4. Syntax/Compilation (20 pts): Does it pass the syntax check? Are all imports present? Any undefined references?

Output JSON:
{
  "score": <total 0-100 — be honest, most code scores 70-90>,
  "breakdown": { "compliance": <0-40>, "security": <0-20>, "efficiency": <0-20>, "syntax": <0-20> },
  "issues": ["Specific, actionable: 'Function X in file Y has bug Z — should be fixed by doing W'"],
  "decisionsHonored": ["List each carried decision and confirm it was implemented correctly"],
  "summary": "One-paragraph verdict — lead with the most critical finding",
  "compilationStatus": "${compilationStatus}",
  "crystallizable_insight": "If score > 90: a concise reusable architectural pattern from this success. Otherwise null."
}

── Example output (for a different task: "Add rate-limiting middleware") ──
{
  "score": 82,
  "breakdown": {"compliance": 32, "security": 18, "efficiency": 17, "syntax": 15},
  "issues": ["RateLimiter.check() uses Date.now() instead of Redis TIME — violates Architect's decision to use server time for clock skew mitigation", "Missing input validation on RATE_LIMIT_MAX — non-numeric env var produces NaN, bypassing limiter entirely", "No test file generated despite Reasoner plan step 6 requiring integration test", "createRateLimiter() creates a new Redis connection per call — should accept injected client or use singleton"],
  "decisionsHonored": ["Redis sorted sets for sliding window — correctly implemented via Lua script", "Middleware factory pattern — consistent with Express chain", "Sliding window over fixed window — correctly uses ZREMRANGEBYSCORE for time-based expiry"],
  "summary": "Solid middleware with correct Lua-based sliding window, but uses client-side timestamps instead of Redis TIME (clock skew vulnerability), missing the integration test specified in the plan, and has an env var parsing bug that could disable the limiter. Fix the timestamp source and add input validation for a production-ready implementation.",
  "compilationStatus": "Syntax Validated (node --check)",
  "crystallizable_insight": null
}`
    }];

    const reviewerMaxTokens = 4096;

    try {
      const primaryProvider = await AIProviderFactory.getProvider(phase.primary.provider);
      const response = await primaryProvider.complete(prompt, { model: phase.primary.model, jsonMode: true, maxTokens: reviewerMaxTokens, signal });
      const parsed = this.parseJSONResponse(response);

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
        const res = await fbProvider.complete(prompt, { model: phase.fallback.model, jsonMode: true, maxTokens: reviewerMaxTokens, signal });
        return this.parseJSONResponse(res);
      } catch (e: any) {
        console.error(`[Waterfall:Reviewer] Fallback (${phase.fallback.provider}/${phase.fallback.model}) failed:`, e.message);
        if (signal?.aborted) throw e;
        const localProvider = await AIProviderFactory.getProvider('ollama');
        const res = await localProvider.complete(prompt, { model: phase.local, jsonMode: true, maxTokens: reviewerMaxTokens, signal });
        return this.parseJSONResponse(res);
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
    return this.runReasonerWithContext(logicData, sessionContext, signal);
  }

  private async runExecutor(planData: any, feedback?: string, signal?: AbortSignal) {
    const sessionContext: WaterfallSessionContext = { originalRequirement: '', architectDecisions: '', reasonerDecisions: '' };
    return this.runExecutorWithContext(planData, sessionContext, feedback, signal);
  }

  private async runReview(plan: any, executorData: any, signal?: AbortSignal) {
    const sessionContext: WaterfallSessionContext = { originalRequirement: '', architectDecisions: '', reasonerDecisions: '' };
    return this.runReviewWithContext(plan, executorData, sessionContext, signal);
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
