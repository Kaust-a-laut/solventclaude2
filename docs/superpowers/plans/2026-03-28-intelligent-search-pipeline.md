# Intelligent Search Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wrap Brave Search with a 4-stage LLM pipeline (Query Expansion → Search → AI Re-rank → AI Synthesis) and surface the results through a progressive stepper UI in the browser panel.

**Architecture:** New `IntelligentSearchService` composes the existing `SearchService` and the Groq provider plugin. The frontend `BrowserArea` gains three new UI sections (pipeline stepper, synthesis card, relevance badges). The `/search` endpoint response shape expands with optional `synthesis`, `expandedQuery`, and `stats` fields — existing consumers degrade gracefully since these fields are additive.

**Tech Stack:** TypeScript, Express, Axios (Groq API via OpenAI-compatible protocol), React, Framer Motion, Tailwind CSS, Zustand, Vitest

---

### Task 1: Extend SearchResultSet Type

**Files:**
- Modify: `frontend/src/store/types.ts:105-110`

- [ ] **Step 1: Update the SearchResultSet interface**

Open `frontend/src/store/types.ts` and replace the existing `SearchResultSet` interface (lines 105-110):

```typescript
export interface SearchResultSet {
  results: any[];
  answerBox?: any;
  relatedSearches?: { query: string }[];
  error?: string;
  synthesis?: {
    answer: string;
    sources: string[];
  };
  expandedQuery?: string;
  stats?: {
    totalFound: number;
    totalRelevant: number;
    pipelineMs: number;
  };
}
```

- [ ] **Step 2: Verify the frontend compiles**

Run: `cd /home/caleb/solventclaude2/dazzling-shirley/frontend && npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors (existing errors are acceptable; no errors referencing `SearchResultSet`).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/store/types.ts
git commit -m "feat(types): extend SearchResultSet with synthesis, expandedQuery, stats fields"
```

---

### Task 2: Update Search Request Schema & Controller

**Files:**
- Modify: `backend/src/controllers/aiController.ts:47-50` (search schema)
- Modify: `backend/src/controllers/aiController.ts:130-146` (search handler)

- [ ] **Step 1: Extend the search request Zod schema**

In `backend/src/controllers/aiController.ts`, replace the `searchRequestSchema` (lines 47-50):

```typescript
const searchRequestSchema = z.object({
  query: z.string().min(1, 'Query is required'),
  page: z.number().int().min(1).optional(),
  expandedQuery: z.string().optional(),
});
```

- [ ] **Step 2: Update the search handler to use IntelligentSearchService**

Replace the `search` method (lines 130-146):

```typescript
static async search(req: Request, res: Response) {
  try {
    const parseResult = searchRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid request body',
        details: parseResult.error.errors
      });
    }
    const { query, page, expandedQuery } = parseResult.data;
    const { intelligentSearchService } = await import('../services/intelligentSearchService');
    const result = await intelligentSearchService.search(query, page, expandedQuery);
    res.json(result);
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    res.status(500).json({ error: err.message });
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/controllers/aiController.ts
git commit -m "feat(controller): wire search endpoint to intelligent search pipeline"
```

---

### Task 3: Create IntelligentSearchService — Query Expansion (Stage 1)

**Files:**
- Create: `backend/src/services/intelligentSearchService.ts`

- [ ] **Step 1: Create the service file with expandQuery method**

Create `backend/src/services/intelligentSearchService.ts`:

```typescript
import { searchService } from './searchService';
import { AIProviderFactory } from './aiProviderFactory';
import { logger } from '../utils/logger';

interface RankedResult {
  title: string;
  link: string;
  snippet: string;
  position: number;
  relevanceScore: number;
}

interface Synthesis {
  answer: string;
  sources: string[];
}

interface IntelligentSearchResult {
  results: RankedResult[];
  answerBox?: any;
  relatedSearches?: { query: string }[];
  synthesis?: Synthesis;
  expandedQuery?: string;
  stats?: {
    totalFound: number;
    totalRelevant: number;
    pipelineMs: number;
  };
}

class IntelligentSearchService {
  /**
   * Stage 1: Query Expansion
   * Rewrites the user query for better search recall using Groq LLM.
   */
  private async expandQuery(query: string): Promise<string> {
    try {
      const groq = await AIProviderFactory.getProvider('groq');
      const response = await groq.complete(
        [
          {
            role: 'system',
            content: `You are a search query optimizer. Given a user query, rewrite it to be more specific and comprehensive for web search. Add relevant technical terms, synonyms, and the current year (2026) for temporal context. Do NOT answer the question — return ONLY the refined search query string. Keep it under 150 characters.`,
          },
          { role: 'user', content: query },
        ],
        {
          model: 'llama-3.3-70b-versatile',
          temperature: 0.2,
          maxTokens: 150,
        }
      );
      const expanded = response.trim();
      logger.info(`[IntelligentSearch] Expanded query: "${query}" → "${expanded}"`);
      return expanded || query;
    } catch (error) {
      logger.warn(`[IntelligentSearch] Query expansion failed, using original query: ${error}`);
      return query;
    }
  }

  async search(query: string, page: number = 1, cachedExpandedQuery?: string): Promise<IntelligentSearchResult> {
    const startTime = Date.now();

    // Stage 1: Query Expansion (skip on pagination if cached)
    const expandedQuery = cachedExpandedQuery || await this.expandQuery(query);

    // Stage 2: Brave Search
    const rawResults = await searchService.webSearch(expandedQuery, page);
    const totalFound = rawResults.results?.length || 0;

    // On pagination (page > 1), skip re-ranking and synthesis
    if (page > 1) {
      return {
        results: (rawResults.results || []).map((r: any, i: number) => ({
          title: r.title,
          link: r.link,
          snippet: r.snippet,
          position: i + 1,
          relevanceScore: 0,
        })),
        answerBox: rawResults.answerBox,
        relatedSearches: rawResults.relatedSearches,
        expandedQuery,
        stats: {
          totalFound,
          totalRelevant: totalFound,
          pipelineMs: Date.now() - startTime,
        },
      };
    }

    // Stage 3: AI Re-rank (implemented in Task 4)
    const rankedResults = await this.rerankResults(query, rawResults.results || []);
    const totalRelevant = rankedResults.length;

    // Stage 4: AI Synthesis (implemented in Task 5)
    const synthesis = await this.synthesize(query, rankedResults.slice(0, 8));

    const pipelineMs = Date.now() - startTime;
    if (pipelineMs > 5000) {
      logger.warn(`[IntelligentSearch] Pipeline exceeded 5s budget: ${pipelineMs}ms`);
    }

    return {
      results: rankedResults,
      answerBox: rawResults.answerBox,
      relatedSearches: rawResults.relatedSearches,
      synthesis,
      expandedQuery,
      stats: { totalFound, totalRelevant, pipelineMs },
    };
  }

  /**
   * Stage 3: AI Re-rank & Filter (placeholder — implemented in Task 4)
   */
  private async rerankResults(query: string, results: any[]): Promise<RankedResult[]> {
    return results.map((r: any, i: number) => ({
      title: r.title,
      link: r.link,
      snippet: r.snippet,
      position: i + 1,
      relevanceScore: 0,
    }));
  }

  /**
   * Stage 4: AI Synthesis (placeholder — implemented in Task 5)
   */
  private async synthesize(query: string, results: RankedResult[]): Promise<Synthesis | undefined> {
    return undefined;
  }
}

export const intelligentSearchService = new IntelligentSearchService();
```

- [ ] **Step 2: Verify backend compiles**

Run: `cd /home/caleb/solventclaude2/dazzling-shirley/backend && npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors referencing `intelligentSearchService`.

- [ ] **Step 3: Commit**

```bash
git add backend/src/services/intelligentSearchService.ts
git commit -m "feat(search): add IntelligentSearchService with query expansion (stage 1)"
```

---

### Task 4: Implement AI Re-rank & Filter (Stage 3)

**Files:**
- Modify: `backend/src/services/intelligentSearchService.ts` (replace `rerankResults` placeholder)

- [ ] **Step 1: Replace the rerankResults placeholder**

In `backend/src/services/intelligentSearchService.ts`, replace the `rerankResults` method:

```typescript
/**
 * Stage 3: AI Re-rank & Filter
 * LLM scores each result 0-100 for relevance, removes duplicates and low scores.
 */
private async rerankResults(query: string, results: any[]): Promise<RankedResult[]> {
  if (!results.length) return [];

  try {
    const groq = await AIProviderFactory.getProvider('groq');

    const resultsForLLM = results.map((r: any, i: number) => ({
      index: i,
      title: r.title,
      url: r.link,
      snippet: r.snippet,
    }));

    const response = await groq.complete(
      [
        {
          role: 'system',
          content: `You are a search result ranker. Given a user query and a list of search results, score each result 0-100 for relevance to the user's intent. Remove duplicates (same domain + similar title). Return JSON only.

Output schema:
{
  "results": [{ "index": <number>, "score": <number>, "reason": "<brief reason>" }],
  "removed": <number of removed results>
}

Sort by score descending. Only include results scoring 40 or above.`,
        },
        {
          role: 'user',
          content: `Query: "${query}"\n\nResults:\n${JSON.stringify(resultsForLLM, null, 2)}`,
        },
      ],
      {
        model: 'llama-3.3-70b-versatile',
        temperature: 0.1,
        maxTokens: 2048,
        jsonMode: true,
      }
    );

    const parsed = JSON.parse(response);
    const ranked: RankedResult[] = [];

    for (const item of parsed.results || []) {
      const original = results[item.index];
      if (!original) continue;
      ranked.push({
        title: original.title,
        link: original.link,
        snippet: original.snippet,
        position: ranked.length + 1,
        relevanceScore: item.score,
      });
    }

    logger.info(`[IntelligentSearch] Re-ranked: ${results.length} → ${ranked.length} results (${parsed.removed || 0} removed)`);
    return ranked;
  } catch (error) {
    logger.warn(`[IntelligentSearch] Re-rank failed, returning raw results: ${error}`);
    return results.map((r: any, i: number) => ({
      title: r.title,
      link: r.link,
      snippet: r.snippet,
      position: i + 1,
      relevanceScore: 0,
    }));
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/services/intelligentSearchService.ts
git commit -m "feat(search): implement AI re-rank and filter (stage 3)"
```

---

### Task 5: Implement AI Synthesis (Stage 4)

**Files:**
- Modify: `backend/src/services/intelligentSearchService.ts` (replace `synthesize` placeholder)

- [ ] **Step 1: Replace the synthesize placeholder**

In `backend/src/services/intelligentSearchService.ts`, replace the `synthesize` method:

```typescript
/**
 * Stage 4: AI Synthesis
 * Generates a concise answer from the top re-ranked results.
 */
private async synthesize(query: string, results: RankedResult[]): Promise<Synthesis | undefined> {
  if (!results.length) return undefined;

  try {
    const groq = await AIProviderFactory.getProvider('groq');

    const context = results.map((r, i) => `[${i + 1}] ${r.title} (${r.link})\n${r.snippet}`).join('\n\n');

    const response = await groq.complete(
      [
        {
          role: 'system',
          content: `You are a search synthesis engine. Given a user query and top search results, generate a concise direct answer (2-4 sentences) that synthesizes information across the results. Include source attribution. Return JSON only.

Output schema:
{
  "answer": "<2-4 sentence synthesis with inline technical terms in backticks>",
  "sources": ["<url1>", "<url2>", ...]
}

Only include URLs that directly informed the answer.`,
        },
        {
          role: 'user',
          content: `Query: "${query}"\n\nTop Results:\n${context}`,
        },
      ],
      {
        model: 'llama-3.3-70b-versatile',
        temperature: 0.3,
        maxTokens: 512,
        jsonMode: true,
      }
    );

    const parsed = JSON.parse(response);
    logger.info(`[IntelligentSearch] Synthesis generated from ${parsed.sources?.length || 0} sources`);
    return {
      answer: parsed.answer || '',
      sources: parsed.sources || [],
    };
  } catch (error) {
    logger.warn(`[IntelligentSearch] Synthesis failed, omitting: ${error}`);
    return undefined;
  }
}
```

- [ ] **Step 2: Verify backend compiles**

Run: `cd /home/caleb/solventclaude2/dazzling-shirley/backend && npx tsc --noEmit 2>&1 | head -20`
Expected: Clean compile.

- [ ] **Step 3: Commit**

```bash
git add backend/src/services/intelligentSearchService.ts
git commit -m "feat(search): implement AI synthesis (stage 4)"
```

---

### Task 6: Update ChatService Frontend Client

**Files:**
- Modify: `frontend/src/services/ChatService.ts:198-207`

- [ ] **Step 1: Update the search method to pass expandedQuery**

In `frontend/src/services/ChatService.ts`, replace the `search` method (lines 198-207):

```typescript
static async search(query: string, page?: number, expandedQuery?: string) {
  const data = await fetchWithRetry(`${API_BASE_URL}/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, page, expandedQuery }),
    retries: 2
  }) as any;

  return data;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/services/ChatService.ts
git commit -m "feat(client): pass expandedQuery through ChatService.search()"
```

---

### Task 7: Build Pipeline Stepper Component

**Files:**
- Create: `frontend/src/components/SearchPipelineStepper.tsx`

- [ ] **Step 1: Create the stepper component**

Create `frontend/src/components/SearchPipelineStepper.tsx`:

```typescript
import React from 'react';
import { motion } from 'framer-motion';
import { Check, Search, Sparkles, BarChart3, Zap } from 'lucide-react';
import { cn } from '../lib/utils';

type PipelineStage = 'idle' | 'expanding' | 'searching' | 'ranking' | 'synthesizing' | 'complete';

interface StepperProps {
  stage: PipelineStage;
  stats?: {
    totalFound: number;
    totalRelevant: number;
    pipelineMs: number;
  };
  expandedQuery?: string;
}

const STAGES = [
  { key: 'expanding', label: 'Refining query', icon: Zap, color: 'text-blue-400', bg: 'bg-blue-400', glow: 'shadow-blue-400/40' },
  { key: 'searching', label: 'Searching', icon: Search, color: 'text-purple-400', bg: 'bg-purple-400', glow: 'shadow-purple-400/40' },
  { key: 'ranking', label: 'Ranking', icon: BarChart3, color: 'text-orange-400', bg: 'bg-orange-400', glow: 'shadow-orange-400/40' },
  { key: 'synthesizing', label: 'Synthesizing', icon: Sparkles, color: 'text-emerald-400', bg: 'bg-emerald-400', glow: 'shadow-emerald-400/40' },
] as const;

function getStageIndex(stage: PipelineStage): number {
  const map: Record<string, number> = { expanding: 0, searching: 1, ranking: 2, synthesizing: 3, complete: 4 };
  return map[stage] ?? -1;
}

export const SearchPipelineStepper: React.FC<StepperProps> = ({ stage, stats, expandedQuery }) => {
  if (stage === 'idle') return null;

  const activeIdx = getStageIndex(stage);
  const isComplete = stage === 'complete';

  return (
    <div className="w-full max-w-[700px] mx-auto mb-8">
      {/* Stepper bar */}
      <div className="flex items-center justify-between gap-0">
        {STAGES.map((s, i) => {
          const isActive = s.key === stage;
          const isDone = activeIdx > i || isComplete;
          const isPending = activeIdx < i && !isComplete;
          const Icon = s.icon;

          return (
            <React.Fragment key={s.key}>
              {/* Connector line (before each step except first) */}
              {i > 0 && (
                <div className="flex-1 h-px relative">
                  <div className="absolute inset-0 bg-white/5" />
                  {isDone && (
                    <motion.div
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: 0.3 }}
                      className={cn('absolute inset-0 origin-left', s.bg, 'opacity-40')}
                    />
                  )}
                </div>
              )}

              {/* Step circle + label */}
              <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                <motion.div
                  animate={isActive ? { scale: [1, 1.15, 1] } : {}}
                  transition={isActive ? { repeat: Infinity, duration: 1.5 } : {}}
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center border transition-all',
                    isComplete ? 'w-6 h-6' : '',
                    isDone && `${s.bg} border-transparent`,
                    isActive && `${s.bg} border-transparent shadow-lg ${s.glow}`,
                    isPending && 'bg-white/5 border-white/10',
                  )}
                >
                  {isDone && !isActive ? (
                    <Check size={isComplete ? 10 : 14} className="text-white" />
                  ) : (
                    <Icon size={isComplete ? 10 : 14} className={cn(isPending ? 'text-white/20' : 'text-white')} />
                  )}
                </motion.div>
                <span className={cn(
                  'text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap',
                  isComplete && 'text-[9px]',
                  isDone && !isActive && 'text-slate-500',
                  isActive && `${s.color} font-black`,
                  isPending && 'text-slate-700',
                )}>
                  {isDone && !isActive && stats
                    ? i === 1 ? `${stats.totalFound} found` : i === 2 ? `${stats.totalRelevant} relevant` : s.label
                    : isActive && stats && i === 2 ? `Ranking ${stats.totalFound} results` : s.label}
                </span>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Expanded query display */}
      {expandedQuery && activeIdx >= 1 && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-[11px] text-slate-500 italic text-center mt-3 truncate px-4"
        >
          Refined: {expandedQuery}
        </motion.p>
      )}
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/SearchPipelineStepper.tsx
git commit -m "feat(ui): add SearchPipelineStepper component"
```

---

### Task 8: Build Synthesis Card Component

**Files:**
- Create: `frontend/src/components/SearchSynthesisCard.tsx`

- [ ] **Step 1: Create the synthesis card component**

Create `frontend/src/components/SearchSynthesisCard.tsx`:

```typescript
import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { cn } from '../lib/utils';

interface SynthesisCardProps {
  synthesis: {
    answer: string;
    sources: string[];
  };
  isLoading?: boolean;
  onSourceClick?: (url: string) => void;
}

export const SearchSynthesisCard: React.FC<SynthesisCardProps> = ({ synthesis, isLoading, onSourceClick }) => {
  if (isLoading) {
    return (
      <div className="rounded-2xl bg-emerald-500/[0.04] border border-emerald-500/10 p-6 mb-8 relative overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-emerald-500 to-blue-500" />
        <div className="flex items-center gap-2 mb-4">
          <Sparkles size={14} className="text-emerald-400 animate-pulse" />
          <span className="text-[11px] font-black text-emerald-400 uppercase tracking-[0.3em]">AI Synthesis</span>
        </div>
        {/* Skeleton shimmers */}
        <div className="space-y-2">
          <div className="h-4 bg-white/5 rounded-lg animate-pulse w-full" />
          <div className="h-4 bg-white/5 rounded-lg animate-pulse w-4/5" />
          <div className="h-4 bg-white/5 rounded-lg animate-pulse w-3/5" />
        </div>
      </div>
    );
  }

  if (!synthesis?.answer) return null;

  // Extract domain from URL for source badges
  const getDomain = (url: string): string => {
    try { return new URL(url).hostname.replace('www.', ''); } catch { return url; }
  };

  const visibleSources = synthesis.sources.slice(0, 4);
  const overflowCount = synthesis.sources.length - visibleSources.length;

  // Render answer with backtick code spans
  const renderAnswer = (text: string) => {
    const parts = text.split(/(`[^`]+`)/g);
    return parts.map((part, i) =>
      part.startsWith('`') && part.endsWith('`')
        ? <code key={i} className="px-1.5 py-0.5 bg-white/5 text-emerald-300 text-xs rounded font-mono">{part.slice(1, -1)}</code>
        : <span key={i}>{part}</span>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-emerald-500/[0.04] border border-emerald-500/10 p-6 mb-8 relative overflow-hidden"
    >
      {/* Left accent border */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-emerald-500 to-blue-500" />

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-emerald-400" />
          <span className="text-[11px] font-black text-emerald-400 uppercase tracking-[0.3em]">AI Synthesis</span>
        </div>
        <span className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">
          from {synthesis.sources.length} source{synthesis.sources.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Answer body */}
      <p className="text-sm text-slate-300 leading-relaxed mb-4">
        {renderAnswer(synthesis.answer)}
      </p>

      {/* Source badges */}
      <div className="flex flex-wrap gap-2">
        {visibleSources.map((url, i) => (
          <button
            key={i}
            onClick={() => onSourceClick?.(url)}
            className="px-2.5 py-1 bg-white/5 border border-white/10 text-[10px] font-bold text-slate-400 uppercase tracking-widest rounded-lg hover:border-emerald-500/30 hover:text-emerald-400 transition-all"
          >
            {getDomain(url)}
          </button>
        ))}
        {overflowCount > 0 && (
          <span className="px-2.5 py-1 bg-white/5 border border-white/10 text-[10px] font-bold text-slate-500 uppercase tracking-widest rounded-lg">
            +{overflowCount} more
          </span>
        )}
      </div>
    </motion.div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/SearchSynthesisCard.tsx
git commit -m "feat(ui): add SearchSynthesisCard component"
```

---

### Task 9: Build Relevance Badge Component

**Files:**
- Create: `frontend/src/components/RelevanceBadge.tsx`

- [ ] **Step 1: Create the relevance badge component**

Create `frontend/src/components/RelevanceBadge.tsx`:

```typescript
import React from 'react';
import { cn } from '../lib/utils';

interface RelevanceBadgeProps {
  score: number;
}

export const RelevanceBadge: React.FC<RelevanceBadgeProps> = ({ score }) => {
  if (score < 60) return null;

  const isHigh = score >= 85;

  return (
    <span className={cn(
      'inline-flex items-center px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest rounded-md',
      isHigh
        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
        : 'bg-orange-400/10 text-orange-400 border border-orange-400/20'
    )}>
      {score}%
    </span>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/RelevanceBadge.tsx
git commit -m "feat(ui): add RelevanceBadge component for search results"
```

---

### Task 10: Integrate Pipeline UI into BrowserArea

**Files:**
- Modify: `frontend/src/components/BrowserArea.tsx`

This is the largest frontend change. We need to:
1. Add pipeline stage state tracking
2. Wire handleNavigate to use progressive stages
3. Insert stepper, synthesis card, and relevance badges into the search results view
4. Pass expandedQuery on pagination

- [ ] **Step 1: Add imports and pipeline state**

At the top of `BrowserArea.tsx`, add imports after the existing ones (after line 14):

```typescript
import { SearchPipelineStepper } from './SearchPipelineStepper';
import { SearchSynthesisCard } from './SearchSynthesisCard';
import { RelevanceBadge } from './RelevanceBadge';

type PipelineStage = 'idle' | 'expanding' | 'searching' | 'ranking' | 'synthesizing' | 'complete';
```

Inside the `BrowserArea` component (after line 112, after the `showSummaryInput` state), add:

```typescript
const [pipelineStage, setPipelineStage] = useState<PipelineStage>('idle');
```

- [ ] **Step 2: Update handleNavigate for progressive pipeline**

Replace the search branch of `handleNavigate` (the `else` block starting around line 151). The full `handleNavigate` callback should become:

```typescript
const handleNavigate = useCallback(async (newUrl: string) => {
  if (!newUrl.trim()) return;
  setInputUrl(newUrl);
  setSummary(null);
  updateBrowserTab(tabId, { isLoading: true });

  if (newUrl.startsWith('http')) {
    // Reader mode (unchanged)
    try {
      const pageContent: PageContent = await ChatService.browse(newUrl);
      updateBrowserTab(tabId, {
        type: 'reader',
        url: newUrl,
        label: pageContent.title?.slice(0, 20) || safeHostname(newUrl),
        pageContent,
        searchResults: null,
        isLoading: false,
      });
      setLastSearchResults(null);
      setPipelineStage('idle');
    } catch (error: any) {
      updateBrowserTab(tabId, {
        type: 'reader',
        url: newUrl,
        label: safeHostname(newUrl),
        pageContent: null,
        searchResults: null,
        isLoading: false,
      });
      setPipelineStage('idle');
    }
  } else {
    // Search mode with progressive pipeline stages
    setPipelineStage('expanding');
    try {
      // Fire the pipeline (backend handles all 4 stages)
      setPipelineStage('searching');
      const results = await ChatService.search(newUrl);

      // Show ranking stage briefly
      setPipelineStage('ranking');
      await new Promise(r => setTimeout(r, 200));

      // Show synthesizing stage briefly
      if (results?.synthesis) {
        setPipelineStage('synthesizing');
        await new Promise(r => setTimeout(r, 300));
      }

      const items = results?.results || results?.organic || [];
      const answer = results?.answerBox || null;
      const related = results?.relatedSearches || [];

      const searchData: SearchResultSet = {
        results: items,
        answerBox: answer,
        relatedSearches: related,
        synthesis: results?.synthesis,
        expandedQuery: results?.expandedQuery,
        stats: results?.stats,
      };
      if (!items.length && !answer) {
        searchData.error = 'Zero matches returned';
      }

      updateBrowserTab(tabId, {
        type: 'search',
        url: newUrl,
        label: newUrl.slice(0, 20),
        searchResults: searchData,
        pageContent: null,
        searchPage: 1,
        isLoading: false,
      });
      setLastSearchResults(searchData);
      setPipelineStage('complete');
    } catch (error: any) {
      updateBrowserTab(tabId, {
        type: 'search',
        searchResults: { results: [], error: error.message || 'Network bridge failure' },
        isLoading: false,
      });
      setLastSearchResults({ results: [], error: error.message });
      setPipelineStage('idle');
    }
  }

  setBrowserHistory([...browserHistory, newUrl]);
}, [tabId, browserHistory, setBrowserHistory, setLastSearchResults, updateBrowserTab]);
```

- [ ] **Step 3: Update handleLoadMore to pass expandedQuery**

Replace the `handleLoadMore` callback:

```typescript
const handleLoadMore = useCallback(async () => {
  if (!activeTab?.searchResults || !activeTab.url) return;
  const nextPage = (activeTab.searchPage || 1) + 1;
  updateBrowserTab(tabId, { isLoading: true });

  try {
    const results = await ChatService.search(
      activeTab.url,
      nextPage,
      activeTab.searchResults.expandedQuery
    );
    const newItems = results?.results || results?.organic || [];

    if (newItems.length > 0) {
      const merged: SearchResultSet = {
        ...activeTab.searchResults,
        results: [...(activeTab.searchResults.results || []), ...newItems],
        relatedSearches: results?.relatedSearches || activeTab.searchResults.relatedSearches,
      };
      updateBrowserTab(tabId, { searchResults: merged, searchPage: nextPage, isLoading: false });
      setLastSearchResults(merged);
    } else {
      updateBrowserTab(tabId, { isLoading: false, searchPage: -1 });
    }
  } catch {
    updateBrowserTab(tabId, { isLoading: false });
  }
}, [activeTab, tabId, updateBrowserTab, setLastSearchResults]);
```

- [ ] **Step 4: Insert stepper and synthesis card into search results view**

In the JSX, find the search results section (around line 548-550, `{/* Search Results View */}`). Insert the stepper and synthesis card right after the opening `<div className="max-w-7xl mx-auto space-y-12 pb-24">`:

```tsx
{/* Search Results View */}
<div className="max-w-7xl mx-auto space-y-12 pb-24">
  {/* Pipeline Stepper */}
  <SearchPipelineStepper
    stage={pipelineStage}
    stats={searchResults?.stats}
    expandedQuery={searchResults?.expandedQuery}
  />

  {/* AI Synthesis Card */}
  {(pipelineStage === 'synthesizing' || pipelineStage === 'complete') && (
    <SearchSynthesisCard
      synthesis={searchResults?.synthesis || { answer: '', sources: [] }}
      isLoading={pipelineStage === 'synthesizing'}
      onSourceClick={(url) => {
        const el = document.querySelector(`[data-result-url="${url}"]`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }}
    />
  )}

  {/* Header Stats */}
  {/* ... existing header stats code ... */}
```

- [ ] **Step 5: Add relevance badges and data attributes to result cards**

In the result card rendering (around line 594), update the result card to include the relevance badge and a data attribute for source linking. Find the hostname display line and add the badge next to it. Also add `data-result-url` to the outer div:

In the result cards `motion.div` (the one with `key={idx}`), add:
```tsx
data-result-url={result.link}
```

After the hostname `<span>` (the one showing `new URL(result.link).hostname`), add:
```tsx
{result.relevanceScore > 0 && <RelevanceBadge score={result.relevanceScore} />}
```

Also add a left accent bar inside each result card (first child of the outer div):
```tsx
{result.relevanceScore >= 60 && (
  <div
    className="absolute left-0 top-0 bottom-0 w-0.5 rounded-r"
    style={{
      height: `${Math.min(100, result.relevanceScore)}%`,
      background: result.relevanceScore >= 85
        ? 'linear-gradient(to bottom, #10b981, #10b981)'
        : 'linear-gradient(to bottom, #fb923c, #fb923c)',
    }}
  />
)}
```

- [ ] **Step 6: Also insert stepper into loading state for idle tabs**

When the tab is loading but has no results yet (the idle/loading state), show the stepper. Find the empty/idle state render section (around line 700+) and add the stepper above it when pipeline is active:

Before the idle state `<div>`, add:
```tsx
{pipelineStage !== 'idle' && pipelineStage !== 'complete' && !searchResults && (
  <div className="max-w-7xl mx-auto pt-12">
    <SearchPipelineStepper stage={pipelineStage} />
    <div className="space-y-4 mt-8">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="rounded-2xl bg-white/[0.02] border border-white/5 p-6">
          <div className="h-3 bg-white/5 rounded-lg animate-pulse w-1/4 mb-3" />
          <div className="h-4 bg-white/5 rounded-lg animate-pulse w-3/4 mb-2" />
          <div className="h-3 bg-white/5 rounded-lg animate-pulse w-full" />
        </div>
      ))}
    </div>
  </div>
)}
```

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/BrowserArea.tsx
git commit -m "feat(browser): integrate intelligent search pipeline UI with stepper, synthesis, and badges"
```

---

### Task 11: Update PiP Component for New Response Shape

**Files:**
- Modify: `frontend/src/components/BrowserArea.tsx` (BrowserPiP sub-component, lines 25-46)

- [ ] **Step 1: Update BrowserPiP handlePiPNavigate**

In the `BrowserPiP` component, update the search handler to store the full response shape:

```typescript
const handlePiPNavigate = async (query: string) => {
  if (!query.trim() || !activeTab) return;
  updateBrowserTab(activeTab.id, { isLoading: true });
  setInputUrl(query);

  if (!query.startsWith('http')) {
    try {
      const results = await ChatService.search(query);
      const items = results?.results || results?.organic || [];
      updateBrowserTab(activeTab.id, {
        type: 'search',
        url: query,
        label: query.slice(0, 20),
        searchResults: {
          results: items,
          answerBox: results?.answerBox,
          relatedSearches: results?.relatedSearches,
          synthesis: results?.synthesis,
          expandedQuery: results?.expandedQuery,
          stats: results?.stats,
        },
        pageContent: null,
        searchPage: 1,
        isLoading: false,
      });
    } catch {
      updateBrowserTab(activeTab.id, { isLoading: false });
    }
  }
};
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/BrowserArea.tsx
git commit -m "feat(pip): update PiP browser to handle intelligent search response"
```

---

### Task 12: Write Tests for IntelligentSearchService

**Files:**
- Create: `backend/src/services/intelligentSearchService.test.ts`

- [ ] **Step 1: Write tests**

Create `backend/src/services/intelligentSearchService.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies before importing the service
vi.mock('./searchService', () => ({
  searchService: {
    webSearch: vi.fn(),
  },
}));

vi.mock('./aiProviderFactory', () => ({
  AIProviderFactory: {
    getProvider: vi.fn(),
  },
}));

vi.mock('../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { intelligentSearchService } from './intelligentSearchService';
import { searchService } from './searchService';
import { AIProviderFactory } from './aiProviderFactory';

const mockGroq = {
  complete: vi.fn(),
};

describe('IntelligentSearchService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (AIProviderFactory.getProvider as any).mockResolvedValue(mockGroq);
  });

  describe('search() — full pipeline (page 1)', () => {
    it('should expand query, search, re-rank, and synthesize', async () => {
      // Stage 1: Query expansion
      mockGroq.complete.mockResolvedValueOnce('react performance optimization rendering 2026');

      // Stage 2: Brave search
      (searchService.webSearch as any).mockResolvedValueOnce({
        results: [
          { title: 'React Perf Guide', link: 'https://react.dev/perf', snippet: 'Performance tips' },
          { title: 'Rendering Best Practices', link: 'https://example.com/render', snippet: 'Render optimization' },
        ],
        answerBox: null,
        relatedSearches: [{ query: 'react memo' }],
      });

      // Stage 3: Re-rank
      mockGroq.complete.mockResolvedValueOnce(JSON.stringify({
        results: [
          { index: 0, score: 92, reason: 'Directly relevant' },
          { index: 1, score: 78, reason: 'Related' },
        ],
        removed: 0,
      }));

      // Stage 4: Synthesis
      mockGroq.complete.mockResolvedValueOnce(JSON.stringify({
        answer: 'React performance can be improved with `useMemo` and `React.memo`.',
        sources: ['https://react.dev/perf'],
      }));

      const result = await intelligentSearchService.search('react performance');

      expect(result.expandedQuery).toBe('react performance optimization rendering 2026');
      expect(result.results).toHaveLength(2);
      expect(result.results[0].relevanceScore).toBe(92);
      expect(result.results[1].relevanceScore).toBe(78);
      expect(result.synthesis?.answer).toContain('useMemo');
      expect(result.synthesis?.sources).toContain('https://react.dev/perf');
      expect(result.stats?.totalFound).toBe(2);
      expect(result.stats?.totalRelevant).toBe(2);
      expect(result.stats?.pipelineMs).toBeGreaterThan(0);

      // Verify Groq was called 3 times (expand + rerank + synthesize)
      expect(mockGroq.complete).toHaveBeenCalledTimes(3);
      // Verify Brave search was called with expanded query
      expect(searchService.webSearch).toHaveBeenCalledWith('react performance optimization rendering 2026', 1);
    });

    it('should fall back gracefully when query expansion fails', async () => {
      mockGroq.complete.mockRejectedValueOnce(new Error('Groq timeout'));

      (searchService.webSearch as any).mockResolvedValueOnce({
        results: [{ title: 'Result', link: 'https://test.com', snippet: 'Test' }],
        answerBox: null,
        relatedSearches: [],
      });

      // Re-rank
      mockGroq.complete.mockResolvedValueOnce(JSON.stringify({
        results: [{ index: 0, score: 80, reason: 'ok' }],
        removed: 0,
      }));

      // Synthesis
      mockGroq.complete.mockResolvedValueOnce(JSON.stringify({
        answer: 'Test answer.',
        sources: ['https://test.com'],
      }));

      const result = await intelligentSearchService.search('test query');

      // Should use original query when expansion fails
      expect(searchService.webSearch).toHaveBeenCalledWith('test query', 1);
      expect(result.expandedQuery).toBe('test query');
      expect(result.results).toHaveLength(1);
    });

    it('should return raw results when re-rank fails', async () => {
      mockGroq.complete.mockResolvedValueOnce('expanded query');

      (searchService.webSearch as any).mockResolvedValueOnce({
        results: [
          { title: 'A', link: 'https://a.com', snippet: 'a' },
          { title: 'B', link: 'https://b.com', snippet: 'b' },
        ],
        answerBox: null,
        relatedSearches: [],
      });

      // Re-rank fails
      mockGroq.complete.mockRejectedValueOnce(new Error('Groq error'));

      // Synthesis
      mockGroq.complete.mockResolvedValueOnce(JSON.stringify({
        answer: 'Synthesized.',
        sources: [],
      }));

      const result = await intelligentSearchService.search('query');

      expect(result.results).toHaveLength(2);
      expect(result.results[0].relevanceScore).toBe(0); // Fallback: no scores
    });
  });

  describe('search() — pagination (page > 1)', () => {
    it('should skip expansion and synthesis on subsequent pages', async () => {
      (searchService.webSearch as any).mockResolvedValueOnce({
        results: [{ title: 'Page 2 Result', link: 'https://p2.com', snippet: 'p2' }],
        answerBox: null,
        relatedSearches: [],
      });

      const result = await intelligentSearchService.search('query', 2, 'cached expanded query');

      // Should NOT call Groq at all
      expect(mockGroq.complete).not.toHaveBeenCalled();
      // Should use cached expanded query for Brave search
      expect(searchService.webSearch).toHaveBeenCalledWith('cached expanded query', 2);
      expect(result.expandedQuery).toBe('cached expanded query');
      expect(result.synthesis).toBeUndefined();
    });
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `cd /home/caleb/solventclaude2/dazzling-shirley/backend && npx vitest run src/services/intelligentSearchService.test.ts 2>&1 | tail -30`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add backend/src/services/intelligentSearchService.test.ts
git commit -m "test: add IntelligentSearchService unit tests"
```

---

### Task 13: End-to-End Smoke Test

**Files:** None (manual verification)

- [ ] **Step 1: Start the backend**

Run: `cd /home/caleb/solventclaude2/dazzling-shirley/backend && npx tsx src/server.ts &`
Wait for the server to start (look for port 3001 message).

- [ ] **Step 2: Test the search endpoint with curl**

```bash
curl -s -X POST http://localhost:3001/api/search \
  -H 'Content-Type: application/json' \
  -d '{"query": "react performance optimization"}' | head -c 2000
```

Expected: JSON response with `results[]`, `synthesis`, `expandedQuery`, and `stats` fields. Results should have `relevanceScore` values.

- [ ] **Step 3: Test pagination with expandedQuery**

```bash
curl -s -X POST http://localhost:3001/api/search \
  -H 'Content-Type: application/json' \
  -d '{"query": "react performance", "page": 2, "expandedQuery": "react performance optimization rendering 2026"}' | head -c 1000
```

Expected: JSON response without `synthesis` field, results with `relevanceScore: 0`.

- [ ] **Step 4: Stop the test server and commit any fixes**

If any issues were found in steps 2-3, fix them and commit.

---

### Task 14: Final Frontend Compilation Check

- [ ] **Step 1: Verify frontend compiles**

Run: `cd /home/caleb/solventclaude2/dazzling-shirley/frontend && npx tsc --noEmit 2>&1 | head -30`
Expected: No new errors related to the search pipeline components.

- [ ] **Step 2: Verify backend compiles**

Run: `cd /home/caleb/solventclaude2/dazzling-shirley/backend && npx tsc --noEmit 2>&1 | head -30`
Expected: No new errors.

- [ ] **Step 3: Run all backend tests**

Run: `cd /home/caleb/solventclaude2/dazzling-shirley/backend && npx vitest run 2>&1 | tail -20`
Expected: All tests pass including the new `intelligentSearchService.test.ts`.

- [ ] **Step 4: Final commit if needed, then verify clean git status**

```bash
git status
git log --oneline -10
```
