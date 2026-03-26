import { AIProviderFactory } from './aiProviderFactory';
import { vectorService } from './vectorService';
import { logger } from '../utils/logger';
import { Server } from 'socket.io';
import { appEventBus } from '../utils/eventBus';
import { toolService } from './toolService';

// --- Interfaces replacing `any` types ---

interface GraphNode {
  id: string;
  label: string;
  type: string;
  [key: string]: unknown;
}

interface GraphEdge {
  source: string;
  target: string;
  label?: string;
}

interface HistoryEntry {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

export interface SupervisorState {
  lastSync: string;
  activeMission: string;
  graphNodes: GraphNode[];
  graphEdges: GraphEdge[];
}

export interface PendingDecision {
  id: string;
  timestamp: number;
  decision: string;
  intervention: {
    needed: boolean;
    type: 'warning' | 'suggestion' | 'action';
    message: string;
    toolToExecute: { name: string; args: Record<string, unknown> } | null;
  } | null;
  crystallize: { content: string; type: string } | null;
  mentalMapUpdate: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  trigger: string;
  expiresAt: number;
}

export interface DecisionRecord {
  id: string;
  timestamp: number;
  trigger: 'notepad_change' | 'memory_crystallization' | 'mission_complete' | 'manual' | 'guidance';
  decision: string;
  intervention: {
    needed: boolean;
    type?: 'warning' | 'suggestion' | 'action';
    message?: string;
    toolToExecute?: { name: string; args: Record<string, unknown> } | null;
    result?: unknown;
  } | null;
  crystallize: { content: string; type: string } | null;
  mentalMapUpdate: string | null;
  status: 'auto_approved' | 'pending' | 'approved' | 'rejected' | 'expired';
  contextSnapshot: {
    notepadExcerpt: string;
    recentMessages: number;
    memoriesQueried: number;
  };
  relatedDecisions: string[];
}

// Tools the Overseer is permitted to call autonomously.
// Restricting to this set prevents prompt-injection attacks from escalating to
// arbitrary shell execution or memory invalidation.
const OVERSEER_ALLOWED_TOOLS = new Set([
  'crystallize_memory',
  'read_file',
  'list_files',
  'web_search',
]);

// Tools that can be auto-approved without user confirmation (safe read-only ops)
const AUTO_APPROVE_TOOLS = new Set([
  'read_file',
  'list_files',
]);

export class SupervisorService {
  private io: Server | null = null;
  private isSupervisorProcessing = false; // guards supervise()
  private isThinkProcessing = false;      // guards think()
  private thinkDepth = 0;
  private readonly MAX_DEPTH = 2;
  private readonly TOOL_BUDGET = 5;
  private toolCallsInCycle = 0;

  // Rolling window of decisions made this session — injected into each think() call
  // so the Overseer remembers what it already decided and doesn't contradict itself.
  private decisionLedger: string[] = [];
  private readonly MAX_LEDGER_ENTRIES = 10;

  // Pending decisions queue for approval flow
  private pendingDecisions: Map<string, PendingDecision> = new Map();
  private decisionHistory: DecisionRecord[] = [];
  private readonly DECISION_HISTORY_SIZE = 50;
  private readonly APPROVAL_TIMEOUT_MS = 60_000; // 60 seconds

  // Auto-approval settings (can be configured via settings)
  private autoApproveReadOnly = true;
  private autoApproveCrystallize = true;

  constructor() {
    // Listen for budget increment events emitted by ToolService (breaks circular import)
    appEventBus.on('supervisor:increment-tool-budget', () => {
      this.incrementToolBudget();
    });

    // Listen for Socket.io broadcast events emitted by ToolService
    appEventBus.on('supervisor:emit-event', ({ event, data }: { event: string; data: unknown }) => {
      this.emitEvent(event, data);
    });

    // Start expiration checker for pending decisions
    this.startExpirationChecker();
  }

  setIO(io: Server) {
    this.io = io;
  }

  incrementToolBudget() {
    if (this.toolCallsInCycle >= this.TOOL_BUDGET) {
      throw new Error(`Overseer tool budget exceeded (${this.TOOL_BUDGET} calls per cycle).`);
    }
    this.toolCallsInCycle++;
  }

  async supervise(noteContent: string, currentGraph: Record<string, unknown>) {
    if (this.isSupervisorProcessing || !noteContent || noteContent.length < 20) return;
    
    this.isSupervisorProcessing = true;
    logger.info('[Supervisor] Analyzing mission delta via Groq LPU...');

    try {
      const groq = await AIProviderFactory.getProvider('groq');
      
      // Pull relevant long-term context for supervision
      const relevantMemories = await vectorService.search(noteContent, 2);
      const memoryContext = relevantMemories
        .filter(m => m.score > 0.8)
        .map(m => `[PAST INSIGHT]: ${m.metadata.text}`)
        .join('\n');

      const prompt = `Act as the Solvent AI Overseer. Analyze the user's latest notes and the current Knowledge Graph state. 
      Your goal is to maintain a perfect mental map of the project.
      
      Current Notes: "${noteContent}"
      Current Graph: ${JSON.stringify(currentGraph)}
      ${memoryContext ? `\nLong-term context found:\n${memoryContext}` : ''}

      TASKS:
      1. Extract new concepts, files, or entities as "nodes".
      2. Define "edges" (links) between these entities.
      3. Identify if any nodes are no longer relevant.
      4. Provide a "Supervisory Insight" (a short, high-value technical tip).
      5. Identify "Crystallizable Knowledge": Is there a NEW, stable rule or architectural decision in the notes that should be permanently remembered?

      RESPONSE FORMAT (STRICT JSON):
      {
        "nodesToAdd": [{"id": "unique_id", "label": "name", "type": "file|concept|task"}],
        "edgesToAdd": [{"source": "id1", "target": "id2", "label": "link_type"}],
        "nodesToRemove": ["id"],
        "insight": "technical insight here",
        "crystallize": { "content": "The rule/fact", "type": "architectural_decision|project_rule" } (OR null)
      }`;

      const response = await groq.complete([
        { role: 'system', content: 'You are the Solvent Knowledge Graph Manager. Your job is to keep the project knowledge graph accurate, surface crystallizable architectural insights, and identify when new stable rules emerge from user notes. Respond in strict JSON only — no prose outside the JSON object.' },
        { role: 'user', content: prompt }
      ], { model: 'llama-3.3-70b-versatile', temperature: 0.1 });

      const analysis = this.parseResponse(response);
      
      if (analysis) {
        if (this.io) {
          this.io.emit('SUPERVISOR_UPDATE', analysis);
          logger.info('[Supervisor] State synchronization emitted.');
        }

        // Auto-Crystallization from Supervisor — only if auto-approve is on
        if (analysis.crystallize && analysis.crystallize.content && this.autoApproveCrystallize) {
          await this.executeToolWithResult('crystallize_memory', {
            content: analysis.crystallize.content,
            type: analysis.crystallize.type || 'architectural_decision',
            tags: ['supervisor_detected']
          }, crypto.randomUUID());
          logger.info(`[Supervisor] Crystallized: ${analysis.crystallize.content}`);
        }
      }

      // Pillar 2: Background Vector Sync
      await vectorService.addEntry(noteContent, { type: 'note_delta', timestamp: new Date().toISOString() });

    } catch (error) {
      logger.error('[Supervisor] Supervision loop failed', error);
    } finally {
      this.isSupervisorProcessing = false;
    }
  }

  private parseResponse(res: string) {
    try {
      const jsonMatch = res.match(/\{[\s\S]*\}/);
      return JSON.parse(jsonMatch ? jsonMatch[0] : res);
    } catch (e) {
      return null;
    }
  }

  emitClarificationRequest(payload: { type: string, question: string, data: unknown }) {
    if (this.io) {
      this.io.emit('SUPERVISOR_CLARIFICATION', payload);
      logger.info(`[Supervisor] Clarification request emitted: ${payload.question}`);
    } else {
      logger.warn('[Supervisor] Cannot emit clarification - IO not initialized.');
    }
  }

  emitEvent(event: string, payload: unknown) {
    if (this.io) {
      this.io.emit(event, payload);
    }
  }

  /**
   * Builds a rich live-context string from all 4 signal sources:
   * notepad content, recent messages, VectorService memory, and mission status.
   */
  private async buildLiveContext(
    activity: string,
    signals: {
      notepadContent?: string;
      recentMessages?: Array<{ role: string; content: string }>;
      missionId?: string;
      focus?: string;
      [key: string]: unknown;
    }
  ): Promise<string> {
    const parts: string[] = [];

    // Signal 1: Active notepad / directives
    if (signals.notepadContent && signals.notepadContent.trim().length > 10) {
      parts.push(`[ACTIVE DIRECTIVES / NOTEPAD]\n${signals.notepadContent.trim().slice(0, 1200)}`);
    }

    // Signal 2: Recent conversation messages (last 8)
    if (signals.recentMessages && signals.recentMessages.length > 0) {
      const recent = signals.recentMessages.slice(-8);
      const msgText = recent
        .map(m => `${m.role.toUpperCase()}: ${String(m.content).slice(0, 300)}`)
        .join('\n');
      parts.push(`[RECENT CONVERSATION]\n${msgText}`);
    }

    // Signal 3: VectorService memory — crystallized rules + past decisions
    try {
      const searchQuery = signals.focus || signals.notepadContent || activity;
      const memories = await vectorService.search(String(searchQuery).slice(0, 500), 15);
      const relevantMemories = memories.filter(m => m.score > 0.55);
      if (relevantMemories.length > 0) {
        const memText = relevantMemories
          .map(m => `[${String(m.metadata.type || 'memory').toUpperCase()}]: ${m.metadata.text}`)
          .join('\n');
        parts.push(`[RELEVANT MEMORY]\n${memText}`);
      }
    } catch {
      // Vector search is non-critical; continue without it
    }

    // Signal 4: Active mission context (if provided)
    if (signals.missionId) {
      parts.push(`[ACTIVE MISSION ID]: ${signals.missionId}`);
    }
    if (signals.result) {
      const missionSummary = typeof signals.result === 'object'
        ? JSON.stringify(signals.result).slice(0, 600)
        : String(signals.result).slice(0, 600);
      parts.push(`[MISSION RESULT SUMMARY]\n${missionSummary}`);
    }

    return parts.length > 0 ? parts.join('\n\n') : `Activity: ${activity}`;
  }

  /**
   * THE OVERSEER BRAIN: Autonomous reasoning loop.
   * Accepts optional live signals for context enrichment.
   */
  async think(context: {
    activity: string;
    data?: {
      notepadContent?: string;
      recentMessages?: Array<{ role: string; content: string }>;
      missionId?: string;
      focus?: string;
      [key: string]: unknown;
    };
  }) {
    if (this.isThinkProcessing) return;

    // GUARD: Recursion depth
    if (this.thinkDepth >= this.MAX_DEPTH) {
      logger.warn(`[Overseer] Max recursion depth (${this.MAX_DEPTH}) reached. Halting.`);
      return;
    }

    this.isThinkProcessing = true;
    this.thinkDepth++;
    this.toolCallsInCycle = 0;

    try {
      const gemini = await AIProviderFactory.getProvider('gemini');

      // 1. Build enriched live context from all signal sources
      const liveContext = await this.buildLiveContext(context.activity, context.data || {});

      // 2. Formulate the Overseer's reasoning prompt with decision ledger
      const ledgerSection = this.decisionLedger.length > 0
        ? `\n\n═══ OVERSEER SESSION MEMORY (your previous decisions this session) ═══\n${this.decisionLedger.map((d, i) => `${i + 1}. ${d}`).join('\n')}\nDo not contradict these decisions without flagging it explicitly.`
        : '';

      const prompt = `You are the SOLVENT OVERSEER — an autonomous engineering intelligence monitoring this IDE session in real time.

You do not write code. You watch, analyze, and intervene when it matters. Your decisions appear in the user's Command Center. Be direct and specific — never vague.

TRIGGER: ${context.activity}${ledgerSection}

═══ LIVE SESSION CONTEXT ═══
${liveContext}

═══ DECISION PROTOCOL ═══
1. ASSESS: What is actually happening in this session right now?
2. COMPARE: Does it align with established rules, past decisions, and the active mission?
3. DECIDE: Is intervention needed? If yes, what specifically? If no, is there anything worth crystallizing?
4. ACT: Use tools sparingly — only when a tool call provides clear value (e.g., crystallizing a new pattern). Do not call tools out of habit.

Allowed tools: ${Array.from(OVERSEER_ALLOWED_TOOLS).join(', ')}

RESPONSE FORMAT (strict JSON):
{
  "decision": "Your concise conclusion about the current state — one or two sentences",
  "intervention": {
    "needed": true|false,
    "type": "warning|suggestion|action",
    "message": "Direct message to the user — specific and actionable",
    "toolToExecute": { "name": "tool_name", "args": {} } (OR null)
  },
  "crystallize": { "content": "The architectural rule or decision to save permanently", "type": "architectural_decision|permanent_rule" } (OR null),
  "mentalMapUpdate": "Brief note on how the knowledge graph should change, or null"
}`;

      const response = await gemini.complete([
        { role: 'user', content: prompt }
      ], { model: 'gemini-2.0-flash', temperature: 0.1 });

      const result = this.parseResponse(response);

      if (result) {
        // Append this decision to the session ledger so future think() calls have continuity
        if (result.decision) {
          this.decisionLedger.push(`[${context.activity}] ${result.decision}`);
          if (this.decisionLedger.length > this.MAX_LEDGER_ENTRIES) {
            this.decisionLedger.shift(); // rolling window — drop oldest
          }
        }

        // Create a decision record for history
        const decisionRecord: DecisionRecord = {
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          trigger: this.mapActivityToTrigger(context.activity),
          decision: result.decision || '',
          intervention: result.intervention || null,
          crystallize: result.crystallize || null,
          mentalMapUpdate: result.mentalMapUpdate || null,
          status: 'pending',
          contextSnapshot: {
            notepadExcerpt: context.data?.notepadContent?.slice(0, 200) || '',
            recentMessages: context.data?.recentMessages?.length || 0,
            memoriesQueried: 0 // Would need to track this in buildLiveContext
          },
          relatedDecisions: []
        };

        // Check if tool execution can be auto-approved
        const toolName = result.intervention?.toolToExecute?.name;
        const canAutoApprove = toolName && (
          (this.autoApproveReadOnly && AUTO_APPROVE_TOOLS.has(toolName)) ||
          (this.autoApproveCrystallize && toolName === 'crystallize_memory')
        );

        if (canAutoApprove && toolName) {
          // Auto-execute safe tools
          logger.info(`[Overseer] Auto-approved tool: ${toolName}`);
          await this.executeToolWithResult(toolName, result.intervention!.toolToExecute!.args, decisionRecord.id);
          decisionRecord.status = 'auto_approved';
          this.addToHistory(decisionRecord);
          this.emitEvent('OVERSEER_DECISION', { ...result, status: 'auto_approved', id: decisionRecord.id });
        } else if (result.intervention?.needed && result.intervention.toolToExecute) {
          // Queue for approval
          const pendingDecision: PendingDecision = {
            id: decisionRecord.id,
            timestamp: Date.now(),
            decision: result.decision || '',
            intervention: result.intervention,
            crystallize: result.crystallize,
            mentalMapUpdate: result.mentalMapUpdate,
            status: 'pending',
            trigger: context.activity,
            expiresAt: Date.now() + this.APPROVAL_TIMEOUT_MS
          };

          this.pendingDecisions.set(pendingDecision.id, pendingDecision);
          decisionRecord.status = 'pending';
          this.addToHistory(decisionRecord);

          // Notify UI of pending decision
          this.emitEvent('DECISION_PENDING', {
            ...pendingDecision,
            timeRemaining: this.APPROVAL_TIMEOUT_MS
          });

          logger.info(`[Overseer] Decision queued for approval: ${pendingDecision.id}`);
        } else {
          // No tool execution needed, just record the decision
          decisionRecord.status = 'auto_approved';
          this.addToHistory(decisionRecord);
          this.emitEvent('OVERSEER_DECISION', { ...result, status: 'auto_approved', id: decisionRecord.id });
        }

        // Handle crystallization separately — but only if it wasn't already
        // executed as part of the tool-approval path above (avoids duplicate entries)
        const toolAlreadyCrystallized = toolName === 'crystallize_memory' && canAutoApprove;
        if (result.crystallize?.content && this.autoApproveCrystallize && !toolAlreadyCrystallized) {
          await toolService.executeTool('crystallize_memory', {
            content: result.crystallize.content,
            type: result.crystallize.type,
            tags: ['overseer_decision']
          }, true);
        }
      }

    } catch (error) {
      logger.error('[Overseer] Autonomous reasoning failed', error);
    } finally {
      this.thinkDepth--;
      this.isThinkProcessing = false;
    }
  }

  /**
   * Start periodic checker for expired pending decisions
   */
  private startExpirationChecker() {
    setInterval(() => {
      const now = Date.now();
      for (const [id, decision] of this.pendingDecisions.entries()) {
        if (decision.expiresAt < now && decision.status === 'pending') {
          decision.status = 'expired';
          this.pendingDecisions.delete(id);
          
          // Update history record
          const historyRecord = this.decisionHistory.find(r => r.id === id);
          if (historyRecord) {
            historyRecord.status = 'expired';
          }
          
          this.emitEvent('DECISION_EXPIRED', { id, decision: decision.decision });
          logger.info(`[Overseer] Decision expired: ${id}`);
        }
      }
    }, 5000); // Check every 5 seconds
  }

  /**
   * Map activity string to trigger type
   */
  private mapActivityToTrigger(activity: string): DecisionRecord['trigger'] {
    if (activity.includes('notepad')) return 'notepad_change';
    if (activity.includes('memory') || activity.includes('crystall')) return 'memory_crystallization';
    if (activity.includes('mission')) return 'mission_complete';
    if (activity.includes('manual')) return 'manual';
    if (activity.includes('guidance')) return 'guidance';
    return 'notepad_change';
  }

  /**
   * Add decision to history with size limit
   */
  private addToHistory(record: DecisionRecord) {
    this.decisionHistory.unshift(record);
    if (this.decisionHistory.length > this.DECISION_HISTORY_SIZE) {
      this.decisionHistory.pop();
    }
  }

  /**
   * Execute tool and store result in decision record
   */
  private async executeToolWithResult(toolName: string, args: Record<string, unknown>, decisionId: string) {
    if (!OVERSEER_ALLOWED_TOOLS.has(toolName)) {
      throw new Error(`Tool '${toolName}' is not in the Overseer allowed-tools list`);
    }
    try {
      const result = await toolService.executeTool(toolName, args, true);
      const record = this.decisionHistory.find(r => r.id === decisionId);
      if (record && record.intervention) {
        record.intervention.result = result;
      }
      return result;
    } catch (error) {
      logger.error(`[Overseer] Tool execution failed: ${toolName}`, error);
      throw error;
    }
  }

  /**
   * Approve a pending decision
   */
  async approveDecision(decisionId: string): Promise<{ success: boolean; error?: string }> {
    const decision = this.pendingDecisions.get(decisionId);
    if (!decision) {
      return { success: false, error: 'Decision not found' };
    }

    if (decision.status !== 'pending') {
      return { success: false, error: 'Decision already resolved' };
    }

    try {
      // Execute the tool
      if (decision.intervention?.toolToExecute) {
        await this.executeToolWithResult(
          decision.intervention.toolToExecute.name,
          decision.intervention.toolToExecute.args,
          decisionId
        );
      }

      // Update status
      decision.status = 'approved';
      this.pendingDecisions.delete(decisionId);

      // Update history
      const record = this.decisionHistory.find(r => r.id === decisionId);
      if (record) {
        record.status = 'approved';
      }

      this.emitEvent('DECISION_RESOLVED', { id: decisionId, status: 'approved' });
      logger.info(`[Overseer] Decision approved: ${decisionId}`);

      return { success: true };
    } catch (error) {
      logger.error(`[Overseer] Failed to execute approved decision: ${decisionId}`, error);
      return { success: false, error: error instanceof Error ? error.message : 'Execution failed' };
    }
  }

  /**
   * Reject a pending decision
   */
  async rejectDecision(decisionId: string, reason?: string): Promise<{ success: boolean; error?: string }> {
    const decision = this.pendingDecisions.get(decisionId);
    if (!decision) {
      return { success: false, error: 'Decision not found' };
    }

    if (decision.status !== 'pending') {
      return { success: false, error: 'Decision already resolved' };
    }

    decision.status = 'rejected';
    this.pendingDecisions.delete(decisionId);

    // Update history
    const record = this.decisionHistory.find(r => r.id === decisionId);
    if (record) {
      record.status = 'rejected';
    }

    this.emitEvent('DECISION_RESOLVED', { id: decisionId, status: 'rejected', reason });
    logger.info(`[Overseer] Decision rejected: ${decisionId}${reason ? ` - ${reason}` : ''}`);

    return { success: true };
  }

  /**
   * Get all pending decisions
   */
  getPendingDecisions(): PendingDecision[] {
    return Array.from(this.pendingDecisions.values());
  }

  /**
   * Get decision history
   */
  getDecisionHistory(limit: number = 50, offset: number = 0): DecisionRecord[] {
    return this.decisionHistory.slice(offset, offset + limit);
  }

  /**
   * Proactive Memory: Analyzes current context (focus/files) to surface relevant rules *before* mistakes happen.
   */
  async provideGuidance(contextFocus: string) {
    if (this.isSupervisorProcessing || !contextFocus) return;
    
    try {
      // 1. Semantic Search for Rules/Decisions only
      const relevantRules = await vectorService.search(contextFocus, 5, { 
        type: 'permanent_rule' 
      });
      
      const relevantDecisions = await vectorService.search(contextFocus, 3, { 
        type: 'architectural_decision' 
      });

      const memories = [...relevantRules, ...relevantDecisions];
      if (memories.length === 0) return;

      const memoryContext = memories
        .filter(m => m.score > 0.75) // Only high relevance
        .map(m => `[${m.metadata.type.toUpperCase()}]: ${m.metadata.text}`)
        .join('\n');

      if (!memoryContext) return;

      const groq = await AIProviderFactory.getProvider('groq');
      const prompt = `Act as a Proactive Engineering Guide.
      
      USER CONTEXT: "${contextFocus}"
      
      RELEVANT MEMORY:
      ${memoryContext}
      
      TASK:
      Determine if any of the above memories are CRITICAL to mention right now to prevent a mistake or align the workflow.
      If yes, output a concise "Nudge". If the rules are obvious or irrelevant, output "NO_ACTION".
      
      Format: Just the nudge text or "NO_ACTION".`;

      const nudge = await groq.complete([
        { role: 'system', content: 'You are a helpful, non-intrusive assistant.' },
        { role: 'user', content: prompt }
      ], { model: 'llama-3.3-70b-versatile', temperature: 0 });

      if (nudge && !nudge.includes('NO_ACTION')) {
        if (this.io) {
          this.io.emit('supervisor-nudge', { message: nudge }); // Reuse existing event
          logger.info(`[Supervisor] Proactive guidance: ${nudge}`);
        }
      }

    } catch (error) {
      logger.warn('[Supervisor] provideGuidance failed', error instanceof Error ? error.message : error);
    }
  }
}

export const supervisorService = new SupervisorService();
