import React, { useState, useEffect, useCallback } from 'react';
import {
  startOptimization, cancelOptimization, getOptimizationRun, listOptimizationRuns
} from '../lib/api-client';
import { cn } from '../lib/utils';
import { Play, Square, ChevronRight, TrendingUp, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';

interface ParetoPoint {
  proposalId: string;
  acceptanceRate: number;
  avgTokens: number;
  iteration: number;
  deltas: Record<string, number>;
  rationale: string;
}

interface LocalProposal {
  id: string;
  iteration?: number;
  deltas?: Record<string, number>;
  rationale?: string;
}

interface LocalEvaluation {
  proposalId: string;
  isParetoOptimal: boolean;
  acceptanceRate: number;
  avgPromptTokens: number;
}

interface LocalOptimizationRun {
  id: string;
  status: string;
  iterations: number;
  config?: { maxIterations?: number };
  proposals?: LocalProposal[];
  evaluations?: LocalEvaluation[];
  paretoFrontier?: unknown[];
  ts?: string | number;
  [key: string]: unknown;
}

export const HarnessOptimizerPanel: React.FC = () => {
  const [runs, setRuns] = useState<LocalOptimizationRun[]>([]);
  const [activeRun, setActiveRun] = useState<LocalOptimizationRun | null>(null);
  const [loading, setLoading] = useState(false);
  const [maxIterations, setMaxIterations] = useState(10);

  const refreshRuns = useCallback(async () => {
    const results = await listOptimizationRuns() as unknown as LocalOptimizationRun[];
    setRuns(results);
    const running = results.find((r: LocalOptimizationRun) => r.status === 'running');
    if (running) setActiveRun(running);
    else if (!activeRun || activeRun.status !== 'running') setActiveRun(null);
  }, []);

  useEffect(() => { refreshRuns(); }, [refreshRuns]);

  // Poll active run every 2 seconds
  useEffect(() => {
    if (!activeRun || activeRun.status !== 'running') return;
    const interval = setInterval(async () => {
      const updated = await getOptimizationRun(activeRun.id) as unknown as LocalOptimizationRun | null;
      if (updated) {
        setActiveRun(updated);
        setRuns(prev => prev.map(r => r.id === updated.id ? updated : r));
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [activeRun?.id, activeRun?.status]);

  const handleStart = async () => {
    setLoading(true);
    const run = await startOptimization({ maxIterations }) as unknown as LocalOptimizationRun | null;
    if (run) {
      setActiveRun(run);
      setRuns(prev => [run, ...prev]);
    }
    setLoading(false);
  };

  const handleCancel = async () => {
    if (!activeRun) return;
    await cancelOptimization(activeRun.id);
    setActiveRun((prev) => prev ? { ...prev, status: 'cancelled' } : null);
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'running': return <Loader2 size={12} className="animate-spin text-blue-400" />;
      case 'completed': return <CheckCircle2 size={12} className="text-emerald-400" />;
      case 'cancelled': return <Square size={12} className="text-slate-300" />;
      case 'failed': return <AlertTriangle size={12} className="text-rose-400" />;
      default: return null;
    }
  };

  // Compute Pareto frontier points
  const paretoPoints: ParetoPoint[] = activeRun?.evaluations
    ?.filter((e: LocalEvaluation) => e.isParetoOptimal)
    ?.map((e: LocalEvaluation) => {
      const proposal = activeRun.proposals?.find((p: LocalProposal) => p.id === e.proposalId);
      return {
        proposalId: e.proposalId,
        acceptanceRate: e.acceptanceRate,
        avgTokens: e.avgPromptTokens,
        iteration: proposal?.iteration || 0,
        deltas: proposal?.deltas || {},
        rationale: proposal?.rationale || '',
      };
    }) || [];

  return (
    <div className="flex flex-col h-full">
      {/* Controls */}
      <div className="flex items-center gap-2 p-3 border-b border-white/5">
        <input
          type="number"
          value={maxIterations}
          onChange={e => setMaxIterations(Math.max(1, Math.min(50, parseInt(e.target.value) || 10)))}
          className="w-16 bg-white/5 border border-white/10 rounded px-2 py-1 text-[12px] text-slate-300 outline-none"
          min={1}
          max={50}
        />
        <span className="text-[11px] text-slate-300">iterations</span>
        <button
          onClick={handleStart}
          disabled={loading || activeRun?.status === 'running'}
          className="flex items-center gap-1 px-3 py-1 bg-emerald-500/20 border border-emerald-500/30 rounded text-[11px] text-emerald-400 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Play size={10} /> Start
        </button>
        {activeRun?.status === 'running' && (
          <button
            onClick={handleCancel}
            className="flex items-center gap-1 px-3 py-1 bg-rose-500/20 border border-rose-500/30 rounded text-[11px] text-rose-400"
          >
            <Square size={10} /> Stop
          </button>
        )}
      </div>

      {/* Active Run Status */}
      {activeRun && (
        <div className="px-3 py-2 border-b border-white/5 bg-white/[0.02]">
          <div className="flex items-center gap-2 text-[11px]">
            {statusIcon(activeRun.status)}
            <span className={cn(
              "font-bold uppercase",
              activeRun.status === 'running' ? 'text-blue-400' :
              activeRun.status === 'completed' ? 'text-emerald-400' :
              activeRun.status === 'failed' ? 'text-rose-400' : 'text-slate-300'
            )}>
              {activeRun.status}
            </span>
            <span className="text-slate-400">·</span>
            <span className="text-slate-300">
              Iteration {activeRun.iterations}/{activeRun.config?.maxIterations}
            </span>
            <span className="text-slate-400">·</span>
            <span className="text-slate-300">
              {activeRun.proposals?.length || 0} proposals
            </span>
            <span className="text-slate-400">·</span>
            <span className="text-slate-300">
              {activeRun.paretoFrontier?.length || 0} Pareto-optimal
            </span>
          </div>
        </div>
      )}

      {/* Pareto Frontier */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {paretoPoints.length > 0 && (
          <div className="p-3">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
              <TrendingUp size={10} /> Pareto Frontier
            </div>
            {paretoPoints.map((point, i) => (
              <details key={point.proposalId} className="mb-1.5 group" open={i === 0}>
                <summary className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.03] border border-white/5 cursor-pointer hover:bg-white/[0.05]">
                  <ChevronRight size={10} className="text-slate-400 group-open:rotate-90 transition-transform" />
                  <div className="flex-1">
                    <div className="flex items-center gap-3 text-[11px]">
                      <span className="text-emerald-400 font-mono">
                        {(point.acceptanceRate * 100).toFixed(1)}% accept
                      </span>
                      <span className="text-slate-400">·</span>
                      <span className="text-slate-400 font-mono">
                        {point.avgTokens.toFixed(0)} tok
                      </span>
                      <span className="text-slate-400">·</span>
                      <span className="text-slate-300">
                        iter {point.iteration}
                      </span>
                    </div>
                  </div>
                </summary>
                <div className="ml-4 mt-1 p-2 bg-black/30 rounded text-[10px] space-y-1">
                  <div className="text-slate-400">{point.rationale}</div>
                  {Object.entries(point.deltas).map(([key, val]) => (
                    <div key={key} className="flex justify-between text-slate-300">
                      <span>{key}</span>
                      <span className="font-mono text-slate-300">{(val as number).toFixed(3)}</span>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        )}

        {/* Past Runs */}
        {runs.length > 0 && (
          <div className="p-3 border-t border-white/5">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
              Past Runs
            </div>
            {runs.filter((r: LocalOptimizationRun) => r.id !== activeRun?.id).slice(0, 10).map((run: LocalOptimizationRun) => (
              <button
                key={run.id}
                onClick={() => setActiveRun(run)}
                className="w-full flex items-center gap-2 p-1.5 rounded text-[10px] text-slate-300 hover:text-slate-300 hover:bg-white/5 transition-colors text-left"
              >
                {statusIcon(run.status)}
                <span>{run.ts ? new Date(run.ts).toLocaleDateString() : 'Unknown'}</span>
                <span className="text-slate-400">·</span>
                <span>{run.iterations} iter</span>
                <span className="text-slate-400">·</span>
                <span>{run.paretoFrontier?.length || 0} Pareto</span>
              </button>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!activeRun && runs.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <Play size={24} className="text-slate-400 mb-3" />
            <p className="text-[11px] text-slate-400 font-bold">No optimization runs yet</p>
            <p className="text-[10px] text-slate-400 mt-1">Start a run to discover better retrieval configurations</p>
          </div>
        )}
      </div>
    </div>
  );
};
