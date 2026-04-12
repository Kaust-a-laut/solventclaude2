import React from 'react';
import { Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';

interface MissionDirectiveInputProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  isStreaming: boolean;
  rows?: number;
  vibrantBorder?: boolean;
}

export function MissionDirectiveInput({
  value,
  onChange,
  onSubmit,
  isStreaming,
  rows = 3,
  vibrantBorder = false,
}: MissionDirectiveInputProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && e.metaKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className={cn('rounded-[2rem]', vibrantBorder && 'vibrant-border')}>
      <div className="glass-panel rounded-[2rem] overflow-hidden">
        <div className="flex flex-col gap-4 p-5">
          <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
            Mission Directive
          </span>
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe the complex task for the pipeline to orchestrate..."
            rows={rows}
            disabled={isStreaming}
            className="w-full bg-transparent text-[14px] font-medium text-white placeholder:text-slate-800 resize-none outline-none leading-relaxed input-focus-ring disabled:opacity-50 transition-opacity"
          />
          <div className="flex items-center justify-between pt-1 border-t border-white/[0.04]">
            <span className="text-[11px] text-slate-400 font-mono">⌘↩ to submit</span>
            <button
              onClick={onSubmit}
              disabled={!value.trim() || isStreaming}
              className="flex items-center gap-2 px-5 py-2 rounded-full bg-jb-purple/15 border border-jb-purple/25 text-jb-purple text-[11px] font-black uppercase tracking-widest hover:bg-jb-purple/25 disabled:opacity-30 transition-all shadow-lg"
            >
              <Sparkles size={13} className={isStreaming ? 'animate-pulse' : ''} />
              {isStreaming ? 'Processing...' : 'Initiate'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
