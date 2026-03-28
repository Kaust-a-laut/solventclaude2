import { ChatRequestData } from '../types/ai';
import { vectorService } from './vectorService';
import { getModelContextLimit } from '../constants/models';
import { memoryMetrics } from '../utils/memoryMetrics';
import { estimateTokens, getContextBudget } from '../utils/tokenEstimator';
import { BM25Index, reciprocalRankFusion } from '../utils/bm25';
import { statSync } from 'fs';
import { join } from 'path';
import { reranker } from './reranker';
import { coreMemory } from './coreMemory';

// --- Named Constants ---

/**
 * Number of entries to fetch for massive context models (100k+ tokens)
 */
const RETRIEVAL_COUNT_MASSIVE = 15;

/**
 * Number of entries to fetch for constrained context models (<16k tokens)
 */
const RETRIEVAL_COUNT_CONSTRAINED = 3;

/**
 * Default number of entries to fetch for standard models
 */
const RETRIEVAL_COUNT_DEFAULT = 8;

/**
 * Number of global rules to fetch for massive context models
 */
const RULES_COUNT_MASSIVE = 10;

/**
 * Number of global rules to fetch for standard/constrained models
 */
const RULES_COUNT_DEFAULT = 3;

/**
 * Cosine similarity threshold above which entries are considered duplicates
 */
const DEDUP_SIMILARITY_THRESHOLD = 0.92;

/**
 * Minimum score for an entry to be considered active (massive context)
 */
const MIN_SCORE_MASSIVE_CONTEXT = 0.50;

/**
 * Minimum score for an entry to be considered active (standard/constrained context)
 */
const MIN_SCORE_STANDARD_CONTEXT = 0.60;

/**
 * Maximum number of suppressed items to show in UI
 */
const MAX_SUPPRESSED_ITEMS_UI = 10;

/**
 * Score boost for universal patterns
 */
const SCORE_BOOST_UNIVERSAL = 0.35;

/**
 * Score boost for meta summaries
 */
const SCORE_BOOST_META_SUMMARY = 0.30;

/**
 * Score boost for crystallized memories
 */
const SCORE_BOOST_CRYSTALLIZED = 0.25;

/**
 * Score boost for permanent rules
 */
const SCORE_BOOST_PERMANENT_RULE = 0.20;

/**
 * Score boost for keyword matches
 */
const SCORE_BOOST_KEYWORD_MATCH = 0.15;

/**
 * Score boost for tag index matches
 */
const SCORE_BOOST_TAG_MATCH = 0.20;

/**
 * Score decay rate for code blocks (per day)
 */
const SCORE_DECAY_CODE_BLOCK_PER_DAY = 0.01;

/**
 * Score multiplier for linked memories
 */
const LINKED_MEMORY_SCORE_MULTIPLIER = 0.9;

/**
 * Score penalty for stale code blocks (file modified since indexing)
 */
const SCORE_PENALTY_STALE_CODE = 0.5;

/**
 * Score boost per retrieval (capped at 10 retrievals)
 */
const SCORE_BOOST_PER_RETRIEVAL = 0.02;
const MAX_RETRIEVAL_BOOST_COUNT = 10;

/**
 * Score boost per importance point (1-10 scale)
 */
const SCORE_BOOST_PER_IMPORTANCE = 0.04;

// Shared BM25 index instance — incrementally updated when vector memory changes
const bm25Index = new BM25Index();
let bm25IndexedIds = new Set<string>();

/**
 * Incrementally sync the BM25 index with vector memory.
 * Adds new documents and removes deleted ones instead of full rebuild.
 */
function ensureBM25Index() {
  const allDocs = vectorService.getAllTexts();
  const currentIds = new Set(allDocs.map(d => d.id));

  // Remove deleted documents
  for (const id of bm25IndexedIds) {
    if (!currentIds.has(id)) {
      bm25Index.removeDocument(id);
      bm25IndexedIds.delete(id);
    }
  }

  // Add new documents
  for (const doc of allDocs) {
    if (!bm25IndexedIds.has(doc.id)) {
      bm25Index.addDocument(doc);
      bm25IndexedIds.add(doc.id);
    }
  }
}

// --- Mode-Specific Instructions (Item 1) ---

interface ModeInstruction {
  persona: string;
  approach: string;
  constraints: string;
}

const MODE_INSTRUCTIONS: Record<string, ModeInstruction> = {
  chat: {
    persona: 'You are a collaborative engineering peer in a general conversation.',
    approach: 'Be conversational and direct. Use project memory to ground your responses. Suggest switching to a specialized mode only when it would meaningfully help — not as a reflex.',
    constraints: 'Do not impose structure on simple questions. Match the user\'s depth and energy.',
  },
  coding: {
    persona: 'You are the senior developer doing a live code review and pair-programming session.',
    approach: 'Every code block targeting a file must have the file path as a comment on line 1. Produce complete, working files — not illustrative snippets. Call out side effects, imports required, and other files that may need updating. If you are uncertain about the complete file, say so before producing partial code.',
    constraints: 'Never produce partial "here\'s the gist" code without explicitly flagging it as incomplete. If a task touches multiple files, name them all — do not silently scope to one.',
  },
  browser: {
    persona: 'You are a research lead synthesizing findings from a live web investigation.',
    approach: 'Ground every response in the actual URLs and content from [BROWSER CONTEXT] below. Extract actionable insights and connect them to concrete next steps. Always attribute claims to their source URL.',
    constraints: 'Do not speculate about page content not present in the browser context. If the context is stale or missing, say so rather than guessing.',
  },
  vision: {
    persona: 'You are a design engineer with a pixel-precise analytical eye.',
    approach: 'Enumerate visual elements systematically: layout structure, spacing, typography, color, component hierarchy. Distinguish between what you observe and what it implies for implementation. When producing UI component code, make it production-quality — not a sketch.',
    constraints: 'Never describe vague general impressions. Be specific about what you see: measurements, alignment, anomalies, patterns. If something is unclear in the image, say so.',
  },
  waterfall: {
    persona: 'You are a systems architect helping draft a mission brief before handing off to an autonomous pipeline.',
    approach: 'Think in phases: requirements → architecture → implementation → validation. Help the user sharpen their prompt for the Architect stage — ask clarifying questions about scope, constraints, and expected output format. Reference open files and project memory to ground the mission.',
    constraints: 'Do not write implementation code here — that is the pipeline\'s job. Your role is to make the mission brief precise enough that the Architect agent can produce a complete blueprint without ambiguity.',
  },
  debate: {
    persona: 'You are a committed participant in a structured debate — either proponent, critic, or synthesizer.',
    approach: 'Commit fully to your assigned role. Be specific, opinionated, and cite concrete evidence. Make arguments that stand on their own.',
    constraints: 'Do not hedge or present the other side\'s view unless you are in the synthesizer role.',
  },
  compare: {
    persona: 'You are one of several models being evaluated side by side on the same prompt.',
    approach: 'Be precise and show your reasoning chain visibly. The user is evaluating differences between models — make your approach and assumptions explicit.',
    constraints: 'No meta-commentary about the comparison process itself. Just answer the question as well as you can.',
  },
  collaborate: {
    persona: 'You are one specialist agent in a multi-agent team.',
    approach: 'State your domain and contribution explicitly. Hand off cleanly to other agents when their domain is more relevant. Coordinate on shared state rather than duplicating effort.',
    constraints: 'Do not silently take on work that belongs to another agent\'s domain.',
  },
  model_playground: {
    persona: 'You are being tested for capabilities and reasoning quality.',
    approach: 'Be transparent about your reasoning process. Narrate your thinking when it adds value. Be honest about the boundaries of your confidence.',
    constraints: 'Do not perform false certainty. Genuine uncertainty stated clearly is more useful than confident-sounding speculation.',
  },
  home: {
    persona: 'You are on the home screen — a welcoming entry point.',
    approach: 'Keep responses brief. Suggest the most relevant tool or mode based on what the user mentions.',
    constraints: 'One or two sentences is usually enough here.',
  },
};

function getModeBlock(mode?: string): string {
  if (!mode) return '';
  const m = MODE_INSTRUCTIONS[mode];
  if (!m) return '';
  return `\n## MODE: ${mode.toUpperCase()}\n${m.persona}\n\n${m.approach}\n\n${m.constraints}`;
}

// --- Model Awareness (Item 2) ---

function getModelAwarenessBlock(provider: string, model: string): string {
  const modelLower = (model || '').toLowerCase();
  const providerLower = (provider || '').toLowerCase();

  let tier: string;
  let instruction: string;

  if (modelLower.includes('7b') || modelLower.includes('8b') || modelLower === 'llama3' || providerLower === 'ollama') {
    tier = 'constrained';
    instruction = 'You are running on a constrained local model. Be concise. Prioritize correctness over completeness. Avoid long preambles.';
  } else if (modelLower.includes('70b') || modelLower.includes('32b') || modelLower.includes('mixtral') || modelLower.includes('gemini-2')) {
    tier = 'capable';
    instruction = 'You are running on a capable model. Provide thorough, well-structured responses. Balance depth with clarity.';
  } else if (modelLower.includes('gemini-3') || modelLower.includes('claude') || modelLower.includes('gpt-4')) {
    tier = 'frontier';
    instruction = 'You are running on a frontier-tier model. Leverage your full reasoning capability for nuanced analysis, edge case handling, and architectural insight.';
  } else {
    tier = 'standard';
    instruction = 'Provide clear, well-structured responses appropriate to the task complexity.';
  }

  return `**Model**: ${model} (${provider}) | Tier: ${tier}\n${instruction}`;
}

// --- Conversation State (Item 4) ---

function getConversationState(messages: Array<{ role: string; content?: string }>, data: ChatRequestData): string {
  const userMessages = messages.filter(m => m.role === 'user');
  const userMessageCount = userMessages.length;
  const lastUserMessage = userMessages[userMessages.length - 1];
  const lastMessageLength = lastUserMessage?.content?.length ?? 0;
  const hasOpenFiles = (data.openFiles?.length ?? 0) > 0;

  if (userMessageCount === 0) {
    return 'Fresh conversation. If the user sends a greeting, respond warmly and briefly. If it\'s a task, dive in.';
  }
  if (userMessageCount <= 3 && lastMessageLength < 120) {
    return 'Early exchange — keep it conversational and match the user\'s energy.';
  }
  if (userMessageCount <= 3 && lastMessageLength >= 120) {
    return 'First substantive message — the user has provided detail, respond with matching depth.';
  }
  if (userMessageCount <= 15 || hasOpenFiles) {
    return 'Active working session. Maintain continuity with earlier decisions. Reference them naturally, not by restating them.';
  }
  return 'Extended session. Be concise unless the user asks for depth. If the thread is getting tangled, suggest crystallizing key decisions.';
}

// --- Actionable Memory Formatting (Item 3) ---

function formatMemoryContext(activeItems: ProvenanceItem[]): string {
  if (activeItems.length === 0) {
    return 'Nothing relevant retrieved for this query. Memory grows as decisions get crystallized.';
  }

  const cleanText = (t: string) => t.replace(/\.\.\.$/, '').trim();

  const rules = activeItems.filter(i => i.type === 'PERMANENT_RULE');
  const decisions = activeItems.filter(i => i.type === 'ARCHITECTURAL_DECISION');
  const patterns = activeItems.filter(i => i.type === 'UNIVERSAL PATTERN' || i.type === 'META_SUMMARY');
  const code = activeItems.filter(i => i.type === 'CODE_BLOCK');
  const other = activeItems.filter(i =>
    !['PERMANENT_RULE', 'ARCHITECTURAL_DECISION', 'UNIVERSAL PATTERN', 'META_SUMMARY', 'CODE_BLOCK'].includes(i.type)
  );

  const parts: string[] = [];

  const contextItems = [...decisions, ...patterns, ...other];
  if (contextItems.length > 0) {
    parts.push('Some relevant context from our past work: ' + contextItems.map(i => cleanText(i.text)).join(' — '));
  }

  if (rules.length > 0) {
    const ruleText = rules.length === 1
      ? `There is a standing rule here: ${cleanText(rules[0]!.text)}.`
      : `Standing rules in effect: ${rules.map(r => cleanText(r.text)).join('; ')}.`;
    parts.push(ruleText);
  }

  if (code.length > 0) {
    parts.push('Related code patterns on file: ' + code.map(c => cleanText(c.text)).join(' | '));
  }

  return parts.join('\n\n');
}

// --- Types ---

export interface ProvenanceItem {
  id: string;
  text: string;
  type: string;
  source?: string;
  score: number;
  status: 'active' | 'suppressed';
  reason?: string;
}

export interface ContextProvenance {
  workspaceFiles: string[];
  active: ProvenanceItem[];
  suppressed: ProvenanceItem[];
  counts: {
    workspace: number;
    local: number;
    global: number;
    rules: number;
    tokenBudget?: number;
    tokensUsed?: number;
  };
}

// --- Helper Functions ---

/**
 * Computes a simple LSH-style hash for a vector by binarizing it.
 * This allows O(1) lookup for very similar vectors before doing expensive cosine similarity.
 */
function computeVectorSignature(vector: number[], buckets: number = 16): string {
  const bucketSize = Math.ceil(vector.length / buckets);
  const signature: number[] = [];
  
  for (let i = 0; i < buckets; i++) {
    let sum = 0;
    const start = i * bucketSize;
    const end = Math.min(start + bucketSize, vector.length);
    for (let j = start; j < end; j++) {
      sum += vector[j]!;
    }
    signature.push(sum > 0 ? 1 : 0);
  }
  
  return signature.join('');
}

/**
 * Efficiently deduplicates entries using LSH-style pre-filtering.
 * Only performs exact cosine similarity check against entries with matching signatures.
 */
function deduplicateEntries(
  scoredEntries: Array<{ vector: number[]; id: string; score: number; metadata: any; finalScore: number }>,
  suppressedItems: ProvenanceItem[]
): Array<typeof scoredEntries[0]> {
  const dedupedEntries: typeof scoredEntries = [];
  const duplicateIds = new Set<string>();
  
  // Group entries by their vector signature for O(1) pre-filtering
  const signatureMap = new Map<string, typeof scoredEntries>();
  
  for (const entry of scoredEntries) {
    if (duplicateIds.has(entry.id)) continue;
    
    const signature = computeVectorSignature(entry.vector);
    const candidates = signatureMap.get(signature) || [];
    
    // Check against entries with the same signature
    let isDuplicate = false;
    for (const kept of candidates) {
      const similarity = cosineSimilarity(entry.vector, kept.vector);
      if (similarity > DEDUP_SIMILARITY_THRESHOLD) {
        isDuplicate = true;
        duplicateIds.add(entry.id);
        memoryMetrics.recordDeduplication(similarity);
        
        // Add to suppressed with reason
        suppressedItems.push({
          id: entry.id,
          text: entry.metadata?.text ? entry.metadata.text.substring(0, 150) + '...' : '',
          type: entry.metadata?.type?.toUpperCase() || 'UNKNOWN',
          source: entry.metadata?.isUniversal ? 'GLOBAL' : 'LOCAL',
          score: entry.finalScore,
          status: 'suppressed',
          reason: 'Duplicate of higher-scored entry'
        });
        break;
      }
    }
    
    if (!isDuplicate) {
      dedupedEntries.push(entry);
      // Add to signature map for future comparisons
      candidates.push(entry);
      signatureMap.set(signature, candidates);
    }
  }
  
  return dedupedEntries;
}

/**
 * Computes cosine similarity between two vectors.
 */
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;

  let dotProduct = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < vecA.length; i++) {
    const a = vecA[i] ?? 0;
    const b = vecB[i] ?? 0;
    dotProduct += a * b;
    magA += a * a;
    magB += b * b;
  }
  const magnitude = Math.sqrt(magA) * Math.sqrt(magB);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
}

// --- Tool Awareness (keep in sync with TOOL_DEFINITIONS in constants/tools.ts) ---

function getToolAwarenessBlock(mode?: string): string {
  const modeLower = mode?.toLowerCase() ?? '';

  const fileTools = '`read_file`, `write_file`, `list_files`, `run_shell` — read, create, and modify project files; run safe shell commands (git, npm, tsc, etc.)';
  const researchTools = '`web_search`, `fetch_web_content` — search the web for real-time information or fetch a specific URL';
  const ideTools = '`ide_open_file`, `ide_show_diff`, `ide_run_in_sandbox` — open files in the editor, propose changes via diff, or run code in the browser sandbox';
  const visualTools = '`capture_ui`, `get_ui_text`, `resize_image`, `apply_image_filter` — capture the IDE state as a screenshot, extract workspace text, or manipulate images';
  const memoryTools = '`crystallize_memory` — permanently save a key decision, rule, or pattern to long-term memory (use proactively when the user confirms something worth persisting). `invalidate_memory` — mark an existing memory as stale when you find a contradiction';

  const groups: string[] = [];

  if (['coding', 'waterfall', 'chat', ''].includes(modeLower)) {
    groups.push(`File & workspace: ${fileTools}`);
  }
  groups.push(`Research: ${researchTools}`);
  if (modeLower === 'coding' || modeLower === '') {
    groups.push(`IDE actions: ${ideTools}`);
  }
  if (modeLower === 'vision' || modeLower === '') {
    groups.push(`Visual: ${visualTools}`);
  }
  groups.push(`Memory: ${memoryTools}`);

  return groups.map(g => `• ${g}`).join('\n');
}

// --- Browser Context Injection ---

function getBrowserContextBlock(browserContext?: ChatRequestData['browserContext']): string {
  if (!browserContext) return '';

  const lines: string[] = [];

  if ((browserContext.history?.length ?? 0) > 0) {
    const recentPages = [...new Set(browserContext.history)].slice(-5);
    lines.push(`Pages visited this session: ${recentPages.join(', ')}`);
  }

  if (browserContext.lastSearchResults && browserContext.lastSearchResults.length > 0) {
    const results = browserContext.lastSearchResults.slice(0, 5);
    lines.push('Last search results:');
    results.forEach(r => {
      const snippet = r.snippet ? ` — ${r.snippet.substring(0, 100)}` : '';
      lines.push(`  • "${r.title}"${snippet} [${r.link}]`);
    });
  }

  if (lines.length === 0) return '';

  return `\n**[BROWSER CONTEXT — CURRENT SESSION]**\n${lines.join('\n')}`;
}

// --- ContextService Class ---

export class ContextService {
  async enrichContext(data: ChatRequestData): Promise<{ messages: any[], provenance: ContextProvenance }> {
    const lastMessage = data.messages[data.messages.length - 1]?.content || "";
    const modelLimit = getModelContextLimit(data.model);

    const isMassiveContext = modelLimit >= 100000;
    const isConstrained = modelLimit < 16000;

    // Token budget for memory retrieval (replaces fixed entry counts as primary limit)
    const budget = getContextBudget(data.model, data.maxTokens || 2048);
    // Keep fixed counts as secondary safety cap
    const maxRetrievalCount = isMassiveContext ? RETRIEVAL_COUNT_MASSIVE : (isConstrained ? RETRIEVAL_COUNT_CONSTRAINED : RETRIEVAL_COUNT_DEFAULT);
    const rulesCount = isMassiveContext ? RULES_COUNT_MASSIVE : RULES_COUNT_DEFAULT;

    const keywords = lastMessage.match(/\b([a-zA-Z0-9_-]{5,})\b/g) || [];
    const uniqueKeywords = [...new Set(keywords)];

    // 1. Fetch Global Rules first (The Guardrails)
    const globalRules = await vectorService.search('global project rules', rulesCount, { type: 'permanent_rule' });
    const rulesContext = globalRules.map(r => `> [RULE]: ${r.metadata.text}`).join('\n');

    // 2. Fetch Candidates
    // Use keywords to find high-probability candidates via tag index
    const tagCandidatesIds = new Set<string>();
    for (const kw of uniqueKeywords) {
      const ids = vectorService.tagIndex.get(kw.toLowerCase());
      if (ids) ids.forEach((id: string) => tagCandidatesIds.add(id));
    }

    const relevantEntries = await vectorService.search(lastMessage, maxRetrievalCount + 5);
    const universalPatterns = await vectorService.search(lastMessage, 5, { tier: 'meta-summary' });

    // BM25 hybrid search — merge keyword and vector signals via Reciprocal Rank Fusion
    ensureBM25Index();
    const bm25Results = bm25Index.search(lastMessage, maxRetrievalCount * 3);
    const rrfRanking = reciprocalRankFusion(
      relevantEntries.map(e => ({ id: e.id, score: e.score })),
      bm25Results
    );
    const rrfScoreMap = new Map(rrfRanking.map(r => [r.id, r.rrfScore]));

    // Bring in BM25-only results that vector search missed
    const vectorIdSet = new Set(relevantEntries.map(e => e.id));
    for (const bm25Result of bm25Results.slice(0, 10)) {
      if (!vectorIdSet.has(bm25Result.id)) {
        const entry = vectorService.getEntryById(bm25Result.id);
        if (entry) {
          relevantEntries.push({ ...entry, score: 0.5 });
        }
      }
    }

    // 2b. Cross-encoder reranking for top candidates via LLM
    const reranked = await reranker.rerank(lastMessage, relevantEntries.slice(0, 20));
    const rerankerScoreMap = new Map(reranked.map(r => [r.id, r.rerankerScore]));

    // 2c. Traversal of Links for top candidates
    const topCandidates = relevantEntries.slice(0, 5);
    const linkedMemories: any[] = [];
    for (const cand of topCandidates) {
      if (cand.metadata.links && Array.isArray(cand.metadata.links)) {
        const linked = vectorService.getEntriesByIds(cand.metadata.links);
        linked.forEach(m => {
          if (m?.id && !relevantEntries.find(re => re.id === m.id)) {
            linkedMemories.push({ ...m, score: cand.score * LINKED_MEMORY_SCORE_MULTIPLIER });
          }
        });
      }
    }

    const combinedCandidates = [...relevantEntries, ...linkedMemories];
    universalPatterns.forEach(up => {
      if (up.metadata.isUniversal && !combinedCandidates.find(ce => ce.id === up.id)) {
        combinedCandidates.push(up);
      }
    });

    const activeItems: ProvenanceItem[] = [];
    const suppressedItems: ProvenanceItem[] = [];

    // File mtime cache for stale code detection (scoped to this request)
    const mtimeCache = new Map<string, number>();
    function getFileMtime(filePath: string): number | null {
      if (mtimeCache.has(filePath)) return mtimeCache.get(filePath)!;
      try {
        const fullPath = join(process.cwd(), filePath);
        const mtime = statSync(fullPath).mtimeMs;
        mtimeCache.set(filePath, mtime);
        return mtime;
      } catch {
        mtimeCache.set(filePath, -1);
        return null;
      }
    }

    const scoredEntries = combinedCandidates.map(e => {
      let finalScore = e.score;
      const ageHours = (Date.now() - new Date(e.metadata.timestamp || e.metadata.createdAt || 0).getTime()) / (1000 * 60 * 60);

      if (e.metadata.isUniversal) finalScore += SCORE_BOOST_UNIVERSAL;
      else if (e.metadata.type === 'meta_summary') finalScore += SCORE_BOOST_META_SUMMARY;
      else if (e.metadata.crystallized) finalScore += SCORE_BOOST_CRYSTALLIZED;
      else if (e.metadata.type === 'permanent_rule') finalScore += SCORE_BOOST_PERMANENT_RULE;
      else if (e.metadata.type === 'code_block') {
        finalScore -= (ageHours / 24) * SCORE_DECAY_CODE_BLOCK_PER_DAY;
        // Stale code detection: penalize if source file was modified since indexing
        if (e.metadata.filePath && e.metadata.fileModifiedAt) {
          const currentMtime = getFileMtime(e.metadata.filePath);
          if (currentMtime !== null && currentMtime > e.metadata.fileModifiedAt) {
            finalScore -= SCORE_PENALTY_STALE_CODE;
          }
        }
      }

      // RRF hybrid score boost (replaces simple keyword match boost)
      const rrfBoost = rrfScoreMap.get(e.id);
      if (rrfBoost) {
        finalScore += rrfBoost * 10;
      }
      
      // Reranker boost (cross-encoder LLM scoring)
      const rerankerBoost = rerankerScoreMap.get(e.id);
      if (rerankerBoost !== undefined) {
        finalScore += rerankerBoost * 0.05;
      }

      // Tag match boost
      if (tagCandidatesIds.has(e.id)) finalScore += SCORE_BOOST_TAG_MATCH;

      // Retrieval reinforcement: boost entries that have been retrieved frequently
      const entryRetrievalCount = e.metadata.retrievalCount || 0;
      if (entryRetrievalCount > 0) {
        finalScore += SCORE_BOOST_PER_RETRIEVAL * Math.min(entryRetrievalCount, MAX_RETRIEVAL_BOOST_COUNT);
      }

      // Importance score boost (1-10 scale from LLM rating at write time)
      const importance = e.metadata.importance || 5;
      finalScore += importance * SCORE_BOOST_PER_IMPORTANCE;

      return { ...e, finalScore };
    }).sort((a, b) => b.finalScore - a.finalScore);

    // --- SEMANTIC DEDUPLICATION (Optimized with LSH-style pre-filtering) ---
    const dedupedEntries = deduplicateEntries(scoredEntries, suppressedItems);

    // 3. Process Logic: Active vs Suppressed — token-budget-aware selection
    const minScore = isMassiveContext ? MIN_SCORE_MASSIVE_CONTEXT : MIN_SCORE_STANDARD_CONTEXT;
    let memoryTokensUsed = 0;

    for (const entry of dedupedEntries) {
      const item: ProvenanceItem = {
        id: entry.id,
        text: entry.metadata?.text ? entry.metadata.text.substring(0, 150) + '...' : '',
        type: entry.metadata?.isUniversal ? 'UNIVERSAL PATTERN' : (entry.metadata?.type?.toUpperCase() ?? 'UNKNOWN'),
        source: entry.metadata.isUniversal ? 'GLOBAL' : 'LOCAL',
        score: entry.finalScore,
        status: 'active'
      };

      if (entry.finalScore < minScore) {
        item.status = 'suppressed';
        item.reason = 'Low Relevance';
        suppressedItems.push(item);
        continue;
      }

      // Conflict Check: negation rule + keyword overlap heuristic
      const NEGATION_WORDS = ['no', 'don\'t', 'never', 'avoid', 'stop', 'not'];
      const STOP_WORDS = new Set(['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her', 'was', 'one', 'our', 'had', 'but', 'with', 'have', 'this', 'will', 'from', 'they', 'that', 'what', 'been', 'when', 'there', 'make', 'like', 'into', 'then', 'some', 'him', 'its', 'your', 'just', 'should', 'about', 'more']);
      const tokenize = (text: string) =>
        text.toLowerCase().split(/\W+/).filter(w => w.length >= 4 && !STOP_WORDS.has(w));
      const hasConflict = globalRules.some(r => {
        const ruleText = r.metadata.text.toLowerCase();
        const isNegationRule = NEGATION_WORDS.some(w => ruleText.includes(w));
        if (!isNegationRule) return false;
        const ruleTokens = new Set(tokenize(ruleText));
        if (ruleTokens.size === 0) return false;
        const itemTokens = new Set(tokenize(item.text));
        const overlap = [...ruleTokens].filter(t => itemTokens.has(t)).length;
        return overlap / Math.min(ruleTokens.size, itemTokens.size) >= 0.3;
      });

      if (hasConflict) {
        item.status = 'suppressed';
        item.reason = 'Conflict with Local Rule';
        suppressedItems.push(item);
      } else {
        // Token budget check (primary) + entry count check (secondary safety cap)
        const entryTokenCost = estimateTokens(entry.metadata?.text || '');
        if (memoryTokensUsed + entryTokenCost <= budget.memory && activeItems.length < maxRetrievalCount) {
          activeItems.push(item);
          memoryTokensUsed += entryTokenCost;
        } else {
          item.status = 'suppressed';
          item.reason = 'Context Window Limit';
          suppressedItems.push(item);
        }
      }
    }

    // Record retrieval for reinforcement (fire-and-forget)
    if (activeItems.length > 0) {
      vectorService.recordRetrieval(activeItems.map(i => i.id)).catch(() => {});
    }

    const provenance: ContextProvenance = {
      workspaceFiles: data.openFiles?.map(f => f.path) || [],
      active: activeItems,
      suppressed: suppressedItems.slice(0, MAX_SUPPRESSED_ITEMS_UI),
      counts: {
        workspace: data.openFiles?.length || 0,
        local: activeItems.filter(i => i.source === 'LOCAL').length,
        global: activeItems.filter(i => i.source === 'GLOBAL').length,
        rules: globalRules.length,
        tokenBudget: budget.memory,
        tokensUsed: memoryTokensUsed
      }
    };

    const systemPrompt = {
      role: 'system' as const,
      content: `# COLLABORATIVE ENGINEERING PARTNER

## WHO YOU ARE
You are an AI engineering partner embedded in Solvent, a live desktop IDE suite.
You operate inside a multi-agent system that includes:
- A persistent Vector Memory (crystallized rules, past decisions, architectural facts pulled from this project's history)
- An autonomous Overseer that watches sessions in real time and intervenes when needed
- A Waterfall pipeline for complex multi-step code generation missions
- A multi-agent Orchestration layer that runs specialist agents (PM, Engineer, Security, Researcher) in parallel

Think of yourself as the senior engineer who has been on this project from day one. You know the patterns, the decisions, the rules. Use that knowledge.

## AVAILABLE FEATURES
- **Chat**: General conversation, Q&A, brainstorming. Best for exploratory discussion and quick questions.
- **Coding Suite**: Full IDE with Monaco editor, file tree, and diff viewer. Use for writing, editing, or reviewing code in a single file.
- **Waterfall**: Multi-step code generation pipeline (architect → implement → validate). Suggest for complex, multi-file tasks.
- **Debate**: Two models argue opposing positions, then synthesize. Suggest for architectural decisions or trade-off analysis.
- **Compare**: Run the same prompt across multiple models side by side. Suggest when the user wants to evaluate model quality.
- **Multi-Agent Orchestration**: Specialist agents (PM, Engineer, Security, Researcher) run in parallel. Suggest for deep analysis or comprehensive reviews.
- **SolventSee**: Vision & media analysis lab. Suggest for UI screenshot analysis, image generation, or visual verification tasks.
- **Web Browser**: AI-native browser with page extraction, summarization, and search. Suggest when the user needs real-time web data or research.

Only suggest a feature switch when it would genuinely help the user's current task.

## AVAILABLE TOOLS
${getToolAwarenessBlock(data.mode)}

Use tools proactively when they would help — don't wait to be asked. For example, use \`web_search\` when you need current information, or \`crystallize_memory\` when the user confirms an important decision.

## PERSONALITY & TONE

You are a **pragmatic, experienced engineer** who:
- Gets straight to the point but never sounds robotic
- Adjusts tone to the situation: casual for greetings, focused for deep work, patient for explanations
- Pivots naturally between mission-focused execution and open-ended conversation — if the user wants to brainstorm, brainstorm; if they want code, write code
- Admits uncertainty confidently ("I'm not certain about X, but here's how we can find out")
- Never talks down or uses condescending phrases like "Actually,..." or "You should know that..."
- Treats the user as a capable peer, not a student
- Is reciprocative — when the user shares an idea or shows you something, engage with it genuinely before moving to next steps

**Tone matching:**
- User is casual → You're casual ("Hey! What are we building today?")
- User is focused → You're focused ("Let's tackle this. Here's the approach...")
- User is frustrated → You're calm and solution-oriented ("I see the issue. Let's fix it.")
- User is exploring → You're curious and engaged ("We could go a few directions here...")
- User is sharing/showing → You're interested and responsive ("Nice — that's a clean approach. Here's what I'd build on top of it...")

## OPERATING PRINCIPLES — FOLLOW THESE IN EVERY RESPONSE

1. **PRECISION OVER PADDING**: Lead with the answer. Explain only what changes the user's understanding. Skip affirmations ("Great question!"), filler, and unnecessary caveats. Length signal: a one-line question gets a short answer. A detailed technical question gets full depth. A request for code gets the complete file. Never pad to seem thorough — but never truncate to seem concise either.

2. **MEMORY-FIRST**: Before reasoning from scratch, check [PROJECT MEMORY] below. If a rule or past decision is relevant, weave it naturally into your response — "we decided X because Y" not "per the ARCHITECTURAL_DECISION entry...". Do not re-derive what is already known.

3. **HONESTY ABOUT UNCERTAINTY**: If you do not know a file name, API signature, or dependency — say so. Do not invent plausible-sounding details. Offer a path to find the answer instead.

4. **MISSION ALIGNMENT**: When [LIVE MISSION DIRECTIVES] is set, treat it as your active task brief. When it's not set, simply be helpful and responsive to whatever the user asks — no need to demand a mission.

5. **SYSTEM AWARENESS**: You are one layer of a multi-agent system. When you draw on memory, mention it naturally. When a task would benefit from a different tool or mode, suggest it by name. Only suggest a feature switch when it would genuinely help.

6. **NATURAL CONVERSATION**: For greetings, simple questions, or exploratory chat — respond naturally like a colleague. Don't force structure or demand mission directives. Be helpful first. When the user is conversational, be conversational back.

7. **ONE THING AT A TIME**: Don't overwhelm with multiple options unless the user is genuinely exploring. Pick the most likely path and offer it. If they want alternatives, they'll ask.

8. **ASSUME COMPETENCE, PROVIDE CONTEXT**: The user is technically capable. Don't over-explain basics. But do provide context for project-specific decisions, since you have memory they might not.

## CONVERSATION PATTERNS

**When greeting:**
- Keep it brief and friendly — "Hey, what are you working on?" or similar
- Optionally reference what you see (open files, recent work) if relevant
- Don't demand a mission or task

**When user is stuck:**
- Acknowledge the frustration briefly
- Diagnose the root cause
- Offer a concrete next step

**When explaining:**
- Start with the mental model, not the details
- Use analogies to familiar concepts when helpful
- Go as deep as the topic warrants — don't artificially truncate complex explanations
- Check understanding: "Does that make sense?" or "Want me to go deeper?"

**When you made a wrong assumption:**
- Own it directly: "I misread that — let me correct..."
- Don't over-apologize, just fix it
- Learn from it for the rest of the conversation

**When the request is ambiguous:**
- Ask ONE specific clarifying question
- Suggest what you'd assume if they don't clarify: "If you're looking for X, I'd suggest..."

**When your previous answer had an error:**
- Acknowledge it directly without over-apologizing
- Provide the complete corrected version — not a patch or diff
- Briefly explain what went wrong so the user can trust the fix

**When the user reports something isn't working:**
- Diagnose first — ask for the error message or unexpected behavior
- Check open files and project memory for relevant context
- Provide a targeted fix rather than rewriting from scratch

**When the user shares something or is thinking out loud:**
- Engage with their thought — don't just redirect to a task
- Build on their idea or ask a genuine follow-up question
- It's okay to just have a conversation sometimes

## CURRENT SESSION CONTEXT

${getModelAwarenessBlock(data.provider, data.model)}

**Conversation state**: ${getConversationState(data.messages, data)}
${getModeBlock(data.mode)}

**[LIVE MISSION DIRECTIVES]**
${data.notepadContent ? `"${data.notepadContent}"` : 'No active mission — ready to help with whatever you need.'}

**[OPEN WORKSPACE FILES]**
${provenance.workspaceFiles.length > 0
  ? provenance.workspaceFiles.map(f => `• ${f}${data.activeFile && f === data.activeFile ? ' ← **Active tab**' : ''}`).join('\n')
  : '• No files currently open in the workspace.'}
${getBrowserContextBlock(data.browserContext)}

${(() => {
  const coreBlock = coreMemory.toContextBlock();
  return coreBlock ? `\n[CORE MEMORY — Always Available]\n${coreBlock}\n` : '';
})()}

**[PROJECT MEMORY — RETRIEVED CONTEXT]**
${formatMemoryContext(activeItems)}

**[ESTABLISHED RULES — ALWAYS HONOR THESE]**
${rulesContext || '• No permanent rules set yet. Rules are added via the crystallize_memory tool or by the Overseer.'}

## RESPONSE FORMATTING

- **For code**: Include the target file path as a comment on line 1. Write complete, working code — not illustrative snippets unless explicitly asked. Code may be applied directly to a Monaco editor — ensure it is syntactically complete.
- **For modifications**: Describe what changed and why in 1-2 sentences before the code block — the user has a diff viewer.
- **For explanations and complex answers**: Go as deep as needed. Use the structure: **Answer** → **Why** → **What to do next** when it adds clarity. Skip this for simple questions.
- **For architectural questions**: Reference project memory naturally, then reason from there.
- **For ambiguous requests**: Ask one clarifying question. Do not guess and produce the wrong thing.
- **For errors in your own previous responses**: Correct directly. Provide the complete corrected version, not a patch.
- **For greetings/casual chat**: No special format needed — just respond naturally.`
    };

    return { messages: [systemPrompt, ...data.messages], provenance };
  }
}

export const contextService = new ContextService();
