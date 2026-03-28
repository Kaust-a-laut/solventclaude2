import React from 'react';
import { 
  Terminal, GripHorizontal, Network, FileText, Save, 
  ExternalLink, Minimize2, X, FlaskConical, Code, 
  ScanEye, Globe, Sparkles, Zap, Smartphone
} from 'lucide-react';
import { cn } from '../lib/utils';

export const MissionControlPreview = () => {
  return (
    <div className="w-full h-full bg-[#050508] border border-white/10 rounded-xl overflow-hidden flex flex-col opacity-90 pointer-events-none select-none relative group/preview">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-white/[0.03] border-b border-white/5 shrink-0">
        <div className="flex items-center gap-2">
          <GripHorizontal size={10} className="text-slate-700" />
          <div className="flex items-center gap-1.5">
            <Terminal size={12} className="text-jb-purple" />
            <span className="text-[11px] font-black text-white uppercase tracking-widest">Mission Control</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
           <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[6px] font-black text-emerald-500 uppercase tracking-tighter">
              <Zap size={8} />
              <span>Live Sync</span>
           </div>
           <div className="w-[1px] h-3 bg-white/10" />
           <ExternalLink size={10} className="text-jb-accent animate-pulse" />
           <X size={10} className="text-slate-600" />
        </div>
      </div>

      {/* Content Area: Mini Overview */}
      <div className="flex-1 p-3 flex flex-col gap-4 overflow-hidden">
        
        {/* Mini Bento Tools */}
        <div className="grid grid-cols-4 gap-2">
           <div className="p-2 rounded-lg bg-jb-purple/10 border border-jb-purple/20 flex flex-col items-center gap-1">
              <FlaskConical size={10} className="text-jb-purple" />
              <div className="w-4 h-[1px] bg-white/10" />
           </div>
           <div className="p-2 rounded-lg bg-jb-accent/10 border border-jb-accent/20 flex flex-col items-center gap-1">
              <Code size={10} className="text-jb-accent" />
              <div className="w-4 h-[1px] bg-white/10" />
           </div>
           <div className="p-2 rounded-lg bg-jb-orange/10 border border-jb-orange/20 flex flex-col items-center gap-1">
              <ScanEye size={10} className="text-jb-orange" />
              <div className="w-4 h-[1px] bg-white/10" />
           </div>
           <div className="p-2 rounded-lg bg-jb-cyan/10 border border-jb-cyan/20 flex flex-col items-center gap-1">
              <Globe size={10} className="text-jb-cyan" />
              <div className="w-4 h-[1px] bg-white/10" />
           </div>
        </div>

        {/* Live Context Plans */}
        <div className="flex-1 space-y-3">
           <div className="space-y-1.5">
              <p className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] px-1">Active Directives</p>
              
              <div className="space-y-1">
                 <div className="p-2 rounded-lg bg-white/[0.03] border border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                       <Sparkles size={10} className="text-jb-purple" />
                       <span className="text-[11px] font-bold text-slate-300">Solvent UI Refactor</span>
                    </div>
                    <span className="text-[6px] font-mono text-jb-purple">STABLE</span>
                 </div>
                 
                 <div className="p-2 rounded-lg bg-white/[0.03] border border-white/5 flex items-center justify-between opacity-60">
                    <div className="flex items-center gap-2">
                       <Globe size={10} className="text-jb-cyan" />
                       <span className="text-[11px] font-bold text-slate-300">Trip to Paris - Logic</span>
                    </div>
                    <span className="text-[6px] font-mono text-slate-600">DRAFT</span>
                 </div>

                 <div className="p-2 rounded-lg bg-white/[0.03] border border-white/5 flex items-center justify-between opacity-40">
                    <div className="flex items-center gap-2">
                       <Network size={10} className="text-jb-accent" />
                       <span className="text-[11px] font-bold text-slate-300">Vector Knowledge Map</span>
                    </div>
                 </div>
              </div>
           </div>

           {/* Logic Preview Area */}
           <div className="h-20 rounded-lg border border-white/5 bg-black/40 flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 bg-jb-purple/5 blur-xl" />
              <Network size={24} className="text-jb-purple/20 animate-pulse" />
              <div className="absolute top-2 right-2 flex gap-1">
                 <div className="w-1 h-1 rounded-full bg-jb-purple shadow-[0_0_5px_#9D5BD2]" />
                 <div className="w-1 h-1 rounded-full bg-jb-purple shadow-[0_0_5px_#9D5BD2] opacity-50" />
              </div>
           </div>
        </div>

        {/* Footer Status */}
        <div className="flex justify-between items-center pt-2 border-t border-white/5 shrink-0">
           <div className="flex items-center gap-1.5">
              <Smartphone size={8} className="text-jb-accent" />
              <span className="text-[11px] font-black text-jb-accent uppercase tracking-widest">PiP Mode Detachable</span>
           </div>
           <span className="text-[11px] font-mono text-slate-700">KERNEL_SYNC_OK</span>
        </div>
      </div>

      {/* Styled Overlay */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-[1px] flex items-center justify-center p-6 text-center opacity-0 group-hover/preview:opacity-100 transition-opacity duration-500 z-50">
         <div className="space-y-4">
            <div className="space-y-1">
               <p className="text-white font-black text-sm uppercase tracking-[0.2em]">Try the Solvent Command Center</p>
               <p className="text-jb-purple text-[11px] font-bold uppercase tracking-widest">Live Context & Data Sync</p>
            </div>
            <div className="h-[1px] w-12 bg-jb-purple mx-auto" />
            <p className="text-[11px] text-slate-400 max-w-[200px] mx-auto leading-relaxed">
               Persistent project memory that follows you across your workspace. Detach into PiP to keep directives visible anywhere.
            </p>
         </div>
      </div>
    </div>
  );
};