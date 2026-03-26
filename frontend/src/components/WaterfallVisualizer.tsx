import React, { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Compass, Brain, Code, Eye, ChevronRight, ChevronDown,
  CheckCircle2, Loader2, AlertCircle, Circle, Pause,
  ExternalLink, FlaskConical, Sparkles, Zap, Clock,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { WATERFALL_PRESET_LIST, type WaterfallPresetMeta } from '../lib/waterfallPresets';

// ─── Stage configs matching WaterfallStageCard palette ─────────────────────

const STAGES = [
  {
    id: 'architect' as const,
    label: 'Architect',
    icon: Compass,
    textColor: 'text-jb-purple',
    bgColor: 'bg-jb-purple/10',
    borderColor: 'border-jb-purple/20',
    dotColor: 'bg-jb-purple',
    glowColor: 'rgba(157,91,210,0.5)',
  },
  {
    id: 'reasoner' as const,
    label: 'Reasoner',
    icon: Brain,
    textColor: 'text-jb-accent',
    bgColor: 'bg-jb-accent/10',
    borderColor: 'border-jb-accent/20',
    dotColor: 'bg-jb-accent',
    glowColor: 'rgba(60,113,247,0.5)',
  },
  {
    id: 'executor' as const,
    label: 'Executor',
    icon: Code,
    textColor: 'text-jb-orange',
    bgColor: 'bg-jb-orange/10',
    borderColor: 'border-jb-orange/20',
    dotColor: 'bg-jb-orange',
    glowColor: 'rgba(251,146,60,0.5)',
  },
  {
    id: 'reviewer' as const,
    label: 'Reviewer',
    icon: Eye,
    textColor: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/20',
    dotColor: 'bg-emerald-500',
    glowColor: 'rgba(16,185,129,0.5)',
  },
] as const;

type StageId = (typeof STAGES)[number]['id'];

// ─── Status helpers ────────────────────────────────────────────────────────

const StatusIcon = ({ status }: { status: string }) => {
  switch (status) {
    case 'completed': return <CheckCircle2 size={12} className="text-emerald-400" />;
    case 'processing': return <Loader2 size={12} className="text-jb-accent animate-spin" />;
    case 'paused': return <Pause size={12} className="text-amber-400" />;
    case 'error': return <AlertCircle size={12} className="text-rose-400" />;
    default: return <Circle size={12} className="text-slate-700" />;
  }
};

const scoreColor = (score: number) => {
  if (score >= 90) return 'text-emerald-400';
  if (score >= 80) return 'text-sky-400';
  if (score >= 70) return 'text-amber-400';
  return 'text-rose-400';
};

// ─── Compact output preview ────────────────────────────────────────────────

const StagePreview = ({ id, data }: { id: StageId; data: any }) => {
  if (!data || data.phase) return null; // skip processing markers

  if (id === 'architect') {
    return (
      <div className="space-y-1.5">
        {data.logic && <p className="text-[9px] text-slate-400 leading-relaxed line-clamp-3">{data.logic}</p>}
        {data.complexity && (
          <span className={cn(
            'inline-block px-1.5 py-0.5 rounded text-[7px] font-black uppercase border',
            data.complexity === 'low' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' :
            data.complexity === 'high' ? 'text-rose-400 bg-rose-500/10 border-rose-500/20' :
            'text-amber-400 bg-amber-500/10 border-amber-500/20',
          )}>
            {data.complexity}
          </span>
        )}
        {data.techStack?.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {data.techStack.slice(0, 5).map((t: string, i: number) => (
              <span key={i} className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[7px] font-mono text-slate-500">{t}</span>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (id === 'reasoner') {
    return (
      <div className="space-y-1.5">
        {data.plan && <p className="text-[9px] text-slate-400 leading-relaxed line-clamp-3">{data.plan}</p>}
        {data.steps?.length > 0 && (
          <span className="text-[8px] text-slate-600 font-mono">{data.steps.length} steps planned</span>
        )}
      </div>
    );
  }

  if (id === 'executor') {
    return (
      <div className="space-y-1.5">
        {data.explanation && <p className="text-[9px] text-slate-400 leading-relaxed line-clamp-2">{data.explanation}</p>}
        {data.files?.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {data.files.slice(0, 4).map((f: string, i: number) => (
              <span key={i} className="px-1.5 py-0.5 rounded bg-jb-orange/10 border border-jb-orange/20 text-[7px] font-mono text-jb-orange/70">{f}</span>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (id === 'reviewer') {
    return (
      <div className="space-y-1.5">
        {data.score != null && (
          <div className="flex items-center gap-2">
            <span className={cn('text-lg font-black tabular-nums', scoreColor(data.score))}>{data.score}</span>
            <span className="text-[8px] text-slate-600 font-black uppercase">/100</span>
          </div>
        )}
        {data.summary && <p className="text-[9px] text-slate-400 leading-relaxed line-clamp-2">{data.summary}</p>}
        {data.issues?.length > 0 && (
          <span className="text-[8px] text-rose-400/60 font-mono">{data.issues.length} issue{data.issues.length !== 1 ? 's' : ''} found</span>
        )}
      </div>
    );
  }

  return null;
};

// ─── Main ──────────────────────────────────────────────────────────────────

// ─── Compact preset selector ───────────────────────────────────────────────

const CompactPresetPicker = () => {
  const { waterfallPresetKey, setWaterfallPreset } = useAppStore();
  const [expanded, setExpanded] = useState(false);

  const selected = WATERFALL_PRESET_LIST.find((p) => p.key === waterfallPresetKey);
  const topPresets = WATERFALL_PRESET_LIST.filter((p) => p.tier === 'top');
  const otherPresets = WATERFALL_PRESET_LIST.filter((p) => p.tier !== 'top');

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[7px] font-black text-slate-600 uppercase tracking-widest">Preset</span>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-[7px] font-bold text-slate-600 hover:text-slate-400 transition-colors"
        >
          {selected?.name || 'Select'}
          <ChevronDown size={8} className={cn('transition-transform', expanded && 'rotate-180')} />
        </button>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="space-y-1 pt-1">
              {topPresets.map((p) => {
                const isActive = waterfallPresetKey === p.key;
                return (
                  <button
                    key={p.key}
                    onClick={() => { setWaterfallPreset(p.key); setExpanded(false); }}
                    className={cn(
                      'w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border transition-all text-left',
                      isActive
                        ? 'bg-jb-purple/10 border-jb-purple/25'
                        : 'bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04]',
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={cn('text-[9px] font-bold', isActive ? 'text-white' : 'text-slate-400')}>{p.name}</span>
                      <span className="text-[7px] text-slate-600 truncate">{p.description}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {p.speed === '~30s' ? <Zap size={8} className="text-emerald-400" /> : <Clock size={8} className="text-slate-600" />}
                      <span className={cn(
                        'text-[8px] font-black tabular-nums',
                        p.score && p.score >= 90 ? 'text-emerald-400' : p.score && p.score >= 85 ? 'text-sky-400' : 'text-slate-500',
                      )}>
                        {p.score ?? '—'}
                      </span>
                    </div>
                  </button>
                );
              })}
              {otherPresets.length > 0 && (
                <div className="flex gap-1 flex-wrap pt-0.5">
                  {otherPresets.map((p) => (
                    <button
                      key={p.key}
                      onClick={() => { setWaterfallPreset(p.key); setExpanded(false); }}
                      className={cn(
                        'px-2 py-1 rounded-md border text-[7px] font-bold transition-all',
                        waterfallPresetKey === p.key
                          ? 'bg-jb-purple/10 border-jb-purple/25 text-white'
                          : 'bg-white/[0.02] border-white/[0.05] text-slate-600 hover:text-slate-400',
                      )}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Main ──────────────────────────────────────────────────────────────────

export const WaterfallVisualizer = () => {
  const { waterfall, waterfallAbortController, setCurrentMode, runFullWaterfall } = useAppStore();
  const [expandedStage, setExpandedStage] = useState<StageId | null>(null);
  const [prompt, setPrompt] = useState('');

  const isIdle = !waterfall.currentStep && waterfall.steps.architect.status === 'idle';
  const isStreaming = waterfallAbortController !== null;
  const allCompleted = STAGES.every((s) => waterfall.steps[s.id].status === 'completed');

  const handleSubmit = async () => {
    if (!prompt.trim() || isStreaming) return;
    await runFullWaterfall(prompt);
    setPrompt('');
  };

  // ── Idle state — launch UI ───────────────────────────────────────────────
  if (isIdle) {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2">
          <FlaskConical size={13} className="text-jb-purple" />
          <span className="text-[9px] font-black uppercase tracking-[0.3em] text-white/70">Pipeline</span>
        </div>

        {/* Prompt input */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="Describe the task for the pipeline..."
            rows={3}
            className="w-full bg-transparent px-3 py-2.5 text-[10px] font-mono text-slate-300 placeholder:text-slate-700 resize-none outline-none leading-relaxed"
          />
          <div className="flex items-center justify-between px-3 py-2 border-t border-white/[0.04]">
            <span className="text-[7px] text-slate-700 font-mono">⌘↩ to launch</span>
            <button
              onClick={handleSubmit}
              disabled={!prompt.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-jb-purple/15 border border-jb-purple/25 text-jb-purple text-[9px] font-black uppercase tracking-wider hover:bg-jb-purple/25 disabled:opacity-30 transition-all"
            >
              <Sparkles size={10} />
              Initiate
            </button>
          </div>
        </div>

        {/* Preset selector */}
        <CompactPresetPicker />

        {/* Link to full view */}
        <button
          onClick={() => setCurrentMode('waterfall' as any)}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/5 text-slate-600 text-[8px] font-black uppercase tracking-wider hover:bg-white/[0.06] hover:text-slate-400 transition-all"
        >
          <ExternalLink size={9} />
          Open Full View
        </button>
      </div>
    );
  }

  // ── Active / completed ───────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FlaskConical size={13} className="text-jb-purple" />
          <span className="text-[9px] font-black uppercase tracking-[0.3em] text-white/70">Pipeline</span>
        </div>
        <div className="flex items-center gap-1.5">
          {waterfall.currentStep && !allCompleted && (
            <span className="px-2 py-0.5 rounded-full bg-jb-accent/10 border border-jb-accent/20 text-jb-accent text-[7px] font-black uppercase animate-pulse">
              {waterfall.currentStep}
            </span>
          )}
          {allCompleted && (
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[7px] font-black uppercase">
              Complete
            </span>
          )}
        </div>
      </div>

      {/* Prompt preview */}
      {waterfall.prompt && (
        <div className="px-3 py-2 rounded-lg bg-white/[0.02] border border-white/5">
          <p className="text-[9px] text-slate-500 line-clamp-2 font-mono leading-relaxed">{waterfall.prompt}</p>
        </div>
      )}

      {/* Stage list */}
      <div className="space-y-1.5">
        {STAGES.map((stage) => {
          const step = waterfall.steps[stage.id];
          const Icon = stage.icon;
          const isExpanded = expandedStage === stage.id;
          const hasData = step.data && !step.data?.phase;
          const isProcessing = step.status === 'processing';

          return (
            <div key={stage.id}>
              <button
                onClick={() => hasData ? setExpandedStage(isExpanded ? null : stage.id) : undefined}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-all text-left',
                  isProcessing && `${stage.bgColor} ${stage.borderColor} shadow-[0_0_12px_${stage.glowColor}]`,
                  step.status === 'completed' && 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]',
                  step.status === 'error' && 'bg-rose-500/5 border-rose-500/15',
                  step.status === 'paused' && 'bg-amber-500/5 border-amber-500/15',
                  step.status === 'idle' && 'bg-black/20 border-white/[0.03] opacity-40',
                  hasData && 'cursor-pointer',
                )}
              >
                <div className={cn('w-6 h-6 rounded-lg flex items-center justify-center shrink-0', stage.bgColor)}>
                  <Icon size={12} className={stage.textColor} />
                </div>
                <div className="flex-1 min-w-0">
                  <span className={cn('text-[10px] font-black uppercase tracking-wider', step.status === 'idle' ? 'text-slate-700' : 'text-slate-300')}>
                    {stage.label}
                  </span>
                </div>
                <StatusIcon status={step.status} />
                {hasData && (
                  <ChevronRight size={10} className={cn('text-slate-600 transition-transform', isExpanded && 'rotate-90')} />
                )}
              </button>

              {/* Expandable preview */}
              <AnimatePresence>
                {isExpanded && hasData && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="pl-11 pr-3 py-2">
                      <StagePreview id={stage.id} data={step.data} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Score display */}
      {allCompleted && waterfall.steps.reviewer.data?.score != null && (
        <div className="flex items-center justify-center gap-3 py-2 px-3 rounded-xl bg-white/[0.02] border border-white/5">
          <span className={cn('text-2xl font-black tabular-nums', scoreColor(waterfall.steps.reviewer.data.score))}>
            {waterfall.steps.reviewer.data.score}
          </span>
          <div>
            <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest block">Quality Score</span>
            <span className="text-[7px] text-slate-700 font-mono">
              {waterfall.steps.reviewer.data.issues?.length || 0} issues
            </span>
          </div>
        </div>
      )}

      {/* Open in main app */}
      <button
        onClick={() => setCurrentMode('waterfall' as any)}
        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/5 text-slate-500 text-[8px] font-black uppercase tracking-wider hover:bg-white/[0.06] hover:text-white transition-all"
      >
        <ExternalLink size={9} />
        View Full Results
      </button>
    </div>
  );
};
