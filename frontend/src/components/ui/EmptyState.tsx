import React from 'react';
import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  accentColor?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  shortcuts?: Array<{
    key: string;
    label: string;
  }>;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  accentColor = 'jb-accent',
  action,
  shortcuts,
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="flex-1 flex flex-col items-center justify-center gap-5 py-20 pointer-events-auto select-none"
    >
      <div className="relative">
        <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
          <Icon className="w-6 h-6 text-jb-accent/60" />
        </div>
      </div>

      <div className="flex flex-col items-center gap-2 max-w-xs text-center">
        <p className="text-sm font-semibold text-slate-300">{title}</p>
        <p className="text-[13px] text-slate-500 leading-relaxed">{description}</p>
      </div>

      {action && (
        <button
          onClick={action.onClick}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium
            bg-jb-accent/10 border border-jb-accent/20 text-jb-accent
            hover:bg-jb-accent/15 hover:border-jb-accent/30
            transition-all duration-200"
        >
          {action.icon && <action.icon className="w-4 h-4" />}
          {action.label}
        </button>
      )}

      {shortcuts && shortcuts.length > 0 && (
        <div className="flex flex-wrap gap-3 mt-2">
          {shortcuts.map((s) => (
            <div key={s.key} className="flex items-center gap-2 text-[11px] text-slate-600">
              <kbd className="font-mono px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.08] text-slate-500">
                {s.key}
              </kbd>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
