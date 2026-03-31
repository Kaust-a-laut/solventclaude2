import React, { useState, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import { ChatService } from '../services/ChatService';
import { fetchWithRetry } from '../lib/api-client';
import { API_BASE_URL } from '../lib/config';
import {
  Globe, Search, ArrowLeft, Send, ChevronUp, ChevronDown,
  Eye, EyeOff, Loader2, Target, Shield, MessageSquare,
} from 'lucide-react';
import { cn } from '../lib/utils';

const URL_PATTERN = /^https?:\/\//i;

function extractHostname(url: string): string {
  try { return new URL(url).hostname; } catch { return url; }
}

export const IntelPanel: React.FC = () => {
  const {
    intelPanelContent, setIntelPanelContent,
    intelAmbientContext, setIntelAmbientContext,
    intelQAHistory, addIntelQAEntry, clearIntelQAHistory,
    intelRecentSearches, addIntelRecentSearch,
    setBrowserInjectedContext, setCurrentMode,
    startConversation,
    notepadContent,
  } = useAppStore();

  const [inputValue, setInputValue] = useState('');
  const [qaInput, setQaInput] = useState('');
  const [qaOpen, setQaOpen] = useState(false);
  const [qaLoading, setQaLoading] = useState(false);

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
    const prevSearchResults = intelPanelContent.searchResults;
    setIntelPanelContent({ type: 'reader', isLoading: true, query: url, searchResults: prevSearchResults });
    clearIntelQAHistory();
    try {
      const pageContent = await ChatService.browse(url);
      setIntelPanelContent({ type: 'reader', pageContent, query: url, searchResults: prevSearchResults });
    } catch {
      setIntelPanelContent({ type: 'reader', pageContent: null, query: url, isLoading: false, searchResults: prevSearchResults });
    }
  }, [intelPanelContent, setIntelPanelContent, clearIntelQAHistory]);

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

  const sendToMission = useCallback(() => {
    const ctx = buildContextString();
    if (!ctx) return;
    startConversation(ctx, 'consultation');
  }, [buildContextString, startConversation]);

  const sendToOverseer = useCallback(async () => {
    const ctx = buildContextString();
    if (!ctx) return;
    try {
      await fetchWithRetry(`${API_BASE_URL}/overseer/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          focus: `Analyze this: ${intelPanelContent.query || 'page content'}`,
          notepadContent: notepadContent + '\n\n--- Intel Context ---\n' + ctx.slice(0, 2000),
          recentMessages: [],
        }),
      });
    } catch { /* fire-and-forget */ }
  }, [buildContextString, intelPanelContent.query, notepadContent]);

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
      <div className="flex-1 overflow-y-auto no-scrollbar px-3">
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
                      {extractHostname(result.link)}
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
            {qaOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
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
              onClick={sendToMission}
              title="Send to Mission"
              className="p-1.5 rounded-md text-slate-600 hover:text-indigo-400 hover:bg-indigo-500/10 transition-all"
            >
              <Target size={12} />
            </button>
            <button
              onClick={sendToOverseer}
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
