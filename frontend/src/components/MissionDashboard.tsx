import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, Users, Clock, Cpu, Brain, MessageSquare,
  CheckCircle, AlertCircle, Hourglass, Zap, TrendingUp
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { api } from '../lib/api';
import { ErrorBoundary } from './ErrorBoundary';

interface AgentContribution {
  agent: string;
  tokenCount: number;
  messageCount: number;
  role?: string;
  status?: 'thinking' | 'speaking' | 'waiting';
}

interface MissionProgress {
  jobId: string;
  progress: number; // 0-100
  currentAgent?: { name: string; role: string };
  phase?: 'thinking' | 'speaking' | 'synthesizing';
  roundNumber?: number;
  totalRounds?: number;
  tokensUsed?: { in: number; out: number };
  agentContributions?: AgentContribution[];
  startedAt?: number;
  status: 'queued' | 'active' | 'complete' | 'failed';
}

interface ConsensusHistory {
  score: number;
  timestamp: number;
}

export const MissionDashboard: React.FC = () => {
  const [activeMission, setActiveMission] = useState<MissionProgress | null>(null);
  const [consensusHistory, setConsensusHistory] = useState<ConsensusHistory[]>([]);
  const [elapsedTime, setElapsedTime] = useState(0);
  const { currentMode } = useAppStore();

  // Poll for mission progress
  useEffect(() => {
    const fetchMissionStatus = async () => {
      try {
        // In a real implementation, this would call a backend endpoint
        // For now, we'll listen to socket events
      } catch (error) {
        console.error('[MissionDashboard] Failed to fetch mission status:', error);
      }
    };

    fetchMissionStatus();
    const interval = setInterval(fetchMissionStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  // Listen for MISSION_PROGRESS socket events
  useEffect(() => {
    const socket = (window as any).socket;
    if (!socket) return;

    const handleMissionProgress = (data: MissionProgress) => {
      setActiveMission(prev => ({
        ...prev,
        ...data,
        agentContributions: data.agentContributions || prev?.agentContributions || []
      }));

      // Update consensus score if available
      if (data.progress !== undefined) {
        setConsensusHistory(prev => [
          ...prev.slice(-19), // Keep last 20
          { score: data.progress, timestamp: Date.now() }
        ]);
      }
    };

    socket.on('MISSION_PROGRESS', handleMissionProgress);
    return () => { socket.off('MISSION_PROGRESS', handleMissionProgress); };
  }, []);

  // Update elapsed time
  useEffect(() => {
    if (!activeMission?.startedAt) return;

    const timer = setInterval(() => {
      setElapsedTime(Date.now() - (activeMission.startedAt || Date.now()));
    }, 1000);

    return () => clearInterval(timer);
  }, [activeMission?.startedAt]);

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  const getConsensusLabel = (score: number) => {
    if (score >= 80) return 'Consensus';
    if (score >= 60) return 'Converging';
    if (score >= 30) return 'Debating';
    return 'Divergent';
  };

  const getConsensusColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400';
    if (score >= 60) return 'text-blue-400';
    if (score >= 30) return 'text-amber-400';
    return 'text-rose-400';
  };

  const getPhaseIcon = (phase?: string) => {
    switch (phase) {
      case 'thinking': return <Brain size={14} className="text-purple-400" />;
      case 'speaking': return <MessageSquare size={14} className="text-blue-400" />;
      case 'synthesizing': return <Activity size={14} className="text-emerald-400" />;
      default: return <Hourglass size={14} className="text-slate-400" />;
    }
  };

  const getAgentStatusColor = (status?: string) => {
    switch (status) {
      case 'thinking': return 'bg-purple-500/20 border-purple-500/30 text-purple-400';
      case 'speaking': return 'bg-blue-500/20 border-blue-500/30 text-blue-400';
      case 'waiting': return 'bg-slate-500/20 border-slate-500/30 text-slate-400';
      default: return 'bg-white/5 border-white/10 text-slate-300';
    }
  };

  if (!activeMission) {
    return (
      <ErrorBoundary>
        <div className="fixed top-4 right-4 z-40 w-80">
          <div className="bg-black/95 backdrop-blur-2xl border border-white/10 rounded-2xl p-4">
            <div className="flex items-center gap-3 text-slate-500">
              <Activity size={18} className="animate-pulse" />
              <span className="text-[11px] font-black uppercase tracking-widest">No Active Mission</span>
            </div>
          </div>
        </div>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div className="fixed top-4 right-4 z-40 w-96 max-h-[80vh] overflow-y-auto">
        <div className="bg-black/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-white/5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity size={16} className="text-jb-accent" />
              <span className="text-[11px] font-black uppercase tracking-widest text-white">Mission Control</span>
            </div>
            <span className={`text-[11px] font-mono px-2 py-0.5 rounded ${
              activeMission.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' :
              activeMission.status === 'failed' ? 'bg-rose-500/20 text-rose-400' :
              'bg-slate-500/20 text-slate-400'
            }`}>
              {activeMission.status?.toUpperCase() || 'ACTIVE'}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="relative h-1.5 bg-white/5 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${activeMission.progress || 0}%` }}
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-jb-accent to-purple-500"
            />
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[11px] font-mono text-slate-500">{activeMission.progress || 0}% complete</span>
            <span className="text-[11px] font-mono text-slate-500">{formatTime(elapsedTime)}</span>
          </div>
        </div>

        {/* Current Agent */}
        {activeMission.currentAgent && (
          <div className="p-4 border-b border-white/5">
            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2">
              <Cpu size={10} />
              Current Agent
            </div>
            <div className="flex items-center gap-3 p-2 bg-white/5 rounded-lg">
              <div className={`w-8 h-8 rounded-lg border flex items-center justify-center ${getAgentStatusColor(activeMission.phase)}`}>
                {getPhaseIcon(activeMission.phase)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-white truncate">{activeMission.currentAgent.name}</p>
                <p className="text-[11px] text-slate-500">{activeMission.currentAgent.role}</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-mono text-slate-500">Round {activeMission.roundNumber || 1}/{activeMission.totalRounds || '?'}</p>
              </div>
            </div>
          </div>
        )}

        {/* Consensus Meter */}
        <div className="p-4 border-b border-white/5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500">
              <TrendingUp size={10} />
              Consensus
            </div>
            <span className={`text-[11px] font-bold ${getConsensusColor(activeMission.progress || 0)}`}>
              {getConsensusLabel(activeMission.progress || 0)}
            </span>
          </div>
          
          {/* Gauge */}
          <div className="relative h-2 bg-gradient-to-r from-rose-500/20 via-amber-500/20 via-blue-500/20 to-emerald-500/20 rounded-full">
            <motion.div
              initial={{ left: 0 }}
              animate={{ left: `${Math.min(100, Math.max(0, (activeMission.progress || 0) - 5))}%` }}
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border-2 border-jb-accent shadow-lg"
            />
          </div>
          
          {/* Sparkline */}
          {consensusHistory.length > 1 && (
            <div className="flex items-end gap-0.5 h-8 mt-2">
              {consensusHistory.map((point, i) => (
                <div
                  key={i}
                  className="flex-1 bg-jb-accent/30 rounded-t"
                  style={{ height: `${point.score}%` }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Agent Activity Timeline */}
        {activeMission.agentContributions && activeMission.agentContributions.length > 0 && (
          <div className="p-4 border-b border-white/5">
            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500 mb-3">
              <Users size={10} />
              Agent Activity
            </div>
            <div className="space-y-1.5">
              {activeMission.agentContributions.map((agent, i) => (
                <div
                  key={agent.agent}
                  className="flex items-center gap-2 p-2 bg-white/5 rounded-lg"
                >
                  <div className={`w-6 h-6 rounded border flex items-center justify-center text-[11px] font-bold ${getAgentStatusColor(agent.status)}`}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-white truncate">{agent.agent}</p>
                    <p className="text-[11px] text-slate-500">{agent.messageCount} messages</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-mono text-slate-400">{formatNumber(agent.tokenCount)} tokens</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Resource Usage */}
        {activeMission.tokensUsed && (
          <div className="p-4">
            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500 mb-3">
              <Zap size={10} />
              Resources
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 bg-white/5 rounded-lg">
                <p className="text-[11px] text-slate-500 uppercase">Tokens In</p>
                <p className="text-[11px] font-mono text-white">{formatNumber(activeMission.tokensUsed.in || 0)}</p>
              </div>
              <div className="p-2 bg-white/5 rounded-lg">
                <p className="text-[11px] text-slate-500 uppercase">Tokens Out</p>
                <p className="text-[11px] font-mono text-white">{formatNumber(activeMission.tokensUsed.out || 0)}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    </ErrorBoundary>
  );
};
