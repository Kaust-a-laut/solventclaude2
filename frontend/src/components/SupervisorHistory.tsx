import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, ChevronDown, ChevronUp, X, Sparkles, AlertTriangle, Lightbulb, Check, XCircle, Clock, Wrench } from 'lucide-react';
import { cn } from '../lib/utils';
import { api } from '../lib/api';
import { ErrorBoundary } from './ErrorBoundary';

interface InsightEntry {
  id: string;
  message: string;
  timestamp: Date;
  type: 'insight' | 'warning' | 'decision' | 'nudge';
}

interface PendingDecision {
  id: string;
  timestamp: number;
  decision: string;
  intervention: {
    needed: boolean;
    type: 'warning' | 'suggestion' | 'action';
    message: string;
    toolToExecute: { name: string; args: Record<string, unknown> } | null;
  } | null;
  crystallize: { content: string; type: string } | null;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  trigger: string;
  expiresAt: number;
  timeRemaining?: number;
}

export const SupervisorHistory = () => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const [insights, setInsights] = useState<InsightEntry[]>([]);
  const [pendingDecisions, setPendingDecisions] = useState<PendingDecision[]>([]);
  const [timeRemaining, setTimeRemaining] = useState<Record<string, number>>({});
  const { supervisorInsight, setSupervisorInsight } = useAppStore();

  // Load pending decisions on mount
  useEffect(() => {
    loadPendingDecisions();
    const interval = setInterval(loadPendingDecisions, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, []);

  // Update countdown timers — values are absolute expiresAt timestamps;
  // re-render every second and prune expired entries without transforming values
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setTimeRemaining(prev => {
        const updated: Record<string, number> = {};
        for (const [id, expiresAt] of Object.entries(prev)) {
          if (expiresAt > now) updated[id] = expiresAt;
        }
        return updated;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Listen for DECISION_PENDING socket events
  useEffect(() => {
    const socket = (window as any).socket;
    if (!socket) return;

    const handleDecisionPending = (decision: PendingDecision) => {
      setPendingDecisions(prev => [...prev, decision]);
      if (decision.timeRemaining) {
        setTimeRemaining(prev => ({ ...prev, [decision.id]: decision.expiresAt }));
      }
    };

    socket.on('DECISION_PENDING', handleDecisionPending);
    return () => { socket.off('DECISION_PENDING', handleDecisionPending); };
  }, []);

  const loadPendingDecisions = async () => {
    try {
      const response = await api.get('/overseer/pending');
      setPendingDecisions(response.data.decisions);
      response.data.decisions.forEach((d: PendingDecision) => {
        setTimeRemaining(prev => ({ ...prev, [d.id]: d.expiresAt }));
      });
    } catch (error) {
      console.error('[SupervisorHistory] Failed to load pending decisions:', error);
    }
  };

  const handleApprove = async (decisionId: string) => {
    try {
      await api.post('/overseer/approve', { decisionId });
      setPendingDecisions(prev => prev.filter(d => d.id !== decisionId));
      setTimeRemaining(prev => { const { [decisionId]: _, ...rest } = prev; return rest; });
    } catch (error) {
      console.error('[SupervisorHistory] Failed to approve decision:', error);
      alert('Failed to approve decision');
    }
  };

  const handleReject = async (decisionId: string) => {
    const reason = prompt('Reason for rejection (optional):') || undefined;
    try {
      await api.post('/overseer/reject', { decisionId, reason });
      setPendingDecisions(prev => prev.filter(d => d.id !== decisionId));
      setTimeRemaining(prev => { const { [decisionId]: _, ...rest } = prev; return rest; });
    } catch (error) {
      console.error('[SupervisorHistory] Failed to reject decision:', error);
    }
  };

  // Capture new insights into history
  useEffect(() => {
    if (supervisorInsight) {
      const newInsight: InsightEntry = {
        id: `insight-${Date.now()}`,
        message: supervisorInsight,
        timestamp: new Date(),
        type: supervisorInsight.toLowerCase().includes('warning') ? 'warning'
            : supervisorInsight.toLowerCase().includes('decision') ? 'decision'
            : 'insight'
      };
      setInsights(prev => [newInsight, ...prev.slice(0, 19)]); // Keep last 20
    }
  }, [supervisorInsight]);

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'warning': return <AlertTriangle size={14} className="text-amber-400" />;
      case 'decision': return <Sparkles size={14} className="text-jb-purple" />;
      case 'nudge': return <Lightbulb size={14} className="text-cyan-400" />;
      default: return <Brain size={14} className="text-jb-purple" />;
    }
  };

  const clearHistory = () => {
    setInsights([]);
    setSupervisorInsight(null);
  };

  const formatTimeRemaining = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  // Don't render if no insights ever and no pending decisions
  if (insights.length === 0 && !supervisorInsight && pendingDecisions.length === 0) return null;

  // Minimized state - just a floating indicator
  if (isMinimized) {
    const totalCount = insights.length + pendingDecisions.length;
    return (
      <ErrorBoundary>
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          onClick={() => setIsMinimized(false)}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 bg-black/90 backdrop-blur-xl border border-jb-purple/30 rounded-full shadow-2xl hover:border-jb-purple/50 transition-all group"
        >
          <div className="relative">
            <Brain size={16} className="text-jb-purple" />
            <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-jb-purple animate-pulse" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-white">
            {totalCount} {totalCount === 1 ? 'Item' : 'Items'}
          </span>
          <ChevronUp size={14} className="text-slate-500 group-hover:text-white transition-colors" />
        </motion.button>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-4"
      >
      <div className="bg-black/95 backdrop-blur-2xl border border-jb-purple/30 rounded-2xl shadow-[0_25px_50px_-12px_rgba(157,91,210,0.25)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <div className="w-9 h-9 rounded-xl bg-jb-purple/20 flex items-center justify-center relative">
              <Brain size={18} className="text-jb-purple" />
              {(insights.length > 0 || pendingDecisions.length > 0) && (
                <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-jb-purple flex items-center justify-center">
                  <span className="text-[8px] font-black text-white">{insights.length + pendingDecisions.length}</span>
                </div>
              )}
            </div>
            <div className="text-left">
              <p className="text-[11px] font-black uppercase tracking-widest text-white">
                Supervisor
              </p>
              <p className="text-[9px] text-slate-500">
                {pendingDecisions.length > 0 ? `${pendingDecisions.length} pending approval` : insights.length > 0 ? `${insights.length} recorded` : 'Monitoring...'}
              </p>
            </div>
          </button>

          <div className="flex items-center gap-2">
            {insights.length > 0 && (
              <button
                onClick={clearHistory}
                className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all"
                title="Clear history"
              >
                <X size={14} />
              </button>
            )}
            <button
              onClick={() => setIsMinimized(true)}
              className="p-2 text-slate-500 hover:text-white hover:bg-white/10 rounded-lg transition-all"
              title="Minimize"
            >
              <ChevronDown size={14} />
            </button>
          </div>
        </div>

        {/* Expandable Content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: 0 }}
              className="overflow-hidden"
            >
              <div className="p-4 space-y-3 max-h-96 overflow-y-auto scrollbar-thin">
                {/* Pending Decisions Section */}
                {pendingDecisions.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-amber-400">
                      <Clock size={10} className="animate-pulse" />
                      Pending Approval
                    </div>
                    {pendingDecisions.map((decision, i) => {
                      const remaining = Math.max(0, (timeRemaining[decision.id] || 0) - Date.now());
                      const isExpiring = remaining > 0 && remaining < 30000;
                      
                      return (
                        <motion.div
                          key={decision.id}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30"
                        >
                          <div className="flex items-start gap-2 mb-2">
                            <Wrench size={12} className="text-amber-400 mt-0.5 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] text-amber-100 font-medium">{decision.decision}</p>
                              {decision.intervention?.message && (
                                <p className="text-[9px] text-amber-200/70 mt-1">{decision.intervention.message}</p>
                              )}
                              {decision.intervention?.toolToExecute && (
                                <p className="text-[8px] font-mono text-amber-300/50 mt-1 bg-amber-500/10 px-1.5 py-0.5 rounded inline-block">
                                  Tool: {decision.intervention.toolToExecute.name}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className={cn(
                              "text-[8px] font-mono",
                              isExpiring ? "text-rose-400 animate-pulse" : "text-slate-500"
                            )}>
                              {formatTimeRemaining(remaining)}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleApprove(decision.id)}
                                className="p-1.5 bg-emerald-500/20 border border-emerald-500/30 rounded hover:bg-emerald-500/30 transition-all"
                                title="Approve"
                              >
                                <Check size={10} className="text-emerald-400" />
                              </button>
                              <button
                                onClick={() => handleReject(decision.id)}
                                className="p-1.5 bg-rose-500/20 border border-rose-500/30 rounded hover:bg-rose-500/30 transition-all"
                                title="Reject"
                              >
                                <XCircle size={10} className="text-rose-400" />
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}

                {/* Insights Section */}
                {insights.length > 0 && (
                  <div className="space-y-2">
                    {pendingDecisions.length > 0 && (
                      <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-slate-500 pt-2 border-t border-white/5">
                        History
                      </div>
                    )}
                    {insights.map((insight, i) => (
                      <motion.div
                        key={insight.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className={cn(
                          "p-3 rounded-xl transition-all duration-300",
                          i === 0
                            ? "bg-jb-purple/10 border border-jb-purple/20"
                            : "bg-white/[0.02] border border-transparent hover:border-white/5 opacity-70 hover:opacity-100"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 shrink-0">
                            {getInsightIcon(insight.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={cn(
                              "text-xs leading-relaxed",
                              i === 0 ? "text-white font-medium" : "text-slate-300"
                            )}>
                              {insight.message}
                            </p>
                            <p className="text-[9px] text-slate-500 mt-1.5 font-mono">
                              {insight.timestamp.toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}

                {insights.length === 0 && pendingDecisions.length === 0 && (
                  <div className="text-center py-6">
                    <p className="text-[10px] text-slate-500">
                      No insights yet. The supervisor is observing...
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
    </ErrorBoundary>
  );
};
