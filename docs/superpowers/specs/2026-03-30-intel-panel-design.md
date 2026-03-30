# Intel Panel — Command Center Browser Integration

## Overview

Add a new "Intel" view to the Command Center PiP that provides a compact, information-dense research terminal. Not a miniature clone of BrowserArea — a purpose-built tool for quick research, AI-powered page Q&A, and cross-view context sharing.

## Goals

1. Search the web and read pages without leaving the Command Center
2. Ask AI questions about loaded content inline
3. Route research to Missions, Overseer, or Chat with explicit actions
4. Ambient context sharing — recent research auto-feeds into other CC views when toggled on

## Non-Goals

- No tab management (single-page focus)
- No pipeline stepper animations
- No pinning system (use BrowserArea for that)
- No Document PiP popout from within the Intel Panel
- Not replacing BrowserArea — this is a complementary compact tool

---

## Component Structure

### New Files

- `frontend/src/components/IntelPanel.tsx` — main component (~300-400 lines estimated)

### Modified Files

- `frontend/src/components/NotepadPiP.tsx` — add "INTEL" to action grid buttons, add `view === 'intel'` render branch
- `frontend/src/store/settingsSlice.ts` — add Intel Panel state
- `frontend/src/store/types.ts` — add Intel Panel types
- `frontend/src/store/collaborateSlice.ts` — read ambient context when launching missions
- `backend/src/controllers/browseController.ts` — add `askAboutPage` handler
- `backend/src/services/browseService.ts` — add `askAboutPage` method
- `backend/src/routes/aiRoutes.ts` — add `/api/v1/browse/ask` route
- `frontend/src/services/ChatService.ts` — add `askAboutPage` method

---

## Layout (420x650 panel)

Top to bottom, within the Command Center's existing panel size:

### 1. Search/URL Bar (fixed, top)

Single input field with Globe icon prefix. Auto-detects input type:
- Starts with `http://` or `https://` → reader mode (fetch page)
- Otherwise → search mode (query the search pipeline)

Submit on Enter. No navigation buttons (back/forward/refresh). Compact — single line, matches CC header style.

### 2. Content Area (scrollable, fills remaining space)

Three states:

**Idle State:**
- Brief description text: "Search or enter a URL"
- Recent searches as clickable chips (last 5 queries from `intelQAHistory` or search history)

**Results View (search mode):**
- Flat list of results, no cards. Each result is a tight row:
  - Domain tag (small, muted)
  - Title (clickable — loads in reader mode)
  - Relevance score (inline, right-aligned, color-coded: green ≥80, amber ≥50, gray below)
  - Snippet (one line, truncated, muted text)
- Synthesis answer at the top if available (compact — 2-3 sentences max, with source count badge)
- Related searches as small clickable chips at the bottom
- "Load more" link at bottom if 10+ results

**Reader View (page mode):**
- Title (bold, prominent)
- Metadata bar: site name · author · date (single line, muted)
- Extracted content body, scrollable
- Headings detected and styled
- Back-to-results link at top if navigated from search

### 3. Q&A Strip (bottom, collapsible)

- Toggle open/closed with a small chevron or "Ask" button
- When open: single-line input with send button
- Responses appear above the input, compact chat-style bubbles
- Max 3-4 visible exchanges, scrollable
- Context: sends the currently loaded page content (or top search results) + the user's question
- Cleared when loading a new page or search

### 4. Action Bar (fixed, bottom-most)

Horizontal row of icon buttons:
- `→ Mission` — pre-fills mission goal with summary + link, switches CC to Missions view
- `→ Overseer` — sends content to overseer trigger with "analyze this page" focus, switches to Overseer view
- `→ Chat` — sets `browserInjectedContext` and switches main app to chat mode
- Ambient context toggle (eye icon) — glows when active, muted when off

---

## Backend

### New Endpoint

**`POST /api/v1/browse/ask`**

Request:
```typescript
{
  content: string;    // page content or search results summary
  question: string;   // user's question
}
```

Response:
```typescript
{
  answer: string;
}
```

Implementation: thin wrapper in `browseService.ts` using the existing Groq provider. System prompt focused on answering questions about provided content. Temperature 0.3, max 512 tokens.

### Existing Endpoints (reused, no changes)

- `POST /api/v1/search` — search pipeline (via `intelligentSearchService`)
- `POST /api/v1/browse` — page extraction (via `browseService.fetchPage`)
- `POST /api/v1/browse/summarize` — page summarization

---

## State Management

### New State in `settingsSlice.ts`

```typescript
// Intel Panel state
intelPanelContent: IntelPanelContent;
intelAmbientContext: boolean;
intelQAHistory: IntelQAEntry[];
intelRecentSearches: string[];

// Setters
setIntelPanelContent: (content: IntelPanelContent) => void;
setIntelAmbientContext: (enabled: boolean) => void;
addIntelQAEntry: (entry: IntelQAEntry) => void;
clearIntelQAHistory: () => void;
addIntelRecentSearch: (query: string) => void;
```

### New Types in `types.ts`

```typescript
interface IntelPanelContent {
  type: 'idle' | 'search' | 'reader';
  searchResults?: SearchResultSet | null;
  pageContent?: PageContent | null;
  query?: string;
  isLoading?: boolean;
}

interface IntelQAEntry {
  question: string;
  answer: string;
  timestamp: number;
}
```

### Default Values

```typescript
intelPanelContent: { type: 'idle' },
intelAmbientContext: true,    // on by default
intelQAHistory: [],
intelRecentSearches: [],
```

---

## Cross-View Wiring

### Explicit Routing (Action Bar Buttons)

**→ Mission:**
1. Build context string: page title + URL + first 500 chars of content (or synthesis answer for search)
2. Set `collaborate.goal` to this context string
3. Switch CC view to `'missions'`

**→ Overseer:**
1. Call `POST /overseer/trigger` with:
   - `focus`: "Analyze this page: [title]"
   - `notepadContent`: current notepad + extracted page content (truncated to 2000 chars)
   - `recentMessages`: last 5 messages from store
2. Switch CC view to `'overseer'`

**→ Chat:**
1. Set `browserInjectedContext` to formatted content (title + URL + excerpt/synthesis)
2. Set `currentMode` to `'chat'` in the main app

### Ambient Context

When `intelAmbientContext` is true:
- Mission launches (in `collaborateSlice.startConversation`) append `intelPanelContent` summary to the goal context
- Overseer triggers (in `NotepadPiP` overseer handlers) include `intelPanelContent` summary in the `notepadContent` field
- No changes to Chat — ambient context for chat would be too noisy; use explicit `→ Chat` instead

When toggled off: these views ignore `intelPanelContent` entirely.

---

## Visual Style

- Matches CC's existing dark, dense aesthetic
- Results are tight rows, not cards — information-dense
- Q&A strip looks like a mini terminal (monospace responses, compact)
- Ambient toggle: eye icon, subtle glow (emerald) when active, muted gray when off
- No Framer Motion animations beyond what CC already uses
- Loading states: simple spinner in the search bar, skeleton lines in content area
- Color coding for relevance scores matches existing `RelevanceBadge` logic (emerald ≥80, amber ≥50, gray below)

---

## Integration into NotepadPiP.tsx

### Action Grid Update

Add "INTEL" as a 5th button in the action grid (current 4: MISSIONS, NOTES, CODE, FLOW). Use `Search` icon from lucide-react. Place it in the grid — may need to adjust from 2x2 to accommodate 5 buttons (either 3+2 layout or a 5-button horizontal strip).

### View Rendering

Add `view === 'intel'` branch in the main render switch that renders `<IntelPanel />`.

### Navigation

The Intel Panel's action bar buttons call `setView('missions')` or `setView('overseer')` to switch CC views after routing content.

---

## Error Handling

- Search failures: show inline error message in content area, keep previous results visible
- Page fetch failures: show "Could not load page" with the URL, suggest trying in full BrowserArea
- Q&A failures: show "Could not get answer" inline in Q&A strip
- No try/catch swallowing — surface errors to the user

---

## Testing Strategy

- Unit: IntelPanel renders idle/search/reader states correctly
- Unit: Q&A strip sends correct payload and displays response
- Unit: Action bar buttons set correct store state
- Unit: Ambient context toggle controls whether other views read intel content
- Integration: Search → click result → reader view → ask question → route to mission (full flow)
- Manual: verify layout fits within 420x650 CC panel without overflow
