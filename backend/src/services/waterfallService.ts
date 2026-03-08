import fs from 'fs/promises';
import { AIProviderFactory } from './aiProviderFactory';
import { WATERFALL_CONFIG, MODELS } from '../constants/models';
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
    resumeArchitect?: any  // pre-computed architect result from a paused run
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
      architect = await this.runArchitectWithContext(fullPrompt, globalProvider, signal);
      sessionContext.architectDecisions = this.extractArchitectDecisions(architect);
    }

    // --- RESOURCE GOVERNANCE GATE ---
    const estimate = ResourceEstimator.estimate(architect.complexity || 'medium', fullPrompt.length);
    if (!forceProceed && (estimate.riskLevel === 'high' || estimate.riskLevel === 'critical')) {
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
    const reasoner = await this.runReasonerWithContext(architect, sessionContext, signal);
    sessionContext.reasonerDecisions = this.extractReasonerDecisions(reasoner);

    if (signal?.aborted) throw new SolventError('Waterfall cancelled by user.', SolventErrorCode.OPERATION_CANCELLED);

    yield { phase: 'executing', message: 'Generating production-ready code...' };
    let executor = await this.runExecutorWithContext(reasoner, sessionContext, undefined, signal);

    if (signal?.aborted) throw new SolventError('Waterfall cancelled by user.', SolventErrorCode.OPERATION_CANCELLED);

    yield { phase: 'reviewing', message: 'Principal Engineer is auditing the full decision chain...', attempts: 1 };
    let reviewer = await this.runReviewWithContext(reasoner, executor, sessionContext, signal);

    let attempts = 0;
    const history = [{ executor, reviewer }];

    while (reviewer.score < 80 && attempts < maxRetries) {
      if (signal?.aborted) throw new SolventError('Waterfall cancelled by user.', SolventErrorCode.OPERATION_CANCELLED);
      attempts++;
      yield {
        phase: 'retrying',
        message: `Score ${reviewer.score}/100 too low. Refining code (Attempt ${attempts})...`,
        data: { issues: reviewer.issues, reviewer, attempt: attempts }
      };

      const feedback = `Previous attempt scored ${reviewer.score}/100. Issues to address:\n${(reviewer.issues as string[]).map((issue: string) => `• ${issue}`).join('\n')}`;
      executor = await this.runExecutorWithContext(reasoner, sessionContext, feedback, signal);

      yield { phase: 'reviewing', message: 'Reviewing refined code...', attempts: attempts + 1 };
      reviewer = await this.runReviewWithContext(reasoner, executor, sessionContext, signal);

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
  async runAgenticWaterfall(prompt: string, globalProvider: string = 'auto', maxRetries: number = 2, onProgress?: (phase: string, data?: any) => void, notepadContent?: string, openFiles?: any[], signal?: AbortSignal, forceProceed: boolean = false, resumeArchitect?: any) {
    const generator = this.runAgenticWaterfallGenerator(prompt, globalProvider, maxRetries, notepadContent, openFiles, signal, forceProceed, resumeArchitect);
    
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
    if (!architect || architect.raw) return 'No structured decisions extracted.';
    const parts: string[] = [];
    if (architect.keyDecisions?.length) parts.push(`Key Decisions: ${architect.keyDecisions.join('; ')}`);
    if (architect.techStack?.length) parts.push(`Tech Stack: ${architect.techStack.join(', ')}`);
    if (architect.assumptions?.length) parts.push(`Assumptions: ${architect.assumptions.join('; ')}`);
    if (architect.complexity) parts.push(`Complexity: ${architect.complexity}`);
    return parts.length > 0 ? parts.join('\n') : JSON.stringify(architect).substring(0, 500);
  }

  private extractReasonerDecisions(reasoner: any): string {
    if (!reasoner || reasoner.raw) return 'No structured decisions extracted.';
    const parts: string[] = [];
    if (reasoner.carriedDecisions?.length) parts.push(`Carried Decisions: ${reasoner.carriedDecisions.join('; ')}`);
    if (reasoner.openQuestions?.length) parts.push(`Open Questions for Executor: ${reasoner.openQuestions.join('; ')}`);
    if (reasoner.plan) parts.push(`Plan Summary: ${String(reasoner.plan).substring(0, 300)}`);
    return parts.length > 0 ? parts.join('\n') : JSON.stringify(reasoner).substring(0, 500);
  }

  private async runArchitectWithContext(userPrompt: string, globalProvider: string, signal?: AbortSignal) {
    const config = WATERFALL_CONFIG.PHASE_1_ARCHITECT;
    const providerName = globalProvider === 'local' ? 'ollama' : 'gemini';
    const provider = await AIProviderFactory.getProvider(providerName);

    const prompt = [{
      role: 'user' as const,
      content: `You are the AI Systems Lead on a senior engineering team. You are Step 1 of a 4-step pipeline: Architect → Reasoner → Executor → Reviewer. Your job is NOT to write code. Your job is to analyze requirements and produce a precise implementation blueprint that the next three agents will execute against.

CRITICAL: The next 3 agents will read your output and build on it. State your key decisions and assumptions explicitly — they will carry them forward. Any ambiguity you leave here compounds across all subsequent steps.

REQUIREMENTS:
${userPrompt}

Output a JSON object with this exact shape:
{
  "logic": "Detailed step-by-step implementation logic — be specific about interfaces, data flow, and integration points",
  "assumptions": ["Every assumption you are making about the environment, existing code, or requirements"],
  "keyDecisions": ["Each architectural decision and WHY you made it — e.g. 'Use event bus over direct import to break circular dependency'"],
  "complexity": "low|medium|high",
  "techStack": ["Technologies, frameworks, and libraries the implementation will use"]
}`
    }];

    try {
      const response = await provider.generateChatCompletion(prompt, {
        model: 'gemini-2.0-flash',
        shouldSearch: false,
        jsonMode: true,
        signal
      });
      return this.parseJSONResponse(response);
    } catch (error: any) {
      if (signal?.aborted) throw error;
      const groq = await AIProviderFactory.getProvider('groq');
      try {
        const res = await groq.generateChatCompletion(prompt, { model: 'llama-3.3-70b-versatile', jsonMode: true, signal });
        return this.parseJSONResponse(res);
      } catch (e) {
        if (signal?.aborted) throw e;
        const localProvider = await AIProviderFactory.getProvider('ollama');
        const res = await localProvider.generateChatCompletion(prompt, { model: config.LOCAL, jsonMode: true, signal });
        return this.parseJSONResponse(res);
      }
    }
  }

  private async runReasonerWithContext(logicData: any, sessionContext: WaterfallSessionContext, signal?: AbortSignal) {
    const gemini = await AIProviderFactory.getProvider('gemini');
    const logicStr = typeof logicData === 'string' ? logicData : JSON.stringify(logicData);

    const prompt = `You are the Technical Architect on a senior engineering team. You are Step 2 of a 4-step pipeline: Architect → [YOU: Reasoner] → Executor → Reviewer.

The Architect (Step 1) has completed their analysis. You must read their decisions carefully and produce a detailed execution plan that the Senior Developer (Step 3) will implement directly.

═══ ORIGINAL REQUIREMENT ═══
${sessionContext.originalRequirement.substring(0, 1000)}

═══ ARCHITECT'S DECISIONS (Step 1 Output) ═══
${sessionContext.architectDecisions}

═══ FULL ARCHITECT OUTPUT ═══
${logicStr}

Your job: Translate the Architect's blueprint into a precise, ordered execution plan. Flag any open questions the Executor needs to resolve. Carry forward every key decision — the Executor should not need to re-derive anything you already know.

Output JSON:
{
  "plan": "The complete refined technical plan — ordered, specific, implementation-ready",
  "steps": [{"title": "step title", "description": "detailed step description with specific method/file names where known"}],
  "carriedDecisions": ["Decisions from the Architect that the Executor must honor — copied and confirmed"],
  "openQuestions": ["Anything the Executor must decide locally — keep this list short"]
}`;

    const messages = [{ role: 'user' as const, content: prompt }];

    try {
      const response = await gemini.generateChatCompletion(messages, { model: 'gemini-2.0-flash', jsonMode: true, signal });
      return this.parseJSONResponse(response);
    } catch (error: any) {
      if (signal?.aborted) throw error;
      const groq = await AIProviderFactory.getProvider('groq');
      const fallback = await groq.generateChatCompletion(messages, { model: 'llama-3.1-8b-instant', jsonMode: true, signal });
      return this.parseJSONResponse(fallback);
    }
  }

  private async runExecutorWithContext(planData: any, sessionContext: WaterfallSessionContext, feedback?: string, signal?: AbortSignal) {
    const groq = await AIProviderFactory.getProvider('groq');
    const planStr = typeof planData === 'string' ? planData : JSON.stringify(planData);

    let prompt = `You are the Senior Developer on a senior engineering team. You are Step 3 of a 4-step pipeline: Architect → Reasoner → [YOU: Executor] → Reviewer.

Two senior engineers have already made explicit decisions about this task. You must implement their plan faithfully. Do not second-guess architectural choices — they were deliberate. If you must deviate from a carried decision, document it in decisionsOverridden with your justification.

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
}`;

    const messages = [{ role: 'user' as const, content: prompt }];

    try {
      const response = await groq.generateChatCompletion(messages, { model: MODELS.GROQ.LLAMA_3_3_70B, jsonMode: true, signal });
      return this.parseJSONResponse(response);
    } catch (error: any) {
      if (signal?.aborted) throw error;
      const orProvider = await AIProviderFactory.getProvider('openrouter');
      try {
        const res = await orProvider.generateChatCompletion(messages, { model: MODELS.OPENROUTER.QWEN_CODER_32B, jsonMode: true, signal });
        return this.parseJSONResponse(res);
      } catch (err) {
        if (signal?.aborted) throw err;
        const localProvider = await AIProviderFactory.getProvider('ollama');
        const res = await localProvider.generateChatCompletion(messages, { model: 'qwen2.5-coder:7b', jsonMode: true, signal });
        return this.parseJSONResponse(res);
      }
    }
  }

  private async runReviewWithContext(plan: any, executorData: any, sessionContext: WaterfallSessionContext, signal?: AbortSignal) {
    const groq = await AIProviderFactory.getProvider('groq');

    let compilationStatus = 'Not tested';
    if (executorData.code) {
      if (signal?.aborted) throw new SolventError('Waterfall cancelled by user.', SolventErrorCode.OPERATION_CANCELLED);
      const tempFile = `.temp_review_${Date.now()}.ts`;
      
      try {
        await toolService.executeTool('write_file', { path: tempFile, content: executorData.code });
        const check = await toolService.executeTool('run_shell', { command: `node --check ${tempFile}` });
        compilationStatus = check.stderr ? `Syntax Error: ${check.stderr}` : 'Syntax Validated (node --check)';
      } catch (e: any) {
        compilationStatus = `Check Failed: ${e.message}`;
      } finally {
        // Use fs.unlink directly — rm was removed from the shell allowlist
        await fs.unlink(tempFile).catch(() => {});
      }
    }

    const prompt = [{
      role: 'user' as const,
      content: `You are the Principal Engineer on a senior engineering team. You are Step 4 of a 4-step pipeline: Architect → Reasoner → Executor → [YOU: Reviewer].

You have visibility into the full decision chain. Your job is to audit whether the Executor faithfully implemented what the Architect and Reasoner designed, AND whether the code itself is correct, secure, and efficient.

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
1. Decision Chain Compliance (40 pts): Does the code implement the Architect's key decisions AND the Reasoner's carried decisions? Note any deviations.
2. Security (20 pts): Hardcoded secrets, injection risks, unsafe imports, or exposed internals?
3. Efficiency (20 pts): Is the code performant and idiomatic for its language/framework?
4. Syntax/Compilation (20 pts): Does it pass the syntax check above?

Output JSON:
{
  "score": <total 0-100>,
  "breakdown": { "compliance": <0-40>, "security": <0-20>, "efficiency": <0-20>, "syntax": <0-20> },
  "issues": ["Specific, actionable issue descriptions — not vague"],
  "decisionsHonored": ["Decisions from the chain that were correctly implemented"],
  "summary": "One-paragraph verdict for the engineering team",
  "compilationStatus": "${compilationStatus}",
  "crystallizable_insight": "If score > 90: a concise reusable architectural pattern from this success. Otherwise null."
}`
    }];

    try {
      const response = await groq.generateChatCompletion(prompt, { model: MODELS.GROQ.LLAMA_3_3_70B, jsonMode: true, signal });
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
      if (signal?.aborted) throw error;
      const gemini = await AIProviderFactory.getProvider('gemini');
      try {
        const res = await gemini.generateChatCompletion(prompt, { model: 'gemini-2.0-flash', jsonMode: true, signal });
        return this.parseJSONResponse(res);
      } catch (e) {
        if (signal?.aborted) throw e;
        const localProvider = await AIProviderFactory.getProvider('ollama');
        const res = await localProvider.generateChatCompletion(prompt, { model: 'qwen2.5-coder:7b', jsonMode: true, signal });
        return this.parseJSONResponse(res);
      }
    }
  }

  // --- Private Steps (Architect, Reasoner, etc.) ---
  // (These methods are largely unchanged but use SolventError now)

  private async runArchitect(userPrompt: string, globalProvider: string, signal?: AbortSignal) {
    const config = WATERFALL_CONFIG.PHASE_1_ARCHITECT;
    const providerName = globalProvider === 'local' ? 'ollama' : 'gemini';
    const provider = await AIProviderFactory.getProvider(providerName);

    const prompt = [{
      role: 'user' as const,
      content: `Act as an AI Project Lead. Analyze requirements and output a structured plan in JSON.
      Requirements: ${userPrompt}
      
      Response MUST be a JSON object:
      {
        "logic": "detailed step-by-step implementation logic",
        "assumptions": ["list", "of", "assumptions"],
        "complexity": "low|medium|high"
      }`
    }];

    try {
      const response = await provider.generateChatCompletion(prompt, { 
        model: 'gemini-2.0-flash', 
        shouldSearch: false,
        jsonMode: true,
        signal
      });
      return this.parseJSONResponse(response);
    } catch (error: any) {
      if (signal?.aborted) throw error;
      const groq = await AIProviderFactory.getProvider('groq');
      try {
        const res = await groq.generateChatCompletion(prompt, { model: 'llama-3.3-70b-versatile', jsonMode: true, signal });
        return this.parseJSONResponse(res);
      } catch (e) {
        if (signal?.aborted) throw e;
        const localProvider = await AIProviderFactory.getProvider('ollama');
        const res = await localProvider.generateChatCompletion(prompt, { model: config.LOCAL, jsonMode: true, signal });
        return this.parseJSONResponse(res);
      }
    }
  }

  private async runReasoner(logicData: any, signal?: AbortSignal) {
    const gemini = await AIProviderFactory.getProvider('gemini');
    const logicStr = typeof logicData === 'string' ? logicData : JSON.stringify(logicData);
    
    const prompt = `Refine this implementation logic into a step-by-step technical plan. 
    Respond in JSON format:
    {
      "plan": "The refined technical plan",
      "steps": [{"title": "step title", "description": "step desc"}]
    }
    
    Logic: ${logicStr}`;

    const messages = [{ role: 'user' as const, content: prompt }];

    try {
      const response = await gemini.generateChatCompletion(messages, { model: 'gemini-2.0-flash', jsonMode: true, signal });
      return this.parseJSONResponse(response);
    } catch (error: any) {
      if (signal?.aborted) throw error;
      const groq = await AIProviderFactory.getProvider('groq');
      const fallback = await groq.generateChatCompletion(messages, { model: 'llama-3.1-8b-instant', jsonMode: true, signal });
      return this.parseJSONResponse(fallback);
    }
  }

  private async runExecutor(planData: any, feedback?: string, signal?: AbortSignal) {
    const groq = await AIProviderFactory.getProvider('groq');
    const planStr = typeof planData === 'string' ? planData : JSON.stringify(planData);
    
    let prompt = `Based on this technical plan, generate the final production-ready code.
    Respond in JSON format:
    {
      "code": "The complete source code",
      "explanation": "brief explanation",
      "files": ["list", "of", "files", "affected"]
    }
    
    Plan: ${planStr}`;

    if (feedback) {
      prompt += `

CRITICAL FEEDBACK FROM PREVIOUS ATTEMPT: ${feedback}
Please address these issues in your revised code.`;
    }

    const messages = [{ role: 'user' as const, content: prompt }];

    try {
      const response = await groq.generateChatCompletion(messages, { model: MODELS.GROQ.LLAMA_3_3_70B, jsonMode: true, signal });
      return this.parseJSONResponse(response);
    } catch (error: any) {
      if (signal?.aborted) throw error;
      const orProvider = await AIProviderFactory.getProvider('openrouter');
      try {
        const res = await orProvider.generateChatCompletion(messages, { model: MODELS.OPENROUTER.QWEN_CODER_32B, jsonMode: true, signal });
        return this.parseJSONResponse(res);
      } catch (err) {
        if (signal?.aborted) throw err;
        const localProvider = await AIProviderFactory.getProvider('ollama');
        const res = await localProvider.generateChatCompletion(messages, { model: 'qwen2.5-coder:7b', jsonMode: true, signal });
        return this.parseJSONResponse(res);
      }
    }
  }

  private async runReview(plan: any, executorData: any, signal?: AbortSignal) {
    const groq = await AIProviderFactory.getProvider('groq');
    
    let compilationStatus = "Not tested";
    if (executorData.code) {
      if (signal?.aborted) throw new SolventError('Waterfall cancelled by user.', SolventErrorCode.OPERATION_CANCELLED);
      const tempFile = `.temp_review_${Date.now()}.ts`;
      
      try {
        await toolService.executeTool('write_file', { path: tempFile, content: executorData.code });
        const check = await toolService.executeTool('run_shell', { command: `node --check ${tempFile}` });
        compilationStatus = check.stderr ? `Syntax Error: ${check.stderr}` : "Syntax Validated (node --check)";
      } catch (e: any) {
        compilationStatus = `Check Failed: ${e.message}`;
      } finally {
        // Always clean up the temp file, even if the check throws
        await toolService.executeTool('run_shell', { command: `rm -f ${tempFile}` }).catch(() => {});
      }
    }

    const prompt = [{
      role: 'user' as const,
      content: `Perform a Senior Architect Review. Audit the code against the original plan.
      
      RUBRIC (100 pts total):
      1. Plan Compliance (40 pts): Does the code implement all requirements in the plan?
      2. Security (20 pts): Are there hardcoded secrets, injection risks, or unsafe imports?
      3. Efficiency (20 pts): Is the code performant and idiomatic? 
      4. Syntax/Compilation (20 pts): Does the code pass basic syntax checks? 
      
      [DEBUG DATA]:
      Compilation Status: ${compilationStatus}
      
      Plan: ${JSON.stringify(plan)}
      Code: ${JSON.stringify(executorData)}
      
      Respond in JSON format:
      {
        "score": (total points from rubric),
        "breakdown": {
          "syntax": (0-20),
          "security": (0-20),
          "logic": (0-40),
          "efficiency": (0-20)
        },
        "issues": ["list", "of", "issues"],
        "summary": "final verdict",
        "compilationStatus": "${compilationStatus}",
        "crystallizable_insight": "If score > 90, provide a concise, reusable architectural pattern or rule derived from this success. Otherwise null."
      }`
    }];

    try {
      const response = await groq.generateChatCompletion(prompt, { model: MODELS.GROQ.LLAMA_3_3_70B, jsonMode: true, signal });
      const parsed = this.parseJSONResponse(response);

      // --- AUTO-CRYSTALLIZATION ---
      // If the code is excellent, we save the "Secret Sauce" to long-term memory automatically.
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
      // ----------------------------

      return parsed;
    } catch (error: any) {
      if (signal?.aborted) throw error;
      const gemini = await AIProviderFactory.getProvider('gemini');
      try {
        const res = await gemini.generateChatCompletion(prompt, { model: 'gemini-2.0-flash', jsonMode: true, signal });
        return this.parseJSONResponse(res);
      } catch (e) {
        if (signal?.aborted) throw e;
        const localProvider = await AIProviderFactory.getProvider('ollama');
        const res = await localProvider.generateChatCompletion(prompt, { model: 'qwen2.5-coder:7b', jsonMode: true, signal });
        return this.parseJSONResponse(res);
      }
    }
  }

  private parseJSONResponse(response: string): any {
    try {
      let cleaned = response.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
      cleaned = cleaned.replace(/```json/g, '').replace(/```/g, '').trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      const jsonToParse = jsonMatch ? jsonMatch[0] : cleaned;
      return JSON.parse(jsonToParse);
    } catch (e) {
      console.warn('[WaterfallService] Failed to parse JSON, returning raw string.');
      return { raw: response };
    }
  }
}
