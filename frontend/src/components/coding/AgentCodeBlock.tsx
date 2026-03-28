import React, { useState } from 'react';
import { Check, X, Copy, CheckCheck } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { CodeSuggestion } from '../../store/codingSlice';

interface Props {
  suggestion: CodeSuggestion;
  onApply: (id: string) => void;
  onReject: (id: string) => void;
}

export const AgentCodeBlock: React.FC<Props> = ({ suggestion, onApply, onReject }) => {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(suggestion.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable
    }
  };

  return (
    <div className="rounded-xl overflow-hidden border border-white/[0.07] bg-black/40 my-2">
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-white/[0.03] border-b border-white/[0.05]">
        <span className="text-[11px] font-mono text-white/30">{suggestion.language}</span>
        <button type="button" aria-label="Copy code" onClick={copy} className="p-1 hover:bg-white/10 rounded text-white/30 hover:text-white/60 transition-colors">
          {copied ? <CheckCheck size={11} className="text-emerald-400" /> : <Copy size={11} />}
        </button>
      </div>
      {/* Code */}
      <pre className="p-3 text-[11px] font-mono text-slate-300 overflow-x-auto scrollbar-thin leading-relaxed whitespace-pre-wrap break-words">
        <code>{suggestion.code}</code>
      </pre>
      {/* Apply / Reject footer */}
      {!suggestion.applied && !suggestion.rejected && (
        <div className="flex items-center gap-2 px-3 py-2 border-t border-white/[0.05] bg-black/20">
          <button
            type="button"
            onClick={() => onApply(suggestion.id)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-[11px] font-bold hover:bg-emerald-500/25 transition-colors"
          >
            <Check size={11} /> Apply
          </button>
          <button
            type="button"
            onClick={() => onReject(suggestion.id)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/15 text-rose-400 text-[11px] font-bold hover:bg-rose-500/20 transition-colors"
          >
            <X size={11} /> Reject
          </button>
        </div>
      )}
      {suggestion.applied && (
        <div className="px-3 py-1.5 border-t border-emerald-500/10 bg-emerald-500/5">
          <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
            <CheckCheck size={11} /> Applied
          </span>
        </div>
      )}
      {suggestion.rejected && (
        <div className="px-3 py-1.5 border-t border-rose-500/10 bg-rose-500/5">
          <span className="text-[11px] font-bold text-rose-400 flex items-center gap-1">
            <X size={11} /> Rejected
          </span>
        </div>
      )}
    </div>
  );
};
