import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Clock, GitMerge } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { ActiveMission } from '../../store/types';

// ─── Helpers ────────────────────────────────────────────────────────────────────

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const TEMPLATE_BADGE: Record<string, string> = {
  consultation: 'bg-jb-purple/10 border-jb-purple/25 text-jb-purple',
  refinement:   'bg-jb-accent/10 border-jb-accent/25 text-jb-accent',
};

// ─── Types ──────────────────────────────────────────────────────────────────────

interface MissionHistoryProps {
  missions: ActiveMission[];
  isOpen: boolean;
  onToggle: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────────────

export const MissionHistory: React.FC<MissionHistoryProps> = ({
  missions,
  isOpen,
  onToggle,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const completed = missions.filter((m) => m.status === 'complete');

  if (completed.length === 0 && !isOpen) return null;

  return (
    <div className="glass-panel rounded-2xl overflow-hidden">
      {/* Toggle handle */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2">
          <Clock size={12} className="text-slate-500" />
          <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">
            Mission History
            {completed.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-white/5 text-slate-400">
                {completed.length}
              </span>
            )}
          </span>
        </div>
        {isOpen ? (
          <ChevronUp size={12} className="text-slate-600" />
        ) : (
          <ChevronDown size={12} className="text-slate-600" />
        )}
      </button>

      {/* Collapsible content */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden border-t border-white/5"
          >
            <div className="p-3 space-y-2 max-h-64 overflow-y-auto no-scrollbar">
              {completed.length === 0 ? (
                <p className="text-[11px] text-slate-700 uppercase tracking-widest text-center py-4">
                  No completed missions yet
                </p>
              ) : (
                completed.map((mission) => {
                  const isExpanded = expandedId === mission.jobId;
                  const result = mission.result as { synthesis?: string; expertOpinions?: unknown[] } | undefined;
                  const badgeCls = TEMPLATE_BADGE[mission.missionType] ?? 'bg-white/5 border-white/10 text-slate-400';

                  return (
                    <div key={mission.jobId} className="glass-card rounded-xl overflow-hidden">
                      {/* Mission row */}
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : mission.jobId)}
                        className="w-full flex items-center gap-2 p-2.5 text-left hover:bg-white/[0.02] transition-colors"
                      >
                        <span className={cn('px-1.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider border flex-shrink-0', badgeCls)}>
                          {mission.missionType}
                        </span>
                        <span className="text-[11px] text-slate-400 flex-1 truncate font-medium">
                          {mission.goal}
                        </span>
                        <span className="text-[11px] text-slate-700 flex-shrink-0">
                          {relativeTime(mission.startedAt)}
                        </span>
                        <ChevronDown
                          size={10}
                          className={cn('text-slate-600 flex-shrink-0 transition-transform', isExpanded && 'rotate-180')}
                        />
                      </button>

                      {/* Expanded synthesis */}
                      <AnimatePresence>
                        {isExpanded && result?.synthesis && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            className="overflow-hidden"
                          >
                            <div className="mx-2.5 mb-2.5 p-2.5 rounded-xl border-l-2 border-emerald-500/40 bg-emerald-500/[0.04]">
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <GitMerge size={10} className="text-emerald-400" />
                                <span className="text-[11px] font-black uppercase tracking-widest text-emerald-400">
                                  Synthesis
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400 leading-relaxed">
                                {result.synthesis}
                              </p>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
