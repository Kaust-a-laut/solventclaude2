import React from 'react';
import { motion } from 'framer-motion';
import { Globe, X, RefreshCw, PanelRightClose } from 'lucide-react';

interface PreviewPanelProps {
  iframeUrl: string;
  onClose: () => void;
  editorVisible: boolean;
  onToggleEditor: () => void;
}

export const PreviewPanel: React.FC<PreviewPanelProps> = ({ iframeUrl, onClose, editorVisible, onToggleEditor }) => {
  const iframeRef = React.useRef<HTMLIFrameElement>(null);

  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className="shrink-0 flex flex-col border-l border-white/[0.04] overflow-clip bg-white"
      style={{ width: '45%', minWidth: 360 }}
    >
      {/* Browser chrome */}
      <div className="h-9 bg-[#0d0d18] flex items-center px-3 gap-2 shrink-0 border-b border-white/[0.04]">
        <button
          type="button"
          onClick={onToggleEditor}
          className="p-1 hover:bg-white/10 rounded text-white/30 hover:text-white/60 transition-colors shrink-0"
          aria-label={editorVisible ? 'Hide editor' : 'Show editor'}
          title={editorVisible ? 'Hide editor (⌘E)' : 'Show editor (⌘E)'}
        >
          <PanelRightClose size={11} style={{ transform: editorVisible ? 'none' : 'scaleX(-1)' }} aria-hidden="true" />
        </button>
        <Globe size={12} className="text-white/30 shrink-0" aria-hidden="true" />
        <span className="text-[11px] font-mono text-white/40 flex-1 truncate min-w-0">{iframeUrl}</span>
        <button
          type="button"
          onClick={() => iframeRef.current?.contentWindow?.location.reload()}
          className="p-1 hover:bg-white/10 rounded text-white/30 hover:text-white/60 transition-colors shrink-0"
          aria-label="Reload preview"
        >
          <RefreshCw size={11} />
        </button>
        <button
          type="button"
          onClick={onClose}
          className="p-1 hover:bg-white/10 rounded text-white/30 hover:text-white/60 transition-colors shrink-0"
          aria-label="Close preview"
        >
          <X size={11} />
        </button>
      </div>

      {/* Preview iframe — fills remaining height */}
      <iframe
        ref={iframeRef}
        src={iframeUrl}
        className="flex-1 border-none w-full h-full"
        title="App preview"
      />
    </motion.div>
  );
};
