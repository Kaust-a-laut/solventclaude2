import React, { useEffect, useState } from 'react';
import {
  Minus, Square, X,
  Search, Settings, Brain
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAppStore } from '../store/useAppStore';
import { motion } from 'framer-motion';
import { Logo } from './Logo';

export const TitleBar = () => {
  const {
    setSettingsOpen, deviceInfo, isProcessing,
    isCommandCenterOpen, toggleCommandCenter,
    setCurrentMode
  } = useAppStore();
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.electron) {
      setIsElectron(true);
    }
  }, []);

  return (
    <div className={cn(
      "bg-black border-b border-white/5 flex items-center justify-between select-none z-[9999] relative shrink-0",
      deviceInfo.isMobile ? "h-14 px-4" : "h-14 px-4"
    )}>
      {/* 1. Brand & System Status */}
      <div className="flex items-center gap-6 min-w-[180px] h-full app-drag-region">
        <div className="flex items-center gap-3">
          <div className="relative group">
            <div className="absolute inset-0 bg-jb-orange/20 blur-lg rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
            <div
              className="w-8 h-8 relative flex items-center justify-center cursor-pointer shrink-0 group-hover:rotate-12 transition-transform"
              onClick={() => setCurrentMode('home')}
            >
              <Logo size="sm" variant="beaker" animated={true} ariaLabel="Solvent AI Home" />
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] font-[900] tracking-[0.25em] text-white uppercase leading-none">Solvent AI</span>
          </div>
        </div>

        <div className="h-6 w-[1px] bg-white/10" />

        <button
          onClick={toggleCommandCenter}
          className={cn(
            "flex items-center gap-3 px-4 py-2 rounded-xl transition-all border group relative overflow-hidden app-no-drag",
            isCommandCenterOpen
              ? "bg-jb-purple/20 border-jb-purple/40 text-jb-purple shadow-[0_0_20px_rgba(157,91,210,0.2)]"
              : "bg-white/5 border-white/5 text-slate-400 hover:text-white hover:border-white/10"
          )}
          title="Command Center"
        >
           <Brain size={14} className={cn(isProcessing && "animate-pulse")} />
           <span className="text-[11px] font-black uppercase tracking-[0.2em] hidden xl:inline">Command Center</span>
           {isProcessing && <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-jb-orange rounded-full animate-pulse" />}
        </button>
      </div>

      {/* 2. Global Command Center (Omni-search) */}
      {!deviceInfo.isMobile && (
        <div className="absolute left-1/2 -translate-x-1/2 w-full max-w-[350px] xl:max-w-[450px] app-no-drag hidden lg:block">
           <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-jb-accent/10 via-jb-purple/10 to-jb-orange/10 rounded-xl blur-md opacity-0 group-focus-within:opacity-100 transition-opacity" />
              <div className="relative flex items-center bg-white/[0.03] border border-white/10 rounded-xl px-5 py-2 backdrop-blur-xl group-focus-within:border-white/20 transition-all">
                 <Search size={14} className="text-slate-500 mr-3" />
            <input
              id="solvent-command-search"
              name="solvent-command-search"
              type="text"
              placeholder="Search // Command Solvent..."
              autoComplete="off"
              className="flex-1 bg-transparent border-none outline-none text-xs font-bold text-white placeholder:text-slate-600"
            />
                 <div className="flex items-center gap-2">
                    <div className="px-1.5 py-0.5 rounded-md bg-black border border-white/5 text-[11px] font-black text-slate-500 uppercase tracking-widest">
                       ⌘K
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* 3. Utilities & Window Controls */}
      <div className="flex items-center gap-1 h-full min-w-[180px] justify-end app-no-drag">
        {/* Global Utilities */}
        <div className="flex items-center gap-1 pr-4">
           <button
             onClick={() => setSettingsOpen(true)}
             className="p-2.5 rounded-xl text-slate-500 hover:text-white hover:bg-white/5 transition-all border border-transparent hover:border-white/5"
             title="System Settings"
           >
              <Settings size={16} />
           </button>
        </div>

        {isElectron && (
          <>
            <div className="h-4 w-[1px] bg-white/10 mx-2" />
            <button
              onClick={() => window.electron?.minimize()}
              className="h-full w-12 flex items-center justify-center hover:bg-white/5 text-slate-500 hover:text-white transition-colors"
            >
              <Minus size={16} />
            </button>

            <button
              onClick={() => window.electron?.maximize()}
              className="h-full w-12 flex items-center justify-center hover:bg-white/5 text-slate-500 hover:text-white transition-colors"
            >
              <Square size={14} />
            </button>

            <button
              onClick={() => window.electron?.close()}
              className="h-full w-12 flex items-center justify-center hover:bg-red-500 text-slate-500 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </>
        )}
      </div>

      <style>{`
        .app-drag-region {
          -webkit-app-region: drag;
        }
        .app-no-drag {
          -webkit-app-region: no-drag;
        }
      `}</style>
    </div>
  );
};
