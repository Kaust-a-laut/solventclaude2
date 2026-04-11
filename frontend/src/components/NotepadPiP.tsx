import React, { useEffect, useState, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import {
  X, LayoutGrid, ExternalLink,
  Settings, Brain, Sparkles,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchWithRetry } from '../lib/api-client';
import { API_BASE_URL } from '../lib/config';
import { socket } from '../lib/socket';

import { LocalOverseerDecision, LocalActiveMission } from './pip/types';
import { PipDashView } from './pip/PipDashView';
import { PipNotesView } from './pip/PipNotesView';
import { PipOverseerView } from './pip/PipOverseerView';
import { PipMissionsView } from './pip/PipMissionsView';
import { PipWaterfallView } from './pip/PipWaterfallView';
import { PipCodeView } from './pip/PipCodeView';
import { PipIntelView } from './pip/PipIntelView';

type PipView = 'dash' | 'notes' | 'overseer' | 'missions' | 'waterfall' | 'code' | 'intel';

export const NotepadPiP = ({ onClose, onDetach }: { onClose?: () => void; onDetach?: () => void } = {}) => {
  const {
    notepadContent, setNotepadContent, supervisorInsight, setSupervisorInsight,
    thinkingModeEnabled, setThinkingModeEnabled, auraMode, setAuraMode,
    globalProvider, setGlobalProvider, setCurrentMode, activities,
    messages, waterfall, waterfallAbortController,
    terminalLines, clearTerminalLines, agentMessages,
    pendingDiff, clearPendingDiff,
    openFiles, activeFile,
    fileTreeVisible, setFileTreeVisible,
    chatPanelVisible, setChatPanelVisible,
    terminalVisible, setTerminalVisible,
    intelAmbientContext, intelPanelContent,
  } = useAppStore();

  const [view, setView] = useState<PipView>('dash');
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
    const handleOverseerDecision = (d: Record<string, unknown>) => {
      const decision: LocalOverseerDecision = {
        id: (d.id as string) || `od_${Date.now()}`,
        decision: (d.decision as string) || (d.message as string) || JSON.stringify(d),
        intervention: d.intervention as LocalOverseerDecision['intervention'],
        timestamp: (d.timestamp as number) || Date.now(),
        trigger: d.trigger as string | undefined,
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

    const handleMissionComplete = ({ jobId, result }: { jobId: string; result: unknown }) => {
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
      let enrichedNotepad = notepadContent;
      if (intelAmbientContext && intelPanelContent.type !== 'idle') {
        if (intelPanelContent.type === 'reader' && intelPanelContent.pageContent) {
          enrichedNotepad += `\n\n--- Intel Context ---\n${intelPanelContent.pageContent.title}: ${intelPanelContent.pageContent.content.slice(0, 1000)}`;
        } else if (intelPanelContent.type === 'search' && intelPanelContent.searchResults?.synthesis) {
          enrichedNotepad += `\n\n--- Intel Context ---\nSearch "${intelPanelContent.query}": ${intelPanelContent.searchResults.synthesis.answer.slice(0, 500)}`;
        }
      }
      await fetchWithRetry(`${API_BASE_URL}/overseer/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          focus: focus || 'manual_check',
          notepadContent: enrichedNotepad,
          recentMessages: messages.slice(-8),
        }),
        retries: 1,
      });
    } catch { /* non-fatal */ }
    finally { setIsThinking(false); }
  }, [notepadContent, messages, intelAmbientContext, intelPanelContent]);

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

  const openLocalView = (v: PipView) => setView(v);
  const launchInMainApp = (mode: string) => setCurrentMode(mode);

  const activeMissionCount = activeMissions.filter(m => m.status === 'queued' || m.status === 'active').length;

  void isCompact; // reserved for future compact mode UI

  return (
    <div className={cn(
      "h-full w-full flex flex-col bg-[#050508] text-slate-300 border border-white/10 overflow-hidden font-sans transition-all duration-300",
      isCompact ? "p-1" : "p-0"
    )}>
      {/* Header */}
      <div
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
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

        <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          {view !== 'dash' && (
            <button
              onClick={() => openLocalView('dash')}
              className="p-1.5 rounded-md text-slate-400 hover:text-white transition-all"
              title="Dashboard"
            >
              <LayoutGrid size={12} />
            </button>
          )}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={cn("p-1.5 rounded-md transition-all", showSettings ? "text-white bg-white/10" : "text-slate-400 hover:text-white")}
            title="Settings"
          >
            <Settings size={12} />
          </button>
          {onDetach && (
            <button
              onClick={onDetach}
              className="p-1.5 rounded-md text-slate-400 hover:text-jb-orange transition-all"
              title="Detach to floating window"
            >
              <ExternalLink size={12} />
            </button>
          )}
          <button
            onClick={() => onClose ? onClose() : window.close()}
            className="p-1.5 text-slate-400 hover:text-red-400 transition-all"
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
                    thinkingModeEnabled ? "bg-jb-purple/20 text-jb-purple" : "bg-white/5 text-slate-300 hover:text-white"
                  )}
                >
                  <div className="flex items-center gap-2"><Brain size={12} /><span>Deep Thinking</span></div>
                  <div className={cn("w-2 h-2 rounded-full", thinkingModeEnabled ? "bg-jb-purple shadow-[0_0_8px_rgba(157,91,210,1)]" : "bg-slate-800")} />
                </button>
                <button
                  onClick={() => setAuraMode(auraMode === 'off' ? 'organic' : 'off')}
                  className={cn(
                    "w-full flex items-center justify-between p-2 rounded-lg text-[11px] font-black uppercase transition-all",
                    auraMode !== 'off' ? "bg-jb-orange/20 text-jb-orange" : "bg-white/5 text-slate-300 hover:text-white"
                  )}
                >
                  <div className="flex items-center gap-2"><Sparkles size={12} /><span>Visual Effects</span></div>
                  <div className={cn("w-2 h-2 rounded-full", auraMode !== 'off' ? "bg-jb-orange shadow-[0_0_8px_rgba(251,146,60,1)]" : "bg-slate-800")} />
                </button>
                <div className="pt-2 mt-2 border-t border-white/5 flex flex-col gap-1">
                  <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">AI Provider</span>
                  <div className="flex gap-1">
                    {(['cloud', 'local', 'auto'] as const).map(p => (
                      <button
                        key={p}
                        onClick={() => setGlobalProvider(p)}
                        className={cn(
                          "flex-1 py-1.5 rounded-md text-[11px] font-black uppercase transition-all border",
                          globalProvider === p ? "bg-white text-black border-white" : "bg-black/40 text-slate-300 border-white/5 hover:border-white/20"
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
          {view === 'dash' && (
            <PipDashView
              waterfall={waterfall}
              waterfallAbortController={waterfallAbortController}
              activities={activities}
              supervisorInsight={supervisorInsight}
              overseerDecisions={overseerDecisions}
              isThinking={isThinking}
              onOpenView={openLocalView}
              onTriggerOverseer={triggerOverseer}
            />
          )}

          {view === 'waterfall' && <PipWaterfallView />}

          {view === 'notes' && (
            <PipNotesView
              notepadContent={notepadContent}
              onContentChange={setNotepadContent}
            />
          )}

          {view === 'overseer' && (
            <PipOverseerView
              decisions={overseerDecisions}
              isThinking={isThinking}
              supervisorInsight={supervisorInsight}
              onTrigger={triggerOverseer}
              onClearDecisions={() => { setOverseerDecisions([]); setUnreadCount(0); }}
            />
          )}

          {view === 'code' && (
            <PipCodeView
              terminalLines={terminalLines}
              pendingDiff={pendingDiff}
              openFiles={openFiles}
              activeFile={activeFile}
              fileTreeVisible={fileTreeVisible}
              chatPanelVisible={chatPanelVisible}
              terminalVisible={terminalVisible}
              agentMessages={agentMessages}
              onSetFileTreeVisible={setFileTreeVisible}
              onSetChatPanelVisible={setChatPanelVisible}
              onSetTerminalVisible={setTerminalVisible}
              onClearDiff={clearPendingDiff}
              onClearTerminal={clearTerminalLines}
              onLaunchMain={launchInMainApp}
            />
          )}

          {view === 'missions' && (
            <PipMissionsView
              activeMissions={activeMissions}
              activeMissionCount={activeMissionCount}
              missionGoal={missionGoal}
              missionTemplate={missionTemplate}
              launchingMission={launchingMission}
              expandedMission={expandedMission}
              onGoalChange={setMissionGoal}
              onTemplateChange={setMissionTemplate}
              onLaunch={launchMission}
              onToggleExpand={setExpandedMission}
            />
          )}

          {view === 'intel' && <PipIntelView />}
        </AnimatePresence>
      </div>
    </div>
  );
};
