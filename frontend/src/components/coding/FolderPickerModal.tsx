import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FolderOpen, X, Check, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { fetchWithRetry } from '../../lib/api-client';
import { BASE_URL } from '../../lib/config';

interface FileNode {
  name: string;
  type: 'file' | 'directory';
  path: string;
  children?: FileNode[];
}

function flattenDirs(nodes: FileNode[], acc: string[] = []): string[] {
  for (const n of nodes) {
    if (n.type === 'directory') {
      acc.push(n.path);
      if (n.children) flattenDirs(n.children, acc);
    }
  }
  return acc;
}

interface FolderPickerModalProps {
  fileName: string;
  onConfirm: (folder: string) => void;
  onClose: () => void;
}

export const FolderPickerModal: React.FC<FolderPickerModalProps> = ({ fileName, onConfirm, onClose }) => {
  const [dirs, setDirs] = useState<string[]>(['.']);
  const [selected, setSelected] = useState('.');
  const [loading, setLoading] = useState(true);
  const [fetchFailed, setFetchFailed] = useState(false);

  useEffect(() => {
    fetchWithRetry(`${BASE_URL}/api/files/list?path=.`)
      .then((data) => {
        const nodes = Array.isArray(data) ? (data as FileNode[]) : [];
        setDirs(['.', ...flattenDirs(nodes)]);
      })
      .catch(() => setFetchFailed(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AnimatePresence>
      <motion.div
        key="overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          key="modal"
          initial={{ opacity: 0, scale: 0.95, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 8 }}
          transition={{ duration: 0.15 }}
          onClick={(e) => e.stopPropagation()}
          className="w-80 rounded-2xl border border-white/10 bg-[#0d0d18] shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <FolderOpen size={14} className="text-jb-accent" />
              <span className="text-[11px] font-black uppercase tracking-widest text-white/60">Import to project</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1 hover:bg-white/10 rounded text-white/30 hover:text-white/60"
              aria-label="Close"
            >
              <X size={12} />
            </button>
          </div>

          {/* File name label */}
          <div className="px-4 pt-3 pb-1">
            <p className="text-[10px] text-white/40">
              Importing <span className="font-mono text-white/70">{fileName}</span>
            </p>
            <p className="text-[10px] text-white/30 mt-0.5">Choose destination folder:</p>
          </div>

          {/* Folder list */}
          <div className="mx-3 my-2 rounded-xl border border-white/[0.06] bg-white/[0.02] max-h-48 overflow-y-auto scrollbar-thin">
            {loading ? (
              <div className="px-3 py-4 flex justify-center">
                <Loader2 size={14} className="text-white/30 animate-spin" />
              </div>
            ) : (
              dirs.map((dir) => (
                <button
                  key={dir}
                  type="button"
                  onClick={() => setSelected(dir)}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-1.5 text-left text-[11px] font-mono transition-colors',
                    selected === dir
                      ? 'bg-jb-accent/10 text-jb-accent'
                      : 'text-white/50 hover:bg-white/5 hover:text-white/80'
                  )}
                >
                  {selected === dir && <Check size={10} className="shrink-0" />}
                  {selected !== dir && <span className="w-[10px] shrink-0" />}
                  {dir === '.' ? '/ (project root)' : dir}
                </button>
              ))
            )}
          </div>

          {/* Fallback note */}
          {fetchFailed && (
            <p className="px-4 pb-1 text-[9px] text-amber-400/60">
              Couldn't load folders — will import to project root
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-white/[0.06]">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl text-[10px] font-bold text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onConfirm(selected)}
              className="px-3 py-1.5 rounded-xl text-[10px] font-black bg-jb-accent/15 border border-jb-accent/25 text-jb-accent hover:bg-jb-accent/25 transition-colors"
            >
              Import
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
