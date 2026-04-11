import React from 'react';
import { Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';

export interface PipNotesViewProps {
  notepadContent: string;
  onContentChange: (v: string) => void;
}

export const PipNotesView: React.FC<PipNotesViewProps> = ({ notepadContent, onContentChange }) => (
  <motion.div
    key="notes"
    initial={{ opacity: 0, x: 5 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -5 }}
    className="flex-1 flex flex-col gap-2 p-3"
  >
    <div className="flex items-center justify-between px-1">
      <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Your Notes</span>
      <button
        onClick={() => { onContentChange(''); window.electron?.saveNotepad(''); }}
        className="p-1 hover:text-red-400 transition-colors"
      >
        <Trash2 size={10} />
      </button>
    </div>
    <textarea
      value={notepadContent}
      onChange={(e) => { onContentChange(e.target.value); window.electron?.saveNotepad(e.target.value); }}
      className="flex-1 bg-black/20 border border-white/5 rounded-xl p-3 text-[11px] font-mono leading-relaxed outline-none resize-none text-slate-300 placeholder:text-slate-800"
      placeholder="Type your notes here..."
      spellCheck={false}
    />
  </motion.div>
);
