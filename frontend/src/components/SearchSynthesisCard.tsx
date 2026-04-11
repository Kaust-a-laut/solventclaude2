import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

interface SynthesisCardProps {
  synthesis: {
    answer: string;
    sources: string[];
  };
  isLoading?: boolean;
  onSourceClick?: (url: string) => void;
}

export const SearchSynthesisCard: React.FC<SynthesisCardProps> = ({ synthesis, isLoading, onSourceClick }) => {
  if (isLoading) {
    return (
      <div className="rounded-2xl bg-emerald-500/[0.04] border border-emerald-500/10 p-6 mb-8 relative overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-emerald-500 to-blue-500" />
        <div className="flex items-center gap-2 mb-4">
          <Sparkles size={14} className="text-emerald-400 animate-pulse" />
          <span className="text-[11px] font-black text-emerald-400 uppercase tracking-[0.3em]">AI Synthesis</span>
        </div>
        {/* Skeleton shimmers */}
        <div className="space-y-2">
          <div className="h-4 bg-white/5 rounded-lg animate-pulse w-full" />
          <div className="h-4 bg-white/5 rounded-lg animate-pulse w-4/5" />
          <div className="h-4 bg-white/5 rounded-lg animate-pulse w-3/5" />
        </div>
      </div>
    );
  }

  if (!synthesis?.answer) return null;

  // Extract domain from URL for source badges
  const getDomain = (url: string): string => {
    try { return new URL(url).hostname.replace('www.', ''); } catch { return url; }
  };

  const visibleSources = synthesis.sources.slice(0, 6);
  const overflowCount = synthesis.sources.length - visibleSources.length;

  // Render answer with backtick code spans
  const renderAnswer = (text: string) => {
    const parts = text.split(/(`[^`]+`)/g);
    return parts.map((part, i) =>
      part.startsWith('`') && part.endsWith('`')
        ? <code key={i} className="px-1.5 py-0.5 bg-white/5 text-emerald-300 text-[13px] rounded font-mono">{part.slice(1, -1)}</code>
        : <span key={i}>{part}</span>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-emerald-500/[0.04] border border-emerald-500/10 p-6 mb-8 relative overflow-hidden"
    >
      {/* Left accent border */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-emerald-500 to-blue-500" />

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-emerald-400" />
          <span className="text-[11px] font-black text-emerald-400 uppercase tracking-[0.3em]">AI Synthesis</span>
        </div>
        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
          from {synthesis.sources.length} source{synthesis.sources.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Answer body */}
      <p className="text-[16px] text-slate-300 leading-[1.8] mb-4">
        {renderAnswer(synthesis.answer)}
      </p>

      {/* Source badges */}
      <div className="flex flex-wrap gap-2">
        {visibleSources.map((url, i) => (
          <button
            key={i}
            onClick={() => onSourceClick?.(url)}
            className="px-2.5 py-1 bg-white/5 border border-white/10 text-[10px] font-bold text-slate-400 uppercase tracking-widest rounded-lg hover:border-emerald-500/30 hover:text-emerald-400 transition-all"
          >
            {getDomain(url)}
          </button>
        ))}
        {overflowCount > 0 && (
          <span className="px-2.5 py-1 bg-white/5 border border-white/10 text-[10px] font-bold text-slate-300 uppercase tracking-widest rounded-lg">
            +{overflowCount} more
          </span>
        )}
      </div>
    </motion.div>
  );
};
