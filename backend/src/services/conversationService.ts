import { v4 as uuid } from 'uuid';
import { orchestrationService, MissionTemplate, MissionAgent } from './orchestrationService';
import { providerSelector } from './providerSelector';
import { pluginManager } from './pluginManager';
import { vectorService } from './vectorService';
import { logger } from '../utils/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ConversationMessage {
  id: string;
  agentId: string;
  agentName: string;
  content: string;
  turnNumber: number;
  addressing?: string;
  type: 'contribution' | 'delegation' | 'agreement' | 'disagreement' | 'synthesis' | 'user_interjection';
}

export interface ConversationSession {
  id: string;
  goal: string;
  missionType: string;
  agents: Array<{ id: string; name: string; role: string }>;
  transcript: ConversationMessage[];
  synthesis: string | null;
  status: 'active' | 'converging' | 'synthesizing' | 'complete' | 'cancelled';
  currentRound: number;
  consensusScore: number;
}

export interface ConversationEvent {
  event: string;
  data: Record<string, unknown>;
}

// ─── In-memory session + interjection stores ──────────────────────────────────

const sessions = new Map<string, ConversationSession>();
const interjectionQueues = new Map<string, string[]>();

// ─── Turn Manager ─────────────────────────────────────────────────────────────

function determineNextSpeaker(
  agents: MissionAgent[],
  transcript: ConversationMessage[],
  currentRound: number
): MissionAgent {
  const lastMsg = transcript[transcript.length - 1];

  // Priority 1: Last message addressed a specific agent
  if (lastMsg?.addressing) {
    const addressed = agents.find(a => a.id === lastMsg.addressing);
    if (addressed) return addressed;
  }

  // Priority 2: User interjected -> least-recent agent responds
  if (lastMsg?.type === 'user_interjection') {
    const agentLastSpoke = new Map<string, number>();
    for (let i = transcript.length - 1; i >= 0; i--) {
      const msg = transcript[i];
      if (msg.agentId !== 'user' && !agentLastSpoke.has(msg.agentId)) {
        agentLastSpoke.set(msg.agentId, i);
      }
    }
    // Agent who spoke least recently
    let leastRecent: MissionAgent = agents[0];
    let leastRecentIdx = Infinity;
    for (const agent of agents) {
      const idx = agentLastSpoke.get(agent.id) ?? -1;
      if (idx < leastRecentIdx) {
        leastRecentIdx = idx;
        leastRecent = agent;
      }
    }
    return leastRecent;
  }

  // Priority 3: Round-robin within current round
  const spokenThisRound = new Set<string>();
  for (let i = transcript.length - 1; i >= 0; i--) {
    const msg = transcript[i];
    if (msg.agentId === 'user') continue;
    // Count backwards until we've seen enough turns for this round
    if (spokenThisRound.size >= agents.length) break;
    spokenThisRound.add(msg.agentId);
  }

  // Find next agent who hasn't spoken this round
  for (const agent of agents) {
    if (!spokenThisRound.has(agent.id)) return agent;
  }

  // Everyone spoke — start new round, first agent goes
  return agents[0];
}

// ─── Delegation / addressing detection ────────────────────────────────────────

function detectAddressing(content: string, agents: MissionAgent[]): string | undefined {
  // Check for @mentions or "Name, what do you think" patterns
  for (const agent of agents) {
    const patterns = [
      new RegExp(`@${agent.id}\\b`, 'i'),
      new RegExp(`@${agent.name}\\b`, 'i'),
      new RegExp(`${agent.name},\\s+(what|how|do you|could you|can you|would you)`, 'i'),
      new RegExp(`(ask|defer to|hand off to|over to)\\s+(?:the\\s+)?${agent.name}`, 'i'),
    ];
    if (patterns.some(p => p.test(content))) return agent.id;
  }
  return undefined;
}

function classifyMessageType(
  content: string,
  transcript: ConversationMessage[]
): ConversationMessage['type'] {
  const lower = content.toLowerCase();
  if (/\bi agree\b|\bthat's right\b|\bexactly\b|\bgood point\b/.test(lower)) return 'agreement';
  if (/\bi disagree\b|\bhowever\b|\bon the contrary\b|\bpush back\b/.test(lower)) return 'disagreement';
  if (/\bwhat do you think\b|\bover to you\b|\byour take\b/.test(lower)) return 'delegation';
  return 'contribution';
}

// ─── Convergence check ────────────────────────────────────────────────────────

async function checkConvergence(
  transcript: ConversationMessage[],
  goal: string
): Promise<number> {
  if (transcript.length < 3) return 0;

  try {
    const provider = await providerSelector.select({
      priority: 'cost',
      requirements: { inputTokens: 500, outputTokens: 50 }
    });

    const recentMsgs = transcript.slice(-6).map(m =>
      `[${m.agentName}]: ${m.content.substring(0, 200)}`
    ).join('\n');

    const response = await provider.complete(
      [{
        role: 'user',
        content: `Score the convergence of this team discussion from 0-100. 100 means full consensus reached, 0 means completely divergent. Respond with ONLY a number.

GOAL: ${goal}

RECENT DISCUSSION:
${recentMsgs}

CONVERGENCE SCORE (0-100):`
      }],
      { model: provider.defaultModel || 'default', maxTokens: 10 }
    );

    const score = parseInt(response.trim(), 10);
    return isNaN(score) ? 50 : Math.min(100, Math.max(0, score));
  } catch (e) {
    logger.warn('[ConversationService] Convergence check failed, defaulting to 50:', e);
    return 50;
  }
}

// ─── Build agent prompt ───────────────────────────────────────────────────────

function buildAgentPrompt(
  agent: MissionAgent,
  allAgents: MissionAgent[],
  transcript: ConversationMessage[],
  goal: string
): Array<{ role: 'system' | 'user'; content: string }> {
  const roster = allAgents
    .filter(a => a.id !== agent.id)
    .map(a => `- ${a.name} (${a.id})`)
    .join('\n');

  const systemPrompt = `${agent.instruction}

You are in a collaborative roundtable discussion with these other experts:
${roster}

CONVERSATION RULES:
1. Address other experts by name when responding to their points.
2. Build on or constructively challenge specific points made by others.
3. Keep your response to 2-4 paragraphs maximum.
4. Be direct and substantive. Avoid filler language.
5. If you want another expert to weigh in, address them directly.
6. Work toward actionable consensus — don't repeat yourself.`;

  const transcriptStr = transcript
    .map(m => `[${m.agentName}]: ${m.content}`)
    .join('\n\n');

  const userPrompt = transcriptStr
    ? `GOAL: ${goal}\n\nCONVERSATION SO FAR:\n${transcriptStr}\n\nIt's your turn. Respond to the discussion above.`
    : `GOAL: ${goal}\n\nYou are speaking first. Open the discussion with your expert perspective on this goal.`;

  return [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: userPrompt }
  ];
}

// ─── Main conversation generator ──────────────────────────────────────────────

export async function* runConversation(
  goal: string,
  missionType: string,
  signal?: AbortSignal
): AsyncGenerator<ConversationEvent, void, void> {
  const template = orchestrationService.getTemplate(missionType);
  if (!template) throw new Error(`Unknown mission type: ${missionType}`);

  const sessionId = uuid();
  const agents = template.agents;
  const maxRounds = Math.max(3, agents.length);
  const maxTurns = agents.length * maxRounds;

  const session: ConversationSession = {
    id: sessionId,
    goal,
    missionType,
    agents: agents.map(a => ({ id: a.id, name: a.name, role: a.id })),
    transcript: [],
    synthesis: null,
    status: 'active',
    currentRound: 1,
    consensusScore: 0,
  };
  sessions.set(sessionId, session);
  interjectionQueues.set(sessionId, []);

  // Emit session start
  yield {
    event: 'session_start',
    data: {
      sessionId,
      agents: session.agents,
      goal,
      maxRounds,
    }
  };

  // Select a provider for the conversation
  let provider;
  try {
    provider = await providerSelector.select({
      priority: 'cost',
      requirements: { inputTokens: 2000, outputTokens: 500 }
    });
  } catch {
    // Fallback to any available provider
    provider = await pluginManager.resolveProvider('groq');
  }
  const model = provider.defaultModel || 'default';

  // Fetch relevant project memory
  const memories = await vectorService.search(goal, 3).catch(() => []);
  const memoryContext = memories.filter(m => m.score > 0.6).length > 0
    ? '\n\nPROJECT CONTEXT:\n' + memories.filter(m => m.score > 0.6).map(m => `- ${m.metadata.text}`).join('\n')
    : '';

  const fullGoal = goal + memoryContext;

  let turnNumber = 0;

  while (turnNumber < maxTurns && session.status === 'active') {
    if (signal?.aborted) {
      session.status = 'cancelled';
      break;
    }

    // Check interjection queue between turns
    const queue = interjectionQueues.get(sessionId);
    if (queue && queue.length > 0) {
      const userMsg = queue.shift()!;
      const interjection: ConversationMessage = {
        id: uuid(),
        agentId: 'user',
        agentName: 'User',
        content: userMsg,
        turnNumber: ++turnNumber,
        type: 'user_interjection',
      };
      session.transcript.push(interjection);

      yield {
        event: 'agent_done',
        data: {
          agentId: 'user',
          agentName: 'User',
          content: userMsg,
          turnNumber: interjection.turnNumber,
          type: 'user_interjection',
        }
      };
    }

    // Determine next speaker
    const nextAgent = determineNextSpeaker(agents, session.transcript, session.currentRound);

    yield {
      event: 'agent_thinking',
      data: { agentId: nextAgent.id, agentName: nextAgent.name }
    };

    // Build prompt and call LLM
    const messages = buildAgentPrompt(nextAgent, agents, session.transcript, fullGoal);

    let content = '';
    try {
      content = await provider.complete(messages, {
        model,
        maxTokens: 1024,
        signal,
      });
    } catch (e: any) {
      if (signal?.aborted) {
        session.status = 'cancelled';
        break;
      }
      logger.error(`[ConversationService] Agent ${nextAgent.id} failed:`, e.message);
      content = `[I encountered an issue formulating my response. Let me defer to the next expert.]`;
    }

    turnNumber++;
    const addressing = detectAddressing(content, agents);
    const msgType = classifyMessageType(content, session.transcript);

    const message: ConversationMessage = {
      id: uuid(),
      agentId: nextAgent.id,
      agentName: nextAgent.name,
      content,
      turnNumber,
      addressing,
      type: msgType,
    };
    session.transcript.push(message);

    // Stream tokens as a single chunk (provider.complete doesn't stream token-by-token)
    // Emit the full response
    yield {
      event: 'agent_token',
      data: { agentId: nextAgent.id, token: content }
    };

    yield {
      event: 'agent_done',
      data: {
        agentId: nextAgent.id,
        agentName: nextAgent.name,
        content,
        turnNumber,
        type: msgType,
        addressing,
      }
    };

    // Check if we completed a round (all agents spoke)
    const agentTurnsThisRound = session.transcript
      .filter(m => m.agentId !== 'user')
      .slice(-agents.length);
    const uniqueSpeakers = new Set(agentTurnsThisRound.map(m => m.agentId));

    if (uniqueSpeakers.size >= agents.length) {
      // Full round complete — check convergence
      const consensusScore = await checkConvergence(session.transcript, goal);
      session.consensusScore = consensusScore;
      session.currentRound++;

      yield {
        event: 'round_complete',
        data: { round: session.currentRound - 1, consensusScore }
      };

      if (consensusScore >= 80) {
        session.status = 'converging';
        break;
      }
    }
  }

  // ── Synthesis pass ────────────────────────────────────────────────────────────
  if (session.status !== 'cancelled') {
    session.status = 'synthesizing';

    yield { event: 'synthesizing', data: {} };

    const transcriptStr = session.transcript
      .map(m => `[${m.agentName}]: ${m.content}`)
      .join('\n\n');

    const synthesisPrompt = `You are a senior technical synthesizer. You have observed a collaborative roundtable discussion among ${agents.length} experts regarding: "${goal}"

FULL DISCUSSION TRANSCRIPT:
${transcriptStr}

INVARIANTS (must be honored):
${template.intentAssertions.map(a => `- ${a}`).join('\n')}

SYNTHESIS TASK:
${template.synthesisInstruction}

IMPORTANT:
- Reference specific points of agreement and disagreement from the discussion.
- Surface the key consensus that emerged.
- Note any unresolved tensions.
- Provide 3-5 prioritized, actionable next steps.`;

    try {
      const synthesis = await provider.complete(
        [{ role: 'user', content: synthesisPrompt }],
        { model, maxTokens: 2048, signal }
      );

      session.synthesis = synthesis;
      session.status = 'complete';

      yield {
        event: 'synthesis_token',
        data: { token: synthesis }
      };

      yield {
        event: 'synthesis_done',
        data: { synthesis }
      };
    } catch (e: any) {
      if (!signal?.aborted) {
        logger.error('[ConversationService] Synthesis failed:', e.message);
        session.synthesis = 'Synthesis failed — please review the transcript above for key takeaways.';
        session.status = 'complete';
        yield {
          event: 'synthesis_done',
          data: { synthesis: session.synthesis }
        };
      }
    }
  }

  // Persist synthesis to memory
  if (session.synthesis) {
    await vectorService.addEntry(session.synthesis, {
      type: 'conversation_synthesis',
      missionType,
      goal,
      timestamp: new Date().toISOString(),
    }).catch(() => {});
  }

  yield {
    event: 'session_complete',
    data: {
      transcript: session.transcript,
      synthesis: session.synthesis,
    }
  };

  // Clean up in-memory session data to prevent memory leaks
  sessions.delete(sessionId);
  interjectionQueues.delete(sessionId);
}

// ─── Public helpers ───────────────────────────────────────────────────────────

export function injectUserMessage(sessionId: string, message: string): boolean {
  const queue = interjectionQueues.get(sessionId);
  if (!queue) return false;
  queue.push(message);
  return true;
}

export function getSession(sessionId: string): ConversationSession | undefined {
  return sessions.get(sessionId);
}

export function triggerSynthesis(sessionId: string): boolean {
  const session = sessions.get(sessionId);
  if (!session || session.status !== 'active') return false;
  session.status = 'converging';
  return true;
}
