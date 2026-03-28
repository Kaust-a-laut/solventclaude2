import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  Users, ShieldAlert, Code2, Briefcase, Play, Loader2,
  CheckCircle2, XCircle, RotateCcw, Swords, Zap, GitMerge,
  Search, BarChart2, AlertTriangle, Layers, StopCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { useAppStore } from '../store/useAppStore';
import type { AgentConfig } from './collaborate/AgentCard';
import { AgentRoster } from './collaborate/AgentRoster';
import { ConversationFeed } from './collaborate/ConversationFeed';
import { UserInterjectionInput } from './collaborate/UserInterjectionInput';
import { MissionHistory } from './collaborate/MissionHistory';
import { AnalysisPanel } from './collaborate/AnalysisPanel';
import type { AnalysisStatus } from './collaborate/AnalysisPanel';
import { fetchWithRetry } from '../lib/api-client';
import { API_BASE_URL } from '../lib/config';

// ─── Agent configs (reused from before) ──────────────────────────────────────

const AGENT_CONFIGS: Record<string, AgentConfig[]> = {
  consultation: [
    {
      role: 'pm', displayName: 'PRODUCT MANAGER', icon: Briefcase,
      color: 'jb-purple', borderColor: 'border-jb-purple',
      bgColor: 'bg-jb-purple/10', textColor: 'text-jb-purple',
      glowRgba: 'rgba(157,91,210,0.25)', borderRgba: 'rgba(157,91,210,',
    },
    {
      role: 'engineer', displayName: 'LEAD ENGINEER', icon: Code2,
      color: 'jb-accent', borderColor: 'border-jb-accent',
      bgColor: 'bg-jb-accent/10', textColor: 'text-jb-accent',
      glowRgba: 'rgba(60,113,247,0.25)', borderRgba: 'rgba(60,113,247,',
    },
    {
      role: 'security', displayName: 'SECURITY AUDITOR', icon: ShieldAlert,
      color: 'jb-orange', borderColor: 'border-jb-orange',
      bgColor: 'bg-jb-orange/10', textColor: 'text-jb-orange',
      glowRgba: 'rgba(251,146,60,0.25)', borderRgba: 'rgba(251,146,60,',
    },
  ],
  refinement: [
    {
      role: 'critic', displayName: 'ADVERSARIAL CRITIC', icon: Swords,
      color: 'jb-orange', borderColor: 'border-jb-orange',
      bgColor: 'bg-jb-orange/10', textColor: 'text-jb-orange',
      glowRgba: 'rgba(251,146,60,0.25)', borderRgba: 'rgba(251,146,60,',
    },
    {
      role: 'optimist', displayName: 'OPTIMIZER', icon: Zap,
      color: 'jb-accent', borderColor: 'border-jb-accent',
      bgColor: 'bg-jb-accent/10', textColor: 'text-jb-accent',
      glowRgba: 'rgba(60,113,247,0.25)', borderRgba: 'rgba(60,113,247,',
    },
    {
      role: 'synthesizer', displayName: 'SYNTHESIZER', icon: GitMerge,
      color: 'jb-purple', borderColor: 'border-jb-purple',
      bgColor: 'bg-jb-purple/10', textColor: 'text-jb-purple',
      glowRgba: 'rgba(157,91,210,0.25)', borderRgba: 'rgba(157,91,210,',
    },
  ],
  research: [
    {
      role: 'researcher', displayName: 'RESEARCHER', icon: Search,
      color: 'emerald-500', borderColor: 'border-emerald-500',
      bgColor: 'bg-emerald-500/10', textColor: 'text-emerald-400',
      glowRgba: 'rgba(16,185,129,0.25)', borderRgba: 'rgba(16,185,129,',
    },
    {
      role: 'analyst', displayName: 'ANALYST', icon: BarChart2,
      color: 'jb-accent', borderColor: 'border-jb-accent',
      bgColor: 'bg-jb-accent/10', textColor: 'text-jb-accent',
      glowRgba: 'rgba(60,113,247,0.25)', borderRgba: 'rgba(60,113,247,',
    },
    {
      role: 'devil', displayName: "DEVIL'S ADVOCATE", icon: AlertTriangle,
      color: 'jb-orange', borderColor: 'border-jb-orange',
      bgColor: 'bg-jb-orange/10', textColor: 'text-jb-orange',
      glowRgba: 'rgba(251,146,60,0.25)', borderRgba: 'rgba(251,146,60,',
    },
  ],
  'code-review': [
    {
      role: 'architect', displayName: 'ARCHITECT', icon: Layers,
      color: 'jb-purple', borderColor: 'border-jb-purple',
      bgColor: 'bg-jb-purple/10', textColor: 'text-jb-purple',
      glowRgba: 'rgba(157,91,210,0.25)', borderRgba: 'rgba(157,91,210,',
    },
    {
      role: 'reviewer', displayName: 'CODE REVIEWER', icon: Code2,
      color: 'jb-accent', borderColor: 'border-jb-accent',
      bgColor: 'bg-jb-accent/10', textColor: 'text-jb-accent',
      glowRgba: 'rgba(60,113,247,0.25)', borderRgba: 'rgba(60,113,247,',
    },
    {
      role: 'security', displayName: 'SECURITY AUDITOR', icon: ShieldAlert,
      color: 'jb-orange', borderColor: 'border-jb-orange',
      bgColor: 'bg-jb-orange/10', textColor: 'text-jb-orange',
      glowRgba: 'rgba(251,146,60,0.25)', borderRgba: 'rgba(251,146,60,',
    },
  ],
};

// ─── Mission templates ───────────────────────────────────────────────────────

const MISSION_TEMPLATES = [
  { id: 'consultation', label: 'Consultation', description: 'PM + Engineer + Security review',
    activeCls: 'bg-jb-purple/15 border-jb-purple/40 text-jb-purple' },
  { id: 'refinement',   label: 'Refinement',   description: 'Adversarial critic + optimizer',
    activeCls: 'bg-jb-accent/15 border-jb-accent/40 text-jb-accent' },
  { id: 'research',     label: 'Research',     description: "Researcher + Analyst + Devil's Advocate",
    activeCls: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400' },
  { id: 'code-review',  label: 'Code Review',  description: 'Architect + Code Reviewer + Security',
    activeCls: 'bg-jb-orange/15 border-jb-orange/40 text-jb-orange' },
];

// ─── Component ──────────────────────────────────────────────────────────────

export const CollaborateArea = () => {
  const [goalInput, setGoalInput] = useState('');
  const [missionType, setMissionType] = useState('consultation');
  const [showHistory, setShowHistory] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus>('awaiting');
  const [analysis, setAnalysis] = useState('');
  const [hoveredAgentId, setHoveredAgentId] = useState<string | null>(null);
  const [visibleAgentIds, setVisibleAgentIds] = useState<Set<string>>(new Set());
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const {
    collaborate,
    startConversation,
    injectUserMessage,
    triggerSynthesizeNow,
    cancelConversation,
    resetConversation,
    activeMissions,
  } = useAppStore();

  const {
    status,
    agents,
    messages,
    synthesis,
    currentRound,
    consensusScore,
    activeAgentId,
    goal,
    error,
  } = collaborate;

  const agentConfigs = AGENT_CONFIGS[missionType] ?? AGENT_CONFIGS['consultation'] ?? [];
  const isIdle = status === 'idle';
  const isActive = status === 'active' || status === 'converging';
  const isSynthesizing = status === 'synthesizing';
  const isComplete = status === 'complete';
  const isFailed = status === 'failed';
  const isRunning = isActive || isSynthesizing;
  const maxRounds = Math.max(3, agentConfigs.length);

  // ── Launch ─────────────────────────────────────────────────────────────────

  const handleLaunch = () => {
    if (!goalInput.trim()) return;
    setAnalysisStatus('awaiting');
    setAnalysis('');
    startConversation(goalInput.trim(), missionType);
  };

  const handleReset = () => {
    resetConversation();
    setGoalInput('');
    setAnalysisStatus('awaiting');
    setAnalysis('');
    setHoveredAgentId(null);
    setVisibleAgentIds(new Set());
  };

  // ── Analysis (post-conversation deeper pass) ──────────────────────────────

  const handleAnalyze = async (userContext: string) => {
    setAnalysisStatus('analyzing');
    try {
      const opinions = messages
        .filter(m => m.agentId !== 'user')
        .map(m => ({ id: m.agentId, agent: m.agentName, role: m.agentId, opinion: m.content }));
      const data = await fetchWithRetry(`${API_BASE_URL}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opinions, synthesis, userContext, missionType }),
      });
      setAnalysis((data as { analysis: string }).analysis);
      setAnalysisStatus('complete');
    } catch {
      setAnalysisStatus('ready');
    }
  };

  // ── Analysis status transitions ────────────────────────────────────────────

  React.useEffect(() => {
    if (isComplete) setAnalysisStatus('ready');
  }, [isComplete]);

  // ── Callbacks for spatial anchoring ────────────────────────────────────────

  const handleVisibleAgentsChange = useCallback((ids: Set<string>) => {
    setVisibleAgentIds(ids);
  }, []);

  const handleAgentHover = useCallback((agentId: string | null) => {
    setHoveredAgentId(agentId);
  }, []);

  // ── Ambient glow color (derived from active/last speaking agent) ───────────

  const getConfig = (agentId: string) =>
    agentConfigs.find(c => c.role === agentId);

  const ambientGlowColor = useMemo(() => {
    const targetId = activeAgentId
      ?? [...messages].reverse().find(m => m.agentId !== 'user')?.agentId;
    if (!targetId) return 'rgba(157,91,210,0.06)';
    const config = getConfig(targetId);
    if (!config?.borderRgba) return 'rgba(157,91,210,0.06)';
    return `${config.borderRgba}0.06)`;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAgentId, messages.length, agentConfigs]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
      {/* Dot-grid texture overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.035] z-0"
        style={{
          backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />

      {isIdle ? (
        /* ── IDLE: Hero Layout ─────────────────────────────────────────── */
        <div className="flex-1 flex flex-col items-center justify-center gap-8 p-6 relative z-10">
          {/* Glow orb behind input */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-80 h-80 rounded-full bg-jb-purple/[0.08] blur-[80px]" />
          </div>

          {/* Heading */}
          <div className="text-center relative z-10">
            <div className="flex items-center justify-center gap-3 mb-3">
              <div className="relative">
                <div className="p-2.5 bg-jb-purple/10 border border-jb-purple/20 rounded-2xl">
                  <Users className="text-jb-purple" size={22} />
                </div>
                <span
                  className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-jb-purple"
                  style={{ boxShadow: '0 0 6px rgba(157,91,210,0.8)' }}
                />
              </div>
            </div>
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-1">
              Multi-Agent Orchestration Engine
            </p>
            <h2 className="text-3xl font-black text-white tracking-tight">
              Agentic <span className="text-vibrant">War Room</span>
            </h2>
            <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">
              Launch a roundtable of specialized AI agents to analyze, debate, and synthesize around your goal.
            </p>
          </div>

          {/* Mission launcher panel */}
          <div className="glass-panel rounded-[1.5rem] p-5 space-y-4 w-full max-w-2xl relative z-10">
            <textarea
              value={goalInput}
              onChange={(e) => setGoalInput(e.target.value)}
              placeholder="Define the engineering mission goal..."
              className="w-full bg-transparent text-slate-300 outline-none resize-none h-28 text-base font-medium placeholder:text-slate-700"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleLaunch();
                }
              }}
            />
            <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-white/5">
              <span className="text-[11px] text-slate-600 uppercase tracking-widest font-black">Template:</span>
              {MISSION_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setMissionType(t.id)}
                  title={t.description}
                  className={cn(
                    'px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider border transition-all',
                    missionType === t.id
                      ? t.activeCls
                      : 'bg-white/5 border-white/10 text-slate-500 hover:text-slate-300',
                  )}
                >
                  {t.label}
                </button>
              ))}

              {/* Launch button inline */}
              <button
                onClick={handleLaunch}
                disabled={!goalInput.trim()}
                className={cn(
                  'ml-auto flex items-center gap-2 px-5 py-2 text-white text-[11px] font-black rounded-full transition-all uppercase tracking-wider',
                  'bg-gradient-to-r from-jb-purple to-jb-accent disabled:opacity-40',
                  goalInput.trim() && 'shadow-[0_0_20px_rgba(157,91,210,0.35)] hover:shadow-[0_0_28px_rgba(157,91,210,0.5)]',
                )}
              >
                <Play size={13} fill="currentColor" /> Launch Mission
              </button>
            </div>
          </div>

          {/* Mission History */}
          <div className="w-full max-w-2xl relative z-10">
            <MissionHistory
              missions={activeMissions}
              isOpen={showHistory}
              onToggle={() => setShowHistory((v) => !v)}
            />
          </div>
        </div>
      ) : (
        /* ── ACTIVE: Flat Layout (no extra nesting) ──────────────────── */
        <>
          {/* ── Goal bar — fixed ──────────────────────────────────────── */}
          <div className="flex-shrink-0 relative z-10 px-6 pt-6">
            <div className="max-w-5xl mx-auto w-full">
              <div className="glass-panel rounded-2xl px-4 py-2.5 flex items-center gap-3">
                <span className="text-[11px] text-slate-600 uppercase tracking-widest font-black">Goal:</span>
                <span className="text-sm text-slate-300 flex-1 truncate">{goal || goalInput}</span>
                <div className="flex items-center gap-1.5">
                  {isComplete && <CheckCircle2 size={12} className="text-emerald-400" />}
                  {isFailed && <XCircle size={12} className="text-rose-400" />}
                  {isRunning && <Loader2 size={12} className="animate-spin text-jb-purple" />}
                  <span className={cn(
                    'text-[11px] font-black uppercase tracking-wider',
                    isComplete ? 'text-emerald-400'
                      : isFailed ? 'text-rose-400'
                      : isSynthesizing ? 'text-jb-purple'
                      : 'text-slate-500',
                  )}>
                    {isFailed ? (error || 'Failed') : isSynthesizing ? 'Synthesizing...' : isComplete ? 'Complete' : 'Active'}
                  </span>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 ml-2">
                  {(isComplete || isFailed) && (
                    <button
                      onClick={handleReset}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 hover:bg-white/10 text-slate-400 text-[11px] font-bold rounded-full transition-all uppercase tracking-wider"
                    >
                      <RotateCcw size={11} /> New Mission
                    </button>
                  )}
                  {isRunning && (
                    <button
                      onClick={cancelConversation}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-400 text-[11px] font-bold rounded-full transition-all uppercase tracking-wider"
                    >
                      <StopCircle size={11} /> Cancel
                    </button>
                  )}
                  {isActive && messages.length >= agentConfigs.length && (
                    <button
                      onClick={triggerSynthesizeNow}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/25 hover:bg-emerald-500/20 text-emerald-400 text-[11px] font-bold rounded-full transition-all uppercase tracking-wider"
                    >
                      <GitMerge size={11} /> Synthesize Now
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── Agent Roster — fixed ──────────────────────────────────── */}
          {agents.length > 0 && (
            <div className="flex-shrink-0 relative z-10 px-6 pt-4">
              <div className="max-w-5xl mx-auto w-full">
                <AgentRoster
                  agents={agents}
                  agentConfigs={agentConfigs}
                  activeAgentId={activeAgentId}
                  currentRound={currentRound}
                  maxRounds={maxRounds}
                  consensusScore={consensusScore}
                  status={status}
                  visibleAgentIds={visibleAgentIds}
                  onAgentHover={handleAgentHover}
                />
              </div>
            </div>
          )}

          {/* ── Messages — SCROLLABLE (HomeArea pattern) ──────────────── */}
          <div className="flex-1 min-h-0 relative z-10">
            {/* Ambient glow — stays fixed while messages scroll */}
            <motion.div
              className="absolute inset-0 pointer-events-none z-0"
              animate={{
                background: `radial-gradient(ellipse at 50% 80%, ${ambientGlowColor} 0%, transparent 70%)`,
              }}
              transition={{ duration: 1.5, ease: 'easeInOut' }}
            />
            {/* Scroll container — exact HomeArea pattern */}
            <div
              ref={scrollContainerRef}
              className="absolute inset-0 overflow-y-scroll scrollbar-thin z-10"
            >
              <div className="max-w-5xl mx-auto w-full px-6 py-4">
                <ConversationFeed
                  messages={messages}
                  agentConfigs={agentConfigs}
                  activeAgentId={activeAgentId}
                  status={status}
                  hoveredAgentId={hoveredAgentId}
                  scrollContainerRef={scrollContainerRef}
                  onVisibleAgentsChange={handleVisibleAgentsChange}
                />

                {/* ── Synthesis Panel (inside scroll) ──────────────────── */}
                <AnimatePresence>
                  {synthesis && (
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5 }}
                      className="mt-4"
                    >
                      <div className="glass-panel rounded-[1.5rem] p-5 border-l-4 border-emerald-500/60">
                        <div className="flex items-center gap-2 mb-3">
                          <GitMerge size={14} className="text-emerald-400" />
                          <span className="text-[11px] font-black uppercase tracking-widest text-emerald-400">
                            Consensus Synthesis
                          </span>
                        </div>
                        <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                          {synthesis}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* ── Analysis Panel (inside scroll) ───────────────────── */}
                <AnimatePresence>
                  {isComplete && (
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 12 }}
                      transition={{ duration: 0.4 }}
                      className="mt-4"
                    >
                      <AnalysisPanel
                        status={analysisStatus}
                        analysis={analysis}
                        onAnalyze={handleAnalyze}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* ── User Interjection Input — fixed at bottom ─────────────── */}
          {isActive && (
            <div className="flex-shrink-0 relative z-10 px-6 pb-2">
              <div className="max-w-5xl mx-auto w-full">
                <UserInterjectionInput
                  onSend={injectUserMessage}
                  disabled={!!activeAgentId}
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
