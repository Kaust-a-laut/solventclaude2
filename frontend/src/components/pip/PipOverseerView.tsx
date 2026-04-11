import React from 'react';
import { Shield, Loader2, Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion } from 'framer-motion';
import { ChatView } from '../ChatView';
import { LocalOverseerDecision, interventionColor, formatTime } from './types';

export interface PipOverseerViewProps {
  decisions: LocalOverseerDecision[];
  isThinking: boolean;
  supervisorInsight: string | null;
  onTrigger: (focus?: string) => void;
  onClearDecisions: () => void;
}

export const PipOverseerView: React.FC<PipOverseerViewProps> = ({
  decisions,
  isThinking,
  supervisorInsight,
  onTrigger,
  onClearDecisions,
}) => (
  <motion.div
    key="overseer"
    initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
    className="flex-1 flex flex-col p-3 gap-3 overflow-hidden"
  >
    {/* Supervisor Insight Banner */}
    <div className="bg-emerald-500/[0.03] border border-emerald-500/10 rounded-xl p-3 flex flex-col gap-2 relative overflow-hidden flex-shrink-0">
      <div className="absolute -right-4 -top-4 w-20 h-20 bg-emerald-500/5 blur-3xl rounded-full" />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield size={12} className="text-emerald-400" />
          <span className="text-[11px] font-black uppercase text-emerald-400 tracking-widest">Overseer</span>
          {isThinking && <Loader2 size={9} className="animate-spin text-emerald-400" />}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onTrigger('manual_check')}
            disabled={isThinking}
            title="Think Now"
            className="px-2 py-0.5 rounded-md text-[11px] font-black uppercase bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-all disabled:opacity-40"
          >
            {isThinking ? '...' : 'Think'}
          </button>
          <button
            onClick={() => onTrigger('nudge_me')}
            disabled={isThinking}
            title="Ask for guidance"
            className="px-2 py-0.5 rounded-md text-[11px] font-black uppercase bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-all disabled:opacity-40"
          >
            Nudge
          </button>
          <button
            onClick={onClearDecisions}
            title="Clear decisions"
            className="p-1 rounded-md text-slate-400 hover:text-rose-400 transition-all"
          >
            <Trash2 size={9} />
          </button>
        </div>
      </div>
      <p className="text-[11px] text-slate-300 leading-relaxed">
        {supervisorInsight || "Watching your session. Hit Think to get a proactive insight, or Nudge for guidance."}
      </p>
    </div>

    {/* Decisions Feed */}
    <div className="flex-[1] flex flex-col overflow-hidden min-h-0">
      <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
        <div className="w-1 h-1 rounded-full bg-emerald-500/50 animate-pulse" />
        <span>Decision Feed</span>
        <span className="text-slate-400">({decisions.length})</span>
      </div>

      {decisions.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center opacity-20 gap-2">
          <Shield size={28} strokeWidth={1} />
          <span className="text-[11px] font-black uppercase">No decisions yet</span>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-2 no-scrollbar">
          {decisions.map((d) => (
            <div key={d.id} className="bg-black/30 border border-white/5 rounded-lg p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                {d.intervention?.needed && (
                  <span className={cn(
                    "text-[11px] font-black uppercase px-1.5 py-0.5 rounded border flex-shrink-0",
                    interventionColor[d.intervention.type] || interventionColor['suggestion']
                  )}>
                    {d.intervention.type}
                  </span>
                )}
                <span className="text-[11px] text-slate-400 font-mono ml-auto flex-shrink-0">
                  {formatTime(d.timestamp)}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed line-clamp-4">
                {d.decision}
              </p>
              {d.intervention?.message && d.intervention.message !== d.decision && (
                <p className="text-[11px] text-slate-300 leading-relaxed border-t border-white/5 pt-2">
                  {d.intervention.message}
                </p>
              )}
              {d.trigger && (
                <span className="text-[6px] text-slate-400 font-mono uppercase">trigger: {d.trigger}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>

    {/* Chat with Overseer */}
    <div className="border-t border-white/5 flex-shrink-0" style={{ height: '260px' }}>
      <ChatView compact />
    </div>
  </motion.div>
);
