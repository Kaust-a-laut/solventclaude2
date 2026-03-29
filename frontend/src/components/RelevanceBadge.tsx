import React from 'react';
import { cn } from '../lib/utils';

interface RelevanceBadgeProps {
  score: number;
}

export const RelevanceBadge: React.FC<RelevanceBadgeProps> = ({ score }) => {
  if (score < 60) return null;

  const isHigh = score >= 85;

  return (
    <span className={cn(
      'inline-flex items-center px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest rounded-md',
      isHigh
        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
        : 'bg-orange-400/10 text-orange-400 border border-orange-400/20'
    )}>
      {score}%
    </span>
  );
};
