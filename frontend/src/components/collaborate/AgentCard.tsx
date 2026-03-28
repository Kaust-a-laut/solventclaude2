import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';
import { cn } from '../../lib/utils';

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface AgentConfig {
  role: string;
  displayName: string;
  icon: React.ElementType;
  color: string;        // e.g. 'jb-purple'
  borderColor: string;  // e.g. 'border-jb-purple'
  bgColor: string;      // e.g. 'bg-jb-purple/10'
  textColor: string;    // e.g. 'text-jb-purple'
  glowRgba: string;     // e.g. 'rgba(157,91,210,0.25)'
  borderRgba: string;   // e.g. 'rgba(157,91,210,' — for inline style opacity
}

export interface AgentOpinion {
  role: string;
  opinion: string;
  status: 'pending' | 'completed';
}

interface AgentCardProps {
  config: AgentConfig;
  opinion: AgentOpinion | null;
  isMissionRunning: boolean;
  isIdle: boolean;
}

// ─── Component ──────────────────────────────────────────────────────────────────

export const AgentCard: React.FC<AgentCardProps> = ({
  config,
  opinion,
  isMissionRunning,
  isIdle,
}) => {
  const isCompleted  = opinion !== null;
  const isProcessing = isMissionRunning && !isCompleted;
  const Icon = config.icon;

  return (
    <motion.div
      className={cn(
        'glass-panel rounded-[1.5rem] flex-1 flex overflow-hidden transition-all duration-500',
        isIdle && 'opacity-40',
        isProcessing && `shadow-[0_0_20px_${config.glowRgba}]`,
      )}
      animate={{ opacity: isIdle ? 0.4 : 1 }}
      transition={{ duration: 0.4 }}
    >
      {/* Left status bar */}
      <div
        className={cn('w-1 flex-shrink-0 rounded-l-[1.5rem] transition-all duration-700')}
        style={{
          background: isProcessing
            ? `${config.borderRgba}0.8)`
            : isCompleted
            ? `${config.borderRgba}1)`
            : `${config.borderRgba}0.2)`,
          boxShadow: isProcessing ? `2px 0 12px ${config.glowRgba}` : 'none',
        }}
      />

      {/* Card body */}
      <div className="flex-1 flex flex-col p-4 gap-3 min-h-[180px]">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div
              className={cn('p-1.5 rounded-lg flex-shrink-0', config.bgColor)}
              style={{ boxShadow: isProcessing ? `0 0 8px ${config.glowRgba}` : 'none' }}
            >
              <Icon size={14} className={config.textColor} />
            </div>
            <div>
              <p className={cn('text-[11px] font-black uppercase tracking-widest', config.textColor)}>
                {config.displayName}
              </p>
            </div>
          </div>

          {/* Status dot */}
          <div className="flex-shrink-0 mt-0.5">
            {isCompleted ? (
              <CheckCircle2 size={13} className="text-emerald-400" />
            ) : isProcessing ? (
              <motion.div
                className={cn('w-2 h-2 rounded-full', config.bgColor)}
                animate={{ opacity: [0.4, 1, 0.4], scale: [0.8, 1.2, 0.8] }}
                transition={{ repeat: Infinity, duration: 1.4 }}
                style={{ background: `${config.borderRgba}0.9)` }}
              />
            ) : (
              <div
                className="w-2 h-2 rounded-full"
                style={{ background: `${config.borderRgba}0.2)` }}
              />
            )}
          </div>
        </div>

        {/* Processing dots */}
        <AnimatePresence mode="wait">
          {isProcessing && (
            <motion.div
              key="processing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="flex-1 flex flex-col items-center justify-center gap-3"
            >
              <div className="flex items-center gap-1.5">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: `${config.borderRgba}0.9)` }}
                    animate={{ scale: [1, 1.6, 1], opacity: [0.3, 1, 0.3] }}
                    transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.22 }}
                  />
                ))}
              </div>
              <p className={cn('text-[11px] font-bold uppercase tracking-widest', config.textColor)}>
                Analyzing...
              </p>
            </motion.div>
          )}

          {isCompleted && opinion && (
            <motion.div
              key="completed"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="flex-1 flex flex-col gap-2"
            >
              <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap flex-1">
                {opinion.opinion}
              </p>
              <div className="pt-2 border-t border-white/5 flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-[11px] font-black uppercase tracking-widest text-emerald-500">
                  Analysis Complete
                </span>
              </div>
            </motion.div>
          )}

          {isIdle && (
            <motion.div
              key="idle"
              className="flex-1 flex items-center justify-center"
            >
              <p className="text-[11px] text-slate-700 uppercase tracking-widest font-bold">
                Standby
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
