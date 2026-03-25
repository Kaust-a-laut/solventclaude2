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
  // Check for @mentions, direct questions, and natural conversational references
  for (const agent of agents) {
    const name = agent.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // escape regex chars
    const patterns = [
      new RegExp(`@${agent.id}\\b`, 'i'),
      new RegExp(`@${name}\\b`, 'i'),
      new RegExp(`${name},\\s+(what|how|do you|could you|can you|would you)`, 'i'),
      new RegExp(`(ask|defer to|hand off to|over to)\\s+(?:the\\s+)?${name}`, 'i'),
      // Natural conversational references
      new RegExp(`(building on|responding to|as|like)\\s+(?:the\\s+)?${name}`, 'i'),
      new RegExp(`${name}'s\\s+(point|concern|analysis|suggestion|proposal|argument|finding|objection)`, 'i'),
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
  // Agreement — require explicit agreement phrases, not just hedging words
  if (/\bi agree\b|\bthat's (a good|an excellent|a fair|a valid) point\b|\bexactly right\b|\bwell said\b|\bspot on\b|\bthat's right\b/.test(lower)) return 'agreement';
  // Disagreement — require explicit pushback, not just "however" which is common in normal discussion
  if (/\bi (disagree|push back|take issue)\b|\bthat's not (right|accurate|correct)\b|\bon the contrary\b|\bi'd challenge\b|\bthat overlooks\b/.test(lower)) return 'disagreement';
  // Delegation — handing off to another speaker
  if (/\bwhat do you think\b|\bover to you\b|\byour take\b|\bi'd like to hear from\b|\bweigh in\b/.test(lower)) return 'delegation';
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
  goal: string,
  currentRound: number
): Array<{ role: 'system' | 'user'; content: string }> {
  // Use conversation-specific instruction if available, fall back to original
  const instruction = agent.conversationInstruction || agent.instruction;

  const roster = allAgents
    .filter(a => a.id !== agent.id)
    .map(a => `- ${a.name} (${a.id})`)
    .join('\n');

  // Round-aware conversation rules
  const roundGuidance = currentRound <= 1
    ? 'This is Round 1. Present your initial expert perspective on the goal. You may reference the roster above to set expectations for who should weigh in on what.'
    : `This is Round ${currentRound}. The discussion is underway. Focus on responding to what others have said — build on agreements, challenge disagreements, and push toward actionable consensus. Do NOT restate your previous points. Add new insight or react to new information.`;

  const systemPrompt = `${instruction}

You are in a collaborative roundtable discussion with these other experts:
${roster}

${roundGuidance}

CONVERSATION RULES:
1. You MUST reference at least one specific point from a previous speaker by name (e.g., "I agree with Lead Engineer's point about X, but..."). The only exception is if you are the very first speaker.
2. Build on, challenge, or extend specific claims — do not produce an independent report.
3. Keep your response to 2-4 paragraphs maximum. Be direct and substantive.
4. Do NOT repeat your own previous points. If you've already said it, move on.
5. If you want another expert to weigh in on something specific, address them directly by name.
6. Do NOT use structured report formats (VERDICT, FINDINGS, RISK LEVEL, etc.). Write in natural conversational prose.`;

  // Enhanced transcript format — show addressing relationships
  const transcriptStr = transcript
    .map(m => {
      const addressingNote = m.addressing
        ? ` (responding to ${allAgents.find(a => a.id === m.addressing)?.name || m.addressing})`
        : '';
      return `[${m.agentName}${addressingNote}]: ${m.content}`;
    })
    .join('\n\n');

  let userPrompt: string;
  if (!transcriptStr) {
    userPrompt = `GOAL: ${goal}\n\nYou are speaking first. Open the discussion with your expert perspective on this goal. Be direct and set the stage for the other experts to respond.`;
  } else {
    userPrompt = `GOAL: ${goal}\n\nCONVERSATION SO FAR:\n${transcriptStr}\n\nIt's your turn. Engage with what others have said — respond to their specific points, challenge or build on their arguments, and advance the discussion toward a conclusion.`;
  }

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
    const messages = buildAgentPrompt(nextAgent, agents, session.transcript, fullGoal, session.currentRound);

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
