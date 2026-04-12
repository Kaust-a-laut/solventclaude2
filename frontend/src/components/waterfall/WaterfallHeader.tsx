import React from 'react';
import { FlaskConical, X, Download, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';

interface WaterfallHeaderProps {
  isMobile: boolean;
  isActive: boolean;
  isStreaming: boolean;
  allCompleted: boolean;
  onCancel: () => void;
  onExportAll: () => void;
  onReset: () => void;
}

export function WaterfallHeader({
  isMobile,
  isActive,
  isStreaming,
  allCompleted,
  onCancel,
  onExportAll,
  onReset,
}: WaterfallHeaderProps) {
  return (
    <div className={cn(
      'flex items-center justify-between border-b border-white/5 bg-black/40 shrink-0 transition-all duration-500',
      isMobile ? 'px-6 pt-28 pb-8 h-auto' : 'px-12 h-28',
    )}>
      {/* Left: identity */}
      <div className="flex items-center gap-6">
        <div className="relative w-14 h-14 bg-jb-purple/10 rounded-[1.75rem] flex items-center justify-center border border-jb-purple/20 shadow-2xl shrink-0">
          <div className="absolute inset-0 bg-jb-purple/10 rounded-[1.75rem] blur-xl opacity-70" />
          <FlaskConical className="text-jb-purple relative z-10" size={26} />
          <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-jb-purple shadow-[0_0_10px_rgba(157,91,210,0.9)] animate-pulse" />
        </div>
        <div>
          <span className="text-[11px] font-black text-slate-300 uppercase tracking-[0.45em] block mb-1.5">
            Tiered Orchestration Pipeline
          </span>
          <h2 className="text-2xl md:text-3xl font-black tracking-tighter leading-none">
            Logic <span className="text-vibrant">Waterfall</span>
          </h2>
        </div>
      </div>

      {/* Right: Cancel / Reset */}
      <AnimatePresence>
        {(isActive || isStreaming) && (
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 16 }}
            className="flex items-center gap-2"
          >
            {isStreaming && (
              <button
                onClick={onCancel}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[11px] font-black uppercase tracking-widest hover:bg-rose-500/20 transition-all"
              >
                <X size={12} />
                Cancel
              </button>
            )}
            {allCompleted && !isStreaming && (
              <button
                onClick={onExportAll}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-jb-purple/10 border border-jb-purple/20 text-jb-purple text-[11px] font-black uppercase tracking-widest hover:bg-jb-purple/20 transition-all"
              >
                <Download size={11} />
                Export All
              </button>
            )}
            <button
              onClick={onReset}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-slate-400 text-[11px] font-black uppercase tracking-widest hover:bg-white/[0.08] transition-all"
            >
              <RotateCcw size={11} />
              Reset
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
