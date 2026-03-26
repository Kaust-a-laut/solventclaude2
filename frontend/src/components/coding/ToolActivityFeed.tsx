import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Check, Loader2, AlertCircle, FileText, FolderOpen, Terminal, Globe, Search, Wrench } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { ToolEvent } from '../../store/codingSlice';

const TOOL_DISPLAY: Record<string, { icon: React.ElementType; verb: string; pastVerb: string }> = {
  read_file:         { icon: FileText,    verb: 'Reading',    pastVerb: 'Read' },
  write_file:        { icon: FileText,    verb: 'Writing',    pastVerb: 'Wrote' },
  list_files:        { icon: FolderOpen,  verb: 'Listing',    pastVerb: 'Listed' },
  run_shell:         { icon: Terminal,    verb: 'Running',    pastVerb: 'Ran' },
  web_search:        { icon: Search,      verb: 'Searching',  pastVerb: 'Searched' },
  fetch_web_content: { icon: Globe,       verb: 'Fetching',   pastVerb: 'Fetched' },
  ide_open_file:     { icon: FileText,    verb: 'Opening',    pastVerb: 'Opened' },
  ide_show_diff:     { icon: FileText,    verb: 'Showing diff', pastVerb: 'Showed diff' },
  ide_run_in_sandbox:{ icon: Terminal,    verb: 'Running in sandbox', pastVerb: 'Ran in sandbox' },
};

function getToolLabel(event: ToolEvent): string {
  const display = TOOL_DISPLAY[event.tool];
  const verb = event.type === 'tool_start' ? display?.verb ?? 'Using' : display?.pastVerb ?? 'Used';
  const target = (event.args?.path as string) || (event.args?.command as string) || (event.args?.query as string) || (event.args?.url as string) || '';
  const shortTarget = target.length > 50 ? '...' + target.slice(-47) : target;
  return shortTarget ? `${verb} ${shortTarget}` : `${verb} ${event.tool}`;
}

interface Props {
  events: ToolEvent[];
}

export const ToolActivityFeed: React.FC<Props> = ({ events }) => {
  const [expanded, setExpanded] = useState(false);

  if (!events || events.length === 0) return null;

  // Group events by callId into pairs (start + result/error)
  const grouped = new Map<string, ToolEvent[]>();
  for (const e of events) {
    const list = grouped.get(e.callId) ?? [];
    list.push(e);
    grouped.set(e.callId, list);
  }

  const entries = Array.from(grouped.values());
  const completedCount = entries.filter(g => g.some(e => e.type === 'tool_result')).length;
  const errorCount = entries.filter(g => g.some(e => e.type === 'tool_error')).length;
  const pendingCount = entries.filter(g => g.every(e => e.type === 'tool_start')).length;

  return (
    <div className="my-1.5">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-[10px] text-white/40 hover:text-white/60 transition-colors"
      >
        {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        <Wrench size={10} />
        <span>
          {pendingCount > 0 ? `${pendingCount} tool${pendingCount > 1 ? 's' : ''} running` : ''}
          {pendingCount > 0 && completedCount > 0 ? ', ' : ''}
          {completedCount > 0 ? `${completedCount} completed` : ''}
          {errorCount > 0 ? `, ${errorCount} failed` : ''}
        </span>
      </button>

      {expanded && (
        <div className="mt-1 ml-2 space-y-0.5 border-l border-white/[0.06] pl-2">
          {entries.map((group) => {
            const start = group.find(e => e.type === 'tool_start');
            const result = group.find(e => e.type === 'tool_result');
            const error = group.find(e => e.type === 'tool_error');

            if (!start) return null;

            const display = TOOL_DISPLAY[start.tool] ?? { icon: Wrench };
            const Icon = display.icon;
            const isDone = !!result;
            const isFailed = !!error;
            const isPending = !isDone && !isFailed;

            return (
              <div
                key={start.callId}
                className={cn(
                  'flex items-center gap-1.5 text-[10px] py-0.5',
                  isFailed ? 'text-rose-400/70' : isDone ? 'text-emerald-400/60' : 'text-white/40'
                )}
              >
                {isPending && <Loader2 size={10} className="animate-spin shrink-0" />}
                {isDone && <Check size={10} className="shrink-0" />}
                {isFailed && <AlertCircle size={10} className="shrink-0" />}
                <Icon size={10} className="shrink-0" />
                <span className="truncate">
                  {isFailed ? `${getToolLabel({ ...start, type: 'tool_result' })}: ${error!.error}` : getToolLabel(start)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
