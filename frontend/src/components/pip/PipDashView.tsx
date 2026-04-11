import React from 'react';
import {
  Shield, Database, Search, PenLine, Code2, Layers,
  ChevronDown, Loader2, FlaskConical,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion } from 'framer-motion';
import { ActivityEvent } from '../../store/types';
import { LocalOverseerDecision } from './types';

type WaterfallState = {
  prompt: string;
  currentStep: 'planner' | 'executor' | 'reviewer' | null;
  steps: {
    planner: { status: string; data?: Record<string, unknown> | null; error?: string | null };
    executor: { status: string; data?: Record<string, unknown> | null; error?: string | null };
    reviewer: { status: string; data?: Record<string, unknown> | null; error?: string | null };
  };
};

type PipView = 'dash' | 'notes' | 'overseer' | 'missions' | 'waterfall' | 'code' | 'intel';

interface ActionButtonProps {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  color: string;
  desc: string;
}

const ActionButton: React.FC<ActionButtonProps> = ({ icon: Icon, label, onClick, color, desc }) => (
  <button
    onClick={onClick}
    className="group relative p-4 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/10 transition-all text-left overflow-hidden h-full flex flex-col justify-between"
  >
    <div className="absolute top-0 right-0 w-12 h-[1px] bg-white/[0.05] group-hover:bg-white/20 transition-colors" />
    <div className="absolute top-0 right-0 w-[1px] h-12 bg-white/[0.05] group-hover:bg-white/20 transition-colors" />
    <div className="relative z-10 space-y-4">
      <div className={cn("p-3 rounded-xl bg-black/40 border border-white/5 w-fit group-hover:scale-110 transition-transform", color)}>
        <Icon size={18} strokeWidth={1.5} />
      </div>
      <div className="space-y-1">
        <h3 className="text-[11px] font-black text-white uppercase tracking-widest">{label}</h3>
        <p className="text-[11px] text-slate-300 font-bold uppercase tracking-tight line-clamp-1">{desc}</p>
      </div>
    </div>
    <div className="relative z-10 pt-4 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.3em] text-white/10 group-hover:text-white transition-all">
      Open <ChevronDown size={10} className="rotate-[-90deg]" />
    </div>
  </button>
);

export interface PipDashViewProps {
  waterfall: WaterfallState;
  waterfallAbortController: unknown;
  activities: ActivityEvent[];
  supervisorInsight: string | null;
  overseerDecisions: LocalOverseerDecision[];
  isThinking: boolean;
  onOpenView: (v: PipView) => void;
  onTriggerOverseer: (focus?: string) => void;
}

export const PipDashView: React.FC<PipDashViewProps> = ({
  waterfall,
  waterfallAbortController,
  activities,
  supervisorInsight,
  overseerDecisions,
  isThinking,
  onOpenView,
  onTriggerOverseer,
}) => {
  const STAGE_ORDER = ['planner', 'executor', 'reviewer'] as const;
  const pipelineIdle = !waterfall.currentStep && waterfall.steps.planner.status === 'idle';
  const pipelineActive = waterfallAbortController !== null || waterfall.currentStep !== null;
  const pipelineComplete = STAGE_ORDER.every((s) => waterfall.steps[s].status === 'completed');
  const reviewerScore = (waterfall.steps.reviewer.data as { score?: number } | null)?.score;
  const currentStage = waterfall.currentStep;

  void pipelineActive; // used only for conditional rendering logic above

  return (
    <motion.div
      key="dash"
      initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
      className="flex-1 flex flex-col gap-3 p-3 overflow-y-auto no-scrollbar"
    >
      {/* Overseer Card */}
      <div
        onClick={() => onOpenView('overseer')}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && onOpenView('overseer')}
        className="group relative p-4 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-emerald-500/20 transition-all text-left overflow-hidden flex-shrink-0 cursor-pointer"
      >
        <div className="absolute top-0 right-0 w-12 h-[1px] bg-white/[0.05] group-hover:bg-emerald-500/20 transition-colors" />
        <div className="absolute top-0 right-0 w-[1px] h-12 bg-white/[0.05] group-hover:bg-emerald-500/20 transition-colors" />
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 w-fit group-hover:scale-110 transition-transform text-emerald-400 shrink-0">
              <Shield size={16} strokeWidth={1.5} />
            </div>
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-[11px] font-black text-white uppercase tracking-widest">Overseer</h3>
                {isThinking && <Loader2 size={9} className="animate-spin text-emerald-400" />}
                {overseerDecisions.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[11px] font-black">
                    {overseerDecisions.length}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-300 font-bold leading-relaxed line-clamp-2">
                {supervisorInsight || 'Watching your session — click to open'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => onTriggerOverseer('manual_check')}
              disabled={isThinking}
              className="px-2 py-1 rounded-md text-[11px] font-black uppercase bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-all disabled:opacity-40"
            >
              {isThinking ? '...' : 'Think'}
            </button>
            <button
              onClick={() => onTriggerOverseer('nudge_me')}
              disabled={isThinking}
              className="px-2 py-1 rounded-md text-[11px] font-black uppercase bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-all disabled:opacity-40"
            >
              Nudge
            </button>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.3em] text-white/10 group-hover:text-emerald-400/40 transition-all">
          Open Overseer <ChevronDown size={10} className="rotate-[-90deg]" />
        </div>
      </div>

      {/* Pipeline Status Card */}
      {!pipelineIdle && (
        <div
          role="button"
          tabIndex={0}
          onClick={() => onOpenView('waterfall')}
          onKeyDown={e => e.key === 'Enter' && onOpenView('waterfall')}
          className="group relative p-4 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-jb-purple/20 transition-all text-left overflow-hidden flex-shrink-0 cursor-pointer"
        >
          <div className="absolute top-0 right-0 w-12 h-[1px] bg-white/[0.05] group-hover:bg-jb-purple/20 transition-colors" />
          <div className="absolute top-0 right-0 w-[1px] h-12 bg-white/[0.05] group-hover:bg-jb-purple/20 transition-colors" />
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 w-fit group-hover:scale-110 transition-transform text-jb-purple shrink-0">
              <FlaskConical size={16} strokeWidth={1.5} />
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-[11px] font-black text-white uppercase tracking-widest">Pipeline</h3>
                {pipelineComplete && reviewerScore != null && (
                  <span className={cn(
                    'px-1.5 py-0.5 rounded-full text-[11px] font-black tabular-nums',
                    reviewerScore >= 90 ? 'bg-emerald-500/20 text-emerald-400' :
                    reviewerScore >= 80 ? 'bg-sky-500/20 text-sky-400' :
                    reviewerScore >= 70 ? 'bg-amber-500/20 text-amber-400' :
                    'bg-rose-500/20 text-rose-400',
                  )}>
                    {reviewerScore}/100
                  </span>
                )}
                {!pipelineComplete && currentStage && (
                  <Loader2 size={9} className="animate-spin text-jb-purple" />
                )}
              </div>
              <p className="text-[11px] text-slate-300 font-bold leading-relaxed line-clamp-1">
                {pipelineComplete
                  ? waterfall.prompt.slice(0, 60) + (waterfall.prompt.length > 60 ? '…' : '')
                  : currentStage
                    ? `${currentStage.charAt(0).toUpperCase() + currentStage.slice(1)} stage running…`
                    : 'Pipeline active'}
              </p>
              {/* Mini stage dots */}
              <div className="flex items-center gap-1.5 pt-1">
                {STAGE_ORDER.map((s) => {
                  const st = waterfall.steps[s].status;
                  return (
                    <div
                      key={s}
                      className={cn(
                        'w-2 h-2 rounded-full transition-all',
                        st === 'completed' ? 'bg-emerald-400' :
                        st === 'processing' ? 'bg-jb-accent animate-pulse' :
                        st === 'error' ? 'bg-rose-400' :
                        st === 'paused' ? 'bg-amber-400' :
                        'bg-slate-800',
                      )}
                    />
                  );
                })}
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.3em] text-white/10 group-hover:text-jb-purple/40 transition-all">
            {pipelineComplete ? 'View Results' : 'Monitor Pipeline'} <ChevronDown size={10} className="rotate-[-90deg]" />
          </div>
        </div>
      )}

      {/* Action Grid */}
      <div className="grid grid-cols-2 gap-2 flex-shrink-0">
        <ActionButton icon={Search}  label="WEB"   onClick={() => onOpenView('intel')}     color="text-cyan-400"  desc="Search & browse" />
        <ActionButton icon={PenLine} label="NOTES"  onClick={() => onOpenView('notes')}     color="text-amber-400" desc="Context & directives" />
        <ActionButton icon={Code2}   label="CODE"   onClick={() => onOpenView('code')}      color="text-jb-accent" desc="IDE control panel" />
        <ActionButton icon={Layers}  label="FLOW"   onClick={() => onOpenView('waterfall')} color="text-jb-purple" desc="Pipeline monitor" />
      </div>

      {/* Activity Feed */}
      <div className="flex-1 bg-black/40 rounded-xl border border-white/5 p-3 flex flex-col overflow-hidden min-h-0">
        <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
          <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
          <span>Recent Activity</span>
        </div>
        <div className="flex-1 overflow-y-auto space-y-2 no-scrollbar">
          {activities.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center opacity-20">
              <Database size={24} strokeWidth={1} />
              <span className="text-[11px] font-black uppercase mt-2">Buffer Empty</span>
            </div>
          ) : (
            activities.slice(0, 15).map((act, i: number) => (
              <div key={i} className="text-[11px] leading-tight flex gap-2">
                <span className={cn(
                  "font-black uppercase text-[6px] px-1 py-0.5 rounded-sm shrink-0 h-fit mt-0.5",
                  act.type === 'user_message' ? "bg-blue-500/20 text-blue-400" :
                  act.type === 'ai_code_update' ? "bg-emerald-500/20 text-emerald-400" :
                  act.type === 'waterfall' ? "bg-jb-purple/20 text-jb-purple" :
                  act.type === 'command' ? "bg-jb-orange/20 text-jb-orange" : "bg-white/10 text-white/50"
                )}>{act.type === 'waterfall' ? 'flow' : String(act.type || '').replace('_', ' ').slice(0, 10)}</span>
                <span className="text-slate-400/80 line-clamp-2 font-mono">
                  {act.content || (act.detail as string) || (act.path as string) || act.message || JSON.stringify(act)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </motion.div>
  );
};
