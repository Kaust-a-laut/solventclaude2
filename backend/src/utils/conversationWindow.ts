import { AIProviderFactory } from '../services/aiProviderFactory';
import { logger } from './logger';
import { estimateTokens, estimateMessagesTokens } from './tokenEstimator';
import type { ChatMessage } from '../types/ai';
import { createHash } from 'crypto';

// Number of recent message pairs to always preserve verbatim
const RECENT_PAIRS_TO_KEEP = 4;
const SUMMARY_MODEL = 'llama-3.3-70b-versatile';

// In-memory cache for conversation summaries to avoid re-summarizing
const summaryCache = new Map<string, { summary: string; timestamp: number }>();
const MAX_CACHE_ENTRIES = 20;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Compute a hash for a set of messages to use as cache key.
 */
function hashMessages(messages: ChatMessage[]): string {
  const text = messages.map(m => `${m.role}:${m.content?.slice(0, 200)}`).join('|');
  return createHash('sha256').update(text).digest('hex').slice(0, 16);
}

/**
 * Evict stale entries from the summary cache.
 */
function evictStaleCache() {
  const now = Date.now();
  for (const [key, entry] of summaryCache) {
    if (now - entry.timestamp > CACHE_TTL_MS) {
      summaryCache.delete(key);
    }
  }
  // LRU eviction if still over limit
  while (summaryCache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = summaryCache.keys().next().value;
    if (oldestKey) summaryCache.delete(oldestKey);
  }
}

/**
 * Summarize a block of messages into a concise summary.
 * Falls back to truncation if the LLM call fails.
 */
async function summarizeMessages(messages: ChatMessage[]): Promise<string> {
  const cacheKey = hashMessages(messages);

  // Check cache first
  const cached = summaryCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.summary;
  }

  try {
    const groq = await AIProviderFactory.getProvider('groq');
    const transcript = messages
      .map(m => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n\n');

    const summary = await groq.complete([
      { role: 'system', content: 'You are a conversation summarizer. Produce a concise summary that preserves key decisions, questions, code references, and technical context. Omit greetings and filler.' },
      { role: 'user', content: `Summarize the following conversation segment in 3-5 dense paragraphs:\n\n${transcript}` }
    ], { model: SUMMARY_MODEL, temperature: 0.1, maxTokens: 512 });

    // Cache the result
    evictStaleCache();
    summaryCache.set(cacheKey, { summary, timestamp: Date.now() });

    return summary;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn(`[ConversationWindow] Summarization failed, falling back to truncation: ${message}`);
    // Fallback: take first and last message of the block
    const first = messages[0]?.content?.slice(0, 200) || '';
    const last = messages[messages.length - 1]?.content?.slice(0, 200) || '';
    return `[Earlier conversation truncated. First message: "${first}..." Last message: "${last}..."]`;
  }
}

export interface FitResult {
  messages: ChatMessage[];
  wasTruncated: boolean;
  summarizedCount: number;
}

/**
 * Fit a conversation into a token budget using a three-tier strategy:
 * 1. Always keep: system messages + last N message pairs
 * 2. Summarize: older messages compressed into a summary
 * 3. Truncate: drop if even the summary is too large
 */
export async function fitConversation(
  messages: ChatMessage[],
  tokenBudget: number
): Promise<FitResult> {
  // If already within budget, return as-is
  const currentTokens = estimateMessagesTokens(messages);
  if (currentTokens <= tokenBudget) {
    return { messages, wasTruncated: false, summarizedCount: 0 };
  }

  // Separate system messages from conversation messages
  const systemMessages: ChatMessage[] = [];
  const conversationMessages: ChatMessage[] = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemMessages.push(msg);
    } else {
      conversationMessages.push(msg);
    }
  }

  // Always keep the most recent messages (last N pairs)
  const recentCount = Math.min(conversationMessages.length, RECENT_PAIRS_TO_KEEP * 2);
  const recentMessages = conversationMessages.slice(-recentCount);
  const olderMessages = conversationMessages.slice(0, -recentCount);

  // If no older messages to summarize, we can only keep what fits
  if (olderMessages.length === 0) {
    // Just system + recent, can't compress further
    return {
      messages: [...systemMessages, ...recentMessages],
      wasTruncated: true,
      summarizedCount: 0
    };
  }

  // Calculate token budget available for the summary
  const systemTokens = estimateMessagesTokens(systemMessages);
  const recentTokens = estimateMessagesTokens(recentMessages);
  const summaryBudget = tokenBudget - systemTokens - recentTokens;

  if (summaryBudget <= 100) {
    // No room for a summary — just keep system + recent
    return {
      messages: [...systemMessages, ...recentMessages],
      wasTruncated: true,
      summarizedCount: olderMessages.length
    };
  }

  // Summarize older messages
  const summary = await summarizeMessages(olderMessages);
  const summaryTokens = estimateTokens(summary);

  // If summary fits, insert it
  if (summaryTokens <= summaryBudget) {
    const summaryMessage: ChatMessage = {
      role: 'system',
      content: `[CONVERSATION SUMMARY — ${olderMessages.length} earlier messages compressed]\n\n${summary}`
    };

    return {
      messages: [...systemMessages, summaryMessage, ...recentMessages],
      wasTruncated: true,
      summarizedCount: olderMessages.length
    };
  }

  // Summary is too large — truncate it to fit
  const maxSummaryChars = summaryBudget * 4; // rough inverse of token estimation
  const truncatedSummary = summary.slice(0, maxSummaryChars);
  const summaryMessage: ChatMessage = {
    role: 'system',
    content: `[CONVERSATION SUMMARY — ${olderMessages.length} earlier messages compressed, truncated]\n\n${truncatedSummary}...`
  };

  return {
    messages: [...systemMessages, summaryMessage, ...recentMessages],
    wasTruncated: true,
    summarizedCount: olderMessages.length
  };
}
