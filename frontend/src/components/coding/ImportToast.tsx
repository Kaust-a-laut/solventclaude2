import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, X, ArrowRight } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

interface ImportToastProps {
  fileName: string;
  folder: string;
  filePath: string;
  fileContent: string;
  onDismiss: () => void;
}

export const ImportToast: React.FC<ImportToastProps> = ({
  fileName, folder, filePath, fileContent, onDismiss,
}) => {
  const { setOpenFiles, setActiveFile } = useAppStore();

  // Keep ref current so the timer callback always calls the latest onDismiss
  // without restarting the 5-second countdown on parent re-renders.
  const onDismissRef = useRef(onDismiss);
  useEffect(() => { onDismissRef.current = onDismiss; });

  useEffect(() => {
    const id = setTimeout(() => onDismissRef.current(), 5000);
    return () => clearTimeout(id);
  }, []); // fires exactly once on mount

  const handleOpenInChat = () => {
    // Read current store state at click time to avoid stale closure
    const { openFiles } = useAppStore.getState();
    if (!openFiles.find((f) => f.path === filePath)) {
      setOpenFiles([...openFiles, { path: filePath, content: fileContent }]);
    }
    setActiveFile(filePath);
    onDismiss();
  };

  const folderDisplay = folder === '.' ? '/' : `${folder}/`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.97 }}
      transition={{ duration: 0.18 }}
      className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl border border-white/10 bg-[#0d0d18] shadow-2xl max-w-sm"
    >
      <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
      <p className="flex-1 min-w-0 text-[11px] font-bold text-white/80 truncate">
        <span className="font-mono text-white">"{fileName}"</span>
        {' '}imported to{' '}
        <span className="font-mono">{folderDisplay}</span>
      </p>
      <button
        type="button"
        onClick={handleOpenInChat}
        className="flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-black uppercase tracking-wider bg-jb-accent/15 border border-jb-accent/25 text-jb-accent hover:bg-jb-accent/25 transition-colors shrink-0 whitespace-nowrap"
      >
        Open in chat <ArrowRight size={9} />
      </button>
      <button
        type="button"
        onClick={onDismiss}
        className="p-1 hover:bg-white/10 rounded text-white/20 hover:text-white/50 shrink-0"
        aria-label="Dismiss"
      >
        <X size={11} />
      </button>
    </motion.div>
  );
};
