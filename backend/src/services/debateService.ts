import { AIProviderFactory } from './aiProviderFactory';
import { logger } from '../utils/logger';

export interface DebateRound {
  model: string;
  role: string;
  content: string;
}

export interface DebateResult {
  topic: string;
  rounds: DebateRound[];
  consensus: string;
}

const PROPONENT_SYSTEM = 'ROLE: PROPONENT — Your job is to champion the strongest possible solution. Be opinionated, specific, and decisive. Defend your choices with concrete reasoning.';
const CRITIC_SYSTEM = 'ROLE: CRITIC — Find weaknesses, scalability issues, security risks, and hidden assumptions. Be rigorous but fair — acknowledge strengths before dismantling flaws.';
const SYNTHESIZER_SYSTEM = 'ROLE: SYNTHESIZER — Produce a final decision that genuinely addresses the critique. Do not simply compromise — find the approach that is strongest after accounting for the identified risks.';

export class DebateService {
  async conductDebate(
    topic: string,
    proponentModel    = 'gemini-3.1-pro-preview',
    criticModel       = 'qwen2.5-coder:7b',
    proponentProviderName = 'gemini',
    criticProviderName    = 'ollama',
  ): Promise<DebateResult> {
    const rounds: DebateRound[] = [];
    const opts = { temperature: 0.7, maxTokens: 2048 };

    logger.info(`[DebateService] Starting debate | topic: "${topic}" | proponent: ${proponentProviderName}/${proponentModel} | critic: ${criticProviderName}/${criticModel}`);

    const proponentProvider = await AIProviderFactory.getProvider(proponentProviderName);
    const criticProvider    = await AIProviderFactory.getProvider(criticProviderName);

    // Round 1: Proponent proposes
    const proposalText = await proponentProvider.complete([
      { role: 'system', content: PROPONENT_SYSTEM },
      { role: 'user', content: `TOPIC: ${topic}\n\nPropose a technical architecture or solution for this topic. Be detailed and decisive.` }
    ], { ...opts, model: proponentModel });
    rounds.push({ model: proponentModel, role: 'proponent', content: proposalText });

    // Round 2: Critic critiques
    const critiqueText = await criticProvider.complete([
      { role: 'system', content: CRITIC_SYSTEM },
      { role: 'user', content: `TOPIC: ${topic}` },
      { role: 'assistant', content: proposalText },
      { role: 'user', content: 'Critically analyze the proposal above. Look for vulnerabilities, scalability issues, and technical debt. Be strict.' }
    ], { ...opts, model: criticModel });
    rounds.push({ model: criticModel, role: 'critic', content: critiqueText });

    // Round 3: Proponent synthesizes
    const synthesisText = await proponentProvider.complete([
      { role: 'system', content: SYNTHESIZER_SYSTEM },
      { role: 'user', content: `TOPIC: ${topic}` },
      { role: 'assistant', content: proposalText },
      { role: 'user', content: critiqueText },
      { role: 'user', content: 'Based on your original proposal and the critique provided, synthesize a final, high-fidelity architectural decision that addresses the concerns while maintaining the core vision.' }
    ], { ...opts, model: proponentModel });
    rounds.push({ model: proponentModel, role: 'synthesizer', content: synthesisText });

    return {
      topic,
      rounds,
      consensus: synthesisText
    };
  }
}

export const debateService = new DebateService();
