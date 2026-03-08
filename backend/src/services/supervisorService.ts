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

// Tools the Overseer is permitted to call autonomously.
// Restricting to this set prevents prompt-injection attacks from escalating to
// arbitrary shell execution or memory invalidation.
const OVERSEER_ALLOWED_TOOLS = new Set([
  'crystallize_memory',
  'read_file',
  'list_files',
  'web_search',
]);

export class SupervisorService {
  private io: Server | null = null;
  private isSupervisorProcessing = false; // guards supervise()
  private isThinkProcessing = false;      // guards think()
  private thinkDepth = 0;
  private readonly MAX_DEPTH = 2;
  private readonly TOOL_BUDGET = 5;
  private toolCallsInCycle = 0;

  constructor() {
    // Listen for budget increment events emitted by ToolService (breaks circular import)
    appEventBus.on('supervisor:increment-tool-budget', () => {
      this.incrementToolBudget();
    });

    // Listen for Socket.io broadcast events emitted by ToolService
    appEventBus.on('supervisor:emit-event', ({ event, data }: { event: string; data: unknown }) => {
      this.emitEvent(event, data);
    });
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

      const response = await groq.generateChatCompletion([
        { role: 'system', content: 'You are a sub-100ms LPU-optimized project supervisor.' },
        { role: 'user', content: prompt }
      ], { model: 'llama-3.3-70b-versatile', temperature: 0.1 });

      const analysis = this.parseResponse(response);
      
      if (analysis) {
        if (this.io) {
          this.io.emit('SUPERVISOR_UPDATE', analysis);
          logger.info('[Supervisor] State synchronization emitted.');
        }

        // Auto-Crystallization from Supervisor
        if (analysis.crystallize && analysis.crystallize.content) {
              await toolService.executeTool('crystallize_memory', {
             content: analysis.crystallize.content,
             type: analysis.crystallize.type || 'architectural_decision',
             tags: ['supervisor_detected']
           }, true);
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

      // 2. Formulate the Overseer's internal state
      const prompt = `You are the SOLVENT AI OVERSEER.
      You are the all-knowing decision engine assistant for this project.
      You have access to live context from notepad directives, recent conversation, crystallized memory, and mission results.

      TRIGGER: ${context.activity}

      LIVE CONTEXT:
      ${liveContext}

      YOUR CAPABILITIES:
      - You have full access to Vector Memory.
      - You can execute tools via the system (File I/O, Shell, Tests).
      - You can proactively intervene if the user deviates from architecture.

      TASK:
      Analyze the current state based on the live context above. If something is missing, risky, or crystallizable, formulate a decision.
      Be concise and specific — your response goes directly to the user in their Command Center.

      RESPONSE FORMAT (JSON):
      {
        "decision": "Your high-level conclusion",
        "intervention": {
          "needed": boolean,
          "type": "warning|suggestion|action",
          "message": "Direct message to the user",
          "toolToExecute": { "name": "tool_name", "args": {} } (OR null)
        },
        "crystallize": { "content": "Knowledge to save", "type": "architectural_decision|rule" } (OR null),
        "mentalMapUpdate": "Changes to reflect in the knowledge graph"
      }`;

      const response = await gemini.complete([
        { role: 'user', content: prompt }
      ], { model: 'gemini-2.0-flash', temperature: 0.1 });

      const result = this.parseResponse(response);

      if (result) {
        // Execute Tool if Overseer decides it's necessary — validate against allowlist first
        if (result.intervention?.toolToExecute) {
          const toolName = result.intervention.toolToExecute.name;
          if (OVERSEER_ALLOWED_TOOLS.has(toolName)) {
            logger.info(`[Overseer] Executing autonomous tool: ${toolName}`);
            await toolService.executeTool(toolName, result.intervention.toolToExecute.args, true);
          } else {
            logger.warn(`[Overseer] Blocked disallowed tool from LLM output: ${toolName}`);
          }
        }

        // Notify UI via Socket
        this.emitEvent('OVERSEER_DECISION', result);

        // Auto-Crystallize
        if (result.crystallize?.content) {
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

      const nudge = await groq.generateChatCompletion([
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
       // Silent fail
    }
  }
}

export const supervisorService = new SupervisorService();
