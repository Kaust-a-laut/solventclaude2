import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import {
  PenLine, X, Shield,
  Database, LayoutGrid, ExternalLink,
  Code2, Settings,
  Layers, Trash2, ChevronDown, Sparkles,
  Brain, FlaskConical,
  Play, Loader2, CheckCircle2, XCircle,
  Users, Terminal as TerminalIcon, FileText,
  Wrench, Check, AlertCircle, FolderOpen,
  Eye, EyeOff, MessageSquare, Diff, ArrowRight,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { ChatView } from './ChatView';
import { WaterfallVisualizer } from './WaterfallVisualizer';
import { fetchWithRetry } from '../lib/api-client';
import { API_BASE_URL } from '../lib/config';
import { socket } from '../lib/socket';

// Local types for PiP window (separate Electron context = separate store)
interface LocalOverseerDecision {
  id: string;
  decision: string;
  intervention?: { needed: boolean; type: 'warning' | 'suggestion' | 'action'; message: string } | null;
  timestamp: number;
  trigger?: string;
}

interface LocalActiveMission {
  jobId: string;
  goal: string;
  missionType: string;
  status: 'queued' | 'active' | 'complete' | 'failed';
  progress: number;
  result?: any;
  error?: string;
}

const MISSION_TEMPLATES = [
  {
    id: 'consultation', label: 'Consultation', desc: 'PM + Engineer + Security',
    cardCls:   'bg-jb-purple/5 border-jb-purple/15',
    activeCls: 'bg-jb-purple/20 border-jb-purple/40 text-jb-purple',
    headerCls: 'text-jb-purple',
    iconCls:   'text-jb-purple',
  },
  {
    id: 'refinement', label: 'Refinement', desc: 'Adversarial critic + optimizer',
    cardCls:   'bg-jb-accent/5 border-jb-accent/15',
    activeCls: 'bg-jb-accent/20 border-jb-accent/40 text-jb-accent',
    headerCls: 'text-jb-accent',
    iconCls:   'text-jb-accent',
  },
];

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

function phaseLabel(progress: number, status: string): string {
  if (status === 'queued') return 'Queued...';
  if (status === 'complete') return 'Complete';
  if (status === 'failed') return 'Failed';
  if (progress < 75) return 'Agents analyzing...';
  if (progress < 90) return 'Synthesizing...';
  return 'Saving to memory...';
}

const interventionColor = {
  warning: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  suggestion: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  action: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
};

// ─── Helper: Mini Terminal ────────────────────────────────────────────────────

const TERMINAL_COLOR_MAP: [RegExp, string][] = [
  [/^\[SYSTEM\]/,    'text-jb-accent/60'],
  [/^\[ERROR\]/,     'text-rose-400'],
  [/^\[STDERR\]/,    'text-rose-400/70'],
  [/^\[WATERFALL\]/, 'text-jb-purple/70'],
  [/^\[AGENT\]/,     'text-emerald-400/70'],
];

const MiniTerminal: React.FC<{ lines: string[] }> = ({ lines }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [lines.length]);

  const tail = lines.slice(-40);
  return (
    <div
      ref={ref}
      className="flex-1 bg-black/40 rounded-lg border border-white/5 p-2 overflow-y-auto no-scrollbar font-mono text-[11px] leading-[1.6] min-h-0"
    >
      {tail.length === 0 ? (
        <div className="h-full flex items-center justify-center opacity-20">
          <span className="text-[11px] font-black uppercase">Terminal empty</span>
        </div>
      ) : (
        tail.map((line, i) => {
          const colorCls = TERMINAL_COLOR_MAP.find(([re]) => re.test(line))?.[1] || 'text-slate-500';
          return (
            <div key={i} className={cn('whitespace-pre-wrap break-all', colorCls)}>
              {line}
            </div>
          );
        })
      )}
    </div>
  );
};

// ─── Helper: Toggle Pill ──────────────────────────────────────────────────────

const TogglePill: React.FC<{
  icon: React.ElementType;
  label: string;
  active: boolean;
  onClick: () => void;
}> = ({ icon: Icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={cn(
      'flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-black uppercase transition-all border',
      active
        ? 'bg-jb-accent/15 border-jb-accent/25 text-jb-accent'
        : 'bg-white/[0.02] border-white/5 text-slate-600 hover:text-white',
    )}
  >
    <Icon size={8} />
    {label}
    {active ? <Eye size={7} /> : <EyeOff size={7} />}
  </button>
);

// ─── Main Component ──────────────────────────────────────────────────────────

export const NotepadPiP = ({ onClose, onDetach }: { onClose?: () => void; onDetach?: () => void } = {}) => {
  const {
    notepadContent, setNotepadContent, supervisorInsight, setSupervisorInsight,
    thinkingModeEnabled, setThinkingModeEnabled, auraMode, setAuraMode,
    globalProvider, setGlobalProvider, setCurrentMode, activities,
    messages, waterfall, waterfallAbortController,
    // Coding suite state
    terminalLines, clearTerminalLines, agentMessages,
    pendingDiff, clearPendingDiff,
    openFiles, activeFile,
    fileTreeVisible, setFileTreeVisible,
    chatPanelVisible, setChatPanelVisible,
    terminalVisible, setTerminalVisible,
  } = useAppStore();

  const [view, setView] = useState<'dash' | 'notes' | 'overseer' | 'missions' | 'waterfall' | 'code'>('dash');
  const [isCompact, setIsCompact] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Overseer state — local since PiP is a separate Electron window
  const [overseerDecisions, setOverseerDecisions] = useState<LocalOverseerDecision[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isThinking, setIsThinking] = useState(false);

  // Missions state
  const [activeMissions, setActiveMissions] = useState<LocalActiveMission[]>([]);
  const [missionGoal, setMissionGoal] = useState('');
  const [missionTemplate, setMissionTemplate] = useState('consultation');
  const [launchingMission, setLaunchingMission] = useState(false);
  const [expandedMission, setExpandedMission] = useState<string | null>(null);

  // Socket listeners — wired directly since PiP has its own socket
  useEffect(() => {
    const handleOverseerDecision = (d: any) => {
      const decision: LocalOverseerDecision = {
        id: d.id || `od_${Date.now()}`,
        decision: d.decision || d.message || JSON.stringify(d),
        intervention: d.intervention,
        timestamp: d.timestamp || Date.now(),
        trigger: d.trigger,
      };
      setOverseerDecisions(prev => [decision, ...prev].slice(0, 20));
      if (view !== 'overseer') setUnreadCount(c => c + 1);
    };

    const handleNudge = ({ message }: { message: string }) => {
      setSupervisorInsight(message);
    };

    const handleMissionProgress = ({ jobId, progress }: { jobId: string; progress: number }) => {
      setActiveMissions(prev => prev.map(m =>
        m.jobId === jobId ? { ...m, progress, status: 'active' } : m
      ));
    };

    const handleMissionComplete = ({ jobId, result }: { jobId: string; result: any }) => {
      setActiveMissions(prev => prev.map(m =>
        m.jobId === jobId ? { ...m, status: 'complete', progress: 100, result } : m
      ));
    };

    const handleMissionFailed = ({ jobId, error }: { jobId: string; error: string }) => {
      setActiveMissions(prev => prev.map(m =>
        m.jobId === jobId ? { ...m, status: 'failed', error } : m
      ));
    };

    socket.on('OVERSEER_DECISION', handleOverseerDecision);
    socket.on('supervisor-nudge', handleNudge);
    socket.on('MISSION_PROGRESS', handleMissionProgress);
    socket.on('MISSION_COMPLETE', handleMissionComplete);
    socket.on('MISSION_FAILED', handleMissionFailed);

    return () => {
      socket.off('OVERSEER_DECISION', handleOverseerDecision);
      socket.off('supervisor-nudge', handleNudge);
      socket.off('MISSION_PROGRESS', handleMissionProgress);
      socket.off('MISSION_COMPLETE', handleMissionComplete);
      socket.off('MISSION_FAILED', handleMissionFailed);
    };
  }, [view, setSupervisorInsight]);

  // Reset unread when switching to overseer
  useEffect(() => {
    if (view === 'overseer') setUnreadCount(0);
  }, [view]);

  const triggerOverseer = useCallback(async (focus?: string) => {
    setIsThinking(true);
    try {
      await fetchWithRetry(`${API_BASE_URL}/overseer/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          focus: focus || 'manual_check',
          notepadContent,
          recentMessages: messages.slice(-8),
        }),
        retries: 1,
      });
    } catch { /* non-fatal */ }
    finally { setIsThinking(false); }
  }, [notepadContent, messages]);

  const launchMission = useCallback(async () => {
    if (!missionGoal.trim()) return;
    setLaunchingMission(true);
    try {
      const data = await fetchWithRetry<{ jobId?: string }>(`${API_BASE_URL}/collaborate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: missionGoal, missionType: missionTemplate, async: true }),
      });
      const jobId = data.jobId;
      if (jobId) {
        setActiveMissions(prev => [{
          jobId,
          goal: missionGoal,
          missionType: missionTemplate,
          status: 'queued' as const,
          progress: 0,
        }, ...prev].slice(0, 10));
        setMissionGoal('');
      }
    } catch { /* non-fatal */ }
    finally { setLaunchingMission(false); }
  }, [missionGoal, missionTemplate]);


  // Navigate PiP-locally (no effect on main app)
  const openLocalView = (v: typeof view) => setView(v);

  // Launch a tool in the main app without changing PiP view
  const launchInMainApp = (mode: string) => setCurrentMode(mode as any);

  const isSocketConnected = socket.connected;
  const activeMissionCount = activeMissions.filter(m => m.status === 'queued' || m.status === 'active').length;

  const ActionButton = ({ icon: Icon, label, onClick, color, desc }: any) => (
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
          <p className="text-[11px] text-slate-500 font-bold uppercase tracking-tight line-clamp-1">{desc}</p>
        </div>
      </div>
      <div className="relative z-10 pt-4 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.3em] text-white/10 group-hover:text-white transition-all">
        Open <ChevronDown size={10} className="rotate-[-90deg]" />
      </div>
    </button>
  );

  return (
    <div className={cn(
      "h-full w-full flex flex-col bg-[#050508] text-slate-300 border border-white/10 overflow-hidden font-sans transition-all duration-300",
      isCompact ? "p-1" : "p-0"
    )}>
      {/* Header */}
      <div
        style={{ WebkitAppRegion: 'drag' } as any}
        className="drag-handle flex items-center justify-between px-3 py-2 bg-[#0a0a0f] border-b border-white/5 cursor-move"
      >
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-jb-purple animate-pulse shadow-[0_0_10px_rgba(139,92,246,0.5)]" />
          <span className="text-[11px] font-black uppercase tracking-[0.3em] text-white/70">Solvent</span>
          {activeMissionCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 text-[11px] font-black">
              {activeMissionCount} active
            </span>
          )}
        </div>

        <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as any}>
          {view !== 'dash' && (
            <button
              onClick={() => openLocalView('dash')}
              className="p-1.5 rounded-md text-slate-600 hover:text-white transition-all"
              title="Dashboard"
            >
              <LayoutGrid size={12} />
            </button>
          )}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={cn("p-1.5 rounded-md transition-all", showSettings ? "text-white bg-white/10" : "text-slate-600 hover:text-white")}
            title="Settings"
          >
            <Settings size={12} />
          </button>
          {onDetach && (
            <button
              onClick={onDetach}
              className="p-1.5 rounded-md text-slate-600 hover:text-jb-orange transition-all"
              title="Detach to floating window"
            >
              <ExternalLink size={12} />
            </button>
          )}
          <button
            onClick={() => onClose ? onClose() : window.close()}
            className="p-1.5 text-slate-600 hover:text-red-400 transition-all"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex flex-col p-0 gap-0 relative">
        {/* Settings Overlay */}
        <AnimatePresence>
          {showSettings && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-3 left-3 right-3 z-[100] glass-panel rounded-xl border border-white/10 shadow-2xl p-3 flex flex-col gap-2 bg-[#0a0a0f]/95"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-black uppercase text-white tracking-widest">Settings</span>
                <button onClick={() => setShowSettings(false)}><X size={10} /></button>
              </div>
              <div className="space-y-1">
                <button
                  onClick={() => setThinkingModeEnabled(!thinkingModeEnabled)}
                  className={cn(
                    "w-full flex items-center justify-between p-2 rounded-lg text-[11px] font-black uppercase transition-all",
                    thinkingModeEnabled ? "bg-jb-purple/20 text-jb-purple" : "bg-white/5 text-slate-500 hover:text-white"
                  )}
                >
                  <div className="flex items-center gap-2"><Brain size={12} /><span>Deep Thinking</span></div>
                  <div className={cn("w-2 h-2 rounded-full", thinkingModeEnabled ? "bg-jb-purple shadow-[0_0_8px_rgba(157,91,210,1)]" : "bg-slate-800")} />
                </button>
                <button
                  onClick={() => setAuraMode(auraMode === 'off' ? 'organic' : 'off')}
                  className={cn(
                    "w-full flex items-center justify-between p-2 rounded-lg text-[11px] font-black uppercase transition-all",
                    auraMode !== 'off' ? "bg-jb-orange/20 text-jb-orange" : "bg-white/5 text-slate-500 hover:text-white"
                  )}
                >
                  <div className="flex items-center gap-2"><Sparkles size={12} /><span>Visual Effects</span></div>
                  <div className={cn("w-2 h-2 rounded-full", auraMode !== 'off' ? "bg-jb-orange shadow-[0_0_8px_rgba(251,146,60,1)]" : "bg-slate-800")} />
                </button>
                <div className="pt-2 mt-2 border-t border-white/5 flex flex-col gap-1">
                  <span className="text-[11px] font-black text-slate-600 uppercase tracking-widest ml-1">AI Provider</span>
                  <div className="flex gap-1">
                    {['cloud', 'local', 'auto'].map(p => (
                      <button
                        key={p}
                        onClick={() => setGlobalProvider(p)}
                        className={cn(
                          "flex-1 py-1.5 rounded-md text-[11px] font-black uppercase transition-all border",
                          globalProvider === p ? "bg-white text-black border-white" : "bg-black/40 text-slate-500 border-white/5 hover:border-white/20"
                        )}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">

          {/* ─── DASHBOARD ─── */}
          {view === 'dash' && (
            <motion.div
              key="dash"
              initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
              className="flex-1 flex flex-col gap-3 p-3 overflow-y-auto no-scrollbar"
            >
              {/* Overseer Card */}
              <button
                onClick={() => openLocalView('overseer')}
                className="group relative p-4 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-emerald-500/20 transition-all text-left overflow-hidden flex-shrink-0"
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
                      <p className="text-[11px] text-slate-500 font-bold leading-relaxed line-clamp-2">
                        {supervisorInsight || 'Watching your session — click to open'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => triggerOverseer('manual_check')}
                      disabled={isThinking}
                      className="px-2 py-1 rounded-md text-[11px] font-black uppercase bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-all disabled:opacity-40"
                    >
                      {isThinking ? '...' : 'Think'}
                    </button>
                    <button
                      onClick={() => triggerOverseer('nudge_me')}
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
              </button>

              {/* Pipeline Status Card */}
              {(() => {
                const STAGE_ORDER = ['architect', 'reasoner', 'executor', 'reviewer'] as const;
                const pipelineIdle = !waterfall.currentStep && waterfall.steps.architect.status === 'idle';
                const pipelineActive = waterfallAbortController !== null || waterfall.currentStep !== null;
                const pipelineComplete = STAGE_ORDER.every((s) => waterfall.steps[s].status === 'completed');
                const reviewerScore = waterfall.steps.reviewer.data?.score;
                const currentStage = waterfall.currentStep;

                if (!pipelineIdle) {
                  return (
                    <button
                      onClick={() => openLocalView('waterfall')}
                      className="group relative p-4 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-jb-purple/20 transition-all text-left overflow-hidden flex-shrink-0"
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
                          <p className="text-[11px] text-slate-500 font-bold leading-relaxed line-clamp-1">
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
                    </button>
                  );
                }
                return null;
              })()}

              {/* Action Grid */}
              <div className="grid grid-cols-2 gap-2 flex-shrink-0">
                <ActionButton icon={Users}  label="MISSIONS" onClick={() => openLocalView('missions')}     color="text-indigo-400" desc="Multi-agent war room" />
                <ActionButton icon={PenLine} label="NOTES"   onClick={() => openLocalView('notes')}        color="text-amber-400"  desc="Context &amp; directives" />
                <ActionButton icon={Code2}  label="CODE"     onClick={() => openLocalView('code')}         color="text-jb-accent"  desc="IDE control panel" />
                <ActionButton icon={Layers} label="FLOW"     onClick={() => openLocalView('waterfall')}    color="text-jb-purple"  desc="Pipeline monitor" />
              </div>

              {/* Activity Feed */}
              <div className="flex-1 bg-black/40 rounded-xl border border-white/5 p-3 flex flex-col overflow-hidden min-h-0">
                <div className="text-[11px] font-black text-slate-600 uppercase tracking-widest mb-2 flex items-center gap-1.5">
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
                    activities.slice(0, 15).map((act: any, i: number) => (
                      <div key={i} className="text-[11px] leading-tight flex gap-2">
                        <span className={cn(
                          "font-black uppercase text-[6px] px-1 py-0.5 rounded-sm shrink-0 h-fit mt-0.5",
                          act.type === 'user_message' ? "bg-blue-500/20 text-blue-400" :
                          act.type === 'ai_code_update' ? "bg-emerald-500/20 text-emerald-400" :
                          act.type === 'waterfall' ? "bg-jb-purple/20 text-jb-purple" :
                          act.type === 'command' ? "bg-jb-orange/20 text-jb-orange" : "bg-white/10 text-white/50"
                        )}>{act.type === 'waterfall' ? 'flow' : String(act.type || '').replace('_', ' ').slice(0, 10)}</span>
                        <span className="text-slate-400/80 line-clamp-2 font-mono">
                          {act.content || act.detail || act.path || act.message || JSON.stringify(act)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* ─── WATERFALL ─── */}
          {view === 'waterfall' && (
            <motion.div
              key="waterfall" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex-1 flex flex-col overflow-y-auto no-scrollbar"
            >
              <div className="p-4"><WaterfallVisualizer /></div>
            </motion.div>
          )}

          {/* ─── NOTES ─── */}
          {view === 'notes' && (
            <motion.div
              key="notes" initial={{ opacity: 0, x: 5 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -5 }}
              className="flex-1 flex flex-col gap-2 p-3"
            >
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-black text-slate-600 uppercase tracking-widest">Your Notes</span>
                <button
                  onClick={() => { setNotepadContent(''); window.electron?.saveNotepad(''); }}
                  className="p-1 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={10} />
                </button>
              </div>
              <textarea
                value={notepadContent}
                onChange={(e) => { setNotepadContent(e.target.value); window.electron?.saveNotepad(e.target.value); }}
                className="flex-1 bg-black/20 border border-white/5 rounded-xl p-3 text-[11px] font-mono leading-relaxed outline-none resize-none text-slate-300 placeholder:text-slate-800"
                placeholder="Type your notes here..."
                spellCheck={false}
              />
            </motion.div>
          )}

          {/* ─── OVERSEER ─── */}
          {view === 'overseer' && (
            <motion.div
              key="overseer" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
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
                      onClick={() => triggerOverseer('manual_check')}
                      disabled={isThinking}
                      title="Think Now"
                      className="px-2 py-0.5 rounded-md text-[11px] font-black uppercase bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-all disabled:opacity-40"
                    >
                      {isThinking ? '...' : 'Think'}
                    </button>
                    <button
                      onClick={() => triggerOverseer('nudge_me')}
                      disabled={isThinking}
                      title="Ask for guidance"
                      className="px-2 py-0.5 rounded-md text-[11px] font-black uppercase bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-all disabled:opacity-40"
                    >
                      Nudge
                    </button>
                    <button
                      onClick={() => { setOverseerDecisions([]); setUnreadCount(0); }}
                      title="Clear decisions"
                      className="p-1 rounded-md text-slate-600 hover:text-rose-400 transition-all"
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
                <div className="text-[11px] font-black text-slate-600 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <div className="w-1 h-1 rounded-full bg-emerald-500/50 animate-pulse" />
                  <span>Decision Feed</span>
                  <span className="text-slate-700">({overseerDecisions.length})</span>
                </div>

                {overseerDecisions.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center opacity-20 gap-2">
                    <Shield size={28} strokeWidth={1} />
                    <span className="text-[11px] font-black uppercase">No decisions yet</span>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto space-y-2 no-scrollbar">
                    {overseerDecisions.map((d) => (
                      <div key={d.id} className="bg-black/30 border border-white/5 rounded-lg p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          {d.intervention?.needed && (
                            <span className={cn(
                              "text-[11px] font-black uppercase px-1.5 py-0.5 rounded border flex-shrink-0",
                              interventionColor[d.intervention.type] || interventionColor.suggestion
                            )}>
                              {d.intervention.type}
                            </span>
                          )}
                          <span className="text-[11px] text-slate-700 font-mono ml-auto flex-shrink-0">
                            {formatTime(d.timestamp)}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-relaxed line-clamp-4">
                          {d.decision}
                        </p>
                        {d.intervention?.message && d.intervention.message !== d.decision && (
                          <p className="text-[11px] text-slate-500 leading-relaxed border-t border-white/5 pt-2">
                            {d.intervention.message}
                          </p>
                        )}
                        {d.trigger && (
                          <span className="text-[6px] text-slate-700 font-mono uppercase">trigger: {d.trigger}</span>
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
          )}

          {/* ─── CODE CONTROL PANEL ─── */}
          {view === 'code' && (
            <motion.div
              key="code" initial={{ opacity: 0, x: 5 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -5 }}
              className="flex-1 flex flex-col p-3 gap-2 overflow-hidden"
            >
              {/* Status bar */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <Code2 size={12} className="text-jb-accent" />
                <span className="text-[11px] font-black uppercase tracking-widest text-jb-accent">IDE Control</span>
                <div className="flex-1" />
                {pendingDiff && (
                  <span className="px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[11px] font-black animate-pulse">
                    Diff pending
                  </span>
                )}
                {agentMessages.some(m => m.isStreaming) && (
                  <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-jb-accent/20 text-jb-accent text-[11px] font-black">
                    <Loader2 size={8} className="animate-spin" /> Agent active
                  </span>
                )}
                <button
                  onClick={() => launchInMainApp('coding')}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-black uppercase bg-jb-accent/10 text-jb-accent hover:bg-jb-accent/20 transition-all"
                  title="Open full IDE"
                >
                  Open IDE <ArrowRight size={8} />
                </button>
              </div>

              {/* Active file indicator */}
              {activeFile && (
                <div className="flex items-center gap-1.5 px-2 py-1.5 bg-black/30 rounded-lg border border-white/5 flex-shrink-0">
                  <FileText size={10} className="text-jb-accent/60 shrink-0" />
                  <span className="text-[11px] font-mono text-slate-400 truncate">{activeFile}</span>
                </div>
              )}

              {/* Open files list */}
              {openFiles.length > 0 && (
                <div className="flex-shrink-0 space-y-1">
                  <span className="text-[11px] font-black text-slate-600 uppercase tracking-widest ml-1">Open Files</span>
                  <div className="flex flex-wrap gap-1">
                    {openFiles.map((f) => {
                      const name = f.path.split('/').pop() || f.path;
                      const isActive = f.path === activeFile;
                      return (
                        <span
                          key={f.path}
                          className={cn(
                            'px-2 py-0.5 rounded-md text-[11px] font-mono border transition-all',
                            isActive
                              ? 'bg-jb-accent/15 border-jb-accent/30 text-jb-accent'
                              : 'bg-black/20 border-white/5 text-slate-500',
                          )}
                          title={f.path}
                        >
                          {name}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Pending diff card */}
              {pendingDiff && (
                <div className="flex-shrink-0 bg-amber-500/[0.04] border border-amber-500/15 rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Diff size={12} className="text-amber-400" />
                    <span className="text-[11px] font-black uppercase tracking-widest text-amber-400">Pending Diff</span>
                  </div>
                  <p className="text-[11px] font-mono text-slate-400 truncate">{pendingDiff.filePath}</p>
                  <p className="text-[11px] text-slate-500 line-clamp-2">{pendingDiff.description}</p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        // Apply diff: update the open file content to the modified version
                        const { openFiles: files, activeFile: af } = useAppStore.getState();
                        const updated = files.map(f =>
                          f.path === pendingDiff.filePath ? { ...f, content: pendingDiff.modified } : f
                        );
                        useAppStore.getState().setOpenFiles(updated);
                        clearPendingDiff();
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-black uppercase bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-all border border-emerald-500/20"
                    >
                      <Check size={9} /> Apply
                    </button>
                    <button
                      onClick={clearPendingDiff}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-black uppercase bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-all border border-rose-500/15"
                    >
                      <XCircle size={9} /> Reject
                    </button>
                  </div>
                </div>
              )}

              {/* Agent activity */}
              <div className="flex-shrink-0 max-h-[140px] overflow-hidden">
                <div className="text-[11px] font-black text-slate-600 uppercase tracking-widest mb-1.5 flex items-center gap-1.5 ml-1">
                  <MessageSquare size={8} />
                  <span>Agent Activity</span>
                  <span className="text-slate-700">({agentMessages.length})</span>
                </div>
                {agentMessages.length === 0 ? (
                  <div className="flex items-center justify-center py-3 opacity-20">
                    <span className="text-[11px] font-black uppercase">No agent activity</span>
                  </div>
                ) : (
                  <div className="space-y-1.5 overflow-y-auto max-h-[110px] no-scrollbar">
                    {agentMessages.slice(-3).map((msg) => (
                      <div
                        key={msg.id}
                        className={cn(
                          'rounded-lg px-2.5 py-1.5 border text-[11px]',
                          msg.role === 'user'
                            ? 'bg-jb-accent/[0.05] border-jb-accent/15 text-slate-400'
                            : 'bg-white/[0.02] border-white/5 text-slate-400',
                        )}
                      >
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={cn(
                            'text-[11px] font-black uppercase tracking-wider',
                            msg.role === 'user' ? 'text-jb-accent' : 'text-emerald-400',
                          )}>
                            {msg.role === 'user' ? 'You' : 'Agent'}
                          </span>
                          {msg.isStreaming && <Loader2 size={7} className="animate-spin text-jb-accent" />}
                          {msg.fileContext && (
                            <span className="text-[6px] text-slate-600 font-mono ml-auto truncate max-w-[120px]">
                              {msg.fileContext.split('/').pop()}
                            </span>
                          )}
                        </div>
                        <p className="line-clamp-2 leading-relaxed">{msg.content || (msg.isStreaming ? 'Thinking...' : '')}</p>
                        {/* Tool events summary */}
                        {msg.toolEvents && msg.toolEvents.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {msg.toolEvents
                              .filter(e => e.type === 'tool_start')
                              .slice(-4)
                              .map((e) => {
                                const hasResult = msg.toolEvents!.some(r => r.callId === e.callId && r.type === 'tool_result');
                                const hasError = msg.toolEvents!.some(r => r.callId === e.callId && r.type === 'tool_error');
                                const target = (e.args?.path as string)?.split('/').pop()
                                  || (e.args?.command as string)?.slice(0, 20)
                                  || e.tool;
                                return (
                                  <span
                                    key={e.callId}
                                    className={cn(
                                      'flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-mono border',
                                      hasError ? 'bg-rose-500/10 border-rose-500/15 text-rose-400' :
                                      hasResult ? 'bg-emerald-500/10 border-emerald-500/15 text-emerald-400' :
                                      'bg-white/5 border-white/10 text-slate-500',
                                    )}
                                  >
                                    {!hasResult && !hasError && <Loader2 size={7} className="animate-spin" />}
                                    {hasResult && <Check size={7} />}
                                    {hasError && <AlertCircle size={7} />}
                                    {target}
                                  </span>
                                );
                              })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Mini terminal */}
              <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                <div className="text-[11px] font-black text-slate-600 uppercase tracking-widest mb-1.5 flex items-center gap-1.5 ml-1">
                  <TerminalIcon size={8} />
                  <span>Terminal</span>
                  <span className="text-slate-700">({terminalLines.length})</span>
                  <button
                    onClick={clearTerminalLines}
                    className="ml-auto p-0.5 rounded text-slate-700 hover:text-rose-400 transition-colors"
                    title="Clear terminal"
                  >
                    <Trash2 size={8} />
                  </button>
                </div>
                <MiniTerminal lines={terminalLines} />
              </div>

              {/* Quick actions */}
              <div className="flex items-center gap-1.5 flex-shrink-0 pt-1 border-t border-white/5">
                <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider mr-1">Panels:</span>
                <TogglePill
                  icon={FolderOpen}
                  label="Tree"
                  active={fileTreeVisible}
                  onClick={() => setFileTreeVisible(!fileTreeVisible)}
                />
                <TogglePill
                  icon={MessageSquare}
                  label="Chat"
                  active={chatPanelVisible}
                  onClick={() => setChatPanelVisible(!chatPanelVisible)}
                />
                <TogglePill
                  icon={TerminalIcon}
                  label="Term"
                  active={terminalVisible}
                  onClick={() => setTerminalVisible(!terminalVisible)}
                />
              </div>
            </motion.div>
          )}

          {/* ─── MISSIONS ─── */}
          {view === 'missions' && (
            <motion.div
              key="missions" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }}
              className="flex-1 flex flex-col p-3 gap-3 overflow-hidden"
            >
              {/* Mission Launcher */}
              {(() => {
                const tmpl = MISSION_TEMPLATES.find(t => t.id === missionTemplate) ?? MISSION_TEMPLATES[0]!;
                return (
                  <div className={cn('rounded-xl p-3 space-y-3 flex-shrink-0 border', tmpl.cardCls)}>
                    <div className="flex items-center gap-2">
                      <Users size={12} className={tmpl.iconCls} />
                      <span className={cn('text-[11px] font-black uppercase tracking-widest', tmpl.headerCls)}>
                        Launch Mission
                      </span>
                    </div>
                    <textarea
                      value={missionGoal}
                      onChange={(e) => setMissionGoal(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) launchMission(); }}
                      placeholder="Define the mission goal..."
                      className="w-full bg-black/30 border border-white/5 rounded-lg px-3 py-2 text-[11px] font-mono outline-none resize-none text-slate-300 placeholder:text-slate-700 h-16"
                    />
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1 flex-1">
                        {MISSION_TEMPLATES.map(t => (
                          <button
                            key={t.id}
                            onClick={() => setMissionTemplate(t.id)}
                            className={cn(
                              'px-2 py-1 rounded-full text-[11px] font-black uppercase border transition-all',
                              missionTemplate === t.id ? t.activeCls : 'bg-white/[0.02] border-white/5 text-slate-600 hover:text-white',
                            )}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={launchMission}
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
                );
              })()}

              {/* Active Missions List */}
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="text-[11px] font-black text-slate-600 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <div className={cn("w-1 h-1 rounded-full", activeMissionCount > 0 ? "bg-indigo-500 animate-pulse" : "bg-slate-700")} />
                  <span>Active Missions</span>
                  <span className="text-slate-700">({activeMissions.length})</span>
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
                        onClick={() => setExpandedMission(expandedMission === m.jobId ? null : m.jobId)}
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
                                "bg-slate-700/40 text-slate-500"
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
                                <span className="text-[11px] font-black uppercase tracking-wider text-slate-600">
                                  {phaseLabel(m.progress, m.status)}
                                </span>
                                <span className="text-[11px] text-slate-700 font-mono">{m.progress}%</span>
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
                        {expandedMission === m.jobId && m.result && (
                          <div className="border-t border-white/5 p-3 space-y-3">
                            {m.result.expertOpinions && (
                              <div className="space-y-2">
                                <span className="text-[11px] font-black uppercase tracking-widest text-slate-600 block">
                                  Expert Analysis
                                </span>
                                {m.result.expertOpinions.map((op: any, i: number) => {
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
                            {m.result.synthesis && (
                              <div className="glass-panel rounded-xl p-3">
                                <h4 className="text-[11px] font-black mb-1.5">
                                  <span className="text-vibrant">Synthesis</span>
                                </h4>
                                <p className="text-[11px] text-slate-400 leading-relaxed">{m.result.synthesis}</p>
                              </div>
                            )}
                          </div>
                        )}

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
          )}

        </AnimatePresence>
      </div>

    </div>
  );
};
