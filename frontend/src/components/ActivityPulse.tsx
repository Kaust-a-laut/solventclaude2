import React from 'react';
import { useAppStore } from '../store/useAppStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Brain, Sparkles, AlertTriangle, Zap, Database, Network, CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';

const getActivityIcon = (type: string) => {
  switch (type) {
    case 'supervisor':
    case 'overseer':
      return <Brain size={12} className="text-jb-purple" />;
    case 'memory':
    case 'crystallize':
      return <Sparkles size={12} className="text-amber-400" />;
    case 'warning':
    case 'error':
      return <AlertTriangle size={12} className="text-rose-400" />;
    case 'provider':
      return <Zap size={12} className="text-orange-400" />;
    case 'vector':
    case 'index':
      return <Database size={12} className="text-cyan-400" />;
    case 'graph':
      return <Network size={12} className="text-emerald-400" />;
    case 'success':
      return <CheckCircle2 size={12} className="text-emerald-400" />;
    default:
      return <Activity size={12} className="text-jb-accent" />;
  }
};

const getActivityColor = (type: string) => {
  switch (type) {
    case 'supervisor':
    case 'overseer':
      return 'border-l-jb-purple';
    case 'memory':
    case 'crystallize':
      return 'border-l-amber-400';
    case 'warning':
    case 'error':
      return 'border-l-rose-400';
    case 'provider':
      return 'border-l-orange-400';
    case 'vector':
    case 'index':
      return 'border-l-cyan-400';
    case 'graph':
      return 'border-l-emerald-400';
    case 'success':
      return 'border-l-emerald-400';
    default:
      return 'border-l-jb-accent';
  }
};

interface ActivityPulseProps {
  collapsed?: boolean;
}

export const ActivityPulse: React.FC<ActivityPulseProps> = ({ collapsed = false }) => {
  const { activities } = useAppStore();

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-2 py-4">
        <div className="relative">
          <Activity size={18} className="text-slate-500" />
          {activities.length > 0 && (
            <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-jb-accent flex items-center justify-center">
              <span className="text-[6px] font-black text-white">{Math.min(activities.length, 99)}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-black/40 backdrop-blur-xl border-l border-white/5">
      {/* Header */}
      <div className="p-4 border-b border-white/5 flex items-center gap-3">
        <div className="relative">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          {activities.length > 0 && (
            <div className="absolute inset-0 w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          )}
        </div>
        <span className="text-[11px] font-black uppercase tracking-[0.3em] text-white">Live Pulse</span>
        <span className="text-[11px] font-mono text-slate-600 ml-auto">{activities.length}</span>
      </div>

      {/* Activity List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin">
        <AnimatePresence initial={false}>
          {activities.slice(0, 50).map((activity: any, i: number) => (
            <motion.div
              key={activity.id || `activity-${i}-${activity.timestamp}`}
              initial={{ opacity: 0, x: 20, height: 0 }}
              animate={{ opacity: 1, x: 0, height: 'auto' }}
              exit={{ opacity: 0, x: -20 }}
              className={cn(
                "p-2.5 rounded-lg border-l-2 transition-all duration-300",
                getActivityColor(activity.type),
                i === 0
                  ? "bg-white/5 border border-l-2 border-white/10"
                  : "bg-transparent border-transparent opacity-60 hover:opacity-100 hover:bg-white/[0.02]"
              )}
            >
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 shrink-0">
                  {getActivityIcon(activity.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-white font-medium leading-relaxed">
                    {activity.message || activity.type || 'System event'}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-[11px] text-slate-500 font-mono">
                      {activity.timestamp
                        ? new Date(activity.timestamp).toLocaleTimeString()
                        : 'just now'}
                    </p>
                    {activity.source && (
                      <span className="text-[11px] font-black text-slate-600 uppercase tracking-wider px-1.5 py-0.5 bg-white/5 rounded">
                        {activity.source}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {activities.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 text-center px-4">
            <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mb-3">
              <Activity size={20} className="text-slate-700" />
            </div>
            <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest mb-1">
              Neural Link Ready
            </p>
            <p className="text-[11px] text-slate-600">
              Activity will appear here as the AI processes
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
