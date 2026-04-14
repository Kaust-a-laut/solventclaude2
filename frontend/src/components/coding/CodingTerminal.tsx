import React, { useEffect, useRef, useMemo } from 'react';
import { Terminal as TerminalIcon, Trash2, AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';

interface Props {
  lines: string[];
  onClear: () => void;
}

interface LineGroup {
  text: string;
  count: number;
}

function groupConsecutiveLines(lines: string[]): LineGroup[] {
  if (lines.length === 0) return [];
  const groups: LineGroup[] = [];
  for (const line of lines) {
    // Skip empty lines (cursor movement artifacts from ANSI clearing)
    if (line.trim() === '') continue;
    const last = groups[groups.length - 1];
    if (last && last.text === line) {
      last.count++;
    } else {
      groups.push({ text: line, count: 1 });
    }
  }
  return groups;
}

const lineStyle = (line: string) => {
  if (line.startsWith('[SYSTEM]') || line.startsWith('[AGENT]')) return 'text-jb-accent';
  if (line.startsWith('[ERROR]') || line.startsWith('[WC-ERROR]')) return 'text-rose-400 font-semibold';
  if (line.startsWith('[WATERFALL]') || line.startsWith('[AUDITOR]')) return 'text-jb-purple';
  if (line.startsWith('[STDERR]')) return 'text-amber-400';
  if (line.startsWith('[WARN]')) return 'text-amber-300';
  if (line.startsWith('$ ')) return 'text-white/60';
  if (line.startsWith('[EXIT]')) return 'text-amber-400';
  // Vite errors often contain [vite] in the message
  if (line.toLowerCase().includes('vite') && (line.includes('error') || line.includes('failed'))) return 'text-rose-300/80';
  return 'text-white/35';
};

export const CodingTerminal: React.FC<Props> = ({ lines, onClear }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [lines]);

  const groups = useMemo(() => groupConsecutiveLines(lines), [lines]);

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
        {groups.map((group, i) => (
          <div key={i} className={cn('mb-0.5 flex items-start gap-1.5', lineStyle(group.text))}>
            {/* Error icon for error lines */}
            {(group.text.includes('[ERROR]') || group.text.includes('error:') || group.text.includes('ECONNREFUSED')) && (
              <AlertTriangle size={10} className="shrink-0 mt-0.5 text-rose-400/60" />
            )}
            <span className="flex-1 break-all">{group.text}</span>
            {group.count > 1 && (
              <span className="shrink-0 text-[9px] font-bold px-1.5 py-0 rounded bg-white/10 text-white/50 leading-tight mt-px">
                ×{group.count}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
