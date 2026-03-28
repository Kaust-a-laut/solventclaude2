import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';
import { Edit3, Check, X } from 'lucide-react';
import type { StageStatus } from './WaterfallStageCard';

interface WaterfallConnectorProps {
  fromStatus: StageStatus;
  fromColor: string;
  toColor: string;
  // Human-in-the-Loop (architect->reasoner only)
  showEditPlan?: boolean;
  editPlanDraft?: string | null;
  onStartEdit?: () => void;
  onEditChange?: (val: string) => void;
  onApplyEdit?: () => void;
  onCancelEdit?: () => void;
  // Gate controls (architect->reasoner when paused)
  isPaused?: boolean;
  onProceed?: () => void;
  onCancel?: () => void;
}

export const WaterfallConnector = ({
  fromStatus,
  fromColor,
  toColor,
  showEditPlan,
  editPlanDraft,
  onStartEdit,
  onEditChange,
  onApplyEdit,
  onCancelEdit,
  isPaused,
  onProceed,
  onCancel,
}: WaterfallConnectorProps) => {
  const isFromCompleted = fromStatus === 'completed';
  const isProcessing = fromStatus === 'processing';
  const isEditing = editPlanDraft !== null && editPlanDraft !== undefined;

  return (
    <div className="flex flex-col items-center gap-1 my-1">
      {/* Vertical pour track */}
      <div className="relative w-[2px] h-10 bg-white/[0.04] rounded-full overflow-hidden">
        {/* Fill animation */}
        <motion.div
          initial={{ scaleY: 0 }}
          animate={{ scaleY: isFromCompleted || isPaused ? 1 : 0 }}
          transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.1 }}
          style={{ transformOrigin: 'top center' }}
          className={cn(
            'absolute inset-0 rounded-full',
            `bg-gradient-to-b from-${fromColor} to-${toColor}`
          )}
        />
        {/* Droplet while processing */}
        {isProcessing && (
          <motion.div
            animate={{ y: ['0%', '100%'] }}
            transition={{ duration: 0.8, repeat: Infinity, ease: 'easeIn' }}
            className={cn('absolute w-full h-3 rounded-full opacity-50', `bg-${fromColor}`)}
          />
        )}
      </div>

      {/* Edit Plan button (architect->reasoner, after planner done, not editing) */}
      <AnimatePresence>
        {showEditPlan && isFromCompleted && !isEditing && !isPaused && (
          <motion.button
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            onClick={onStartEdit}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-jb-purple/10 border border-jb-purple/25 text-jb-purple text-[11px] font-black uppercase tracking-widest hover:bg-jb-purple/20 transition-all"
          >
            <Edit3 size={10} />
            Edit Plan
          </motion.button>
        )}
      </AnimatePresence>

      {/* Inline JSON editor */}
      <AnimatePresence>
        {showEditPlan && isEditing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="w-full max-w-xl overflow-hidden"
          >
            <div className="my-1 bg-black/60 border border-jb-purple/25 rounded-2xl overflow-hidden shadow-[0_0_30px_-10px_rgba(157,91,210,0.25)]">
              <div className="flex items-center justify-between px-4 py-2 border-b border-jb-purple/15 bg-jb-purple/5">
                <span className="text-[11px] font-black text-jb-purple uppercase tracking-widest">Edit Plan JSON</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={onApplyEdit}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-black uppercase hover:bg-emerald-500/20 transition-all"
                  >
                    <Check size={10} /> Apply
                  </button>
                  <button
                    onClick={onCancelEdit}
                    className="p-1 rounded-lg text-slate-500 hover:text-rose-400 transition-colors"
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>
              <textarea
                value={editPlanDraft ?? ''}
                onChange={(e) => onEditChange?.(e.target.value)}
                className="w-full bg-transparent p-4 font-mono text-xs text-slate-300 resize-none outline-none min-h-[120px] max-h-[200px] scrollbar-thin"
                spellCheck={false}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Gate controls */}
      <AnimatePresence>
        {isPaused && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex items-center gap-2 my-1"
          >
            <button
              onClick={onProceed}
              className="px-4 py-1.5 rounded-full bg-amber-500/15 border border-amber-400/30 text-amber-400 text-[11px] font-black uppercase tracking-widest hover:bg-amber-500/25 transition-all"
            >
              Proceed Anyway
            </button>
            <button
              onClick={onCancel}
              className="px-3 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[11px] font-black uppercase hover:bg-rose-500/20 transition-all"
            >
              Cancel
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
