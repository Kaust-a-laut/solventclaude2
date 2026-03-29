import React from 'react';
import { motion } from 'framer-motion';
import { Check, Search, Sparkles, BarChart3, Zap } from 'lucide-react';
import { cn } from '../lib/utils';

type PipelineStage = 'idle' | 'expanding' | 'searching' | 'ranking' | 'synthesizing' | 'complete';

interface StepperProps {
  stage: PipelineStage;
  stats?: {
    totalFound: number;
    totalRelevant: number;
    pipelineMs: number;
  };
  expandedQuery?: string;
}

const STAGES = [
  { key: 'expanding', label: 'Refining query', icon: Zap, color: 'text-blue-400', bg: 'bg-blue-400', glow: 'shadow-blue-400/40' },
  { key: 'searching', label: 'Searching', icon: Search, color: 'text-purple-400', bg: 'bg-purple-400', glow: 'shadow-purple-400/40' },
  { key: 'ranking', label: 'Ranking', icon: BarChart3, color: 'text-orange-400', bg: 'bg-orange-400', glow: 'shadow-orange-400/40' },
  { key: 'synthesizing', label: 'Synthesizing', icon: Sparkles, color: 'text-emerald-400', bg: 'bg-emerald-400', glow: 'shadow-emerald-400/40' },
] as const;

function getStageIndex(stage: PipelineStage): number {
  const map: Record<string, number> = { expanding: 0, searching: 1, ranking: 2, synthesizing: 3, complete: 4 };
  return map[stage] ?? -1;
}

export const SearchPipelineStepper: React.FC<StepperProps> = ({ stage, stats, expandedQuery }) => {
  if (stage === 'idle') return null;

  const activeIdx = getStageIndex(stage);
  const isComplete = stage === 'complete';

  return (
    <div className={cn("w-full max-w-[700px] mx-auto mb-8 transition-opacity duration-500", isComplete && "opacity-60")}>
      {/* Stepper bar */}
      <div className="flex items-center justify-between gap-0">
        {STAGES.map((s, i) => {
          const isActive = s.key === stage;
          const isDone = activeIdx > i || isComplete;
          const isPending = activeIdx < i && !isComplete;
          const Icon = s.icon;

          return (
            <React.Fragment key={s.key}>
              {/* Connector line (before each step except first) */}
              {i > 0 && (
                <div className="flex-1 h-px relative">
                  <div className="absolute inset-0 bg-white/5" />
                  {isDone && (
                    <motion.div
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: 0.3 }}
                      className={cn('absolute inset-0 origin-left', s.bg, 'opacity-40')}
                    />
                  )}
                </div>
              )}

              {/* Step circle + label */}
              <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                <motion.div
                  animate={isActive ? { scale: [1, 1.15, 1] } : {}}
                  transition={isActive ? { repeat: Infinity, duration: 1.5 } : {}}
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center border transition-all',
                    isComplete ? 'w-6 h-6' : '',
                    isDone && `${s.bg} border-transparent`,
                    isActive && `${s.bg} border-transparent shadow-lg ${s.glow}`,
                    isPending && 'bg-white/5 border-white/10',
                  )}
                >
                  {isDone && !isActive ? (
                    <Check size={isComplete ? 10 : 14} className="text-white" />
                  ) : (
                    <Icon size={isComplete ? 10 : 14} className={cn(isPending ? 'text-white/20' : 'text-white')} />
                  )}
                </motion.div>
                <span className={cn(
                  'text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap',
                  isComplete && 'text-[9px]',
                  isDone && !isActive && 'text-slate-500',
                  isActive && `${s.color} font-black`,
                  isPending && 'text-slate-700',
                )}>
                  {isDone && !isActive && stats
                    ? i === 1 ? `${stats.totalFound} found` : i === 2 ? `${stats.totalRelevant} relevant` : i === 3 ? 'Synthesized' : s.label
                    : isActive && stats && i === 2 ? `Ranking ${stats.totalFound} results` : s.label}
                </span>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Expanded query display */}
      {expandedQuery && activeIdx >= 1 && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-[11px] text-slate-500 italic text-center mt-3 truncate px-4"
        >
          Refined: {expandedQuery}
        </motion.p>
      )}
    </div>
  );
};
