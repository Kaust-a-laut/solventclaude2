import React from 'react';
import {
  Users, Play, Loader2, CheckCircle2, XCircle,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion } from 'framer-motion';
import { LocalActiveMission, MISSION_TEMPLATES, phaseLabel } from './types';

export interface PipMissionsViewProps {
  activeMissions: LocalActiveMission[];
  activeMissionCount: number;
  missionGoal: string;
  missionTemplate: string;
  launchingMission: boolean;
  expandedMission: string | null;
  onGoalChange: (v: string) => void;
  onTemplateChange: (v: string) => void;
  onLaunch: () => void;
  onToggleExpand: (id: string | null) => void;
}

export const PipMissionsView: React.FC<PipMissionsViewProps> = ({
  activeMissions,
  activeMissionCount,
  missionGoal,
  missionTemplate,
  launchingMission,
  expandedMission,
  onGoalChange,
  onTemplateChange,
  onLaunch,
  onToggleExpand,
}) => {
  const tmpl = MISSION_TEMPLATES.find(t => t.id === missionTemplate) ?? MISSION_TEMPLATES[0]!;

  return (
    <motion.div
      key="missions"
      initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }}
      className="flex-1 flex flex-col p-3 gap-3 overflow-hidden"
    >
      {/* Mission Launcher */}
      <div className={cn('rounded-xl p-3 space-y-3 flex-shrink-0 border', tmpl.cardCls)}>
        <div className="flex items-center gap-2">
          <Users size={12} className={tmpl.iconCls} />
          <span className={cn('text-[11px] font-black uppercase tracking-widest', tmpl.headerCls)}>
            Launch Mission
          </span>
        </div>
        <textarea
          value={missionGoal}
          onChange={(e) => onGoalChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onLaunch(); }}
          placeholder="Define the mission goal..."
          className="w-full bg-black/30 border border-white/5 rounded-lg px-3 py-2 text-[11px] font-mono outline-none resize-none text-slate-300 placeholder:text-slate-400 h-16"
        />
        <div className="flex items-center gap-2">
          <div className="flex gap-1 flex-1">
            {MISSION_TEMPLATES.map(t => (
              <button
                key={t.id}
                onClick={() => onTemplateChange(t.id)}
                className={cn(
                  'px-2 py-1 rounded-full text-[11px] font-black uppercase border transition-all',
                  missionTemplate === t.id ? t.activeCls : 'bg-white/[0.02] border-white/5 text-slate-400 hover:text-white',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <button
            onClick={onLaunch}
            disabled={!missionGoal.trim() || launchingMission}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 disabled:opacity-50 text-white text-[11px] font-black rounded-full transition-all',
              tmpl.id === 'consultation' ? 'bg-jb-purple hover:bg-jb-purple/80' : 'bg-jb-accent hover:bg-jb-accent/80',
            )}
          >
            {launchingMission ? <Loader2 size={10} className="animate-spin" /> : <Play size={10} fill="currentColor" />}
            {launchingMission ? 'Launching...' : 'Launch'}
          </button>
        </div>
      </div>

      {/* Active Missions List */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
          <div className={cn("w-1 h-1 rounded-full", activeMissionCount > 0 ? "bg-indigo-500 animate-pulse" : "bg-slate-700")} />
          <span>Active Missions</span>
          <span className="text-slate-400">({activeMissions.length})</span>
        </div>

        {activeMissions.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center opacity-20 gap-2">
            <Users size={28} strokeWidth={1} />
            <span className="text-[11px] font-black uppercase">No missions yet</span>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-2 no-scrollbar">
            {activeMissions.map((m) => (
              <div
                key={m.jobId}
                className="bg-black/30 border border-white/5 rounded-lg overflow-hidden cursor-pointer"
                onClick={() => onToggleExpand(expandedMission === m.jobId ? null : m.jobId)}
              >
                <div className="p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] text-slate-300 font-medium line-clamp-1 flex-1">{m.goal}</p>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className={cn(
                        "text-[11px] font-black uppercase px-1.5 py-0.5 rounded",
                        m.status === 'complete' ? "bg-emerald-500/20 text-emerald-400" :
                        m.status === 'failed' ? "bg-rose-500/20 text-rose-400" :
                        m.status === 'active' ? "bg-indigo-500/20 text-indigo-400" :
                        "bg-slate-700/40 text-slate-300"
                      )}>{m.status}</span>
                      {(m.status === 'queued' || m.status === 'active') && (
                        <Loader2 size={9} className="animate-spin text-indigo-400" />
                      )}
                      {m.status === 'complete' && <CheckCircle2 size={9} className="text-emerald-400" />}
                      {m.status === 'failed' && <XCircle size={9} className="text-rose-400" />}
                    </div>
                  </div>

                  {(m.status === 'queued' || m.status === 'active') && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                          {phaseLabel(m.progress, m.status)}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">{m.progress}%</span>
                      </div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full rounded-full bg-gradient-to-r from-jb-purple to-jb-accent"
                          initial={{ width: 0 }}
                          animate={{ width: `${m.progress}%` }}
                          transition={{ duration: 0.5, ease: 'easeOut' }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Expanded result */}
                {expandedMission === m.jobId && typeof m.result === 'object' && m.result !== null && 'expertOpinions' in m.result && (() => {
                  const resultData = m.result as { expertOpinions?: { role?: string; content?: string; name?: string; opinion?: string }[]; synthesis?: string };
                  return (
                    <div className="border-t border-white/5 p-3 space-y-3">
                      {resultData.expertOpinions && (
                        <div className="space-y-2">
                          <span className="text-[11px] font-black uppercase tracking-widest text-slate-400 block">
                            Expert Analysis
                          </span>
                          {resultData.expertOpinions.map((op, i: number) => {
                            const agentBorders = ['border-jb-purple', 'border-jb-accent', 'border-jb-orange'];
                            const agentText    = ['text-jb-purple',   'text-jb-accent',   'text-jb-orange'];
                            return (
                              <div key={i} className={cn('glass-card p-2.5 rounded-xl border-l-2', agentBorders[i % 3])}>
                                <span className={cn('text-[11px] font-black uppercase tracking-widest block mb-0.5', agentText[i % 3])}>
                                  {op.role}
                                </span>
                                <p className="text-[11px] text-slate-400 leading-relaxed">{op.opinion}</p>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {resultData.synthesis && (
                        <div className="glass-panel rounded-xl p-3">
                          <h4 className="text-[11px] font-black mb-1.5">
                            <span className="text-vibrant">Synthesis</span>
                          </h4>
                          <p className="text-[11px] text-slate-400 leading-relaxed">{resultData.synthesis}</p>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {expandedMission === m.jobId && m.error && (
                  <div className="border-t border-white/5 p-3">
                    <p className="text-[11px] text-rose-400">{m.error}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
};
