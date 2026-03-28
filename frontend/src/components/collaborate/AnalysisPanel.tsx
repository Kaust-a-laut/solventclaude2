import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Loader2, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '../../lib/utils';

// ─── Types ──────────────────────────────────────────────────────────────────────

export type AnalysisStatus = 'awaiting' | 'ready' | 'analyzing' | 'complete';

interface AnalysisPanelProps {
  status: AnalysisStatus;
  analysis: string;
  onAnalyze: (userContext: string) => void;
}

// ─── Component ──────────────────────────────────────────────────────────────────

export const AnalysisPanel: React.FC<AnalysisPanelProps> = ({
  status,
  analysis,
  onAnalyze,
}) => {
  const [userContext, setUserContext] = useState('');
  const [isExpanded, setIsExpanded]  = useState(true);

  const isAwaiting  = status === 'awaiting';
  const isReady     = status === 'ready';
  const isAnalyzing = status === 'analyzing';
  const isComplete  = status === 'complete';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: isAwaiting ? 0.5 : 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={cn(
        'glass-panel rounded-[1.5rem] p-5 flex-shrink-0 transition-all duration-500',
        (isReady || isComplete) && 'border-l-4 border-jb-purple/40',
      )}
    >
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <AnimatePresence mode="wait">
            {isAnalyzing ? (
              <motion.div key="spin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Loader2 size={14} className="text-jb-purple animate-spin" />
              </motion.div>
            ) : isComplete ? (
              <motion.div key="check" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <CheckCircle2 size={14} className="text-emerald-400" />
              </motion.div>
            ) : (
              <motion.div key="brain" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Brain size={14} className={isAwaiting ? 'text-slate-600' : 'text-jb-purple'} />
              </motion.div>
            )}
          </AnimatePresence>

          <span className={cn(
            'text-[11px] font-black uppercase tracking-widest transition-colors duration-300',
            isAwaiting   ? 'text-slate-600'
              : isComplete ? 'text-emerald-400'
              : 'text-jb-purple',
          )}>
            {isAnalyzing ? 'Analyzing Findings...' : 'Conclusive Analysis'}
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {isReady && (
            <button
              onClick={() => onAnalyze(userContext)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-jb-purple/15 border border-jb-purple/30 hover:bg-jb-purple/25 text-jb-purple text-[11px] font-black uppercase tracking-wider rounded-full transition-all"
            >
              Analyze Findings ▶
            </button>
          )}

          {isComplete && (
            <button
              onClick={() => setIsExpanded((v) => !v)}
              className="text-slate-600 hover:text-slate-400 transition-colors"
            >
              {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
          )}
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">

        {/* Awaiting */}
        {isAwaiting && (
          <motion.div
            key="awaiting"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-3 py-1"
          >
            <div className="flex items-center gap-1.5">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-slate-600"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ repeat: Infinity, duration: 1.4, delay: i * 0.2 }}
                />
              ))}
            </div>
            <p className="text-[11px] text-slate-600 font-medium">
              Awaiting agent findings...
            </p>
          </motion.div>
        )}

        {/* Ready — optional context input + trigger button */}
        {isReady && (
          <motion.div
            key="ready"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.3 }}
            className="space-y-3"
          >
            <p className="text-[11px] text-slate-500">
              Agent findings ready — run analysis to synthesize deeper insights
            </p>
            <textarea
              value={userContext}
              onChange={(e) => setUserContext(e.target.value)}
              placeholder="Add context or framing for deeper analysis... (optional)"
              className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-slate-300 text-xs font-medium placeholder:text-slate-700 outline-none resize-none h-16 focus:border-jb-purple/40 transition-colors no-scrollbar"
            />
          </motion.div>
        )}

        {/* Analyzing */}
        {isAnalyzing && (
          <motion.div
            key="analyzing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="flex flex-col items-center gap-4 py-5"
          >
            <div className="flex items-center gap-2">
              {(['rgba(157,91,210,0.9)', 'rgba(60,113,247,0.9)', 'rgba(251,146,60,0.9)'] as const).map(
                (color, i) => (
                  <motion.div
                    key={i}
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ background: color }}
                    animate={{ scale: [1, 1.6, 1], opacity: [0.3, 1, 0.3] }}
                    transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.22 }}
                  />
                )
              )}
            </div>
            <p className="text-[11px] text-slate-500 uppercase tracking-widest font-bold">
              Synthesizing expert findings...
            </p>
          </motion.div>
        )}

        {/* Complete */}
        {isComplete && (
          <motion.div
            key="complete"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  className="overflow-hidden"
                >
                  <div className="border-l-2 border-jb-purple/30 pl-4 pt-1">
                    <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {analysis}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

      </AnimatePresence>
    </motion.div>
  );
};
