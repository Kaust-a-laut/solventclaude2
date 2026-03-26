import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface ActivityEntry {
  id: number;
  timestamp: number;
  text: string;
  type: 'system' | 'pm' | 'engineer' | 'security' | 'synthesis';
}

interface ActivityLogProps {
  entries: ActivityEntry[];
}

// ─── Color map ──────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<ActivityEntry['type'], { dot: string; label: string }> = {
  system:    { dot: 'bg-slate-500',      label: 'text-slate-400'     },
  pm:        { dot: 'bg-jb-purple',      label: 'text-jb-purple'     },
  engineer:  { dot: 'bg-jb-accent',      label: 'text-jb-accent'     },
  security:  { dot: 'bg-jb-orange',      label: 'text-jb-orange'     },
  synthesis: { dot: 'bg-emerald-500',    label: 'text-emerald-400'   },
};

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
}

// ─── Component ──────────────────────────────────────────────────────────────────

export const ActivityLog: React.FC<ActivityLogProps> = ({ entries }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest entry
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [entries.length]);

  return (
    <div ref={scrollRef} className="glass-panel rounded-2xl p-3 max-h-32 overflow-y-auto no-scrollbar">
      <div className="flex flex-col gap-1">
        <AnimatePresence initial={false}>
          {entries.map((entry) => {
            const cfg = TYPE_CONFIG[entry.type];
            return (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="flex items-center gap-2"
              >
                <div className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', cfg.dot)} />
                <span className="text-[9px] text-slate-600 font-mono flex-shrink-0 tabular-nums">
                  {fmtTime(entry.timestamp)}
                </span>
                <span className={cn('text-[9px] font-bold uppercase tracking-wider truncate', cfg.label)}>
                  {entry.text}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};
