import React, { useEffect, useRef } from 'react';
import { Terminal as TerminalIcon, Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface Props {
  lines: string[];
  onClear: () => void;
}

export const CodingTerminal: React.FC<Props> = ({ lines, onClear }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [lines]);

  const lineColor = (line: string) => {
    if (line.startsWith('[SYSTEM]') || line.startsWith('[AGENT]')) return 'text-jb-accent';
    if (line.startsWith('[ERROR]') || line.startsWith('[WC-ERROR]')) return 'text-rose-400';
    if (line.startsWith('[WATERFALL]') || line.startsWith('[AUDITOR]')) return 'text-jb-purple';
    if (line.startsWith('[STDERR]')) return 'text-amber-400';
    if (line.startsWith('>')) return 'text-white/60';
    return 'text-white/35';
  };

  return (
    <div className="h-[180px] flex flex-col border-t border-white/[0.04] bg-black/30 shrink-0">
      <div className="px-4 py-1.5 flex items-center justify-between border-b border-white/[0.06] shrink-0">
        <div className="flex items-center gap-2">
          <TerminalIcon size={12} className="text-white/30" />
          <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white/30">Console</span>
        </div>
        <button onClick={onClear} className="p-0.5 hover:bg-white/10 rounded text-white/20 hover:text-white/50">
          <Trash2 size={11} />
        </button>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 font-mono text-[11px] leading-relaxed scrollbar-thin">
        {lines.map((line, i) => (
          <div key={i} className={cn('mb-0.5', lineColor(line))}>{line}</div>
        ))}
      </div>
    </div>
  );
};
