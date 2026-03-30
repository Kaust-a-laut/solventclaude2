# Intel Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "Intel" view to the Command Center PiP — a compact research terminal with search, page reading, inline AI Q&A, and cross-view context routing.

**Architecture:** New `IntelPanel.tsx` component rendered as a 6th view inside `NotepadPiP.tsx`. Reuses existing `ChatService` search/browse methods. One new backend endpoint (`POST /api/v1/browse/ask`) for Q&A. New state fields in `settingsSlice` for intel panel content, ambient context toggle, Q&A history, and recent searches.

**Tech Stack:** React, TypeScript, Zustand, Tailwind CSS, Lucide React, Express, Zod

---

### Task 1: Add Types and State

**Files:**
- Modify: `frontend/src/store/types.ts:104-143`
- Modify: `frontend/src/store/settingsSlice.ts:23-99` (interface) and `101-199` (implementation)

- [ ] **Step 1: Add Intel Panel types to `types.ts`**

Add after the `BrowserTab` interface (after line 141):

```typescript
export interface IntelPanelContent {
  type: 'idle' | 'search' | 'reader';
  searchResults?: SearchResultSet | null;
  pageContent?: PageContent | null;
  query?: string;
  isLoading?: boolean;
}

export interface IntelQAEntry {
  question: string;
  answer: string;
  timestamp: number;
}
```

- [ ] **Step 2: Add Intel Panel state to `SettingsSlice` interface**

Add these properties to the `SettingsSlice` interface in `settingsSlice.ts` (after `browserPinnedUrls` on line 56):

```typescript
intelPanelContent: IntelPanelContent;
intelAmbientContext: boolean;
intelQAHistory: IntelQAEntry[];
intelRecentSearches: string[];
```

Add these setters (after `removeBrowserPinnedUrl` on line 95):

```typescript
setIntelPanelContent: (content: IntelPanelContent) => void;
setIntelAmbientContext: (enabled: boolean) => void;
addIntelQAEntry: (entry: IntelQAEntry) => void;
clearIntelQAHistory: () => void;
addIntelRecentSearch: (query: string) => void;
```

- [ ] **Step 3: Add default values and setter implementations**

Add the import for the new types at the top of `settingsSlice.ts`:

```typescript
import { AppState, DeviceInfo, BrowserTab, IntelPanelContent, IntelQAEntry } from './types';
```

Add default values in `createSettingsSlice` (after `browserPinnedUrls: [],` on line 141):

```typescript
intelPanelContent: { type: 'idle' } as IntelPanelContent,
intelAmbientContext: true,
intelQAHistory: [],
intelRecentSearches: [],
```

Add setter implementations (after `removeBrowserPinnedUrl` setter):

```typescript
setIntelPanelContent: (intelPanelContent) => set({ intelPanelContent }),
setIntelAmbientContext: (intelAmbientContext) => set({ intelAmbientContext }),
addIntelQAEntry: (entry) => set((state) => ({
  intelQAHistory: [...state.intelQAHistory.slice(-9), entry],
})),
clearIntelQAHistory: () => set({ intelQAHistory: [] }),
addIntelRecentSearch: (query) => set((state) => ({
  intelRecentSearches: [query, ...state.intelRecentSearches.filter(q => q !== query)].slice(0, 5),
})),
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd /home/caleb/solventclaude2/dazzling-shirley/frontend && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors related to Intel types/state

- [ ] **Step 5: Commit**

```bash
git add frontend/src/store/types.ts frontend/src/store/settingsSlice.ts
git commit -m "feat(intel): add IntelPanel types and state to store"
```

---

### Task 2: Add Backend Q&A Endpoint

**Files:**
- Modify: `backend/src/services/browseService.ts:110-132`
- Modify: `backend/src/controllers/browseController.ts:1-54`
- Modify: `backend/src/routes/aiRoutes.ts:54-56`

- [ ] **Step 1: Add `askAboutPage` method to `browseService.ts`**

Add after the `summarizePage` method (after line 129):

```typescript
async askAboutPage(content: string, question: string): Promise<string> {
  const provider = await AIProviderFactory.getProvider(config.DEFAULT_PROVIDER || 'groq');

  const messages = [
    {
      role: 'system' as const,
      content: 'You are a helpful assistant answering questions about web page content. Answer concisely and accurately based only on the provided content. If the content does not contain enough information to answer, say so.',
    },
    {
      role: 'user' as const,
      content: `Page content:\n\n${content.slice(0, 30_000)}\n\nQuestion: ${question}`,
    },
  ];

  const result = await provider.complete(messages, {
    model: provider.defaultModel || 'llama-3.3-70b-versatile',
    temperature: 0.3,
    maxTokens: 512,
  });

  return result;
}
```

- [ ] **Step 2: Add `askAboutPage` handler to `browseController.ts`**

Add the Zod schema after the existing `summarizeSchema` (after line 13):

```typescript
const askSchema = z.object({
  content: z.string().min(1, 'Content is required'),
  question: z.string().min(1, 'Question is required'),
});
```

Add the handler after the `summarize` method (after line 53):

```typescript
static async askAboutPage(req: Request, res: Response) {
  try {
    const parseResult = askSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid request body',
        details: parseResult.error.errors,
      });
    }

    const { content, question } = parseResult.data;
    const answer = await browseService.askAboutPage(content, question);
    res.json({ answer });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[BrowseController] Ask Error:', err.message);
    res.status(500).json({ error: err.message });
  }
}
```

- [ ] **Step 3: Add route in `aiRoutes.ts`**

Add after line 56 (`router.post('/browse/summarize', BrowseController.summarize);`):

```typescript
router.post('/browse/ask', BrowseController.askAboutPage);
```

- [ ] **Step 4: Verify backend compiles**

Run: `cd /home/caleb/solventclaude2/dazzling-shirley/backend && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/browseService.ts backend/src/controllers/browseController.ts backend/src/routes/aiRoutes.ts
git commit -m "feat(intel): add POST /api/v1/browse/ask endpoint for page Q&A"
```

---

### Task 3: Add Frontend `askAboutPage` Service Method

**Files:**
- Modify: `frontend/src/services/ChatService.ts:220-249`

- [ ] **Step 1: Add `askAboutPage` method to `ChatService`**

Add after the `summarizePage` method (after line 228):

```typescript
static async askAboutPage(content: string, question: string) {
  const data = await fetchWithRetry(`${API_BASE_URL}/browse/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, question }),
    retries: 1
  }) as any;

  return data;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /home/caleb/solventclaude2/dazzling-shirley/frontend && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/services/ChatService.ts
git commit -m "feat(intel): add ChatService.askAboutPage() client method"
```

---

### Task 4: Build IntelPanel Component — Layout and Search

**Files:**
- Create: `frontend/src/components/IntelPanel.tsx`

- [ ] **Step 1: Create `IntelPanel.tsx` with search bar and idle state**

```typescript
import React, { useState, useRef, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import { ChatService } from '../services/ChatService';
import {
  Globe, Search, ArrowLeft, Send, ChevronUp, ChevronDown,
  Eye, EyeOff, Loader2, Target, Shield, MessageSquare,
} from 'lucide-react';
import { cn } from '../lib/utils';

const URL_PATTERN = /^https?:\/\//i;

export const IntelPanel: React.FC = () => {
  const {
    intelPanelContent, setIntelPanelContent,
    intelAmbientContext, setIntelAmbientContext,
    intelQAHistory, addIntelQAEntry, clearIntelQAHistory,
    intelRecentSearches, addIntelRecentSearch,
    setBrowserInjectedContext, setCurrentMode,
  } = useAppStore();

  const [inputValue, setInputValue] = useState('');
  const [qaInput, setQaInput] = useState('');
  const [qaOpen, setQaOpen] = useState(false);
  const [qaLoading, setQaLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const qaInputRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const handleSubmit = useCallback(async () => {
    const query = inputValue.trim();
    if (!query) return;

    if (URL_PATTERN.test(query)) {
      // Reader mode
      setIntelPanelContent({ type: 'reader', isLoading: true, query });
      clearIntelQAHistory();
      try {
        const pageContent = await ChatService.browse(query);
        setIntelPanelContent({ type: 'reader', pageContent, query });
      } catch {
        setIntelPanelContent({ type: 'reader', pageContent: null, query, isLoading: false });
      }
    } else {
      // Search mode
      setIntelPanelContent({ type: 'search', isLoading: true, query });
      addIntelRecentSearch(query);
      clearIntelQAHistory();
      try {
        const searchResults = await ChatService.search(query);
        setIntelPanelContent({ type: 'search', searchResults, query });
      } catch {
        setIntelPanelContent({ type: 'search', searchResults: null, query, isLoading: false });
      }
    }
  }, [inputValue, setIntelPanelContent, addIntelRecentSearch, clearIntelQAHistory]);

  const handleResultClick = useCallback(async (url: string) => {
    setInputValue(url);
    setIntelPanelContent({ type: 'reader', isLoading: true, query: url });
    clearIntelQAHistory();
    try {
      const pageContent = await ChatService.browse(url);
      setIntelPanelContent({ type: 'reader', pageContent, query: url });
    } catch {
      setIntelPanelContent({ type: 'reader', pageContent: null, query: url, isLoading: false });
    }
  }, [setIntelPanelContent, clearIntelQAHistory]);

  const handleQASubmit = useCallback(async () => {
    const question = qaInput.trim();
    if (!question) return;

    let context = '';
    if (intelPanelContent.type === 'reader' && intelPanelContent.pageContent) {
      context = intelPanelContent.pageContent.content;
    } else if (intelPanelContent.type === 'search' && intelPanelContent.searchResults) {
      const results = intelPanelContent.searchResults.results || [];
      context = results.slice(0, 5).map((r: any) => `${r.title}: ${r.snippet || ''}`).join('\n');
      if (intelPanelContent.searchResults.synthesis?.answer) {
        context = intelPanelContent.searchResults.synthesis.answer + '\n\n' + context;
      }
    }

    if (!context) return;

    setQaLoading(true);
    setQaInput('');
    try {
      const { answer } = await ChatService.askAboutPage(context, question);
      addIntelQAEntry({ question, answer, timestamp: Date.now() });
    } catch {
      addIntelQAEntry({ question, answer: 'Could not get an answer. Try again.', timestamp: Date.now() });
    } finally {
      setQaLoading(false);
    }
  }, [qaInput, intelPanelContent, addIntelQAEntry]);

  const buildContextString = useCallback((): string => {
    if (intelPanelContent.type === 'reader' && intelPanelContent.pageContent) {
      const p = intelPanelContent.pageContent;
      return `[${p.title}](${p.url})\n\n${p.content.slice(0, 500)}`;
    }
    if (intelPanelContent.type === 'search' && intelPanelContent.searchResults) {
      const syn = intelPanelContent.searchResults.synthesis;
      if (syn) return `Search: "${intelPanelContent.query}"\n\n${syn.answer}`;
      const top = (intelPanelContent.searchResults.results || []).slice(0, 3);
      return `Search: "${intelPanelContent.query}"\n\n` + top.map((r: any) => `- ${r.title}: ${r.snippet || ''}`).join('\n');
    }
    return '';
  }, [intelPanelContent]);

  const sendToChat = useCallback(() => {
    const ctx = buildContextString();
    if (!ctx) return;
    setBrowserInjectedContext(ctx);
    setCurrentMode('chat');
  }, [buildContextString, setBrowserInjectedContext, setCurrentMode]);

  const hasContent = intelPanelContent.type !== 'idle';
  const relevanceColor = (score: number) =>
    score >= 80 ? 'text-emerald-400' : score >= 50 ? 'text-amber-400' : 'text-slate-600';

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Search/URL Bar */}
      <div className="px-3 pt-3 pb-2 flex-shrink-0">
        <div className="flex items-center gap-2 bg-black/40 rounded-lg border border-white/5 px-3 py-1.5">
          <Globe size={12} className="text-slate-600 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            placeholder="Search or enter URL..."
            className="flex-1 bg-transparent text-[12px] text-white placeholder:text-slate-700 outline-none font-mono"
          />
          {intelPanelContent.isLoading ? (
            <Loader2 size={12} className="animate-spin text-slate-500" />
          ) : (
            <button onClick={handleSubmit} className="text-slate-600 hover:text-white transition-colors">
              <Search size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div ref={contentRef} className="flex-1 overflow-y-auto no-scrollbar px-3">
        {/* Idle State */}
        {intelPanelContent.type === 'idle' && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
              <Search size={20} className="text-slate-700" />
            </div>
            <div>
              <p className="text-[11px] text-slate-600 font-bold">Search or enter a URL</p>
              <p className="text-[10px] text-slate-800 mt-1">Research without leaving Command Center</p>
            </div>
            {intelRecentSearches.length > 0 && (
              <div className="flex flex-wrap gap-1.5 justify-center mt-2">
                {intelRecentSearches.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => { setInputValue(q); }}
                    className="px-2.5 py-1 rounded-full bg-white/[0.03] border border-white/5 text-[10px] text-slate-500 hover:text-white hover:border-white/10 transition-all font-mono"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Loading State */}
        {intelPanelContent.isLoading && intelPanelContent.type !== 'idle' && (
          <div className="space-y-2 py-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 rounded-lg bg-white/[0.02] animate-pulse" />
            ))}
          </div>
        )}

        {/* Search Results */}
        {intelPanelContent.type === 'search' && !intelPanelContent.isLoading && intelPanelContent.searchResults && (
          <div className="space-y-1 py-1">
            {/* Synthesis */}
            {intelPanelContent.searchResults.synthesis && (
              <div className="mb-3 p-2.5 rounded-lg bg-emerald-500/[0.04] border border-emerald-500/10">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <div className="w-1 h-1 rounded-full bg-emerald-400" />
                  <span className="text-[10px] font-black uppercase text-emerald-400/60 tracking-widest">
                    Synthesis · {intelPanelContent.searchResults.synthesis.sources.length} sources
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-4">
                  {intelPanelContent.searchResults.synthesis.answer}
                </p>
              </div>
            )}

            {/* Results List */}
            {(intelPanelContent.searchResults.results || []).map((result: any, i: number) => (
              <button
                key={i}
                onClick={() => handleResultClick(result.link)}
                className="w-full text-left p-2 rounded-lg hover:bg-white/[0.03] transition-all group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="text-[9px] font-mono text-slate-700 block truncate">
                      {(() => { try { return new URL(result.link).hostname; } catch { return result.link; } })()}
                    </span>
                    <span className="text-[11px] text-slate-300 font-bold block truncate group-hover:text-white transition-colors">
                      {result.title}
                    </span>
                    <span className="text-[10px] text-slate-600 block truncate mt-0.5">
                      {result.snippet}
                    </span>
                  </div>
                  {result.relevanceScore != null && result.relevanceScore >= 25 && (
                    <span className={cn('text-[10px] font-mono font-bold shrink-0 mt-1', relevanceColor(result.relevanceScore))}>
                      {result.relevanceScore}%
                    </span>
                  )}
                </div>
              </button>
            ))}

            {/* Related Searches */}
            {intelPanelContent.searchResults.relatedSearches && intelPanelContent.searchResults.relatedSearches.length > 0 && (
              <div className="pt-2 mt-2 border-t border-white/5">
                <span className="text-[9px] text-slate-700 uppercase font-black tracking-widest">Related</span>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {intelPanelContent.searchResults.relatedSearches.slice(0, 5).map((rs, i) => (
                    <button
                      key={i}
                      onClick={() => { setInputValue(rs.query); }}
                      className="px-2 py-0.5 rounded-full bg-white/[0.03] border border-white/5 text-[10px] text-slate-600 hover:text-white hover:border-white/10 transition-all"
                    >
                      {rs.query}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* No results */}
            {(intelPanelContent.searchResults.results || []).length === 0 && !intelPanelContent.searchResults.error && (
              <div className="text-center py-6">
                <p className="text-[11px] text-slate-600">No results found</p>
              </div>
            )}

            {/* Error */}
            {intelPanelContent.searchResults.error && (
              <div className="text-center py-6">
                <p className="text-[11px] text-rose-400">{intelPanelContent.searchResults.error}</p>
              </div>
            )}
          </div>
        )}

        {/* Reader View */}
        {intelPanelContent.type === 'reader' && !intelPanelContent.isLoading && (
          <div className="py-1">
            {intelPanelContent.pageContent ? (
              <div>
                {/* Back to results link */}
                {intelPanelContent.searchResults && (
                  <button
                    onClick={() => setIntelPanelContent({
                      type: 'search',
                      searchResults: intelPanelContent.searchResults,
                      query: intelPanelContent.query,
                    })}
                    className="flex items-center gap-1 text-[10px] text-slate-600 hover:text-white transition-colors mb-2"
                  >
                    <ArrowLeft size={10} /> Back to results
                  </button>
                )}

                <h2 className="text-[13px] font-bold text-white leading-snug">
                  {intelPanelContent.pageContent.title}
                </h2>

                {/* Metadata bar */}
                <div className="flex items-center gap-2 mt-1 mb-3 text-[10px] text-slate-600 font-mono">
                  {intelPanelContent.pageContent.siteName && <span>{intelPanelContent.pageContent.siteName}</span>}
                  {intelPanelContent.pageContent.author && (
                    <>
                      <span className="text-slate-800">·</span>
                      <span>{intelPanelContent.pageContent.author}</span>
                    </>
                  )}
                  {intelPanelContent.pageContent.publishedDate && (
                    <>
                      <span className="text-slate-800">·</span>
                      <span>{new Date(intelPanelContent.pageContent.publishedDate).toLocaleDateString()}</span>
                    </>
                  )}
                </div>

                {/* Content body */}
                <div className="text-[11px] text-slate-400 leading-relaxed space-y-2">
                  {intelPanelContent.pageContent.content.split(/\n{2,}/).map((para, i) => (
                    <p key={i}>{para}</p>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-[11px] text-rose-400">Could not load page</p>
                <p className="text-[10px] text-slate-700 mt-1">Try opening in the full Browser</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Q&A Strip */}
      {hasContent && (
        <div className="flex-shrink-0 border-t border-white/5">
          <button
            onClick={() => setQaOpen(!qaOpen)}
            className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-black uppercase text-slate-600 hover:text-white transition-colors tracking-widest"
          >
            <span>Ask</span>
            {qaOpen ? <ChevronDown size={10} /> : <ChevronUp size={10} />}
          </button>

          {qaOpen && (
            <div className="px-3 pb-2">
              {/* Q&A History */}
              {intelQAHistory.length > 0 && (
                <div className="max-h-[120px] overflow-y-auto no-scrollbar space-y-1.5 mb-2">
                  {intelQAHistory.slice(-4).map((entry, i) => (
                    <div key={i} className="space-y-1">
                      <p className="text-[10px] text-slate-500 font-mono">
                        <span className="text-slate-700">Q:</span> {entry.question}
                      </p>
                      <p className="text-[10px] text-slate-400 font-mono bg-black/30 rounded p-1.5 leading-relaxed">
                        {entry.answer}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Q&A Input */}
              <div className="flex items-center gap-2 bg-black/40 rounded-lg border border-white/5 px-2 py-1">
                <input
                  ref={qaInputRef}
                  type="text"
                  value={qaInput}
                  onChange={e => setQaInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleQASubmit()}
                  placeholder="Ask about this content..."
                  className="flex-1 bg-transparent text-[11px] text-white placeholder:text-slate-700 outline-none font-mono"
                  disabled={qaLoading}
                />
                {qaLoading ? (
                  <Loader2 size={11} className="animate-spin text-slate-500" />
                ) : (
                  <button onClick={handleQASubmit} className="text-slate-600 hover:text-white transition-colors">
                    <Send size={11} />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Action Bar */}
      {hasContent && (
        <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 border-t border-white/5 bg-black/20">
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                const ctx = buildContextString();
                if (!ctx) return;
                const store = useAppStore.getState();
                (store as any).collaborate = {
                  ...(store as any).collaborate,
                  goal: ctx,
                };
              }}
              title="Send to Mission"
              className="p-1.5 rounded-md text-slate-600 hover:text-indigo-400 hover:bg-indigo-500/10 transition-all"
            >
              <Target size={12} />
            </button>
            <button
              onClick={async () => {
                const ctx = buildContextString();
                if (!ctx) return;
                const store = useAppStore.getState();
                try {
                  await fetch(`${(window as any).__API_BASE || ''}/api/v1/overseer/trigger`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      focus: `Analyze this: ${intelPanelContent.query || 'page content'}`,
                      notepadContent: store.notepadContent + '\n\n--- Intel Context ---\n' + ctx.slice(0, 2000),
                      recentMessages: (store as any).messages?.slice(-5) || [],
                    }),
                  });
                } catch { /* overseer trigger is fire-and-forget */ }
              }}
              title="Send to Overseer"
              className="p-1.5 rounded-md text-slate-600 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all"
            >
              <Shield size={12} />
            </button>
            <button
              onClick={sendToChat}
              title="Send to Chat"
              className="p-1.5 rounded-md text-slate-600 hover:text-blue-400 hover:bg-blue-500/10 transition-all"
            >
              <MessageSquare size={12} />
            </button>
          </div>

          <button
            onClick={() => setIntelAmbientContext(!intelAmbientContext)}
            title={intelAmbientContext ? 'Ambient context ON' : 'Ambient context OFF'}
            className={cn(
              'p-1.5 rounded-md transition-all',
              intelAmbientContext
                ? 'text-emerald-400 bg-emerald-500/10 shadow-[0_0_6px_rgba(16,185,129,0.2)]'
                : 'text-slate-700 hover:text-slate-500'
            )}
          >
            {intelAmbientContext ? <Eye size={12} /> : <EyeOff size={12} />}
          </button>
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /home/caleb/solventclaude2/dazzling-shirley/frontend && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors (component is created but not yet imported anywhere)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/IntelPanel.tsx
git commit -m "feat(intel): create IntelPanel component with search, reader, Q&A, and action bar"
```

---

### Task 5: Wire IntelPanel into NotepadPiP

**Files:**
- Modify: `frontend/src/components/NotepadPiP.tsx:1-10` (imports), `157` (view state type), `555-561` (action grid), and a new view render branch

- [ ] **Step 1: Add imports to NotepadPiP.tsx**

Add `Search` to the lucide-react import (line 3-13):

```typescript
import {
  PenLine, X, Shield,
  Database, LayoutGrid, ExternalLink,
  Code2, Settings, Search,
  Layers, Trash2, ChevronDown, Sparkles,
  Brain, FlaskConical,
  Play, Loader2, CheckCircle2, XCircle,
  Users, Terminal as TerminalIcon, FileText,
  Wrench, Check, AlertCircle, FolderOpen,
  Eye, EyeOff, MessageSquare, Diff, ArrowRight,
} from 'lucide-react';
```

Add the IntelPanel import after the other component imports (after line 18):

```typescript
import { IntelPanel } from './IntelPanel';
```

- [ ] **Step 2: Update view state type**

Change line 157 from:

```typescript
const [view, setView] = useState<'dash' | 'notes' | 'overseer' | 'missions' | 'waterfall' | 'code'>('dash');
```

To:

```typescript
const [view, setView] = useState<'dash' | 'notes' | 'overseer' | 'missions' | 'waterfall' | 'code' | 'intel'>('dash');
```

- [ ] **Step 3: Add INTEL button to the action grid**

Change the action grid (lines 556-561) from:

```tsx
<div className="grid grid-cols-2 gap-2 flex-shrink-0">
  <ActionButton icon={Users}  label="MISSIONS" onClick={() => openLocalView('missions')}     color="text-indigo-400" desc="Multi-agent war room" />
  <ActionButton icon={PenLine} label="NOTES"   onClick={() => openLocalView('notes')}        color="text-amber-400"  desc="Context &amp; directives" />
  <ActionButton icon={Code2}  label="CODE"     onClick={() => openLocalView('code')}         color="text-jb-accent"  desc="IDE control panel" />
  <ActionButton icon={Layers} label="FLOW"     onClick={() => openLocalView('waterfall')}    color="text-jb-purple"  desc="Pipeline monitor" />
</div>
```

To:

```tsx
<div className="grid grid-cols-2 gap-2 flex-shrink-0">
  <ActionButton icon={Users}  label="MISSIONS" onClick={() => openLocalView('missions')}     color="text-indigo-400" desc="Multi-agent war room" />
  <ActionButton icon={Search} label="INTEL"     onClick={() => openLocalView('intel')}        color="text-cyan-400"   desc="Research terminal" />
  <ActionButton icon={PenLine} label="NOTES"   onClick={() => openLocalView('notes')}        color="text-amber-400"  desc="Context &amp; directives" />
  <ActionButton icon={Code2}  label="CODE"     onClick={() => openLocalView('code')}         color="text-jb-accent"  desc="IDE control panel" />
  <ActionButton icon={Layers} label="FLOW"     onClick={() => openLocalView('waterfall')}    color="text-jb-purple"  desc="Pipeline monitor" />
</div>
```

Note: This makes 5 buttons in a 2-column grid (3 + 2 layout). The last button will span naturally.

- [ ] **Step 4: Add Intel view render branch**

Find the last view branch before the closing `</AnimatePresence>` in the main content area. Add the Intel view branch. Place it after the missions view block. Look for the pattern `{view === 'missions' && (` and after its corresponding closing `)}`, add:

```tsx
{/* ─── INTEL ─── */}
{view === 'intel' && (
  <motion.div
    key="intel"
    initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
    className="flex-1 flex flex-col overflow-hidden"
  >
    <IntelPanel />
  </motion.div>
)}
```

- [ ] **Step 5: Verify TypeScript compiles and dev server runs**

Run: `cd /home/caleb/solventclaude2/dazzling-shirley/frontend && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/NotepadPiP.tsx
git commit -m "feat(intel): wire IntelPanel as 6th view in Command Center"
```

---

### Task 6: Add Ambient Context to Missions and Overseer

**Files:**
- Modify: `frontend/src/store/collaborateSlice.ts:70-95`
- Modify: `frontend/src/components/NotepadPiP.tsx` (overseer trigger function)

- [ ] **Step 1: Add ambient context to mission launches in `collaborateSlice.ts`**

In the `startConversation` method (around line 70), modify the goal before sending. Change:

```typescript
startConversation: async (goal: string, missionType: string) => {
    const { collaborateAbortController } = get();
    if (collaborateAbortController) collaborateAbortController.abort();
```

To:

```typescript
startConversation: async (goal: string, missionType: string) => {
    const { collaborateAbortController, intelAmbientContext, intelPanelContent } = get();
    if (collaborateAbortController) collaborateAbortController.abort();

    // Append ambient intel context if enabled
    let enrichedGoal = goal;
    if (intelAmbientContext && intelPanelContent.type !== 'idle') {
      let intelSummary = '';
      if (intelPanelContent.type === 'reader' && intelPanelContent.pageContent) {
        const p = intelPanelContent.pageContent;
        intelSummary = `\n\n[Intel Context] ${p.title} (${p.url}): ${p.content.slice(0, 500)}`;
      } else if (intelPanelContent.type === 'search' && intelPanelContent.searchResults?.synthesis) {
        intelSummary = `\n\n[Intel Context] Search "${intelPanelContent.query}": ${intelPanelContent.searchResults.synthesis.answer.slice(0, 500)}`;
      }
      if (intelSummary) enrichedGoal += intelSummary;
    }
```

Then change the `body: JSON.stringify({ goal, missionType }),` line to:

```typescript
body: JSON.stringify({ goal: enrichedGoal, missionType }),
```

- [ ] **Step 2: Add ambient context to overseer trigger in `NotepadPiP.tsx`**

Find the `triggerOverseer` function in NotepadPiP.tsx. It likely calls `POST /overseer/trigger`. Add intel context to the `notepadContent` field. Search for the function and modify the body to include intel context when `intelAmbientContext` is true.

First, add the store reads. Find where `triggerOverseer` is defined and add:

```typescript
const { intelAmbientContext, intelPanelContent } = useAppStore();
```

If `triggerOverseer` already reads from the store, just add these two to the destructured values.

Then where it builds the request body for the overseer trigger, append intel context to `notepadContent`:

```typescript
let enrichedNotepad = notepadContent;
if (intelAmbientContext && intelPanelContent.type !== 'idle') {
  if (intelPanelContent.type === 'reader' && intelPanelContent.pageContent) {
    enrichedNotepad += `\n\n--- Intel Context ---\n${intelPanelContent.pageContent.title}: ${intelPanelContent.pageContent.content.slice(0, 1000)}`;
  } else if (intelPanelContent.type === 'search' && intelPanelContent.searchResults?.synthesis) {
    enrichedNotepad += `\n\n--- Intel Context ---\nSearch "${intelPanelContent.query}": ${intelPanelContent.searchResults.synthesis.answer.slice(0, 500)}`;
  }
}
```

And use `enrichedNotepad` instead of `notepadContent` in the request body.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /home/caleb/solventclaude2/dazzling-shirley/frontend && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/store/collaborateSlice.ts frontend/src/components/NotepadPiP.tsx
git commit -m "feat(intel): wire ambient context into Missions and Overseer"
```

---

### Task 7: Manual Verification

- [ ] **Step 1: Start the dev servers**

Run both backend and frontend:
```bash
cd /home/caleb/solventclaude2/dazzling-shirley && npm run dev:backend &
cd /home/caleb/solventclaude2/dazzling-shirley && npm run dev:frontend &
```

- [ ] **Step 2: Verify Intel button appears in Command Center**

Open the app, click the Brain icon to open Command Center. Confirm:
- 5 buttons in action grid (MISSIONS, INTEL, NOTES, CODE, FLOW)
- INTEL button has cyan color and Search icon
- Clicking INTEL switches to the Intel view

- [ ] **Step 3: Test search flow**

In the Intel view:
- Type a search query and press Enter
- Confirm loading skeletons appear
- Confirm results render as dense rows with domain, title, snippet, relevance score
- Confirm synthesis appears at top if available
- Click a result — confirm it switches to reader view

- [ ] **Step 4: Test reader flow**

- Paste a URL and press Enter
- Confirm page title, metadata bar, and content body render
- Confirm "Back to results" link appears if navigated from search

- [ ] **Step 5: Test Q&A strip**

- With a page loaded, click "Ask" to expand Q&A
- Type a question and press Enter
- Confirm answer appears in compact format
- Confirm Q&A clears when loading a new page

- [ ] **Step 6: Test action bar**

- Click Send to Chat — confirm `browserInjectedContext` is set and app switches to chat
- Click Send to Overseer — confirm overseer trigger fires
- Toggle ambient context eye icon — confirm it toggles between emerald glow and gray

- [ ] **Step 7: Test ambient context**

- Load a page in Intel, toggle ambient context ON
- Go to Missions, launch a mission — confirm goal includes `[Intel Context]` suffix
- Toggle ambient context OFF, launch another mission — confirm no intel context appended
