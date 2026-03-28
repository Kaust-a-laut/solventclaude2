import React, { useEffect, useState } from 'react';
import { Folder, FileCode, ChevronRight, ChevronDown, RefreshCw } from 'lucide-react';
import { cn } from '../lib/utils';
import { BASE_URL } from '../lib/config';
import { fetchWithRetry } from '../lib/api-client';

interface FileNode {
  name: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  path: string;
}

export const FileExplorer = ({ onFileSelect }: { onFileSelect: (path: string) => void }) => {
  const [files, setFiles] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const data = await fetchWithRetry(`${BASE_URL}/api/files/list?path=.`);
      setFiles(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Failed to fetch files", e);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchFiles(); }, []);

  const toggleFolder = (path: string) => {
    setExpanded(prev => ({ ...prev, [path]: !prev[path] }));
  };

  const renderNode = (node: FileNode, depth = 0) => {
    const isExpanded = expanded[node.path];
    
    return (
      <div key={node.path} className="select-none">
        <div 
          onClick={() => node.type === 'directory' ? toggleFolder(node.path) : onFileSelect(node.path)}
          className={cn(
            "flex items-center gap-2 py-1 px-2 hover:bg-white/5 cursor-pointer text-sm transition-colors",
            node.type === 'file' ? "text-slate-400" : "text-slate-200"
          )}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          {node.type === 'directory' && (
            isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
          )}
          {node.type === 'directory' ? <Folder size={14} className="text-indigo-400" /> : <FileCode size={14} className="text-blue-400" />}
          <span className="truncate">{node.name}</span>
        </div>
        
        {node.type === 'directory' && isExpanded && node.children && (
          <div>{node.children.map(child => renderNode(child, depth + 1))}</div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-slate-900/50 border-r border-slate-800 w-64">
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-tighter text-slate-500">Explorer</span>
        <button onClick={fetchFiles} className={cn("p-1 hover:bg-white/10 rounded", loading && "animate-spin")}>
          <RefreshCw size={12} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        {files.map(node => renderNode(node))}
      </div>
    </div>
  );
};
