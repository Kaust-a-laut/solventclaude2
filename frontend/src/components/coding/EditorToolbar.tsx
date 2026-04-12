import React from 'react';
import { Save, Play, Loader2, Box, Terminal, Plus, FolderOpen } from 'lucide-react';
import { cn } from '../../lib/utils';

interface EditorToolbarProps {
  fileTreeVisible: boolean;
  chatPanelVisible: boolean;
  terminalVisible: boolean;
  setFileTreeVisible: (v: boolean) => void;
  setTerminalVisible: (v: boolean) => void;
  setChatPanelVisible: (v: boolean) => void;
  bootStatus: 'idle' | 'booting' | 'ready' | 'error';
  isRunning: boolean;
  activeFile: string | null;
  currentProject: { name: string } | null;
  onBootWebContainer: () => void;
  onRetryBoot: () => void;
  onSave: () => void;
  onRun: () => void;
  onNewProject: () => void;
  onOpenFolder: () => void;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  fileTreeVisible,
  chatPanelVisible,
  terminalVisible,
  setFileTreeVisible,
  setChatPanelVisible,
  setTerminalVisible,
  bootStatus,
  isRunning,
  activeFile,
  currentProject,
  onBootWebContainer,
  onRetryBoot,
  onSave,
  onRun,
  onNewProject,
  onOpenFolder,
}) => {
  return (
    <div className="h-11 flex items-center px-4 gap-3 border-b border-white/[0.04] shrink-0">
      <button
        type="button"
        onClick={() => setFileTreeVisible(!fileTreeVisible)}
        className={cn('p-1.5 rounded-lg transition-colors', fileTreeVisible ? 'text-jb-accent bg-jb-accent/10' : 'text-white/30 hover:text-white/60')}
        title="Toggle file tree (⌘B)"
        aria-label="Toggle file tree"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="3" width="7" height="18" /><rect x="14" y="3" width="7" height="18" /></svg>
      </button>

      {currentProject ? (
        <span className="text-[11px] font-bold text-white/40 truncate max-w-[120px]" title={currentProject.name}>
          {currentProject.name}
        </span>
      ) : (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onNewProject}
            className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold text-jb-accent hover:bg-jb-accent/10 transition-colors"
            title="New Project"
          >
            <Plus size={12} />
            <span className="hidden sm:inline">New</span>
          </button>
          <button
            type="button"
            onClick={onOpenFolder}
            className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold text-white/40 hover:bg-white/5 hover:text-white/60 transition-colors"
            title="Open Folder"
          >
            <FolderOpen size={12} />
            <span className="hidden sm:inline">Open</span>
          </button>
        </div>
      )}

      <div className="flex-1" />

      {/* Sandbox toggle */}
      {bootStatus === 'idle' && (
        <button
          type="button"
          onClick={onBootWebContainer}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-orange-500/30 bg-orange-500/5 text-orange-400 text-[11px] font-bold hover:bg-orange-500/10 transition-colors"
        >
          <Box size={12} aria-hidden="true" /> Sandbox
        </button>
      )}
      {bootStatus === 'booting' && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 text-orange-400/60 text-[11px] font-bold">
          <Loader2 size={12} className="animate-spin" aria-hidden="true" /> Booting…
        </div>
      )}
      {bootStatus === 'ready' && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 text-emerald-400 text-[11px] font-bold">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          Sandbox Active
        </div>
      )}
      {bootStatus === 'error' && (
        <button
          type="button"
          onClick={onRetryBoot}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-500/30 bg-rose-500/5 text-rose-400 text-[11px] font-bold hover:bg-rose-500/10 transition-colors"
        >
          <Box size={12} aria-hidden="true" /> Retry Sandbox
        </button>
      )}

      <button
        type="button"
        onClick={onSave}
        disabled={!activeFile}
        className="p-1.5 rounded-lg text-white/30 hover:text-white/60 disabled:opacity-20"
        aria-label="Save file"
      >
        {/* Fix 3: icon is decorative; button has aria-label */}
        <Save size={15} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={onRun}
        disabled={isRunning}
        className="p-1.5 rounded-lg text-jb-accent hover:bg-jb-accent/10 transition-colors disabled:opacity-40"
        aria-label="Run"
      >
        {/* Fix 3: icon is decorative; button has aria-label */}
        <Play size={15} fill="currentColor" fillOpacity={0.3} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => setChatPanelVisible(!chatPanelVisible)}
        className={cn('p-1.5 rounded-lg transition-colors', chatPanelVisible ? 'text-jb-accent bg-jb-accent/10' : 'text-white/30 hover:text-white/60')}
        title="Toggle agent chat (⌘⇧I)"
        aria-label="Toggle agent chat"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
      </button>
      <button
        type="button"
        onClick={() => setTerminalVisible(!terminalVisible)}
        className={cn('p-1.5 rounded-lg transition-colors', terminalVisible ? 'text-jb-accent bg-jb-accent/10' : 'text-white/30 hover:text-white/60')}
        title="Toggle terminal (⌘J)"
        aria-label="Toggle terminal"
      >
        <Terminal size={14} aria-hidden="true" />
      </button>
    </div>
  );
};
