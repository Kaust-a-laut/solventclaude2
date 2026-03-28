import React, { useState } from 'react';
import { 
  ScanEye, Sparkles, Wand2, Scissors, 
  Palette, MousePointer2, Box, Loader2, 
  Target, Zap, Code, Shield
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface ToolControlProps {
  activeTool: string;
  onAction: (action: string, data?: any) => void;
  isProcessing: boolean;
}

export const VisionToolControls: React.FC<ToolControlProps> = ({ activeTool, onAction, isProcessing }) => {
  const [localInput, setLocalInput] = useState("");

  const renderToolUI = () => {
    switch (activeTool) {
      case 'analyze':
        return (
          <div className="space-y-3">
            <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
              Perform a deep structural audit of the visual entity. AI will identify UI components, spacing, and hierarchy.
            </p>
            <button 
              onClick={() => onAction('Deep Scan')}
              disabled={isProcessing}
              className="w-full flex items-center justify-center gap-2 py-3 bg-jb-accent/10 border border-jb-accent/20 text-jb-accent rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-jb-accent hover:text-white transition-all shadow-lg"
            >
              <ScanEye size={14} /> Initiate Logic Scan
            </button>
          </div>
        );

      case 'generate':
        return (
          <div className="space-y-3">
            <textarea 
              value={localInput}
              onChange={(e) => setLocalInput(e.target.value)}
              placeholder="What should I generate or fill in?"
              className="w-full h-20 bg-white/[0.03] border border-white/10 rounded-xl p-3 text-[11px] font-bold text-white outline-none focus:border-jb-orange/40 transition-all resize-none placeholder:text-slate-700"
            />
            <button 
              onClick={() => onAction('Gen-Fill', localInput)}
              disabled={isProcessing || !localInput.trim()}
              className="w-full flex items-center justify-center gap-2 py-3 bg-jb-orange/10 border border-jb-orange/20 text-jb-orange rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-jb-orange hover:text-black transition-all shadow-lg"
            >
              <Sparkles size={14} /> Predict & Generate
            </button>
          </div>
        );

      case 'edit':
        return (
          <div className="space-y-3">
            <input 
              value={localInput}
              onChange={(e) => setLocalInput(e.target.value)}
              placeholder="Change the button to blue, make it larger..."
              className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-[11px] font-bold text-white outline-none focus:border-jb-purple/40 transition-all"
            />
            <button 
              onClick={() => onAction('Agentic Edit', localInput)}
              disabled={isProcessing || !localInput.trim()}
              className="w-full flex items-center justify-center gap-2 py-3 bg-jb-purple/10 border border-jb-purple/20 text-jb-purple rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-jb-purple hover:text-white transition-all shadow-lg"
            >
              <Wand2 size={14} /> Execute Modification
            </button>
          </div>
        );

      case 'colors':
        return (
          <div className="space-y-3">
            <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
              Analyze the color DNA of this entity. Extracts hex codes and generates a cohesive theme palette.
            </p>
            <button 
              onClick={() => onAction('Extract Palette')}
              disabled={isProcessing}
              className="w-full flex items-center justify-center gap-2 py-3 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-amber-500 hover:text-black transition-all"
            >
              <Palette size={14} /> Extract Color DNA
            </button>
          </div>
        );

      case 'crop':
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
               {['Square', '16:9', '4:3', 'UI Component'].map(aspect => (
                 <button 
                   key={aspect}
                   onClick={() => onAction('Crop Prep', aspect)}
                   className="py-2.5 rounded-xl bg-white/[0.03] border border-white/5 text-[11px] font-black uppercase text-slate-500 hover:text-white hover:border-white/10 transition-all"
                 >
                   {aspect}
                 </button>
               ))}
            </div>
            <button 
              onClick={() => onAction('Execute Crop')}
              disabled={isProcessing}
              className="w-full flex items-center justify-center gap-2 py-3 bg-jb-purple/10 border border-jb-purple/20 text-jb-purple rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-jb-purple hover:text-white transition-all shadow-lg"
            >
              <Scissors size={14} /> Auto-Focus Crop
            </button>
          </div>
        );

      default:
        return (
          <div className="flex flex-col items-center justify-center p-8 text-center opacity-40">
             <Target size={32} className="mb-4" />
             <p className="text-[11px] font-black uppercase tracking-widest">Select a toolkit agent to begin</p>
          </div>
        );
    }
  };

  return (
    <div className="p-4 rounded-[2rem] bg-white/[0.02] border border-white/5 shadow-2xl relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
         <Box size={40} />
      </div>
      <div className="flex items-center gap-3 mb-4">
         <div className="w-1.5 h-1.5 rounded-full bg-jb-accent animate-pulse shadow-[0_0_8px_rgba(60,113,247,0.8)]" />
         <span className="text-[11px] font-black text-white uppercase tracking-widest">Active Directive</span>
      </div>
      {renderToolUI()}
    </div>
  );
};
