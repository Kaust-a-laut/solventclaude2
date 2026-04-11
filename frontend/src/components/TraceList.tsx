import React, { useState, useEffect, useCallback } from 'react';
import { getTraces, updateTraceOutcome, TraceFilter } from '../lib/api-client';
import { cn } from '../lib/utils';
import { GitCompare, ChevronDown, ChevronRight } from 'lucide-react';

interface TraceRow {
  id: string;
  ts: string;
  mode: string;
  provider: string;
  model: string;
  query: string;
  active: any[];
  suppressed: any[];
  promptTokens: {
    memory: number; rules: number; workspace: number;
    conversationHistory: number; systemPrompt: number; total: number; budget: number;
  };
  counts: { workspace: number; local: number; global: number; rules: number };
  harnessSnapshot: Record<string, number>;
  pipelineMs: number;
  outcome: string | null;
}

const REASON_COLORS: Record<string, string> = {
  below_min_score: 'text-rose-400 bg-rose-500/10',
  duplicate: 'text-amber-400 bg-amber-500/10',
  stale_code: 'text-orange-400 bg-orange-500/10',
  token_budget: 'text-purple-400 bg-purple-500/10',
  conflict: 'text-red-400 bg-red-500/10',
};

const OUTCOME_STYLES: Record<string, string> = {
  accepted:     'bg-emerald-500/20 text-emerald-400',
  crystallized: 'bg-blue-500/20 text-blue-400',
  rerequested:  'bg-amber-500/20 text-amber-400',
  correction:   'bg-red-500/20 text-red-400',
};
const OUTCOME_LABELS: Record<string, string> = {
  accepted: '✓ accepted', crystallized: '✓ crystallized',
  rerequested: '↩ rerequested', correction: '✗ correction',
};

function OutcomeBadge({ outcome }: { outcome: string | null }) {
  if (!outcome) return <span className="text-slate-400 text-[10px] font-mono">—</span>;
  return (
    <span className={`text-[10px] font-mono px-1 py-0.5 rounded ${OUTCOME_STYLES[outcome] ?? 'bg-slate-500/20 text-slate-400'}`}>
      {OUTCOME_LABELS[outcome] ?? outcome}
    </span>
  );
}

function BudgetBar({ pt }: { pt: TraceRow['promptTokens'] }) {
  if (!pt || pt.budget === 0) return null;
  const pct = Math.min((pt.total / pt.budget) * 100, 100);
  return (
    <div className="mt-3">
      <div className="flex justify-between text-[10px] text-slate-300 mb-1">
        <span>Context Budget</span>
        <span className={cn("font-mono", pct >= 95 ? 'text-rose-400' : pct >= 85 ? 'text-amber-400' : 'text-slate-400')}>
          {pt.total.toLocaleString()} / {pt.budget.toLocaleString()} tok
        </span>
      </div>
      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden flex">
        <div className="h-full bg-blue-500/60" style={{ width: `${(pt.memory / pt.budget) * 100}%` }} />
        <div className="h-full bg-purple-500/60" style={{ width: `${(pt.rules / pt.budget) * 100}%` }} />
        <div className="h-full bg-emerald-500/60" style={{ width: `${(pt.workspace / pt.budget) * 100}%` }} />
        <div className="h-full bg-amber-500/60" style={{ width: `${(pt.conversationHistory / pt.budget) * 100}%` }} />
        <div className="h-full bg-slate-500/60" style={{ width: `${(pt.systemPrompt / pt.budget) * 100}%` }} />
      </div>
    </div>
  );
}

export const TraceList: React.FC = () => {
  const [traces, setTraces] = useState<TraceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<TraceFilter>({ limit: 50 });
  const [queryInput, setQueryInput] = useState('');
  const [modeInput, setModeInput] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set());
  const [comparing, setComparing] = useState(false);

  const fetchTraces = useCallback(async (f: TraceFilter) => {
    setLoading(true);
    try {
      const results = await getTraces(f);
      setTraces(results);
    } catch {
      setTraces([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTraces(filter);
  }, [filter, fetchTraces]);

  // Debounced filter updates
  useEffect(() => {
    const t = setTimeout(() => {
      setFilter(f => ({ ...f, query: queryInput || undefined, mode: modeInput || undefined }));
    }, 300);
    return () => clearTimeout(t);
  }, [queryInput, modeInput]);

  const toggleCompare = (id: string) => {
    setCompareIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); }
      else if (next.size < 2) { next.add(id); }
      return next;
    });
  };

  const comparePair = comparing && compareIds.size === 2
    ? traces.filter(t => compareIds.has(t.id))
    : null;

  const formatTime = (ts: string) => {
    try { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
    catch { return ts; }
  };

  const budgetPct = (pt: TraceRow['promptTokens']) =>
    pt?.budget > 0 ? (pt.total / pt.budget) * 100 : 0;

  return (
    <div className="flex flex-col h-full">
      {/* Filter bar */}
      <div className="flex gap-2 p-2 border-b border-white/5">
        <input
          value={queryInput}
          onChange={e => setQueryInput(e.target.value)}
          placeholder="Filter by query..."
          className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-[12px] text-slate-300 placeholder-slate-600 outline-none focus:border-white/20"
        />
        <select
          value={modeInput}
          onChange={e => setModeInput(e.target.value)}
          className="bg-white/5 border border-white/10 rounded px-2 py-1 text-[12px] text-slate-300 outline-none"
        >
          <option value="">All modes</option>
          {['chat', 'coding', 'waterfall', 'debate', 'browser', 'compare'].map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        {compareIds.size === 2 && (
          <button
            onClick={() => setComparing(c => !c)}
            className="flex items-center gap-1 px-2 py-1 bg-blue-500/20 border border-blue-500/30 rounded text-[11px] text-blue-400"
          >
            <GitCompare size={10} />
            Compare
          </button>
        )}
      </div>

      {/* Compare view */}
      {comparePair && (
        <div className="border-b border-white/10 p-3 bg-white/3">
          <div className="text-[11px] font-black text-slate-400 uppercase mb-2">Comparing 2 Traces</div>
          <div className="grid grid-cols-2 gap-3 text-[10px]">
            {comparePair.map(t => (
              <div key={t.id}>
                <div className="text-slate-300 mb-1">{formatTime(t.ts)} · {t.mode} · {t.query.slice(0, 50)}</div>
                <div className="text-emerald-400 font-black mb-0.5">ACTIVE ({t.active.length})</div>
                {t.active.map((a: any) => (
                  <div key={a.id} className="text-slate-400 truncate">· {a.text?.slice(0, 60)}</div>
                ))}
                <div className="text-rose-400 font-black mt-1 mb-0.5">SUPPRESSED ({t.suppressed.length})</div>
                {t.suppressed.slice(0, 3).map((s: any) => (
                  <div key={s.id} className="text-slate-300 truncate">· {s.text?.slice(0, 60)}</div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trace list */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {loading && (
          <div className="text-center text-slate-400 text-[12px] p-4">Loading traces...</div>
        )}
        {!loading && traces.length === 0 && (
          <div className="text-center text-slate-400 text-[12px] p-8">
            No traces yet. Send a message in chat to generate the first trace.
          </div>
        )}
        {traces.map(trace => {
          const pct = budgetPct(trace.promptTokens);
          const isExpanded = expandedId === trace.id;
          const isSelected = compareIds.has(trace.id);
          return (
            <div
              key={trace.id}
              className={cn(
                "border-b border-white/5 hover:bg-white/3 transition-colors",
                isSelected && "bg-blue-500/5 border-l-2 border-l-blue-500"
              )}
            >
              {/* Collapsed row */}
              <div
                className="flex items-center gap-2 p-2 cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : trace.id)}
              >
                {/* Budget color indicator */}
                <div className={cn(
                  "w-1 h-8 rounded-full flex-shrink-0",
                  pct >= 95 ? 'bg-rose-500' : pct >= 85 ? 'bg-amber-500' : 'bg-emerald-500/50'
                )} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <span className="text-slate-300 font-mono">{formatTime(trace.ts)}</span>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-400">{trace.mode}</span>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-300 text-[10px]">{trace.provider}</span>
                  </div>
                  <div className="text-[12px] text-slate-300 truncate">{trace.query}</div>
                  <div className="flex gap-3 text-[10px] text-slate-400 mt-0.5">
                    <span>{trace.active.length} active</span>
                    <span>{trace.suppressed.length} suppressed</span>
                    {trace.promptTokens && (
                      <span className="font-mono">{trace.promptTokens.total.toLocaleString()}/{trace.promptTokens.budget.toLocaleString()} tok</span>
                    )}
                    <span>{trace.pipelineMs}ms</span>
                    <OutcomeBadge outcome={trace.outcome} />
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleCompare(trace.id)}
                    onClick={e => e.stopPropagation()}
                    className="w-3 h-3 accent-blue-500"
                    title="Select for compare"
                  />
                  {isExpanded ? <ChevronDown size={12} className="text-slate-300" /> : <ChevronRight size={12} className="text-slate-300" />}
                </div>
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="px-4 pb-3 space-y-3 border-t border-white/5 bg-white/2">
                  {/* Active items */}
                  <div>
                    <div className="text-[10px] font-black text-emerald-400 uppercase mt-2 mb-1">
                      Active ({trace.active.length})
                    </div>
                    {trace.active.map((a: any) => (
                      <div key={a.id} className="text-[10px] text-slate-400 border-l border-emerald-500/30 pl-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-emerald-400">{a.score?.toFixed(2)}</span>
                          <span className="text-slate-400 uppercase text-[9px]">{a.type}</span>
                          <span className="text-slate-400 text-[9px]">{a.source}</span>
                        </div>
                        <div className="text-slate-300 truncate">{a.text}</div>
                      </div>
                    ))}
                  </div>

                  {/* Suppressed items */}
                  {trace.suppressed.length > 0 && (
                    <div>
                      <div className="text-[10px] font-black text-rose-400 uppercase mb-1">
                        Suppressed ({trace.suppressed.length})
                      </div>
                      {trace.suppressed.map((s: any) => (
                        <div key={s.id} className="text-[10px] text-slate-300 border-l border-rose-500/20 pl-2 mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-slate-400">{s.score?.toFixed(2)}</span>
                            <span className={cn("text-[9px] px-1 rounded", REASON_COLORS[s.reason] || 'text-slate-300 bg-white/5')}>
                              {s.reason}
                            </span>
                          </div>
                          <div className="truncate line-through decoration-rose-500/30">{s.text}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Budget bar */}
                  {trace.promptTokens && <BudgetBar pt={trace.promptTokens} />}

                  {/* Harness snapshot — collapsed by default */}
                  <details className="mt-2">
                    <summary className="text-[10px] font-black text-slate-400 uppercase cursor-pointer hover:text-slate-400">
                      Harness Snapshot
                    </summary>
                    <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5">
                      {Object.entries(trace.harnessSnapshot || {}).map(([k, v]) => (
                        <div key={k} className="flex justify-between text-[9px]">
                          <span className="text-slate-400 truncate">{k}</span>
                          <span className="font-mono text-slate-400">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  </details>

                  {/* Outcome badge + manual override */}
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] text-slate-300">Outcome:</span>
                    <OutcomeBadge outcome={trace.outcome} />
                    <select
                      className="text-[10px] bg-slate-800 border border-slate-700 rounded px-1 py-0.5 text-slate-300"
                      value={trace.outcome ?? ''}
                      onChange={async (e) => {
                        const val = e.target.value as 'correction' | 'crystallized' | 'rerequested' | 'accepted';
                        if (!val) return;
                        await updateTraceOutcome(trace.id, val);
                        setTraces(prev => prev.map(t => t.id === trace.id ? { ...t, outcome: val } : t));
                      }}
                    >
                      <option value="">— set outcome —</option>
                      <option value="accepted">accepted</option>
                      <option value="correction">correction</option>
                      <option value="crystallized">crystallized</option>
                      <option value="rerequested">rerequested</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
