import React, { useEffect, useState, useCallback } from 'react';
import { ChevronRight, ChevronDown, RefreshCw, Search, Plus, FolderOpen, X } from 'lucide-react';
import { ImportFileButton } from './ImportFileButton';
import { cn } from '../../lib/utils';
import { fetchWithRetry } from '../../lib/api-client';
import { BASE_URL } from '../../lib/config';
import { getFileIcon } from './fileIcons';
import { useAppStore } from '../../store/useAppStore';

interface FileNode {
  name: string;
  type: 'file' | 'directory';
  path: string;
  children?: FileNode[];
}

interface Props {
  onFileSelect: (path: string) => void;
}

export const FileTreePanel: React.FC<Props> = ({ onFileSelect }) => {
  const { openFiles, activeFile, fileTreeRefreshTrigger, currentProject, projectHistory, createNewProject, openProject, openFolder, closeProject } = useAppStore();
  const [nodes, setNodes] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showNewProjectInput, setShowNewProjectInput] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [showOpenFolderInput, setShowOpenFolderInput] = useState(false);
  const [openFolderPath, setOpenFolderPath] = useState('');

  const fetchFiles = useCallback(async () => {
    if (!currentProject) return;
    setLoading(true);
    try {
      const projectParam = currentProject.type === 'folder' ? '' : `?project=${currentProject.name}`;
      const url = currentProject.type === 'folder' 
        ? `${BASE_URL}/api/files/list?path=.` 
        : `${BASE_URL}/api/files/list${projectParam}`;
      const data = await fetchWithRetry(url);
      setNodes(Array.isArray(data) ? data : []);
    } catch {
      setNodes([]);
    } finally {
      setLoading(false);
    }
  }, [currentProject]);

  const handleCreateProject = () => {
    if (newProjectName.trim()) {
      createNewProject(newProjectName.trim());
      setNewProjectName('');
      setShowNewProjectInput(false);
    }
  };

  const handleOpenFolder = () => {
    if (openFolderPath.trim()) {
      openFolder(openFolderPath.trim());
      setOpenFolderPath('');
      setShowOpenFolderInput(false);
    }
  };

  const toggle = (path: string) =>
    setExpanded((prev) => ({ ...prev, [path]: !prev[path] }));

  const isModified = (path: string) =>
    openFiles.some((f) => f.path === path);

  const renderNode = (node: FileNode, depth = 0) => {
    const icon = getFileIcon(node.name);
    const isActive = activeFile === node.path;
    const modified = node.type === 'file' && isModified(node.path);

    return (
      <div key={node.path}>
        <div
          onClick={() => node.type === 'directory' ? toggle(node.path) : onFileSelect(node.path)}
          className={cn(
            'flex items-center gap-1.5 py-[3px] pr-2 cursor-pointer transition-colors text-[12px]',
            'hover:bg-white/5 rounded',
            isActive && 'bg-jb-accent/10 text-jb-accent',
            !isActive && node.type === 'file' && 'text-slate-300',
            !isActive && node.type === 'directory' && 'text-slate-200 font-medium',
          )}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          {node.type === 'directory' && (
            <span className="text-slate-300 shrink-0">
              {expanded[node.path] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </span>
          )}
          <span className={cn('shrink-0', node.type === 'file' ? icon.color : 'text-indigo-400')}>
            {node.type === 'directory' ? '📁' : icon.emoji}
          </span>
          <span className="truncate flex-1">{node.name}</span>
          {modified && (
            <span className="w-1.5 h-1.5 rounded-full bg-jb-accent shrink-0" title="Modified" />
          )}
        </div>
        {node.type === 'directory' && expanded[node.path] && node.children?.map((c) => renderNode(c, depth + 1))}
      </div>
    );
  };

  if (!currentProject) {
    return (
      <div className="h-full flex flex-col overflow-hidden bg-transparent">
        <div className="px-3 py-2 flex items-center justify-between border-b border-white/[0.04] shrink-0">
          <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white/30">Explorer</span>
        </div>

        <div className="px-3 py-3 space-y-2 shrink-0">
          <button
            onClick={() => setShowNewProjectInput(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-jb-accent/10 border border-jb-accent/20 text-jb-accent text-[11px] font-bold hover:bg-jb-accent/20 transition-colors"
          >
            <Plus size={12} />
            New Project
          </button>
          <button
            onClick={() => setShowOpenFolderInput(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 text-white/50 text-[11px] font-bold hover:bg-white/5 hover:text-white/70 transition-colors"
          >
            <FolderOpen size={12} />
            Open Folder
          </button>
        </div>

        {showNewProjectInput && (
          <div className="px-3 pb-3 shrink-0">
            <div className="flex items-center gap-1 p-2 rounded-lg border border-jb-accent/30 bg-jb-accent/5">
              <input
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
                placeholder="Project name..."
                className="flex-1 bg-transparent text-[12px] text-white placeholder-white/30 outline-none"
                autoFocus
              />
              <button
                onClick={handleCreateProject}
                className="p-1 hover:bg-white/10 rounded text-jb-accent"
              >
                <Plus size={12} />
              </button>
              <button
                onClick={() => { setShowNewProjectInput(false); setNewProjectName(''); }}
                className="p-1 hover:bg-white/10 rounded text-white/30"
              >
                <X size={12} />
              </button>
            </div>
          </div>
        )}

        {showOpenFolderInput && (
          <div className="px-3 pb-3 shrink-0">
            <div className="flex items-center gap-1 p-2 rounded-lg border border-white/10 bg-white/5">
              <input
                type="text"
                value={openFolderPath}
                onChange={(e) => setOpenFolderPath(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleOpenFolder()}
                placeholder="/absolute/path/to/folder"
                className="flex-1 bg-transparent text-[12px] text-white placeholder-white/30 outline-none font-mono"
                autoFocus
              />
              <button
                onClick={handleOpenFolder}
                className="p-1 hover:bg-white/10 rounded text-white/50"
              >
                <FolderOpen size={12} />
              </button>
              <button
                onClick={() => { setShowOpenFolderInput(false); setOpenFolderPath(''); }}
                className="p-1 hover:bg-white/10 rounded text-white/30"
              >
                <X size={12} />
              </button>
            </div>
          </div>
        )}

        {projectHistory.length > 0 && (
          <>
            <div className="px-3 py-2 shrink-0">
              <span className="text-[11px] font-black uppercase tracking-[0.15em] text-white/20">Recent Projects</span>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
              {projectHistory.map((project) => (
                <button
                  key={project.type === 'folder' ? project.path : project.name}
                  onClick={() => project.type === 'folder' ? openFolder(project.path) : openProject(project.name)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-[12px] text-white/50 hover:bg-white/5 hover:text-white/80 transition-colors"
                >
                  <span className="shrink-0">{project.type === 'folder' ? '📂' : '📁'}</span>
                  <span className="truncate">{project.name}</span>
                  <span className="text-[10px] text-white/20 ml-auto shrink-0">
                    {project.type === 'folder' ? 'folder' : 'scratchpad'}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        {projectHistory.length === 0 && !showNewProjectInput && !showOpenFolderInput && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-[11px] text-white/20 text-center px-4">
              No project open.<br />Create a new project or open a folder.
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-transparent">
      <div className="px-3 py-2 flex items-center justify-between border-b border-white/[0.04] shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white/30 truncate">
            {currentProject.name}
          </span>
          <button
            onClick={closeProject}
            className="p-1 hover:bg-white/10 rounded text-white/30 hover:text-white/60 shrink-0"
            title="Close project"
          >
            <X size={10} />
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={fetchFiles}
            className={cn('p-1 hover:bg-white/10 rounded text-white/30 hover:text-white/60', loading && 'animate-spin')}
          >
            <RefreshCw size={11} />
          </button>
          <button className="p-1 hover:bg-white/10 rounded text-white/30 hover:text-white/60">
            <Search size={11} />
          </button>
          <ImportFileButton onImported={fetchFiles} />
        </div>
      </div>

      <div className="px-3 py-1.5 shrink-0">
        <span className="text-[11px] font-black uppercase tracking-[0.15em] text-white/20">Files</span>
      </div>

      <div className="flex-1 min-h-0 relative">
        <div className="absolute inset-0 overflow-y-auto scrollbar-thin py-1">
          {loading ? (
            <div className="px-3 py-4 flex justify-center">
              <RefreshCw size={14} className="text-white/30 animate-spin" />
            </div>
          ) : nodes.length > 0 ? (
            nodes.map((n) => renderNode(n))
          ) : (
            <div className="px-3 py-4 text-center text-[11px] text-white/30">
              No files yet. Import or create files to get started.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};