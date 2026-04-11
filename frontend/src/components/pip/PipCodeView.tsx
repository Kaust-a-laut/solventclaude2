import React from 'react';
import {
  Code2, FileText, Diff, Check, XCircle, Loader2,
  MessageSquare, AlertCircle, Terminal as TerminalIcon,
  Trash2, ArrowRight, FolderOpen,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion } from 'framer-motion';
import { useAppStore } from '../../store/useAppStore';
import { PendingDiff, AgentMessage } from '../../store/codingSlice';
import { MiniTerminal } from './MiniTerminal';
import { TogglePill } from './TogglePill';

export interface PipCodeViewProps {
  terminalLines: string[];
  pendingDiff: PendingDiff | null;
  openFiles: { path: string; content: string }[];
  activeFile: string | null;
  fileTreeVisible: boolean;
  chatPanelVisible: boolean;
  terminalVisible: boolean;
  agentMessages: AgentMessage[];
  onSetFileTreeVisible: (v: boolean) => void;
  onSetChatPanelVisible: (v: boolean) => void;
  onSetTerminalVisible: (v: boolean) => void;
  onClearDiff: () => void;
  onClearTerminal: () => void;
  onLaunchMain: (mode: string) => void;
}

export const PipCodeView: React.FC<PipCodeViewProps> = ({
  terminalLines,
  pendingDiff,
  openFiles,
  activeFile,
  fileTreeVisible,
  chatPanelVisible,
  terminalVisible,
  agentMessages,
  onSetFileTreeVisible,
  onSetChatPanelVisible,
  onSetTerminalVisible,
  onClearDiff,
  onClearTerminal,
  onLaunchMain,
}) => (
  <motion.div
    key="code"
    initial={{ opacity: 0, x: 5 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -5 }}
    className="flex-1 flex flex-col p-3 gap-2 overflow-hidden"
  >
    {/* Status bar */}
    <div className="flex items-center gap-2 flex-shrink-0">
      <Code2 size={12} className="text-jb-accent" />
      <span className="text-[11px] font-black uppercase tracking-widest text-jb-accent">IDE Control</span>
      <div className="flex-1" />
      {pendingDiff && (
        <span className="px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[11px] font-black animate-pulse">
          Diff pending
        </span>
      )}
      {agentMessages.some(m => m.isStreaming) && (
        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-jb-accent/20 text-jb-accent text-[11px] font-black">
          <Loader2 size={8} className="animate-spin" /> Agent active
        </span>
      )}
      <button
        onClick={() => onLaunchMain('coding')}
        className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-black uppercase bg-jb-accent/10 text-jb-accent hover:bg-jb-accent/20 transition-all"
        title="Open full IDE"
      >
        Open IDE <ArrowRight size={8} />
      </button>
    </div>

    {/* Active file indicator */}
    {activeFile && (
      <div className="flex items-center gap-1.5 px-2 py-1.5 bg-black/30 rounded-lg border border-white/5 flex-shrink-0">
        <FileText size={10} className="text-jb-accent/60 shrink-0" />
        <span className="text-[11px] font-mono text-slate-400 truncate">{activeFile}</span>
      </div>
    )}

    {/* Open files list */}
    {openFiles.length > 0 && (
      <div className="flex-shrink-0 space-y-1">
        <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Open Files</span>
        <div className="flex flex-wrap gap-1">
          {openFiles.map((f) => {
            const name = f.path.split('/').pop() || f.path;
            const isActive = f.path === activeFile;
            return (
              <span
                key={f.path}
                className={cn(
                  'px-2 py-0.5 rounded-md text-[11px] font-mono border transition-all',
                  isActive
                    ? 'bg-jb-accent/15 border-jb-accent/30 text-jb-accent'
                    : 'bg-black/20 border-white/5 text-slate-300',
                )}
                title={f.path}
              >
                {name}
              </span>
            );
          })}
        </div>
      </div>
    )}

    {/* Pending diff card */}
    {pendingDiff && (
      <div className="flex-shrink-0 bg-amber-500/[0.04] border border-amber-500/15 rounded-xl p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Diff size={12} className="text-amber-400" />
          <span className="text-[11px] font-black uppercase tracking-widest text-amber-400">Pending Diff</span>
        </div>
        <p className="text-[11px] font-mono text-slate-400 truncate">{pendingDiff.filePath}</p>
        <p className="text-[11px] text-slate-300 line-clamp-2">{pendingDiff.description}</p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const { openFiles: files, setOpenFiles } = useAppStore.getState();
              const updated = files.map(f =>
                f.path === pendingDiff.filePath ? { ...f, content: pendingDiff.modified } : f
              );
              setOpenFiles(updated);
              onClearDiff();
            }}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-black uppercase bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-all border border-emerald-500/20"
          >
            <Check size={9} /> Apply
          </button>
          <button
            onClick={onClearDiff}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-black uppercase bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-all border border-rose-500/15"
          >
            <XCircle size={9} /> Reject
          </button>
        </div>
      </div>
    )}

    {/* Agent activity */}
    <div className="flex-shrink-0 max-h-[140px] overflow-hidden">
      <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5 ml-1">
        <MessageSquare size={8} />
        <span>Agent Activity</span>
        <span className="text-slate-400">({agentMessages.length})</span>
      </div>
      {agentMessages.length === 0 ? (
        <div className="flex items-center justify-center py-3 opacity-20">
          <span className="text-[11px] font-black uppercase">No agent activity</span>
        </div>
      ) : (
        <div className="space-y-1.5 overflow-y-auto max-h-[110px] no-scrollbar">
          {agentMessages.slice(-3).map((msg) => (
            <div
              key={msg.id}
              className={cn(
                'rounded-lg px-2.5 py-1.5 border text-[11px]',
                msg.role === 'user'
                  ? 'bg-jb-accent/[0.05] border-jb-accent/15 text-slate-400'
                  : 'bg-white/[0.02] border-white/5 text-slate-400',
              )}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className={cn(
                  'text-[11px] font-black uppercase tracking-wider',
                  msg.role === 'user' ? 'text-jb-accent' : 'text-emerald-400',
                )}>
                  {msg.role === 'user' ? 'You' : 'Agent'}
                </span>
                {msg.isStreaming && <Loader2 size={7} className="animate-spin text-jb-accent" />}
                {msg.fileContext && (
                  <span className="text-[6px] text-slate-400 font-mono ml-auto truncate max-w-[120px]">
                    {msg.fileContext.split('/').pop()}
                  </span>
                )}
              </div>
              <p className="line-clamp-2 leading-relaxed">{msg.content || (msg.isStreaming ? 'Thinking...' : '')}</p>
              {/* Tool events summary */}
              {msg.toolEvents && msg.toolEvents.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {msg.toolEvents
                    .filter(e => e.type === 'tool_start')
                    .slice(-4)
                    .map((e) => {
                      const hasResult = msg.toolEvents!.some(r => r.callId === e.callId && r.type === 'tool_result');
                      const hasError = msg.toolEvents!.some(r => r.callId === e.callId && r.type === 'tool_error');
                      const target = (e.args?.path as string)?.split('/').pop()
                        || (e.args?.command as string)?.slice(0, 20)
                        || e.tool;
                      return (
                        <span
                          key={e.callId}
                          className={cn(
                            'flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-mono border',
                            hasError ? 'bg-rose-500/10 border-rose-500/15 text-rose-400' :
                            hasResult ? 'bg-emerald-500/10 border-emerald-500/15 text-emerald-400' :
                            'bg-white/5 border-white/10 text-slate-300',
                          )}
                        >
                          {!hasResult && !hasError && <Loader2 size={7} className="animate-spin" />}
                          {hasResult && <Check size={7} />}
                          {hasError && <AlertCircle size={7} />}
                          {target}
                        </span>
                      );
                    })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>

    {/* Mini terminal */}
    <div className="flex-1 flex flex-col overflow-hidden min-h-0">
      <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5 ml-1">
        <TerminalIcon size={8} />
        <span>Terminal</span>
        <span className="text-slate-400">({terminalLines.length})</span>
        <button
          onClick={onClearTerminal}
          className="ml-auto p-0.5 rounded text-slate-400 hover:text-rose-400 transition-colors"
          title="Clear terminal"
        >
          <Trash2 size={8} />
        </button>
      </div>
      <MiniTerminal lines={terminalLines} />
    </div>

    {/* Quick actions */}
    <div className="flex items-center gap-1.5 flex-shrink-0 pt-1 border-t border-white/5">
      <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider mr-1">Panels:</span>
      <TogglePill
        icon={FolderOpen}
        label="Tree"
        active={fileTreeVisible}
        onClick={() => onSetFileTreeVisible(!fileTreeVisible)}
      />
      <TogglePill
        icon={MessageSquare}
        label="Chat"
        active={chatPanelVisible}
        onClick={() => onSetChatPanelVisible(!chatPanelVisible)}
      />
      <TogglePill
        icon={TerminalIcon}
        label="Term"
        active={terminalVisible}
        onClick={() => onSetTerminalVisible(!terminalVisible)}
      />
    </div>
  </motion.div>
);
