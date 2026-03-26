import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, MessageSquare, FileText, Brain, History,
  ChevronRight, X, Command, Clock, Folder, AlertTriangle
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { api } from '../lib/api';

interface SearchResult {
  type: 'session' | 'message' | 'memory' | 'file';
  id: string;
  title: string;
  excerpt: string;
  score?: number;
  metadata: {
    mode?: string;
    date?: string;
    messageCount?: number;
    memoryType?: string;
    filePath?: string;
  };
}

interface SearchGroup {
  type: string;
  label: string;
  icon: React.ReactNode;
  results: SearchResult[];
}

export const GlobalSearch: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const { loadSession, setMessages } = useAppStore();

  // Open on Cmd+K or Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim()) {
        performSearch(query);
      } else {
        setResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  const performSearch = async (searchQuery: string) => {
    setIsLoading(true);
    try {
      const [sessionsRes, memoriesRes] = await Promise.all([
        api.get(`/sessions?search=${encodeURIComponent(searchQuery)}&limit=10`),
        api.post('/memory/search', {
          query: searchQuery,
          limit: 10
        }).catch(() => ({ data: { results: [] } }))
      ]);

      const formattedResults: SearchResult[] = [];

      // Format session results
      if (sessionsRes.data.sessions) {
        for (const session of sessionsRes.data.sessions) {
          // Find matching message if search matched within messages
          const matchingMessage = session.messages?.find((m: any) => 
            m.content.toLowerCase().includes(searchQuery.toLowerCase())
          );

          formattedResults.push({
            type: 'session',
            id: session.id,
            title: session.title,
            excerpt: matchingMessage 
              ? matchingMessage.content.slice(0, 150) + '...'
              : session.messages?.[0]?.content.slice(0, 150) + '...',
            metadata: {
              mode: session.mode,
              date: new Date(session.updatedAt).toLocaleDateString(),
              messageCount: session.metadata?.messageCount || session.messages?.length
            }
          });
        }
      }

      // Format memory results
      if (memoriesRes.data.results) {
        for (const memory of memoriesRes.data.results) {
          formattedResults.push({
            type: 'memory',
            id: memory.id,
            title: memory.metadata?.type || 'Memory',
            excerpt: memory.text?.slice(0, 150) || '',
            score: memory.score,
            metadata: {
              memoryType: memory.metadata?.type
            }
          });
        }
      }

      setResults(formattedResults);
    } catch (error) {
      console.error('[GlobalSearch] Search failed:', error);
      setError(error instanceof Error ? error.message : 'Search failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelect = useCallback((result: SearchResult) => {
    if (result.type === 'session') {
      loadSession(result.id).then(() => setIsOpen(false));
    }
    // Handle other types as needed
  }, [loadSession]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      handleSelect(results[selectedIndex]);
    }
  }, [results, selectedIndex, handleSelect]);

  const groupResults = (): SearchGroup[] => {
    const groups: SearchGroup[] = [];

    const sessions = results.filter(r => r.type === 'session');
    if (sessions.length > 0) {
      groups.push({
        type: 'session',
        label: 'Sessions',
        icon: <MessageSquare size={12} />,
        results: sessions
      });
    }

    const memories = results.filter(r => r.type === 'memory');
    if (memories.length > 0) {
      groups.push({
        type: 'memory',
        label: 'Memories',
        icon: <Brain size={12} />,
        results: memories
      });
    }

    return groups;
  };

  const groupedResults = groupResults();

  return (
    <>
      {/* Trigger hint */}
      <div className="fixed bottom-4 left-4 z-30 flex items-center gap-2 px-3 py-1.5 bg-black/80 backdrop-blur border border-white/10 rounded-lg">
        <Command size={12} className="text-slate-500" />
        <span className="text-[9px] font-mono text-slate-500">K</span>
        <span className="text-[8px] text-slate-600">to search</span>
      </div>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm"
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              className="fixed z-[301] top-[15%] left-1/2 -translate-x-1/2 w-full max-w-2xl"
            >
              <div className="bg-[#0a0a0f] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                {/* Search Input */}
                <div className="flex items-center gap-3 p-4 border-b border-white/5">
                  <Search size={18} className="text-slate-500" />
                  <input
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Search sessions, memories, and messages..."
                    autoFocus
                    className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-slate-600"
                  />
                  {query && (
                    <button
                      onClick={() => { setQuery(''); setResults([]); }}
                      className="p-1 text-slate-500 hover:text-white transition-colors"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Results */}
                <div className="max-h-[60vh] overflow-y-auto">
                  {error ? (
                    <div className="p-8 text-center">
                      <AlertTriangle size={24} className="text-rose-500 mx-auto mb-2" />
                      <p className="text-[10px] text-rose-400 uppercase tracking-widest">Search Error</p>
                      <p className="text-[8px] text-slate-500 mt-1">{error}</p>
                      <button
                        onClick={() => { setError(null); setQuery(''); }}
                        className="mt-3 px-3 py-1.5 bg-rose-500/20 border border-rose-500/30 rounded-lg text-[9px] text-rose-300 hover:bg-rose-500/30 transition-all"
                      >
                        Try Again
                      </button>
                    </div>
                  ) : isLoading ? (
                    <div className="p-8 text-center">
                      <div className="inline-block w-5 h-5 border-2 border-jb-accent border-t-transparent rounded-full animate-spin" />
                      <p className="text-[10px] text-slate-500 mt-2 uppercase tracking-widest">Searching...</p>
                    </div>
                  ) : groupedResults.length > 0 ? (
                    <div className="p-2">
                      {groupedResults.map((group, groupIndex) => (
                        <div key={group.type} className="mb-3 last:mb-0">
                          <div className="flex items-center gap-2 px-2 py-1.5 text-[8px] font-black uppercase tracking-widest text-slate-500">
                            {group.icon}
                            {group.label}
                            <span className="text-[7px] bg-white/5 px-1 rounded">{group.results.length}</span>
                          </div>
                          {group.results.map((result, resultIndex) => {
                            const globalIndex = groupedResults
                              .slice(0, groupIndex)
                              .reduce((acc, g) => acc + g.results.length, 0) + resultIndex;
                            const isSelected = globalIndex === selectedIndex;

                            return (
                              <button
                                key={result.id}
                                onClick={() => handleSelect(result)}
                                className={`w-full flex items-start gap-3 p-3 rounded-xl transition-all ${
                                  isSelected 
                                    ? 'bg-jb-accent/10 border border-jb-accent/20' 
                                    : 'bg-white/[0.02] border border-transparent hover:border-white/5'
                                }`}
                              >
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                  result.type === 'session' ? 'bg-blue-500/20 text-blue-400' :
                                  result.type === 'memory' ? 'bg-purple-500/20 text-purple-400' :
                                  'bg-white/5 text-slate-400'
                                }`}>
                                  {result.type === 'session' ? <MessageSquare size={14} /> :
                                   result.type === 'memory' ? <Brain size={14} /> :
                                   <FileText size={14} />}
                                </div>
                                <div className="flex-1 min-w-0 text-left">
                                  <div className="flex items-center gap-2 mb-0.5">
                                    <p className="text-[10px] font-bold text-white truncate">{result.title}</p>
                                    {result.metadata?.mode && (
                                      <span className="text-[6px] font-mono text-slate-500 bg-white/5 px-1 rounded">
                                        {result.metadata.mode}
                                      </span>
                                    )}
                                    {result.score && (
                                      <span className="text-[6px] font-mono text-slate-500">
                                        {(result.score * 100).toFixed(0)}% match
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[9px] text-slate-400 line-clamp-2">{result.excerpt}</p>
                                  {result.metadata?.date && (
                                    <p className="text-[7px] text-slate-600 mt-1 flex items-center gap-1">
                                      <Clock size={6} />
                                      {result.metadata.date}
                                    </p>
                                  )}
                                </div>
                                <ChevronRight size={12} className="text-slate-600 shrink-0 mt-0.5" />
                              </button>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  ) : query ? (
                    <div className="p-8 text-center">
                      <Search size={24} className="text-slate-700 mx-auto mb-2" />
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest">No results found</p>
                    </div>
                  ) : (
                    <div className="p-8 text-center">
                      <History size={24} className="text-slate-700 mx-auto mb-2" />
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest">Start typing to search</p>
                      <div className="flex items-center justify-center gap-4 mt-4 text-[8px] text-slate-600">
                        <span className="flex items-center gap-1">
                          <MessageSquare size={10} /> Sessions
                        </span>
                        <span className="flex items-center gap-1">
                          <Brain size={10} /> Memories
                        </span>
                        <span className="flex items-center gap-1">
                          <Folder size={10} /> Files
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer */}
                {results.length > 0 && (
                  <div className="flex items-center justify-between px-4 py-2 border-t border-white/5 bg-white/[0.02]">
                    <div className="flex items-center gap-3 text-[7px] text-slate-500">
                      <span className="flex items-center gap-1">
                        <span className="px-1 bg-white/5 rounded">↑↓</span> to navigate
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="px-1 bg-white/5 rounded">Enter</span> to open
                      </span>
                    </div>
                    <span className="text-[7px] text-slate-600">{results.length} results</span>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
