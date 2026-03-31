import React from 'react';
import { cn } from '../lib/utils';

interface RelevanceBadgeProps {
  score: number;
}

export const RelevanceBadge: React.FC<RelevanceBadgeProps> = ({ score }) => {
  // Show badge for scores 25 and above (our new minimum threshold)
  if (score < 25) return null;

  const isHigh = score >= 80;
  const isMedium = score >= 50 && score < 80;

  return (
    <span className={cn(
      'inline-flex items-center px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest rounded-md',
      isHigh
        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
        : isMedium
          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
          : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
    )}>
      {score}%
    </span>
  );
};
