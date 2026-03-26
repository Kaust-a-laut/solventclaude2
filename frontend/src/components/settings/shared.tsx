import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import type { LucideIcon } from 'lucide-react';

// ── InlineToggle ──────────────────────────────────────────────────────────────

interface InlineToggleProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}

export const InlineToggle = ({ label, description, checked, onChange }: InlineToggleProps) => (
  <div className="flex items-center justify-between py-4 border-b border-white/5 last:border-b-0">
    <div className="flex flex-col gap-0.5 pr-8">
      <span className="text-xs font-bold text-white">{label}</span>
      <span className="text-[10px] text-slate-500 font-medium leading-snug">{description}</span>
    </div>
    <button
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      className={cn(
        "relative flex-shrink-0 w-10 h-5 rounded-full transition-all duration-300",
        checked ? "bg-jb-accent shadow-[0_0_12px_rgba(60,113,247,0.4)]" : "bg-white/10"
      )}
    >
      <span className={cn(
        "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-300",
        checked ? "translate-x-5" : "translate-x-0"
      )} />
    </button>
  </div>
);

// ── TabButton ─────────────────────────────────────────────────────────────────

interface TabButtonProps {
  id: string;
  label: string;
  icon: LucideIcon;
  isActive: boolean;
  onClick: () => void;
  shortcut?: string;
}

export const TabButton = ({ id, label, icon: Icon, isActive, onClick, shortcut }: TabButtonProps) => (
  <button
    onClick={onClick}
    className={cn(
      "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group",
      isActive ? "bg-white/5 text-white shadow-xl" : "text-slate-500 hover:text-slate-300"
    )}
  >
    <Icon size={16} className={cn(isActive ? "text-jb-accent" : "text-slate-600")} />
    <span className="text-[11px] font-black uppercase tracking-widest">{label}</span>
    {shortcut && (
      <span className="text-[8px] text-slate-700 font-mono ml-auto mr-1">{shortcut}</span>
    )}
    {isActive && (
      <motion.div layoutId="tabGlow" className="ml-auto w-1 h-1 rounded-full bg-jb-accent shadow-[0_0_10px_rgba(60,113,247,1)]" />
    )}
  </button>
);

// ── SectionCard ───────────────────────────────────────────────────────────────

interface SectionCardProps {
  children: React.ReactNode;
  className?: string;
}

export const SectionCard = ({ children, className }: SectionCardProps) => (
  <div className={cn("bg-white/[0.02] border border-white/5 rounded-2xl px-5 hover:border-white/[0.08] transition-colors", className)}>
    {children}
  </div>
);

// ── Stagger animation variants ────────────────────────────────────────────────

export const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

export const staggerItem = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' as const } },
};
