# Intelligent Search Pipeline — Design Spec

## Overview

Enhance the browser's web search with a 4-stage LLM pipeline that transforms raw Brave API results into ranked, filtered, and synthesized output. The pipeline runs sequentially: Query Expansion → Brave Search → AI Re-rank → AI Synthesis.

## Architecture

### Pipeline Stages

**Stage 1 — Query Expansion (~400ms)**
- Input: raw user query (e.g., `"react performance"`)
- LLM rewrites the query to be more specific, adding temporal context (current year), technical terms, and synonyms
- Output: expanded query string (e.g., `"React performance optimization rendering profiling virtual DOM 2025"`)
- Provider: Groq (`llama-3.3-70b-versatile`), temperature 0.2, max 150 tokens
- System prompt instructs: expand for better search recall, do NOT answer the question, return only the refined query string

**Stage 2 — Brave Search (~300ms)**
- Input: expanded query from Stage 1
- Fires to Brave Search API with `count: 20`
- Output: raw results array (title, url, description), answerBox, relatedSearches
- No change to existing `braveSearch()` method — just receives the expanded query instead of the raw one

**Stage 3 — AI Re-rank & Filter (~600ms)**
- Input: original user query + all 20 raw results (title, url, snippet only — not full page content)
- LLM scores each result 0-100 for relevance to the user's actual intent
- Removes duplicates (same domain + similar title)
- Filters out results scoring below 40
- Returns results sorted by relevance score descending
- Provider: Groq, temperature 0.1, max 2048 tokens, JSON mode
- Output schema: `{ results: [{ index: number, score: number, reason: string }], removed: number }`
- The `reason` field is for internal logging, not displayed to user. The `score` is displayed as a percentage badge.

**Stage 4 — AI Synthesis (~800ms)**
- Input: original query + top 8 re-ranked results (title, url, snippet)
- LLM generates a concise direct answer (2-4 sentences) synthesizing information across results
- Includes source attribution (which result URLs informed the answer)
- Provider: Groq, temperature 0.3, max 512 tokens
- Output schema: `{ answer: string, sources: string[] }`
- Returned as a complete response (streaming deferred to a future iteration)

### Backend Changes

**New file: `backend/src/services/intelligentSearchService.ts`**

Wraps the existing `searchService.webSearch()` with the LLM pipeline:

```
class IntelligentSearchService {
  async search(query: string, page: number = 1): Promise<IntelligentSearchResult>
  private async expandQuery(query: string): Promise<string>
  private async rerankResults(query: string, results: RawResult[]): Promise<RankedResult[]>
  private async synthesize(query: string, results: RankedResult[]): Promise<Synthesis>
}
```

The existing `searchService` is unchanged — `intelligentSearchService` composes it. For pagination (page > 1), the frontend passes the `expandedQuery` from the first page's response back in the request body. The backend skips Stage 1 (uses the provided expanded query) and skips Stage 4 (no re-synthesis). The `/search` request body adds an optional `expandedQuery?: string` field for this purpose.

**Modified: `backend/src/controllers/aiController.ts`**

The `/search` endpoint calls `intelligentSearchService.search()` instead of `searchService.webSearch()`. Response shape changes to:

```typescript
{
  results: Array<{
    title: string;
    link: string;
    snippet: string;
    position: number;
    relevanceScore: number;   // 0-100 from re-ranking
  }>;
  answerBox?: any;            // From Brave (kept for compatibility)
  relatedSearches?: Array<{ query: string }>;
  synthesis?: {               // NEW
    answer: string;
    sources: string[];
  };
  expandedQuery?: string;     // NEW — the refined query shown in stepper
  stats?: {                   // NEW — pipeline metadata for stepper
    totalFound: number;       // Raw results from Brave
    totalRelevant: number;    // After filtering
    pipelineMs: number;       // Total pipeline time
  };
}
```

### Frontend Changes

**Modified: `frontend/src/components/BrowserArea.tsx`**

Search results view gains three new sections above the existing result cards:

1. **Pipeline Stepper** — horizontal bar with 4 stages. During search, shows which stage is active (pulsing indicator). After completion, shrinks and shows stats ("20 found → 14 relevant → Synthesized"). Displays the expanded query below in italic.

2. **AI Synthesis Card** — appears between stepper and results. Green-accented card with the synthesized answer, source citation badges (domain names as pills), and a "+N more" overflow badge. Shows skeleton shimmers during loading.

3. **Relevance Score Badges** — each result card gets a small colored badge (green ≥ 85, orange ≥ 60, hidden below 60). The existing result card layout is preserved; the badge is added next to the domain name.

**Modified: `frontend/src/store/types.ts`**

```typescript
interface SearchResultSet {
  results: any[];
  answerBox?: any;
  relatedSearches?: { query: string }[];
  error?: string;
  synthesis?: {              // NEW
    answer: string;
    sources: string[];
  };
  expandedQuery?: string;    // NEW
  stats?: {                  // NEW
    totalFound: number;
    totalRelevant: number;
    pipelineMs: number;
  };
}
```

### Progressive UI States

The search flow shows 4 visual states in sequence:

1. **"Refining query..."** — stepper stage 1 active (blue pulse). Rest of page shows skeleton shimmers.
2. **"Searching..."** — stepper stage 2 active (purple pulse). Skeleton shimmers continue.
3. **"Ranking N results..."** — stepper stage 3 active (orange pulse). Shows count of results being ranked.
4. **"Synthesizing..."** — stepper stage 4 active (green pulse). Result cards begin populating with staggered fade. Synthesis card shows skeleton shimmer.
5. **Complete** — stepper shrinks, all stages show checkmarks with stats. Synthesis card is fully rendered. All result cards visible with relevance badges.

### Stepper Design

- Horizontal bar, max-width 700px, centered
- 4 circles connected by gradient lines
- Active stage: colored circle with glow + pulse animation, bold label
- Completed stage: solid colored circle with checkmark, dimmed label showing stat
- Pending stage: gray circle with dim number, muted label
- After all stages complete: entire stepper reduces in visual weight (smaller circles, lower opacity) so synthesis and results take focus
- Below the stepper: "Refined Query: ..." in small italic text, only shown after Stage 1 completes

### Synthesis Card Design

- Rounded container with subtle green-tinted background (`rgba(16,185,129,0.04)`)
- Left accent border gradient (green to blue)
- Header: "AI SYNTHESIS" label + "from N sources" count
- Body: 2-4 sentence answer with inline `<code>` styling for technical terms
- Footer: source domain badges as small pills, "+N more" overflow
- Click a source badge to scroll to that result card below

### Result Card Enhancement

- Existing card layout preserved
- Add relevance badge next to domain name: small rounded pill showing score percentage
- Badge color: green (#10b981) for ≥85, orange (#fb923c) for ≥60, no badge below 60
- Left accent bar on each card: height proportional to score, gradient from green (high) to orange (mid)

## Error Handling

- If any LLM stage fails, fall back gracefully: skip that stage and continue
- Query expansion failure → use original query for Brave search
- Re-rank failure → return raw Brave results in original order, no scores
- Synthesis failure → omit synthesis card, show results without it
- Each failure logs to console but does not block the pipeline
- Frontend checks for presence of `synthesis`, `expandedQuery`, `stats` fields — if missing, those UI sections simply don't render

## Performance Budget

- Target total pipeline time: < 3 seconds on Groq
- Stage 1 (expand): < 500ms
- Stage 2 (Brave): < 500ms
- Stage 3 (re-rank): < 1000ms
- Stage 4 (synthesize): < 1000ms
- If total exceeds 5s, log a warning

## Non-Goals

- No streaming of synthesis in v1 (add in a future iteration if latency is noticeable)
- No caching of LLM results (search results change frequently)
- No user-facing toggle to disable intelligent search (always on)
- No full-page content scraping for synthesis (too slow, uses only snippets from Brave)
