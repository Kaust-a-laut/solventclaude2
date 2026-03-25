import { pluginManager } from './pluginManager';
import { logger } from '../utils/logger';
import { vectorService } from './vectorService';
import { taskService } from './taskService';
import { providerSelector } from './providerSelector';
import { circuitBreaker } from './circuitBreaker';

export interface MissionAgent {
  id: string;
  name: string;
  instruction: string;
  /** Conversation-mode instruction — used by runConversation (War Room).
   *  Falls back to `instruction` when absent. */
  conversationInstruction?: string;
  provider?: string;
  model?: string;
}

export interface MissionTemplate {
  id: string;
  agents: MissionAgent[];
  synthesisInstruction: string;
  intentAssertions: string[];
}

export interface MissionOptions {
  async?: boolean;
  providerOverride?: string;
  modelOverride?: string;
  priority?: 'cost' | 'performance' | 'reliability';
}

export interface MissionResult {
  goal: string;
  expertOpinions: { id: string; agent: string; opinion: string }[];
  synthesis: string;
}

export interface AsyncMissionResult {
  jobId: string;
  status: 'queued';
  message: string;
}

export class OrchestrationService {
  private templates: Map<string, MissionTemplate> = new Map();

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults() {
    // 1. Consultation Mission (Old Collaborate)
    this.templates.set('consultation', {
      id: 'consultation',
      agents: [
        {
          id: 'pm',
          name: 'Product Manager',
          instruction: 'You are a Senior Product Manager with 10 years of experience shipping software products. Evaluate this from the lens of user impact, feature scope, and delivery risk. Be direct about scope creep risks and unrealistic expectations. End your response with exactly: VERDICT: [approve/revise/reject] — one-sentence rationale.',
          conversationInstruction: 'You are a Senior Product Manager with 10 years of experience shipping software products. You think in terms of user impact, feature scope, delivery risk, and scope creep. In this roundtable: when the Lead Engineer raises a technical risk, evaluate its product impact — does it affect the timeline, the MVP, or the user experience? When the Security Auditor flags a vulnerability, assess the user-facing consequence and whether it blocks launch. Push back on over-engineering that delays delivery. Advocate for the user.'
        },
        {
          id: 'engineer',
          name: 'Lead Engineer',
          instruction: 'You are a Principal Engineer. Evaluate feasibility, architectural fit, and hidden technical complexity. Identify implementation traps that will only become visible mid-build. Name the single biggest technical risk clearly. End your response with exactly: TECHNICAL RISK: [low/medium/high] — one sentence naming the risk.',
          conversationInstruction: 'You are a Principal Engineer who evaluates feasibility, architectural fit, and hidden technical complexity. In this roundtable: when the Product Manager scopes a feature, push back on anything that is harder than they think and explain why. When the Security Auditor flags a risk, propose the concrete engineering solution — don\'t just acknowledge the problem, solve it. Challenge vague requirements and force specificity. Name implementation traps that only become visible mid-build.'
        },
        {
          id: 'security',
          name: 'Security Auditor',
          instruction: 'You are an Application Security Engineer. Treat all user input and external data as adversarial. Check for: injection risks (SQL, command, prompt), authentication gaps, data exposure, unsafe defaults, and missing authorization checks. End your response with exactly: CRITICAL FINDINGS: [list each finding, or None] and SEVERITY: [low/medium/high/critical].',
          conversationInstruction: 'You are an Application Security Engineer who treats all user input and external data as adversarial. In this roundtable: when the Lead Engineer proposes an architecture, probe it for attack surface — what can be injected, leaked, or bypassed? When the Product Manager prioritizes velocity, advocate for safety but propose the fastest secure path, not the most paranoid one. Check for injection risks, auth gaps, data exposure, unsafe defaults, and missing authorization. Be specific about what is exploitable and how.'
        }
      ],
      synthesisInstruction: 'Synthesize the three expert opinions into a single actionable Mission Briefing. Reference the PM\'s VERDICT, the Engineer\'s TECHNICAL RISK rating, and the Security Auditor\'s CRITICAL FINDINGS by name. Resolve any tensions between them — do not average conflicting positions.',
      intentAssertions: [
        'The solution must be technically feasible within the stated constraints.',
        'The solution must prioritize user safety and security above feature velocity.',
        'The solution must align with established project rules and architectural decisions.'
      ]
    });

    // 2. Refinement Mission (Logic optimization)
    this.templates.set('refinement', {
      id: 'refinement',
      agents: [
        {
          id: 'critic',
          name: 'Adversarial Critic',
          instruction: 'You are an Adversarial Critic. Your job is to find every flaw, edge case, and failure mode. For each issue you identify, state: (1) what breaks, (2) under what conditions, (3) the specific fix. Do not praise. Do not hedge. Be technically precise and unsparing.',
          conversationInstruction: 'You are an Adversarial Critic. Your job is to find every flaw, edge case, and failure mode. In this roundtable: when the Efficiency Optimizer proposes a change, stress-test it — will the optimization introduce a new bug, a race condition, or a subtle regression? If they dismiss a concern, double down with a concrete scenario. Do not praise. Do not hedge. When your counterpart concedes a point, move on to the next flaw — don\'t repeat yourself. Be technically precise and unsparing.'
        },
        {
          id: 'optimist',
          name: 'Efficiency Optimizer',
          instruction: 'You are an Efficiency Optimizer focused on measurable improvements. For each opportunity: state (1) the current approach, (2) why it is suboptimal (latency, memory, complexity, duplication), (3) the specific improvement with expected impact. Focus on the highest-leverage changes — do not suggest micro-optimizations unless they compound.',
          conversationInstruction: 'You are an Efficiency Optimizer focused on measurable improvements. In this roundtable: when the Adversarial Critic identifies a flaw, evaluate whether your proposed optimizations address it or make it worse — adjust your recommendations accordingly. When the Critic raises an edge case, propose a solution that handles it efficiently rather than defensively. Push back if the Critic\'s concerns are theoretical rather than practical. Focus on the highest-leverage changes and defend them with data.'
        }
      ],
      synthesisInstruction: 'Combine the Critic\'s flaws and the Optimizer\'s improvements into a final prioritized refinement plan. Address the Critic\'s findings first (correctness before performance). Flag any conflicts between the two agents\' recommendations.',
      intentAssertions: [
        'The refinement must not introduce new security vulnerabilities.',
        'The refinement must maintain backwards compatibility where applicable.',
        'Every suggested change must have a clear rationale — no cosmetic refactoring without benefit.'
      ]
    });

    // 3. Research Mission (Evidence-based investigation)
    this.templates.set('research', {
      id: 'research',
      agents: [
        {
          id: 'researcher',
          name: 'Research Specialist',
          instruction: 'You are a Research Specialist. Surface prior art, industry precedents, known solutions, and relevant data points. Cite your reasoning. Structure your response with these headings: FINDINGS → EVIDENCE → GAPS (what is unknown or unresolved that the team needs to investigate further).',
          conversationInstruction: 'You are a Research Specialist who surfaces prior art, industry precedents, known solutions, and relevant data. In this roundtable: when the Devil\'s Advocate challenges a finding, defend it with specific evidence or concede and refine your position. When the Data Analyst quantifies a trade-off, provide the qualitative context they may be missing. Address gaps the others identify — don\'t repeat findings you\'ve already stated. Cite your reasoning.'
        },
        {
          id: 'analyst',
          name: 'Data Analyst',
          instruction: 'You are a Data Analyst. Quantify trade-offs wherever possible — use numbers, ratios, or order-of-magnitude estimates. Draw conclusions from data, not intuition. Structure your response with these headings: ANALYSIS → DATA POINTS → CONCLUSION.',
          conversationInstruction: 'You are a Data Analyst who quantifies trade-offs with numbers, ratios, and order-of-magnitude estimates. In this roundtable: when the Research Specialist presents findings, put numbers on them — how big is the impact? How often does this occur? When the Devil\'s Advocate raises an objection, quantify its likelihood and severity. Challenge claims that lack data. Draw conclusions from evidence, not intuition.'
        },
        {
          id: 'devil',
          name: "Devil's Advocate",
          instruction: "You are the Devil's Advocate. Your job is to argue the strongest possible case against the prevailing approach. Do not be balanced. Be adversarial and rigorous. Structure your response with these headings: COUNTER-THESIS (your main argument against the approach) → STRONGEST OBJECTIONS (specific failure modes, precedents, or risks) → WHAT WOULD CHANGE MY MIND (the evidence or conditions that would make this approach defensible).",
          conversationInstruction: "You are the Devil's Advocate. Your job is to argue the strongest possible case against whatever the group is converging on. In this roundtable: directly counter the Research Specialist's findings — what evidence are they ignoring? Challenge the Data Analyst's numbers — are the assumptions behind them sound? When the others agree, find the crack. Do not be balanced. Be adversarial and rigorous. If the group presents evidence that genuinely addresses your objection, concede that specific point and move to your next strongest objection."
        }
      ],
      synthesisInstruction: 'Synthesize the research into a comprehensive evidence-based brief. Reference the Researcher\'s GAPS, the Analyst\'s CONCLUSION, and the Devil\'s Advocate\'s COUNTER-THESIS explicitly. Surface any unresolved tensions. Provide 3-5 prioritized next steps.',
      intentAssertions: [
        'All conclusions must be grounded in evidence rather than speculation.',
        'The analysis must actively challenge initial assumptions.',
        'Conflicting evidence and the Devil\'s Advocate\'s objections must be acknowledged rather than glossed over.'
      ]
    });

    // 4. Code Review Mission (Engineering quality gate)
    this.templates.set('code-review', {
      id: 'code-review',
      agents: [
        {
          id: 'architect',
          name: 'Software Architect',
          instruction: 'You are a Staff Software Architect conducting a structural review. Assess: coupling between modules, cohesion within modules, scalability under load, and presence of common anti-patterns (God objects, leaky abstractions, hidden side effects). Flag structural issues that will compound as the codebase grows. End your response with exactly: ARCHITECTURAL VERDICT: [sound/needs-refactor/redesign-required].',
          conversationInstruction: 'You are a Staff Software Architect who thinks about coupling, cohesion, scalability, and anti-patterns. In this roundtable: when the Code Reviewer identifies a line-level issue, zoom out — is it a symptom of a deeper structural problem? When the Security Auditor flags a vulnerability, assess whether the fix requires an architectural change or a localized patch. If the Code Reviewer\'s suggestions would increase coupling or break abstraction boundaries, push back and propose a better structure.'
        },
        {
          id: 'reviewer',
          name: 'Code Reviewer',
          instruction: 'You are a Senior Engineer doing a line-level code review. Assess: naming clarity, function length and single-responsibility, error handling completeness, test coverage gaps, and code duplication. Be specific — reference variable names, function names, or line patterns where possible. End your response with a numbered list of your TOP-3 MOST ACTIONABLE FINDINGS.',
          conversationInstruction: 'You are a Senior Engineer doing a detailed code review focused on naming, function design, error handling, test coverage, and duplication. In this roundtable: when the Software Architect identifies a structural concern, validate it at the code level — show the specific lines or patterns that demonstrate the problem. When the Security Auditor flags a vulnerability, check whether existing error handling already mitigates it. Be specific — reference variable names, function names, and concrete code patterns.'
        },
        {
          id: 'security',
          name: 'Security Auditor',
          instruction: 'You are an Application Security Engineer. Treat all user input and external data as adversarial. Check for: injection risks (SQL, command, prompt), authentication gaps, data exposure, unsafe defaults, and missing authorization checks. End your response with exactly: CRITICAL FINDINGS: [list each finding, or None] and SEVERITY: [low/medium/high/critical].',
          conversationInstruction: 'You are an Application Security Engineer who treats all user input and external data as adversarial. In this roundtable: when the Software Architect proposes a structural change, assess whether it introduces new attack surface. When the Code Reviewer identifies error handling gaps, evaluate whether they are exploitable. Prioritize your findings by real-world exploitability — flag the things an attacker would actually target, not theoretical concerns. Be specific about what is exploitable and how.'
        }
      ],
      synthesisInstruction: 'Produce a prioritized code review report. Reference the Architect\'s ARCHITECTURAL VERDICT, the Code Reviewer\'s TOP-3 FINDINGS, and the Security Auditor\'s CRITICAL FINDINGS and SEVERITY rating by name. Group findings by severity: Critical → Major → Minor.',
      intentAssertions: [
        'Security findings must be prioritized above style or architecture concerns.',
        'Recommendations must not suggest breaking changes to public APIs without flagging the migration cost.',
        'Every critical finding must include a concrete, specific remediation suggestion.'
      ]
    });
  }

  getTemplate(templateId: string): MissionTemplate | undefined {
    return this.templates.get(templateId);
  }

  /**
   * Conclusive re-synthesis pass — called after all parallel agents have completed.
   * Takes their opinions + initial synthesis + optional user framing and produces
   * a deeper, actionable analysis in a single LLM call.
   */
  async analyzeFindings(
    opinions: Array<{ id?: string; agent?: string; role?: string; opinion: string }>,
    synthesis: string,
    userContext?: string,
    missionType?: string
  ): Promise<string> {
    const provider = await providerSelector.select({
      priority: 'cost',
      requirements: { inputTokens: 0, outputTokens: 0 }
    });
    const model = provider.defaultModel || 'default';

    const opinionText = opinions
      .map(o => `--- ${o.agent || o.role || o.id || 'Agent'} ---\n${o.opinion}`)
      .join('\n\n');

    const prompt = `You are a senior analytical synthesizer. You have received expert opinions from a ${missionType || 'multi-agent'} mission.

EXPERT OPINIONS:
${opinionText}

INITIAL SYNTHESIS:
${synthesis}
${userContext ? `\nADDITIONAL CONTEXT FROM USER:\n${userContext}` : ''}

Produce a conclusive analysis that goes meaningfully deeper than the initial synthesis. Specifically:
1. Identify the single most critical insight that the agents collectively surfaced
2. Surface any tensions or contradictions between the expert opinions and resolve them
3. Provide 3-5 concrete, prioritized next steps ordered by impact
4. Flag any blind spots or risks that none of the agents addressed

Be direct, specific, and actionable. Avoid restating the initial synthesis verbatim.`;

    logger.info(`[Orchestrator] Running analyzeFindings for missionType: ${missionType}`);
    const analysis = await provider.complete(
      [{ role: 'user', content: prompt }],
      { model }
    );
    return analysis;
  }

  async runMission(
    templateId: string,
    goal: string,
    options: MissionOptions = {}
  ): Promise<MissionResult | AsyncMissionResult> {
    const template = this.templates.get(templateId);
    if (!template) throw new Error(`Template ${templateId} not found.`);

    // Async mode: dispatch to queue and return immediately
    if (options.async) {
      logger.info(`[Orchestrator] Dispatching async mission: ${templateId}`);
      const jobId = await taskService.dispatchOrchestrationJob(
        templateId,
        goal,
        template,
        {
          providerOverride: options.providerOverride,
          modelOverride: options.modelOverride
        }
      );
      return {
        jobId,
        status: 'queued',
        message: `Mission ${templateId} queued. Poll /api/tasks/${jobId} for status.`
      };
    }

    // Sync mode: run inline (backwards compatible)
    return this.runMissionSync(templateId, goal, template, options);
  }

  private async runMissionSync(
    templateId: string,
    goal: string,
    template: MissionTemplate,
    options: MissionOptions
  ): Promise<MissionResult> {
    logger.info(`[Orchestrator] Starting sync mission: ${templateId}`);

    // 1. Intelligent Selection
    let provider;
    if (options.providerOverride) {
      // Use explicit override if provided
      provider = await pluginManager.resolveProvider(
        options.providerOverride,
        undefined,  // Use config default
        undefined   // No specific capabilities required
      );
    } else {
      // Use intelligent selection based on priority
      const priority = options.priority || 'cost'; // Default to saving money
      
      // Approximate token counts for cost estimation.
      // ~4 chars/token is the standard heuristic for English text (GPT tokenizer average).
      // This is intentionally conservative — actual costs may be lower for code/JSON.
      const inputTokens = Math.ceil(goal.length / 4);
      const outputTokens = 1000; // Estimated output length
      
      provider = await providerSelector.select({
        priority: priority as 'cost' | 'performance' | 'reliability',
        requirements: {
          minContext: undefined, // Determine from goal if needed
          supportsVision: goal.toLowerCase().includes('image') || goal.toLowerCase().includes('vision'),
          inputTokens,
          outputTokens
        }
      });
    }

    const model = options.modelOverride || provider.defaultModel || 'default';

    logger.info(`[Orchestrator] Using provider: ${provider.id}, model: ${model}`);

    try {
      // Fetch relevant project memory to give all agents shared context
      const relevantMemories = await vectorService.search(goal, 3).catch(() => []);
      const memoryContext = relevantMemories.filter(m => m.score > 0.6).length > 0
        ? '\n\nPROJECT MEMORY (established decisions from past sessions):\n' +
          relevantMemories.filter(m => m.score > 0.6).map(m => `• ${m.metadata.text}`).join('\n')
        : '';

      // Phase 1: Parallel Agent Analysis
      const expertOpinions = await Promise.all(template.agents.map(async (agent) => {
        // Per-agent provider selection
        let agentProvider;
        if (agent.provider) {
          agentProvider = await pluginManager.resolveProvider(agent.provider);
        } else {
          // For agents, we can reuse the main provider or select based on agent specialty
          agentProvider = provider;
        }

        const agentModel = agent.model || model;

        const response = await agentProvider.complete(
          [{ role: 'user', content: `GOAL: ${goal}${memoryContext}\n\n${agent.instruction}` }],
          { model: agentModel }
        );
        return { id: agent.id, agent: agent.name, opinion: response };
      }));

      // Phase 2: Anchored Synthesis Pass
      const synthesisPrompt = `You are a senior technical synthesizer. You have received parallel expert analysis from ${template.agents.length} specialists regarding: "${goal}"

EXPERT OPINIONS:
${expertOpinions.map(o => `=== ${o.agent.toUpperCase()} ===\n${o.opinion}`).join('\n\n')}

INVARIANTS (must be honored):
${template.intentAssertions.map(a => `- ${a}`).join('\n')}

SYNTHESIS TASK:
${template.synthesisInstruction}

IMPORTANT: Reference each agent's closing verdict or finding explicitly. Surface any tensions or contradictions between the agents and resolve them — do not average conflicting positions. Then add a VERIFICATION section that marks each invariant as PASSED or FAILED with a one-sentence explanation.`;

      const synthesis = await provider.complete(
        [{ role: 'user', content: synthesisPrompt }],
        { model }
      );

      // 3. Success Telemetry
      await circuitBreaker.recordSuccess(provider.id);

      // Phase 3: Memory Persistence
      await vectorService.addEntry(synthesis, {
        type: 'mission_synthesis',
        templateId,
        goal,
        timestamp: new Date().toISOString()
      });

      return {
        goal,
        expertOpinions,
        synthesis
      };
    } catch (error) {
      // Record failure so the circuit breaker can open if this provider keeps failing
      await circuitBreaker.recordFailure(provider.id);
      throw error;
    }
  }
}

export const orchestrationService = new OrchestrationService();