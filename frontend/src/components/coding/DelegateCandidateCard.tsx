import React from 'react';
import { cn } from '../../lib/utils';

export interface DelegateCandidate {
  task: string;
  files: string[];
  context: string;
}

function extractTag(html: string, tag: string): string | null {
  const match = html.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return match?.[1]?.trim() ?? null;
}

export function parseDelegateCandidate(text: string): DelegateCandidate | null {
  const match = text.match(/<delegate-candidate>([\s\S]*?)<\/delegate-candidate>/);
  if (!match) return null;
  const inner = match[1] ?? '';
  const task = extractTag(inner, 'task') ?? '';
  const filesRaw = extractTag(inner, 'files') ?? '';
  const files = filesRaw.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
  const context = extractTag(inner, 'context') ?? '';
  return { task, files, context };
}

interface DelegateCandidateCardProps {
  candidate: DelegateCandidate;
  onSend: () => void;
  onDismiss: () => void;
  status?: 'pending' | 'running' | 'complete' | 'failed';
  resultMessage?: string;
}

export const DelegateCandidateCard: React.FC<DelegateCandidateCardProps> = ({
  candidate,
  onSend,
  onDismiss,
  status = 'pending',
  resultMessage,
}) => {
  return (
    <div className={cn(
      'rounded-xl border p-3 text-[12px]',
      status === 'pending' && 'bg-black/30 border-amber-500/30',
      status === 'running' && 'bg-black/30 border-amber-500/30',
      status === 'complete' && 'bg-black/30 border-emerald-500/30',
      status === 'failed' && 'bg-black/30 border-red-500/30',
    )}>
      {status === 'pending' && (
        <>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">
              Delegate to code-tier model
            </span>
          </div>
          <p className="text-slate-300 mb-1">{candidate.task}</p>
          <p className="text-[11px] text-slate-500 font-mono mb-2">
            {candidate.files.join(', ')}
          </p>
          <div className="flex gap-2">
            <button
              onClick={onSend}
              className="px-2.5 py-1 rounded-md bg-jb-accent/20 text-jb-accent text-[11px] font-bold hover:bg-jb-accent/30 transition-colors"
            >
              Send to code model
            </button>
            <button
              onClick={onDismiss}
              className="px-2.5 py-1 rounded-md bg-white/5 text-slate-400 text-[11px] font-bold hover:bg-white/10 transition-colors"
            >
              Dismiss
            </button>
          </div>
        </>
      )}
      {status === 'running' && (
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 border-2 border-amber-400/50 border-t-amber-400 rounded-full animate-spin" />
          <span className="text-amber-400 text-[11px] font-bold uppercase">Delegating</span>
        </div>
      )}
      {status === 'complete' && (
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <span className="text-emerald-400 text-[11px] font-bold uppercase">Complete</span>
          </div>
          <p className="text-slate-300 mb-2">{resultMessage ?? 'Task completed'}</p>
          <div className="flex gap-2">
            <button className="px-2.5 py-1 rounded-md bg-emerald-500/15 text-emerald-400 text-[11px] font-bold border border-emerald-500/30">
              Open result
            </button>
            <button
              onClick={onDismiss}
              className="px-2.5 py-1 rounded-md bg-white/5 text-slate-400 text-[11px] font-bold hover:bg-white/10 transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
      {status === 'failed' && (
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-red-400 text-[11px] font-bold uppercase">Failed</span>
          </div>
          <p className="text-slate-400 mb-2">{resultMessage ?? 'Delegation failed'}</p>
          <button
            onClick={onSend}
            className="px-2.5 py-1 rounded-md bg-red-500/15 text-red-400 text-[11px] font-bold border border-red-500/30"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
};
