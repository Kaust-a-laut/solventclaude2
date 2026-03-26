import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Trash2, Pencil, Check, Tag, Filter, Star, Hash,
  ChevronDown, ChevronUp, X, Loader2, RefreshCw, Database,
  CheckCircle2, AlertCircle,
} from 'lucide-react';
import { API_BASE_URL } from '../../lib/config';
import { cn } from '../../lib/utils';
import { fetchWithRetry } from '../../lib/api-client';
import { staggerContainer, staggerItem } from './shared';

export const MemoryTab = () => {
  const [memoryStatus, setMemoryStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [memoryStats, setMemoryStats] = useState<{ total: number; byTier: Record<string, number>; byType: Record<string, number> } | null>(null);
  const [memoryEntries, setMemoryEntries] = useState<any[]>([]);
  const [memorySearch, setMemorySearch] = useState('');
  const [memoryLoading, setMemoryLoading] = useState(false);
  const [memoryTierFilter, setMemoryTierFilter] = useState<string | null>(null);
  const [memoryTypeFilter, setMemoryTypeFilter] = useState<string | null>(null);
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [showTypeBreakdown, setShowTypeBreakdown] = useState(false);

  const fetchMemoryData = useCallback(async () => {
    setMemoryLoading(true);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (memoryTierFilter) params.set('tier', memoryTierFilter);
      if (memoryTypeFilter) params.set('type', memoryTypeFilter);
      const [statsData, entriesData] = await Promise.all([
        fetchWithRetry(`${API_BASE_URL}/memory/stats`) as Promise<any>,
        fetchWithRetry(`${API_BASE_URL}/memory/entries?${params}`) as Promise<any>,
      ]);
      setMemoryStats(statsData);
      setMemoryEntries((entriesData as any).entries || []);
    } catch {
      // silently fail — backend may not be running
    } finally {
      setMemoryLoading(false);
    }
  }, [memoryTierFilter, memoryTypeFilter]);

  useEffect(() => { fetchMemoryData(); }, [fetchMemoryData]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!memorySearch.trim()) {
        fetchMemoryData();
        return;
      }
      setMemoryLoading(true);
      try {
        const result = await fetchWithRetry(`${API_BASE_URL}/memory/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: memorySearch, limit: 20 }),
        }) as any;
        setMemoryEntries(result.entries || []);
      } catch {
        // silently fail
      } finally {
        setMemoryLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [memorySearch, fetchMemoryData]);

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-4">

      {/* Stats Bar */}
      <motion.div variants={staggerItem} className="grid grid-cols-4 gap-2" id="settings-memory-index">
        {[
          { label: 'Total', value: memoryStats?.total ?? '—', color: 'text-white', tier: null },
          { label: 'Crystallized', value: memoryStats?.byTier?.crystallized ?? 0, color: 'text-jb-purple', tier: 'crystallized' },
          { label: 'Episodic', value: memoryStats?.byTier?.episodic ?? 0, color: 'text-jb-accent', tier: 'episodic' },
          { label: 'Summaries', value: memoryStats?.byTier?.['meta-summary'] ?? 0, color: 'text-slate-400', tier: 'meta-summary' },
        ].map(stat => {
          const isActive = memoryTierFilter === stat.tier || (stat.tier === null && memoryTierFilter === null);
          return (
            <button
              key={stat.label}
              onClick={() => setMemoryTierFilter(stat.tier === memoryTierFilter ? null : stat.tier)}
              className={cn(
                'bg-white/[0.03] border rounded-2xl p-3 flex flex-col gap-1 text-left transition-all cursor-pointer',
                isActive && stat.tier !== null
                  ? 'border-white/20 ring-1 ring-white/10'
                  : 'border-white/[0.06] hover:border-white/10'
              )}
            >
              <span className={cn('text-lg font-black', stat.color)}>{memoryLoading ? '—' : stat.value}</span>
              <span className="text-[9px] font-bold text-slate-600 uppercase tracking-wider">{stat.label}</span>
            </button>
          );
        })}
      </motion.div>

      {/* Type Distribution */}
      {memoryStats && Object.keys(memoryStats.byType).length > 0 && (
        <motion.div variants={staggerItem} className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
          <button
            onClick={() => setShowTypeBreakdown(v => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-[9px] font-black text-slate-500 uppercase tracking-widest hover:text-slate-400 transition-colors"
          >
            <span className="flex items-center gap-1.5"><Hash size={10} /> Type Distribution</span>
            {showTypeBreakdown ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          <AnimatePresence>
            {showTypeBreakdown && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="flex flex-wrap gap-1.5 px-4 pb-3">
                  {Object.entries(memoryStats.byType)
                    .sort(([, a], [, b]) => b - a)
                    .map(([type, count]) => (
                      <button
                        key={type}
                        onClick={() => setMemoryTypeFilter(memoryTypeFilter === type ? null : type)}
                        className={cn(
                          'px-2.5 py-1 rounded-full text-[9px] font-bold border transition-all',
                          memoryTypeFilter === type
                            ? 'bg-jb-accent/20 text-jb-accent border-jb-accent/40'
                            : 'bg-white/[0.03] text-slate-500 border-white/[0.08] hover:border-white/20 hover:text-slate-400'
                        )}
                      >
                        {type.replace(/_/g, ' ')} <span className="text-slate-700 ml-0.5">{count}</span>
                      </button>
                    ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Search */}
      <motion.div variants={staggerItem} className="relative">
        <Search size={13} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" />
        <input
          value={memorySearch}
          onChange={e => setMemorySearch(e.target.value)}
          placeholder="Search memories..."
          className="w-full bg-white/[0.03] border border-white/[0.08] rounded-2xl pl-10 pr-4 py-3 text-[11px] font-bold text-slate-300 placeholder:text-slate-700 focus:outline-none focus:border-jb-purple/40 transition-colors"
        />
      </motion.div>

      {/* Active Filters */}
      {(memoryTierFilter || memoryTypeFilter) && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <Filter size={10} className="text-slate-600" />
          {memoryTierFilter && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/[0.05] border border-white/[0.1] text-[9px] font-bold text-slate-400">
              tier: {memoryTierFilter}
              <button onClick={() => setMemoryTierFilter(null)} className="hover:text-white transition-colors"><X size={8} /></button>
            </span>
          )}
          {memoryTypeFilter && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/[0.05] border border-white/[0.1] text-[9px] font-bold text-slate-400">
              type: {memoryTypeFilter.replace(/_/g, ' ')}
              <button onClick={() => setMemoryTypeFilter(null)} className="hover:text-white transition-colors"><X size={8} /></button>
            </span>
          )}
        </div>
      )}

      {/* Entry List */}
      <motion.div variants={staggerItem} className="bg-white/[0.01] border border-white/[0.06] rounded-[28px] overflow-hidden">
        <div className="max-h-[380px] overflow-y-auto divide-y divide-white/[0.04]">
          {memoryLoading && memoryEntries.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-10 text-slate-600 text-[11px]">
              <Loader2 size={14} className="animate-spin" /> Loading memories...
            </div>
          ) : memoryEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-slate-700">
              <Database size={28} className="opacity-30" />
              <p className="text-[11px] font-bold">
                {memorySearch ? 'No results found' : 'No memories yet — resync to build index'}
              </p>
            </div>
          ) : memoryEntries.map(entry => {
            const tierColors: Record<string, string> = {
              crystallized: 'bg-jb-purple/20 text-jb-purple border-jb-purple/30',
              episodic: 'bg-jb-accent/20 text-jb-accent border-jb-accent/30',
              'meta-summary': 'bg-white/10 text-slate-400 border-white/20',
              archived: 'bg-white/5 text-slate-600 border-white/10',
            };
            const tierClass = tierColors[entry.tier] || 'bg-white/5 text-slate-500 border-white/10';
            const confidence = typeof entry.confidence === 'string'
              ? entry.confidence
              : entry.confidence != null
                ? entry.confidence >= 0.8 ? 'HIGH' : entry.confidence >= 0.5 ? 'MED' : 'LOW'
                : null;
            const relTime = entry.timestamp
              ? (() => {
                  const diff = Date.now() - new Date(entry.timestamp).getTime();
                  if (diff < 3600000) return `${Math.round(diff / 60000)}m ago`;
                  if (diff < 86400000) return `${Math.round(diff / 3600000)}h ago`;
                  return `${Math.round(diff / 86400000)}d ago`;
                })()
              : null;
            const isExpanded = expandedEntryId === entry.id;
            const isEditing = editingEntryId === entry.id;
            return (
              <div key={entry.id} className="hover:bg-white/[0.02] transition-colors group">
                <div
                  className="flex items-start gap-3 px-4 py-3 cursor-pointer"
                  onClick={() => {
                    setExpandedEntryId(isExpanded ? null : entry.id);
                    if (isEditing) { setEditingEntryId(null); }
                  }}
                >
                  <div className="mt-0.5 text-slate-700 flex-shrink-0">
                    {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {entry.tier && (
                        <span className={cn('px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider border', tierClass)}>
                          {entry.tier}
                        </span>
                      )}
                      {entry.type && (
                        <span className="px-2 py-0.5 rounded-full text-[8px] font-bold bg-white/[0.05] text-slate-500 border border-white/[0.08]">
                          {entry.type.replace(/_/g, ' ')}
                        </span>
                      )}
                      {confidence && (
                        <span className={cn('px-1.5 py-0.5 rounded text-[8px] font-bold',
                          confidence === 'HIGH' ? 'text-emerald-400' : confidence === 'MED' ? 'text-yellow-500' : 'text-rose-400'
                        )}>
                          {confidence}
                        </span>
                      )}
                      {entry.importance != null && (
                        <span className="flex items-center gap-0.5 text-[8px] font-bold text-amber-400/80">
                          <Star size={8} className="fill-amber-400/80" /> {entry.importance}
                        </span>
                      )}
                      {relTime && <span className="text-[8px] text-slate-700">{relTime}</span>}
                    </div>
                    <p className={cn('text-[10px] text-slate-400 leading-relaxed font-medium', !isExpanded && 'line-clamp-2')}>
                      {entry.content}
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5 flex-shrink-0 mt-0.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedEntryId(entry.id);
                        setEditingEntryId(entry.id);
                        setEditContent(entry.content || '');
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-jb-accent/20 text-slate-700 hover:text-jb-accent transition-all"
                      title="Edit this memory"
                    >
                      <Pencil size={11} />
                    </button>
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        setMemoryEntries(prev => prev.filter(el => el.id !== entry.id));
                        try {
                          await fetchWithRetry(`${API_BASE_URL}/memory/entries/${entry.id}`, { method: 'DELETE' });
                        } catch {
                          setMemoryEntries(prev => [...prev, entry]);
                        }
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-rose-500/20 text-slate-700 hover:text-rose-400 transition-all"
                      title="Delete this memory"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>

                {/* Expanded area */}
                {isExpanded && (
                  <div className="px-4 pb-3 pl-[40px] space-y-2">
                    {entry.tags && entry.tags.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap">
                        <Tag size={9} className="text-slate-700" />
                        {entry.tags.map((tag: string) => (
                          <span key={tag} className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-white/[0.04] text-slate-600 border border-white/[0.06]">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    {isEditing && (
                      <div className="space-y-2">
                        <textarea
                          value={editContent}
                          onChange={e => setEditContent(e.target.value)}
                          rows={4}
                          className="w-full bg-white/[0.03] border border-white/[0.1] rounded-xl p-3 text-[10px] text-slate-300 font-medium focus:outline-none focus:border-jb-purple/40 resize-none"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            disabled={editSaving || !editContent.trim()}
                            onClick={async (e) => {
                              e.stopPropagation();
                              setEditSaving(true);
                              const prevContent = entry.content;
                              setMemoryEntries(prev => prev.map(el => el.id === entry.id ? { ...el, content: editContent.trim() } : el));
                              try {
                                await fetchWithRetry(`${API_BASE_URL}/memory/entries/${entry.id}`, {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ content: editContent.trim() }),
                                });
                                setEditingEntryId(null);
                              } catch {
                                setMemoryEntries(prev => prev.map(el => el.id === entry.id ? { ...el, content: prevContent } : el));
                              } finally {
                                setEditSaving(false);
                              }
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 bg-jb-purple/20 hover:bg-jb-purple/30 border border-jb-purple/30 rounded-lg text-[9px] font-bold text-jb-purple transition-all disabled:opacity-50"
                          >
                            {editSaving ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />} Save
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingEntryId(null);
                            }}
                            className="px-3 py-1.5 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded-lg text-[9px] font-bold text-slate-500 transition-all"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Action Row */}
      <motion.div variants={staggerItem} className="flex items-center gap-3">
        <button
          disabled={memoryStatus === 'loading'}
          onClick={async () => {
            setMemoryStatus('loading');
            try {
              await fetchWithRetry(`${API_BASE_URL}/index`, { method: 'POST' });
              setMemoryStatus('success');
              setTimeout(() => setMemoryStatus('idle'), 5000);
            } catch {
              setMemoryStatus('error');
            }
          }}
          className="flex-1 flex items-center justify-center gap-2 py-3 bg-jb-purple/10 hover:bg-jb-purple/20 border border-jb-purple/20 hover:border-jb-purple/40 rounded-2xl text-[10px] font-black uppercase tracking-widest text-jb-purple transition-all disabled:opacity-50"
        >
          {memoryStatus === 'loading'
            ? <><Loader2 size={12} className="animate-spin" /> Indexing...</>
            : <><RefreshCw size={12} /> Resync Memory</>
          }
        </button>
        <button
          onClick={async () => {
            if (!window.confirm('Clear all memory entries? This cannot be undone.')) return;
            try {
              await fetchWithRetry(`${API_BASE_URL}/memory`, { method: 'DELETE' });
              setMemoryEntries([]);
              setMemoryStats(null);
              await fetchMemoryData();
            } catch {
              console.error('[Settings] Failed to clear memory');
            }
          }}
          className="flex-1 flex items-center justify-center gap-2 py-3 bg-rose-500/5 hover:bg-rose-500/10 border border-rose-500/20 hover:border-rose-500/40 rounded-2xl text-[10px] font-black uppercase tracking-widest text-rose-500 transition-all"
        >
          <Trash2 size={12} /> Clear All
        </button>
      </motion.div>

      {/* Status message */}
      <AnimatePresence>
        {memoryStatus !== 'idle' && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={cn(
              'flex items-center gap-2 px-5 py-3 rounded-2xl text-[11px] font-bold',
              memoryStatus === 'loading' && 'bg-jb-accent/10 border border-jb-accent/20 text-jb-accent',
              memoryStatus === 'success' && 'bg-emerald-400/10 border border-emerald-400/20 text-emerald-400',
              memoryStatus === 'error' && 'bg-rose-400/10 border border-rose-400/20 text-rose-400',
            )}
          >
            {memoryStatus === 'loading' && <><Loader2 size={14} className="animate-spin" /> Indexing workspace files...</>}
            {memoryStatus === 'success' && <><CheckCircle2 size={14} /> Memory index updated — context is now current</>}
            {memoryStatus === 'error' && <><AlertCircle size={14} /> Indexing failed — is the backend running?</>}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
