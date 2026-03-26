import React, { useEffect, useState, useCallback } from 'react';
import { ChevronRight, ChevronDown, RefreshCw, Search } from 'lucide-react';
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
  const { openFiles, activeFile, fileTreeRefreshTrigger } = useAppStore();
  const [nodes, setNodes] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchWithRetry(`${BASE_URL}/api/files/list?path=.`);
      setNodes(Array.isArray(data) ? data : []);
    } catch {
      setNodes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  // Re-fetch when agent triggers a file tree refresh
  useEffect(() => {
    if (fileTreeRefreshTrigger > 0) fetchFiles();
  }, [fileTreeRefreshTrigger, fetchFiles]);

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
            <span className="text-slate-500 shrink-0">
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

  return (
    <div className="h-full flex flex-col overflow-hidden bg-transparent">
      {/* Header */}
      <div className="px-3 py-2 flex items-center justify-between border-b border-white/[0.04] shrink-0">
        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/30">Explorer</span>
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
      {/* Files section label */}
      <div className="px-3 py-1.5 shrink-0">
        <span className="text-[8px] font-black uppercase tracking-[0.15em] text-white/20">Files</span>
      </div>
      {/* Tree */}
      <div className="flex-1 min-h-0 relative">
        <div className="absolute inset-0 overflow-y-auto scrollbar-thin py-1">
          {nodes.map((n) => renderNode(n))}
        </div>
      </div>
    </div>
  );
};
