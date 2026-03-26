import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';
import {
  Brain, GitBranch, Code2, ShieldCheck,
  ChevronDown, ChevronUp, AlertCircle,
  CheckCircle2, Loader2, PauseCircle, RefreshCw
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type StageKey = 'architect' | 'reasoner' | 'executor' | 'reviewer';
export type StageStatus = 'idle' | 'processing' | 'completed' | 'error' | 'paused';

export interface StageConfig {
  key: StageKey;
  displayName: string;
  icon: React.ElementType;
  color: string;
  borderColor: string;
  bgColor: string;
  textColor: string;
  glowColor: string;
  borderRgba: string;
  description: string;
}

export interface WaterfallStageCardProps {
  config: StageConfig;
  status: StageStatus;
  data: any;
  error: string | null;
  retryCount?: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  timing?: number;
  /** When true, card acts as a clickable selector — no inline expansion */
  compact?: boolean;
  /** Visual selection ring (used in split-layout mode) */
  isSelected?: boolean;
  /** Click handler for the whole card (split-layout mode) */
  onSelect?: () => void;
}

// ─── Stage Configs ─────────────────────────────────────────────────────────────

export const STAGE_CONFIGS: Record<StageKey, StageConfig> = {
  architect: {
    key: 'architect',
    displayName: 'PLANNER',
    icon: Brain,
    color: 'jb-purple',
    borderColor: 'border-jb-purple',
    bgColor: 'bg-jb-purple/10',
    textColor: 'text-jb-purple',
    glowColor: 'rgba(157,91,210,0.25)',
    borderRgba: 'rgba(157,91,210,',
    description: 'Decomposing mission into a structured execution plan',
  },
  reasoner: {
    key: 'reasoner',
    displayName: 'STRATEGIST',
    icon: GitBranch,
    color: 'jb-accent',
    borderColor: 'border-jb-accent',
    bgColor: 'bg-jb-accent/10',
    textColor: 'text-jb-accent',
    glowColor: 'rgba(60,113,247,0.25)',
    borderRgba: 'rgba(60,113,247,',
    description: 'Building logic chains and architectural strategy',
  },
  executor: {
    key: 'executor',
    displayName: 'EXECUTIONER',
    icon: Code2,
    color: 'jb-orange',
    borderColor: 'border-jb-orange',
    bgColor: 'bg-jb-orange/10',
    textColor: 'text-jb-orange',
    glowColor: 'rgba(251,146,60,0.25)',
    borderRgba: 'rgba(251,146,60,',
    description: 'Generating production-quality implementation',
  },
  reviewer: {
    key: 'reviewer',
    displayName: 'REVIEWER',
    icon: ShieldCheck,
    color: 'emerald-500',
    borderColor: 'border-emerald-500',
    bgColor: 'bg-emerald-500/10',
    textColor: 'text-emerald-400',
    glowColor: 'rgba(16,185,129,0.25)',
    borderRgba: 'rgba(16,185,129,',
    description: 'Quality assurance — validating against the original plan',
  },
};

// ─── Sub-components ────────────────────────────────────────────────────────────

const StatusIndicator = ({ status, textColor }: { status: StageStatus; textColor: string }) => {
  if (status === 'idle') return <div className="w-2 h-2 rounded-full bg-white/10" />;
  if (status === 'processing') return <Loader2 size={14} className={cn('animate-spin', textColor)} />;
  if (status === 'completed') return <CheckCircle2 size={14} className="text-emerald-400" />;
  if (status === 'error') return <AlertCircle size={14} className="text-rose-400" />;
  if (status === 'paused') return <PauseCircle size={14} className="text-amber-400 animate-pulse" />;
  return null;
};

const GateContent = ({ data }: { data: any }) => {
  const estimate = data?.estimate;
  if (!estimate) return null;
  const complexity = (estimate.complexity || estimate.riskLevel || 'medium').toLowerCase();
  const complexityColors: Record<string, string> = {
    low: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    medium: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    high: 'text-jb-orange bg-jb-orange/10 border-jb-orange/20',
    critical: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-4 p-4 rounded-2xl bg-amber-500/[0.04] border border-amber-400/20 space-y-3"
    >
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-black text-amber-400 uppercase tracking-widest">Resource Gate</span>
        <span className={cn('px-2 py-0.5 rounded-full text-[8px] font-black uppercase border', complexityColors[complexity] ?? complexityColors.medium)}>
          {complexity}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {estimate.estimatedTokens && (
          <div>
            <div className="text-[8px] text-slate-600 uppercase font-black mb-0.5">Est. Tokens</div>
            <div className="text-[13px] font-black text-white font-mono">{estimate.estimatedTokens.toLocaleString()}</div>
          </div>
        )}
        {estimate.estimatedCost && (
          <div>
            <div className="text-[8px] text-slate-600 uppercase font-black mb-0.5">Est. Cost</div>
            <div className="text-[13px] font-black text-white font-mono">${Number(estimate.estimatedCost).toFixed(4)}</div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

const StageOutput = ({ stageKey, data, textColor }: { stageKey: StageKey; data: any; textColor: string }) => {
  if (!data) return null;

  if (stageKey === 'reviewer') {
    return (
      <div className="mt-4 space-y-3">
        {data.summary && <p className="text-sm text-slate-300 leading-relaxed">{data.summary}</p>}
        {data.issues?.length > 0 && (
          <ul className="space-y-1.5">
            {data.issues.map((issue: string, i: number) => (
              <li key={i} className="flex items-start gap-2 text-xs text-slate-400">
                <span className="w-1 h-1 rounded-full bg-rose-500/60 mt-2 shrink-0" />
                {issue}
              </li>
            ))}
          </ul>
        )}
        {data.crystallizable_insight && (
          <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/15 text-xs text-emerald-300/80 leading-relaxed">
            <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest block mb-1">Crystallized Insight</span>
            {data.crystallizable_insight}
          </div>
        )}
      </div>
    );
  }

  if (data?.plan || data?.steps) {
    return (
      <div className="mt-4 space-y-3">
        {data.plan && <p className="text-sm text-slate-300 leading-relaxed">{data.plan}</p>}
        {data.logic && <p className="text-sm text-slate-300 leading-relaxed">{data.logic}</p>}
        {data.steps?.length > 0 && (
          <ul className="space-y-2">
            {data.steps.map((s: any, i: number) => (
              <li key={i} className={cn('text-xs flex gap-2', textColor)}>
                <span className="font-black shrink-0 mt-0.5">{i + 1}.</span>
                <span className="text-slate-400">
                  {s.title && <strong className="text-slate-300">{s.title}: </strong>}
                  {s.description || s}
                </span>
              </li>
            ))}
          </ul>
        )}
        {data.assumptions && (
          <p className="text-xs text-slate-500 italic">{data.assumptions}</p>
        )}
      </div>
    );
  }

  if (data?.code) {
    return (
      <div className="mt-4 space-y-2">
        {data.explanation && <p className="text-xs text-slate-400 leading-relaxed">{data.explanation}</p>}
        {data.files?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {data.files.map((f: string, i: number) => (
              <span key={i} className="px-2 py-0.5 rounded-lg bg-white/5 border border-white/10 text-[9px] font-mono text-slate-400">{f}</span>
            ))}
          </div>
        )}
        <div className="bg-black/60 border border-white/5 rounded-xl overflow-hidden">
          <div className="px-4 py-1.5 border-b border-white/5 bg-white/[0.02]">
            <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Generated Code</span>
          </div>
          <pre className="p-4 font-mono text-xs text-slate-300 max-h-48 overflow-y-auto scrollbar-thin leading-relaxed">
            {data.code}
          </pre>
        </div>
      </div>
    );
  }

  // Generic string fallback
  if (typeof data === 'string') {
    return <p className="mt-4 text-sm text-slate-300 leading-relaxed">{data}</p>;
  }

  return null;
};

// ─── Main Component ────────────────────────────────────────────────────────────

export const WaterfallStageCard = ({
  config,
  status,
  data,
  error,
  retryCount = 0,
  isExpanded,
  onToggleExpand,
  timing,
  compact = false,
  isSelected = false,
  onSelect,
}: WaterfallStageCardProps) => {
  const Icon = config.icon;

  const statusBarColor = () => {
    if (status === 'idle') return 'bg-white/5';
    if (status === 'processing') return `bg-${config.color} opacity-80`;
    if (status === 'completed') return `bg-${config.color}`;
    if (status === 'error') return 'bg-rose-500';
    if (status === 'paused') return 'bg-amber-400';
    return 'bg-white/5';
  };

  const cardStyle = () => {
    if (status === 'idle') return {};
    if (status === 'processing') return {
      borderColor: `${config.borderRgba}0.35)`,
      boxShadow: `0 0 40px -10px ${config.glowColor}`,
    };
    if (status === 'completed') return {
      borderColor: `${config.borderRgba}0.2)`,
      boxShadow: `0 0 20px -12px ${config.glowColor}`,
    };
    if (status === 'error') return {
      borderColor: 'rgba(244,63,94,0.3)',
      boxShadow: '0 0 30px -10px rgba(244,63,94,0.15)',
    };
    if (status === 'paused') return {
      borderColor: 'rgba(251,191,36,0.3)',
      boxShadow: '0 0 30px -10px rgba(251,191,36,0.15)',
    };
    return {};
  };

  const canExpand = !compact && (status === 'completed' || status === 'error');

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: status === 'idle' ? 0.45 : 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={cn(
        'relative glass-panel rounded-[1.5rem] overflow-hidden transition-all duration-500',
        compact && 'cursor-pointer',
        isSelected && 'ring-1 ring-white/20',
      )}
      style={cardStyle()}
      onClick={compact ? onSelect : undefined}
    >
      {/* Left status bar */}
      <div
        className={cn(
          'absolute left-0 top-0 bottom-0 w-1 rounded-l-[1.5rem] transition-all duration-700',
          statusBarColor()
        )}
      />

      <div className="pl-6 pr-5 py-5">
        {/* Header row */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Icon */}
            <div className={cn(
              'w-10 h-10 rounded-2xl flex items-center justify-center border shrink-0 transition-all duration-500',
              config.bgColor,
              status === 'idle' ? 'border-white/5' : `border-${config.color}/25`
            )}>
              <Icon size={18} className={cn(config.textColor, status === 'idle' && 'opacity-40')} />
            </div>

            {/* Labels */}
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white">
                  {config.displayName}
                </span>
                {config.key === 'executor' && retryCount > 0 && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-jb-orange/15 border border-jb-orange/30 text-jb-orange text-[8px] font-black uppercase">
                    <RefreshCw size={8} />
                    Attempt {retryCount + 1}
                  </span>
                )}
              </div>
              <span className="text-[9px] text-slate-600 font-mono uppercase tracking-widest">
                {status === 'idle' && config.description}
                {status === 'processing' && 'Processing...'}
                {status === 'completed' && `Completed${timing ? ` · ${(timing / 1000).toFixed(1)}s` : ''}`}
                {status === 'error' && 'Failed'}
                {status === 'paused' && 'Awaiting approval'}
              </span>
            </div>
          </div>

          {/* Right: status indicator + expand */}
          <div className="flex items-center gap-3 shrink-0">
            <StatusIndicator status={status} textColor={config.textColor} />
            {canExpand && (
              <button
                onClick={onToggleExpand}
                className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
              >
                {isExpanded
                  ? <ChevronUp size={13} className="text-slate-500" />
                  : <ChevronDown size={13} className="text-slate-500" />
                }
              </button>
            )}
          </div>
        </div>

        {/* Processing dots */}
        <AnimatePresence>
          {status === 'processing' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 flex items-center gap-2 overflow-hidden"
            >
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                  transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.25 }}
                  className={cn('w-1.5 h-1.5 rounded-full', `bg-${config.color}`)}
                />
              ))}
              {data?.message && (
                <span className="text-[10px] text-slate-600 font-mono ml-1 animate-pulse">
                  {data.message}
                </span>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Gate content */}
        <AnimatePresence>
          {status === 'paused' && <GateContent data={data} />}
        </AnimatePresence>

        {/* Error */}
        <AnimatePresence>
          {status === 'error' && error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-3 flex items-start gap-2 text-rose-400"
            >
              <AlertCircle size={13} className="mt-0.5 shrink-0" />
              <span className="text-xs font-mono">{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Expanded output (hidden in compact/split-layout mode) */}
        {!compact && (
          <AnimatePresence>
            {isExpanded && (status === 'completed' || status === 'error') && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ type: 'spring', damping: 28, stiffness: 200 }}
                className="overflow-hidden"
              >
                <StageOutput stageKey={config.key} data={data} textColor={config.textColor} />
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </motion.div>
  );
};
