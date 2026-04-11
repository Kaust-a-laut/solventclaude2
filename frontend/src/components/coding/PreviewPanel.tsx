import React from 'react';
import { motion } from 'framer-motion';
import { Globe, X } from 'lucide-react';

interface PreviewPanelProps {
  iframeUrl: string;
  onClose: () => void;
}

export const PreviewPanel: React.FC<PreviewPanelProps> = ({ iframeUrl, onClose }) => {
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: '40%', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      className="border-t border-white/[0.04] flex flex-col bg-white overflow-clip shrink-0"
    >
      <div className="h-8 bg-slate-100 flex items-center px-3 gap-2 shrink-0">
        <Globe size={12} className="text-slate-400" aria-hidden="true" />
        <span className="text-[11px] font-mono text-slate-300 flex-1 truncate">{iframeUrl}</span>
        <button type="button" onClick={onClose} aria-label="Close preview">
          <X size={14} className="text-slate-400 cursor-pointer" aria-hidden="true" />
        </button>
      </div>
      <iframe src={iframeUrl} className="flex-1 border-none" title="Preview" />
    </motion.div>
  );
};
