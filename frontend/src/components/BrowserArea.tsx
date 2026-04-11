import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Search, ArrowLeft, ArrowRight, RotateCw, Globe,
  ShieldCheck, ExternalLink, Zap, Plus, X,
  Layout, Command, Cpu, Network, BookOpen,
  Sparkles, Send, ChevronDown, FileText
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { safeHostname } from '../lib/allModels';
import { cn } from '../lib/utils';
import { ChatService } from '../services/ChatService';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../store/useAppStore';
import type { BrowserTab, PageContent, SearchResultSet } from '../store/types';
import { SearchPipelineStepper } from './SearchPipelineStepper';

const stripHtml = (text: string) => {
  if (!text) return '';
  const doc = new DOMParser().parseFromString(text, 'text/html');
  return doc.body.textContent || '';
};
import { SearchSynthesisCard } from './SearchSynthesisCard';
import { RelevanceBadge } from './RelevanceBadge';

type PipelineStage = 'idle' | 'expanding' | 'searching' | 'ranking' | 'synthesizing' | 'complete';

// ── PiP Component (rendered inside Document PiP window) ──────────────────
const BrowserPiP = () => {
  const {
    browserTabs, activeBrowserTabId, updateBrowserTab,
  } = useAppStore();

  const activeTab = browserTabs.find(t => t.id === activeBrowserTabId) || browserTabs[0];
  const [inputUrl, setInputUrl] = useState(activeTab?.url || '');

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

  return (
    <div className="flex flex-col h-full bg-[#020205] text-white font-sans overflow-hidden">
      <div className="h-12 border-b border-white/5 flex items-center px-4 bg-black/40 gap-3">
        <Globe size={14} className="text-slate-400" />
        <input
          type="text"
          value={inputUrl}
          onChange={(e) => setInputUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handlePiPNavigate(inputUrl)}
          placeholder="Search..."
          className="flex-1 bg-transparent text-xs font-bold text-white outline-none placeholder:text-slate-800 uppercase tracking-widest"
        />
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab?.searchResults?.results?.map((result: unknown, idx: number) => {
          const r = result as { link: string; title: string; snippet: string; relevanceScore?: number };
          return (
          <a key={idx} href={r.link} target="_blank" rel="noopener noreferrer"
            className="block mb-3 p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-jb-accent/20 transition-all">
            <div className="text-[11px] text-jb-accent font-bold uppercase tracking-widest mb-1">
              {(() => { try { return new URL(r.link).hostname; } catch { return ''; } })()}
            </div>
            <div className="text-[13px] font-bold text-white mb-1">{r.title}</div>
            <div className="text-[11px] text-slate-300 line-clamp-2">{r.snippet}</div>
          </a>
          );
        })}
        {activeTab?.pageContent && (
          <div className="space-y-3">
            <h2 className="text-xl font-black text-white">{activeTab.pageContent.title}</h2>
            <p className="text-sm text-slate-400 leading-relaxed whitespace-pre-wrap">{activeTab.pageContent.content.slice(0, 5000)}</p>
          </div>
        )}
        {!activeTab?.searchResults && !activeTab?.pageContent && (
          <div className="flex flex-col items-center justify-center h-full text-center opacity-40">
            <Globe size={48} className="mb-4" />
            <p className="text-xs uppercase tracking-widest">Search the web</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Main BrowserArea ─────────────────────────────────────────────────────
export const BrowserArea = () => {
  const {
    browserHistory, setBrowserHistory, lastSearchResults, setLastSearchResults,
    deviceInfo, messages,
    browserTabs, activeBrowserTabId, addBrowserTab, closeBrowserTab,
    updateBrowserTab, setActiveBrowserTabId,
    browserPiPOpen, setBrowserPiPOpen,
    browserInjectedContext, setBrowserInjectedContext,
    browserPinnedUrls, addBrowserPinnedUrl, removeBrowserPinnedUrl,
    setCurrentMode,
  } = useAppStore();

  const activeTab = browserTabs.find(t => t.id === activeBrowserTabId) || browserTabs[0];
  const lastProvenance = [...messages].reverse().find(m => m.provenance)?.provenance;

  const [inputUrl, setInputUrl] = useState('');
  const [summary, setSummary] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryInstruction, setSummaryInstruction] = useState('');
  const [showSummaryInput, setShowSummaryInput] = useState(false);
  const [pipelineStage, setPipelineStage] = useState<PipelineStage>('idle');
  const pipWindowRef = useRef<Window | null>(null);
  const pipCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => { pipCleanupRef.current?.(); };
  }, []);

  const tabId = activeTab?.id || 'tab-1';

  // ── Navigation Handler ─────────────────────────────────────────────
  const handleNavigate = useCallback(async (newUrl: string) => {
    if (!newUrl.trim()) return;
    setInputUrl(newUrl);
    setSummary(null);
    updateBrowserTab(tabId, { isLoading: true });

    if (newUrl.startsWith('http')) {
      // Reader mode: fetch and extract page content
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
        // Sync legacy store
        setLastSearchResults(null);
        setPipelineStage('idle');
      } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
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
        await new Promise(r => setTimeout(r, 400));
        setPipelineStage('searching');
        const results = await ChatService.search(newUrl);

        setPipelineStage('ranking');
        await new Promise(r => setTimeout(r, 200));

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
      } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        updateBrowserTab(tabId, {
          type: 'search',
          searchResults: { results: [], error: err.message || 'Network bridge failure' },
          isLoading: false,
        });
        setLastSearchResults({ results: [], error: err.message });
        setPipelineStage('idle');
      }
    }

    setBrowserHistory([...browserHistory, newUrl]);
  }, [tabId, browserHistory, setBrowserHistory, setLastSearchResults, updateBrowserTab]);

  // ── Load More (Pagination) ─────────────────────────────────────────
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
        updateBrowserTab(tabId, { isLoading: false, searchPage: -1 }); // -1 = no more
      }
    } catch {
      updateBrowserTab(tabId, { isLoading: false });
    }
  }, [activeTab, tabId, updateBrowserTab, setLastSearchResults]);

  // ── Summarize ──────────────────────────────────────────────────────
  const handleSummarize = useCallback(async (instruction?: string) => {
    if (!activeTab?.pageContent?.content) return;
    setIsSummarizing(true);
    setSummary(null);
    try {
      const data = await ChatService.summarizePage(activeTab.pageContent.content, instruction);
      setSummary(typeof data.summary === 'string' ? data.summary : null);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Summarization failed';
      setSummary(`Error: ${msg}`);
    } finally {
      setIsSummarizing(false);
      setShowSummaryInput(false);
      setSummaryInstruction('');
    }
  }, [activeTab]);

  // ── Send to Chat ───────────────────────────────────────────────────
  const sendToChat = useCallback((text: string) => {
    setBrowserInjectedContext(text);
    setCurrentMode('chat');
  }, [setBrowserInjectedContext, setCurrentMode]);

  // ── Pin/Unpin URL ───────────────────────────────────────────────────
  const togglePinUrl = useCallback(() => {
    if (!activeTab?.url || !activeTab?.pageContent?.title) return;
    
    const isPinned = browserPinnedUrls.some((p: { url: string }) => p.url === activeTab.url);
    if (isPinned) {
      removeBrowserPinnedUrl(activeTab.url);
    } else {
      // Auto-generate summary from page content
      const summary = activeTab.pageContent.content.slice(0, 500).split('\n').slice(0, 3).join(' ');
      addBrowserPinnedUrl(activeTab.url, activeTab.pageContent.title, summary);
    }
  }, [activeTab, browserPinnedUrls, removeBrowserPinnedUrl, addBrowserPinnedUrl]);

  const isCurrentUrlPinned = activeTab?.url && browserPinnedUrls.some((p: { url: string }) => p.url === activeTab.url);

  // ── Tab Management ─────────────────────────────────────────────────
  const handleAddTab = useCallback(() => {
    const id = `tab-${Date.now()}`;
    addBrowserTab({ id, label: 'New Tab', url: '', type: 'idle' });
    setInputUrl('');
    setSummary(null);
  }, [addBrowserTab]);

  const handleCloseTab = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    closeBrowserTab(id);
  }, [closeBrowserTab]);

  const handleSwitchTab = useCallback((id: string) => {
    setActiveBrowserTabId(id);
    const tab = browserTabs.find(t => t.id === id);
    if (tab) setInputUrl(tab.url || '');
    setSummary(null);
  }, [browserTabs, setActiveBrowserTabId]);

  // ── PiP Popout ─────────────────────────────────────────────────────
  const openBrowserPiP = async () => {
    if (pipWindowRef.current && !pipWindowRef.current.closed) {
      pipWindowRef.current.focus();
      return;
    }
    if (!('documentPictureInPicture' in window)) return;

    try {
      const pipWin: Window = await (window as unknown as { documentPictureInPicture?: { requestWindow: (opts: unknown) => Promise<Window> } }).documentPictureInPicture!.requestWindow({
        width: 480, height: 700,
      });
      pipWindowRef.current = pipWin;

      [...document.styleSheets].forEach((sheet) => {
        try {
          if (sheet.href) {
            const link = pipWin.document.createElement('link');
            link.rel = 'stylesheet';
            link.href = sheet.href;
            pipWin.document.head.appendChild(link);
          } else {
            const cssText = [...sheet.cssRules].map(r => r.cssText).join('\n');
            const style = pipWin.document.createElement('style');
            style.textContent = cssText;
            pipWin.document.head.appendChild(style);
          }
        } catch (_) {}
      });

      pipWin.document.body.style.cssText = 'margin:0;padding:0;background:#020205;color:white;';
      const container = pipWin.document.createElement('div');
      container.style.cssText = 'width:100vw;height:100vh;';
      pipWin.document.body.appendChild(container);

      const root = createRoot(container);
      root.render(<BrowserPiP />);
      setBrowserPiPOpen(true);

      const onPageHide = () => {
        root.unmount();
        setBrowserPiPOpen(false);
        pipWindowRef.current = null;
      };
      pipWin.addEventListener('pagehide', onPageHide);
      pipCleanupRef.current = () => {
        pipWin.removeEventListener('pagehide', onPageHide);
        root.unmount();
        pipWin.close();
        setBrowserPiPOpen(false);
        pipWindowRef.current = null;
      };
    } catch (err) {
      console.error('Document PiP failed:', err);
    }
  };

  // ── Computed ───────────────────────────────────────────────────────
  const searchResults = activeTab?.searchResults;
  const pageContent = activeTab?.pageContent;
  const isLoading = activeTab?.isLoading || false;
  const canLoadMore = searchResults && searchResults.results?.length >= 10 && (activeTab?.searchPage || 1) > 0;
  const displayUrl = activeTab?.url || '';
  const supportsPiP = typeof window !== 'undefined' && 'documentPictureInPicture' in window;


  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#020205] font-sans relative">
      <div className="absolute inset-0 neural-grid opacity-[0.03] pointer-events-none" />

      {/* Browser Chrome */}
      <div className="h-20 border-b border-white/5 flex items-center px-8 bg-black/40 backdrop-blur-xl relative z-30 gap-6">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/5">
            <button onClick={() => { /* TODO: wire to in-app browserHistory state */ }} className="p-2 hover:bg-white/5 rounded-lg disabled:opacity-10 transition-all" disabled>
              <ArrowLeft size={16} className="text-white" />
            </button>
            <button onClick={() => { /* TODO: wire to in-app browserHistory state */ }} className="p-2 hover:bg-white/5 rounded-lg disabled:opacity-10 transition-all" disabled>
              <ArrowRight size={16} className="text-white" />
            </button>
            <button onClick={() => handleNavigate(inputUrl)} className="p-2 hover:bg-white/5 rounded-lg transition-all">
              <RotateCw size={16} className={cn("text-white", isLoading && "animate-spin text-jb-accent")} />
            </button>
          </div>
        </div>

        <div className="flex-1 flex items-center gap-3 bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-2.5 group focus-within:border-jb-accent/40 transition-all shadow-inner">
          <Globe size={14} className="text-slate-400 group-focus-within:text-jb-accent transition-colors" />
          <input
            type="text"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleNavigate(inputUrl)}
            placeholder="URL or Search Query..."
            className="flex-1 bg-transparent text-xs font-bold text-white outline-none placeholder:text-slate-800 uppercase tracking-widest"
          />
          <AnimatePresence>
            {isLoading ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Zap size={14} className="text-jb-orange animate-pulse" />
              </motion.div>
            ) : (
              <ShieldCheck size={14} className="text-emerald-500/60" />
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex flex-col text-right hidden lg:flex">
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Session Node</span>
            <span className="text-[11px] font-mono text-jb-accent uppercase truncate max-w-[120px]">
              {activeTab?.type === 'search' ? 'QUERY_STREAM' : activeTab?.type === 'reader' ? 'READER' : safeHostname(displayUrl || 'https://google.com')}
            </span>
          </div>
          {supportsPiP && (
            <button onClick={openBrowserPiP} className="px-5 py-2.5 bg-jb-accent/10 border border-jb-accent/20 text-jb-accent text-[11px] font-black uppercase tracking-widest rounded-xl hover:bg-jb-accent hover:text-white transition-all shadow-[0_0_20px_rgba(60,113,247,0.1)]">
              <ExternalLink size={14} className="inline mr-2" /> Popout
            </button>
          )}
        </div>
      </div>

      {/* Tab Bar */}
      <div className="h-10 border-b border-white/5 flex items-center px-4 bg-black/20 gap-1 overflow-x-auto scrollbar-none relative z-20">
        {browserTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleSwitchTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-1.5 rounded-t-lg text-[11px] font-bold uppercase tracking-widest transition-all min-w-0 max-w-[160px] group",
              tab.id === activeBrowserTabId
                ? "bg-white/[0.06] text-white border-t border-x border-white/10"
                : "text-slate-400 hover:text-slate-400 hover:bg-white/[0.02]"
            )}
          >
            <span className="truncate">{tab.label || 'New Tab'}</span>
            {browserTabs.length > 1 && (
              <X size={10} className="flex-shrink-0 opacity-0 group-hover:opacity-100 hover:text-rose-400 transition-all" onClick={(e) => handleCloseTab(e, tab.id)} />
            )}
          </button>
        ))}
        {browserTabs.length < 8 && (
          <button onClick={handleAddTab} className="p-1.5 hover:bg-white/5 rounded-lg transition-all ml-1">
            <Plus size={12} className="text-slate-400" />
          </button>
        )}
      </div>

      {/* Viewport */}
      <div className="flex-1 min-h-0 relative bg-transparent overflow-y-auto scrollbar-thin p-6 md:p-12">
        {/* Reader Mode */}
        {activeTab?.type === 'reader' && pageContent?.restricted ? (
          /* Restricted Site State */
          <div className="max-w-2xl mx-auto py-24">
            <div className="p-8 rounded-2xl bg-white/[0.02] border border-amber-500/20 space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                  <ShieldCheck size={20} className="text-amber-500" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-white tracking-tight">{pageContent.title}</h2>
                  <p className="text-[11px] font-black text-amber-500 uppercase tracking-[0.3em]">Restricted Access</p>
                </div>
              </div>

              <p className="text-sm text-slate-400 leading-relaxed">
                {pageContent.excerpt}
              </p>

              <div className="flex flex-wrap gap-3">
                <a
                  href={pageContent.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-5 py-2.5 bg-jb-accent text-white text-[11px] font-black uppercase tracking-widest rounded-xl hover:bg-jb-accent/80 transition-all"
                >
                  <ExternalLink size={12} /> Open in Browser
                </a>
                <button
                  onClick={() => updateBrowserTab(tabId, { type: 'search', pageContent: null })}
                  className="flex items-center gap-2 px-5 py-2.5 bg-white/5 border border-white/10 text-slate-400 text-[11px] font-black uppercase tracking-widest rounded-xl hover:bg-white/10 transition-all"
                >
                  <ArrowLeft size={12} /> Back to Results
                </button>
              </div>
            </div>
          </div>

        ) : activeTab?.type === 'reader' && pageContent ? (
          <div className="max-w-4xl mx-auto space-y-8 pb-24">
            {/* Reader Header */}
            <div className="space-y-4 border-b border-white/5 pb-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[11px] font-black text-emerald-500 uppercase tracking-[0.3em]">Reader Mode</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-[900] text-white tracking-tighter leading-tight">
                {pageContent.title}
              </h1>
              <div className="flex flex-wrap items-center gap-4 text-[11px] font-black text-slate-300 uppercase tracking-widest">
                {pageContent.siteName && (
                  <span className="text-jb-accent">{pageContent.siteName}</span>
                )}
                {pageContent.author && <span>By {pageContent.author}</span>}
                {pageContent.publishedDate && (
                  <span>{new Date(pageContent.publishedDate).toLocaleDateString()}</span>
                )}
              </div>
              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  onClick={togglePinUrl}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 border text-[11px] font-black uppercase tracking-widest rounded-xl transition-all",
                    isCurrentUrlPinned
                      ? "bg-jb-accent border-jb-accent text-white"
                      : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
                  )}
                >
                  {isCurrentUrlPinned ? '📌 Unpin' : '📌 Pin Page'}
                </button>
                <button
                  onClick={() => handleSummarize()}
                  disabled={isSummarizing}
                  className="flex items-center gap-2 px-4 py-2 bg-jb-accent/10 border border-jb-accent/20 text-jb-accent text-[11px] font-black uppercase tracking-widest rounded-xl hover:bg-jb-accent hover:text-white transition-all disabled:opacity-40"
                >
                  <Sparkles size={12} /> {isSummarizing ? 'Summarizing...' : 'Summarize'}
                </button>
                <button
                  onClick={() => setShowSummaryInput(!showSummaryInput)}
                  className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 text-slate-400 text-[11px] font-black uppercase tracking-widest rounded-xl hover:bg-white/10 transition-all"
                >
                  <FileText size={12} /> Focused Summary
                </button>
                <button
                  onClick={() => sendToChat(`Page: ${pageContent.title}\nURL: ${pageContent.url}\n\n${pageContent.content.slice(0, 3000)}`)}
                  className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 text-slate-400 text-[11px] font-black uppercase tracking-widest rounded-xl hover:bg-white/10 transition-all"
                >
                  <Send size={12} /> Send to Chat
                </button>
              </div>
              {/* Focused Summary Input */}
              <AnimatePresence>
                {showSummaryInput && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="flex gap-2 pt-2">
                      <input
                        type="text"
                        value={summaryInstruction}
                        onChange={(e) => setSummaryInstruction(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSummarize(summaryInstruction)}
                        placeholder="e.g. Focus on technical architecture..."
                        className="flex-1 bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2 text-xs text-white outline-none placeholder:text-slate-400 focus:border-jb-accent/40"
                      />
                      <button
                        onClick={() => handleSummarize(summaryInstruction)}
                        disabled={isSummarizing || !summaryInstruction.trim()}
                        className="px-4 py-2 bg-jb-accent text-white text-[11px] font-black uppercase tracking-widest rounded-xl disabled:opacity-40"
                      >
                        Go
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Summary Card */}
            <AnimatePresence>
              {summary && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="p-6 rounded-2xl bg-jb-accent/5 border border-jb-accent/20 relative overflow-hidden"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Sparkles size={14} className="text-jb-accent" />
                      <span className="text-[11px] font-black text-jb-accent uppercase tracking-[0.3em]">AI Summary</span>
                    </div>
                    <button
                      onClick={() => sendToChat(`AI Summary of "${pageContent.title}":\n\n${summary}`)}
                      className="flex items-center gap-1.5 px-3 py-1 bg-white/5 border border-white/10 text-slate-400 text-[11px] font-black uppercase tracking-widest rounded-lg hover:bg-white/10 transition-all"
                    >
                      <Send size={10} /> Send to Chat
                    </button>
                  </div>
                  <div className="text-[15px] text-slate-300 leading-relaxed whitespace-pre-wrap">{summary}</div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Page Content */}
            <div className={cn(
              "p-8 rounded-2xl bg-white/[0.02] border border-white/[0.06]",
              "prose prose-invert prose-sm max-w-none",
              "prose-headings:text-white prose-headings:font-bold prose-headings:tracking-tight",
              "prose-h1:text-[22px] prose-h1:pt-6 prose-h1:pb-2 prose-h1:border-t prose-h1:border-white/[0.06] first:prose-h1:border-t-0 first:prose-h1:pt-0",
              "prose-h2:text-[19px] prose-h2:pt-5 prose-h2:pb-1.5",
              "prose-h3:text-[16px] prose-h3:pt-4 prose-h3:pb-1",
              "prose-p:text-[15px] prose-p:text-white/85 prose-p:leading-[1.9]",
              "prose-a:text-jb-accent prose-a:no-underline hover:prose-a:underline",
              "prose-li:text-white/80 prose-li:text-[14px]",
              "prose-strong:text-white prose-em:text-white/70",
              "prose-blockquote:border-jb-purple/30 prose-blockquote:text-white/60",
              "prose-code:text-jb-accent prose-code:bg-white/5 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-[12px] prose-code:border prose-code:border-white/5",
              "prose-pre:bg-black/40 prose-pre:border prose-pre:border-white/[0.08] prose-pre:rounded-xl",
            )}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  a({ href, children }) {
                    return (
                      <a
                        href={href}
                        onClick={(e) => {
                          e.preventDefault();
                          if (href) {
                            setInputUrl(href);
                            handleNavigate(href);
                          }
                        }}
                        className="text-jb-accent hover:underline cursor-pointer"
                      >
                        {children}
                      </a>
                    );
                  },
                }}
              >
                {pageContent.content}
              </ReactMarkdown>
            </div>
          </div>

        ) : activeTab?.type === 'reader' && !pageContent ? (
          /* Reader Error State */
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="relative mb-8">
              <div className="absolute inset-0 bg-rose-500/20 blur-3xl rounded-full animate-pulse" />
              <Globe size={64} className="relative z-10 text-rose-500/20" />
            </div>
            <p className="text-xl font-black text-slate-400 uppercase tracking-[0.2em]">Content Unavailable</p>
            <p className="text-xs text-rose-500/60 uppercase tracking-widest mt-2">
              Could not extract content from this page
            </p>
          </div>

        ) : searchResults ? (
          /* Search Results View */
          <div className="max-w-7xl mx-auto space-y-12 pb-24">
            {/* Pipeline Stepper */}
            <SearchPipelineStepper
              stage={pipelineStage}
              stats={searchResults?.stats}
              expandedQuery={searchResults?.expandedQuery}
            />

            {/* AI Synthesis Card */}
            {(pipelineStage === 'synthesizing' || pipelineStage === 'complete') && searchResults?.synthesis && (
              <SearchSynthesisCard
                synthesis={searchResults.synthesis}
                isLoading={pipelineStage === 'synthesizing'}
                onSourceClick={(url) => {
                  const el = document.querySelector(`[data-result-url="${CSS.escape(url)}"]`);
                  el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
              />
            )}

            {/* Header Stats */}
            <div className="flex items-end justify-between border-b border-white/5 pb-8">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-jb-accent animate-pulse" />
                  <h2 className="text-4xl md:text-5xl font-[900] text-white tracking-tighter uppercase">
                    Web <span className="text-vibrant text-transparent bg-clip-text bg-gradient-to-r from-jb-accent to-jb-purple">Results</span>
                  </h2>
                </div>
                <p className="text-[11px] text-slate-300 font-black uppercase tracking-[0.4em]">Live Web Search // Results Synchronized</p>
              </div>
              <div className="px-4 py-2 rounded-xl bg-white/[0.03] border border-white/5 text-right">
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-1">Items Found</span>
                <span className="text-lg font-mono font-black text-white">0{searchResults.results?.length || 0}</span>
              </div>
            </div>

            {/* Answer Box */}
            {searchResults.answerBox && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-8 rounded-[2.5rem] bg-jb-accent/5 border border-jb-accent/20 shadow-2xl relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:scale-110 transition-transform">
                  <Cpu size={120} />
                </div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[11px] font-black text-jb-accent uppercase tracking-[0.3em]">Direct Answer</span>
                  <button
                    onClick={() => sendToChat(`Direct Answer: ${searchResults.answerBox.title}\n\n${searchResults.answerBox.answer || searchResults.answerBox.snippet}`)}
                    className="flex items-center gap-1.5 px-3 py-1 bg-white/5 border border-white/10 text-slate-400 text-[11px] font-black uppercase tracking-widest rounded-lg hover:bg-white/10 transition-all"
                  >
                    <Send size={10} /> Chat
                  </button>
                </div>
                <h3 className="text-2xl font-black text-white mb-4 tracking-tight">{searchResults.answerBox.title}</h3>
                <p className="text-slate-400 leading-relaxed text-[19px] font-medium">{stripHtml(searchResults.answerBox.answer || searchResults.answerBox.snippet)}</p>
              </motion.div>
            )}

            {/* Result Cards */}
            <div className="flex flex-col gap-4">
              {searchResults.results?.map((result: unknown, idx: number) => {
                const r = result as { link: string; title: string; snippet: string; relevanceScore?: number };
                return (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.02 }}
                  key={idx}
                  data-result-url={result.link}
                  className="group relative rounded-2xl bg-white/[0.02] border border-white/5 hover:border-jb-accent/20 hover:bg-white/[0.04] transition-all overflow-hidden"
                >
                  {result.relevanceScore >= 60 && (
                    <div
                      className="absolute left-0 top-0 w-0.5 rounded-r"
                      style={{
                        height: `${Math.min(100, result.relevanceScore)}%`,
                        background: result.relevanceScore >= 85
                          ? 'linear-gradient(to bottom, #10b981, #10b981)'
                          : 'linear-gradient(to bottom, #fb923c, #fb923c)',
                      }}
                    />
                  )}
                  <div className="flex items-start gap-5 px-8 py-6">
                    <div className="flex-shrink-0 w-8 flex flex-col items-center gap-1.5 pt-0.5">
                      <span className="text-[11px] font-mono font-black text-white/20">{String(idx + 1).padStart(2, '0')}</span>
                      <div className="w-px flex-1 min-h-[24px] bg-white/5 group-hover:bg-jb-accent/20 transition-colors" />
                    </div>

                    <div className="flex-1 min-w-0 space-y-2 cursor-pointer" onClick={() => { setInputUrl(result.link); handleNavigate(result.link); }}>
                      <div className="flex items-center gap-2 min-w-0">
                        <Network size={10} className="text-jb-accent/70 flex-shrink-0" />
                        <span className="text-[14px] font-black text-jb-accent uppercase tracking-widest flex-shrink-0">
                          {(() => { try { return new URL(result.link).hostname; } catch { return ''; } })()}
                        </span>
                        {result.relevanceScore > 0 && <RelevanceBadge score={result.relevanceScore} />}
                        <span className="text-[14px] text-slate-400 truncate min-w-0">· {result.link}</span>
                      </div>
                      <h3 className="text-[18px] font-black text-white group-hover:text-jb-accent/90 transition-colors tracking-tight leading-snug">
                        {stripHtml(result.title)}
                      </h3>
                      <p className="text-[16px] text-slate-300 font-medium leading-relaxed line-clamp-4 group-hover:text-slate-400 transition-colors">
                        {stripHtml(result.snippet)}
                      </p>
                    </div>

                    <div className="flex-shrink-0 flex flex-col gap-2 pt-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); sendToChat(`${result.title}\n${result.link}\n${result.snippet || ''}`); }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-white/5 rounded-lg"
                        title="Send to Chat"
                      >
                        <Send size={12} className="text-slate-300 hover:text-jb-accent" />
                      </button>
                      <a href={result.link} target="_blank" rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-white/5 rounded-lg"
                        title="Open in new tab"
                      >
                        <ExternalLink size={12} className="text-slate-300 hover:text-jb-accent" />
                      </a>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Load More (Pagination) */}
            {canLoadMore && (
              <div className="flex justify-center pt-4">
                <button
                  onClick={handleLoadMore}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-8 py-3 bg-white/[0.03] border border-white/10 text-slate-400 text-[11px] font-black uppercase tracking-widest rounded-2xl hover:bg-white/[0.06] hover:border-jb-accent/20 transition-all disabled:opacity-40"
                >
                  <ChevronDown size={14} className={cn(isLoading && "animate-bounce")} />
                  {isLoading ? 'Loading...' : 'Load More Results'}
                </button>
              </div>
            )}

            {/* Related Searches (Phase 1) */}
            {searchResults.relatedSearches && searchResults.relatedSearches.length > 0 && (
              <div className="space-y-4 pt-4 border-t border-white/5">
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] block">Related Searches</span>
                <div className="flex flex-wrap gap-2">
                  {searchResults.relatedSearches.map((rs: { query: string }, i: number) => (
                    <button
                      key={i}
                      onClick={() => { setInputUrl(rs.query); handleNavigate(rs.query); }}
                      className="px-4 py-2 bg-white/[0.03] border border-white/5 text-slate-400 text-[14px] font-bold rounded-full hover:bg-jb-accent/10 hover:border-jb-accent/20 hover:text-jb-accent transition-all"
                    >
                      <Search size={10} className="inline mr-1.5 -mt-0.5" />
                      {rs.query}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* No Results */}
            {(!searchResults.results || searchResults.results.length === 0) && (
              <div className="flex flex-col items-center justify-center py-32 text-center">
                <div className="relative mb-8">
                  <div className="absolute inset-0 bg-rose-500/20 blur-3xl rounded-full animate-pulse" />
                  <Search size={64} className="relative z-10 text-rose-500/20" />
                </div>
                <p className="text-xl font-black text-slate-400 uppercase tracking-[0.2em]">No Results Found</p>
                <p className="text-xs text-rose-500/60 uppercase tracking-widest mt-2">
                  {searchResults.error || 'Adjust search parameters and try again'}
                </p>
              </div>
            )}
          </div>

        ) : (
          /* Idle / Landing State */
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-transparent">
            <div className="max-w-md text-center space-y-8 p-6">
              <div className="relative mx-auto w-32 h-32 mb-12">
                <div className="absolute inset-0 bg-jb-accent/20 blur-[60px] rounded-full animate-pulse" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Globe size={80} className="text-jb-accent opacity-20" />
                </div>
                <div className="absolute inset-0 border-2 border-jb-accent/10 border-dashed rounded-full animate-[spin_20s_linear_infinite]" />
              </div>

              <div className="space-y-4">
                <p className="text-2xl font-[900] text-white tracking-tighter uppercase">Web Browser <span className="text-vibrant">Standby</span></p>
                <p className="text-[11px] text-slate-300 font-black uppercase tracking-[0.4em] leading-relaxed">
                  Enter a URL or search query to begin.
                </p>
              </div>

              <div className="p-6 bg-white/[0.02] border border-white/5 rounded-[2rem] text-left relative overflow-hidden glass-panel">
                <div className="absolute top-0 right-0 p-4 opacity-5">
                  <Command size={32} />
                </div>
                <span className="text-[11px] font-black text-jb-accent uppercase tracking-widest block mb-3">Bridge Protocols</span>
                <p className="text-[11px] text-slate-300 font-medium leading-relaxed italic">
                  Solvent AI will scan the open web, extract structural metadata, and provide real-time context for your current engineering mission.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Pinned URLs Panel */}
      {browserPinnedUrls.length > 0 && (
        <div className="absolute top-4 left-4 z-20 w-72 max-h-96 overflow-y-auto">
          <div className="bg-black/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-3 border-b border-white/5 flex items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-300">📌 Pinned Pages</span>
              <span className="text-[11px] font-mono text-slate-400 bg-white/5 px-1 rounded">{browserPinnedUrls.length}</span>
            </div>
            <div className="p-2 space-y-1">
              {browserPinnedUrls.map((pinned: { url: string; title: string; summary?: string }) => (
                <div
                  key={pinned.url}
                  className="group p-2 bg-white/[0.02] border border-white/5 rounded-lg hover:border-jb-accent/20 transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold text-white truncate">{pinned.title}</p>
                      <p className="text-[11px] text-slate-300 truncate">{pinned.url}</p>
                      {pinned.summary && (
                        <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{pinned.summary}</p>
                      )}
                    </div>
                    <button
                      onClick={() => removeBrowserPinnedUrl(pinned.url)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-400 transition-all"
                    >
                      <X size={8} />
                    </button>
                  </div>
                  <button
                    onClick={() => {
                      handleNavigate(pinned.url);
                    }}
                    className="w-full mt-1.5 py-1 bg-white/5 hover:bg-jb-accent/10 border border-white/5 hover:border-jb-accent/20 rounded text-[11px] font-black uppercase tracking-widest text-slate-300 hover:text-jb-accent transition-all"
                  >
                    Open Page
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Status Bar */}
      <div className="h-12 px-8 bg-black border-t border-white/5 flex justify-between items-center relative z-30">
        <div className="flex items-center gap-6 text-[11px] text-slate-400 font-black uppercase tracking-[0.2em]">
          <div className="flex items-center gap-2.5">
            <span className={cn("w-1.5 h-1.5 rounded-full", lastProvenance ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" : "bg-slate-700")} />
            CTX: <span className="text-white/40 font-mono ml-1">{lastProvenance ? `${lastProvenance.active.length} entries` : '—'}</span>
          </div>
          <div className="h-4 w-[1px] bg-white/10" />
          <div className="flex items-center gap-2">
            <Layout size={12} className="text-slate-400" />
            WS: <span className="text-white/40 font-mono ml-1">{lastProvenance ? `${lastProvenance.counts.workspace} files` : '—'}</span>
          </div>
          <div className="h-4 w-[1px] bg-white/10" />
          <div className="flex items-center gap-2">
            <BookOpen size={12} className="text-slate-400" />
            TABS: <span className="text-white/40 font-mono ml-1">{browserTabs.length}</span>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-[11px] text-slate-400 font-black uppercase tracking-[0.2em] hidden sm:block">
            MODE: <span className="text-white/40 font-mono">{activeTab?.type?.toUpperCase() || 'IDLE'}</span>
          </div>
          <div className="text-[11px] text-slate-400 font-black uppercase tracking-[0.2em]">
            {searchResults ? (
              <>HITS: <span className="text-jb-accent font-mono">{String(searchResults.results?.length || 0).padStart(2, '0')}</span></>
            ) : pageContent ? (
              <>LEN: <span className="text-emerald-500 font-mono">{(pageContent.content.length / 1000).toFixed(1)}k</span></>
            ) : (
              <>SUPPRESSED: <span className="text-white/40 font-mono">{lastProvenance ? lastProvenance.suppressed.length : '—'}</span></>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
