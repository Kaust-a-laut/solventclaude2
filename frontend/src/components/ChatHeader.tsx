import React, { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { cn } from '../lib/utils';
import { History, ChevronDown, Check, Cloud, Cpu, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SessionHistory } from './SessionHistory';
import { PROVIDER_GROUPS } from '../lib/allModels';

interface ChatHeaderProps {
  compact?: boolean;
}

export const ChatHeader = ({ compact }: ChatHeaderProps) => {
  const {
    currentMode,
    selectedCloudModel,
    selectedLocalModel,
    selectedCloudProvider,
    globalProvider,
    setGlobalProvider,
    setSelectedCloudModel,
    setSelectedCloudProvider,
    thinkingModeEnabled,
    modeConfigs,
    deviceInfo,
    imageProvider
  } = useAppStore();

  const isMobile = deviceInfo.isMobile;
  const [showHistory, setShowHistory] = useState(false);
  const [showModelDrop, setShowModelDrop] = useState(false);
  const [cloudProvider, setCloudProvider] = useState<'groq' | 'gemini' | 'openrouter'>('groq');
  const [dropAlign, setDropAlign] = useState<'left' | 'right'>('left');
  const dropRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showModelDrop) return;
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setShowModelDrop(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showModelDrop]);

  useEffect(() => {
    if (!showModelDrop || !dropRef.current) return;
    const rect = dropRef.current.getBoundingClientRect();
    setDropAlign(rect.left + 640 > window.innerWidth ? 'right' : 'left');
  }, [showModelDrop]);

  // Resolve active provider and model for display
  const config = modeConfigs[currentMode] || { provider: 'auto', model: selectedCloudModel };
  let displayProvider = selectedCloudProvider;
  let displayModel = selectedCloudModel;

  if (currentMode === 'vision') {
    displayProvider = imageProvider as any;
    displayModel = imageProvider === 'huggingface' ? 'Stable Diffusion' :
                   imageProvider === 'local' ? 'Juggernaut XL' :
                   imageProvider === 'pollinations' ? 'Flux (Free)' : 'Imagen 3';
  } else if (thinkingModeEnabled) {
    if (globalProvider === 'local') {
      displayProvider = 'ollama' as any;
      displayModel = 'deepseek-r1:8b';
    } else {
      displayProvider = 'groq' as any;
      displayModel = 'llama-3.3-70b-versatile';
    }
  } else if (globalProvider === 'local') {
    displayProvider = 'ollama' as any;
    displayModel = selectedLocalModel;
  } else if (config.provider !== 'auto' && config.provider !== 'cloud') {
    displayProvider = config.provider as any;
    displayModel = config.model;
  } else {
    displayProvider = selectedCloudProvider;
    displayModel = selectedCloudModel;
  }

  const isLocal = globalProvider === 'local';

  const handleSelectCloudModel = (value: string, provider: string) => {
    setSelectedCloudModel(value);
    setSelectedCloudProvider(provider as any);
    setShowModelDrop(false);
  };

  const handleToggleProvider = (p: 'cloud' | 'local') => {
    setGlobalProvider(p);
    setShowModelDrop(false);
  };

  return (
    <>
      <SessionHistory isOpen={showHistory} onClose={() => setShowHistory(false)} />

      <div
        className={cn(
          "absolute top-0 left-0 right-0 z-[60] flex items-center justify-between border-b border-white/5 backdrop-blur-2xl transition-all duration-300",
          compact ? "h-[var(--header-height-compact,64px)] bg-black/80 px-6" : "h-[var(--header-height,80px)] bg-gradient-to-b from-black/60 to-transparent px-12",
          isMobile && !compact ? "px-6 pl-20" : ""
        )}
      >
        {/* Left: Mode + Model */}
        <div className={cn("flex items-center", compact ? "gap-6" : (isMobile ? "gap-4" : "gap-10"))}>
          <div className="flex flex-col">
            {!compact && <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.5em] mb-1.5 opacity-60">Mode</span>}
            <span className={cn("font-extrabold text-white uppercase tracking-[0.2em]", compact ? "text-[10px]" : "text-[12px]")}>
              {({
                chat: 'Chat', coding: 'Code', vision: 'Vision', browser: 'Browser',
                model_playground: 'Playground', waterfall: 'Waterfall', debate: 'Debate',
                compare: 'Compare', collaborate: 'Collaborate', home: 'Overview'
              } as Record<string, string>)[currentMode] ?? currentMode}
            </span>
          </div>
          <div className={cn("bg-white/10", compact ? "h-4 w-[1px]" : "h-8 w-[1px]")} />

          {/* Clickable Model Pill */}
          <div className="flex flex-col relative" ref={dropRef}>
            {!compact && <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.5em] mb-1.5 opacity-60">Model</span>}
            <button
              onClick={() => setShowModelDrop(v => !v)}
              className="flex items-center gap-2 group border border-white/[0.08] hover:border-jb-orange/40 bg-white/[0.03] rounded-xl px-2.5 py-1.5 transition-all"
            >
              <span className={cn("font-extrabold text-jb-accent uppercase tracking-[0.2em]", compact ? "text-[10px]" : "text-[12px]")}>{displayProvider}</span>
              {!isMobile && (
                <span className={cn("font-mono font-bold text-slate-400 bg-white/5 px-2 py-0.5 rounded border border-white/10 uppercase tracking-widest group-hover:border-jb-orange/30 group-hover:text-slate-300 transition-all", compact ? "text-[8px]" : "text-[10px]")}>
                  {displayModel}
                </span>
              )}
              <ChevronDown size={10} className={cn("text-jb-orange group-hover:text-jb-orange/80 transition-all", showModelDrop && "rotate-180")} />
            </button>

            {/* Model Dropdown */}
            <AnimatePresence>
              {showModelDrop && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.97 }}
                  transition={{ type: 'spring', damping: 28, stiffness: 400 }}
                  className={`absolute top-full mt-2 ${dropAlign}-0 z-[300] w-[640px] bg-[#0a0a0f] border border-white/10 rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.7)] overflow-hidden`}
                >
                  {/* Provider Toggle */}
                  <div className="p-3 border-b border-white/5">
                    <div className="flex gap-1.5 bg-white/[0.03] rounded-xl p-1">
                      <button
                        onClick={() => handleToggleProvider('cloud')}
                        className={cn(
                          "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all",
                          !isLocal ? "bg-jb-accent/20 text-jb-accent border border-jb-accent/30" : "text-slate-600 hover:text-slate-400"
                        )}
                      >
                        <Cloud size={9} /> Cloud
                      </button>
                      <button
                        onClick={() => handleToggleProvider('local')}
                        className={cn(
                          "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all",
                          isLocal ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "text-slate-600 hover:text-slate-400"
                        )}
                      >
                        <Cpu size={9} /> Local
                      </button>
                    </div>
                  </div>

                  {/* Model List */}
                  <div className="p-2">
                    {isLocal ? (
                      <div className="flex items-center gap-2 px-3 py-3 text-center">
                        <Cpu size={12} className="text-emerald-400 flex-shrink-0" />
                        <div>
                          <p className="text-[10px] font-bold text-slate-300">{selectedLocalModel}</p>
                          <p className="text-[8px] text-slate-600 mt-0.5">Managed in Settings → Models</p>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Cloud provider sub-tabs */}
                        <div className="flex gap-1 mb-2 bg-white/[0.03] rounded-lg p-0.5">
                          {PROVIDER_GROUPS.map(g => (
                            <button
                              key={g.id}
                              onClick={() => setCloudProvider(g.id as any)}
                              className={cn(
                                "flex-1 py-1 rounded-md text-[8px] font-black uppercase tracking-wider transition-all",
                                cloudProvider === g.id
                                  ? "bg-jb-accent/20 text-jb-accent border border-jb-accent/30"
                                  : "text-slate-600 hover:text-slate-400"
                              )}
                            >
                              {g.label}
                            </button>
                          ))}
                        </div>
                        {/* Models for selected provider — 3-column grid */}
                        <div className="grid grid-cols-3 gap-1.5">
                          {PROVIDER_GROUPS.find(g => g.id === cloudProvider)?.models.map(m => {
                            const isSelected = selectedCloudModel === m.value && selectedCloudProvider === cloudProvider;
                            return (
                              <button
                                key={m.value}
                                onClick={() => handleSelectCloudModel(m.value, cloudProvider)}
                                className={cn(
                                  "flex flex-col items-start gap-0.5 p-2.5 rounded-xl border transition-all text-left",
                                  isSelected
                                    ? "bg-jb-accent/10 border-jb-accent/30"
                                    : "bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.05] hover:border-white/10"
                                )}
                              >
                                <span className="text-[7px] font-black uppercase tracking-wider text-slate-600">{cloudProvider}</span>
                                <span className={cn("text-[9px] font-bold leading-tight", isSelected ? "text-jb-accent" : "text-slate-300")}>{m.label}</span>
                                {isSelected && <Check size={8} className="text-jb-accent mt-0.5" />}
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Footer hint */}
                  <div className="px-3 py-2 border-t border-white/5">
                    <p className="text-[8px] text-slate-700 text-center">More models in Settings → Models</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Right: History button */}
        <button
          onClick={() => setShowHistory(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/5 hover:border-jb-accent/20 hover:bg-jb-accent/5 transition-all group"
          title="Session History"
        >
          <History size={12} className="text-slate-500 group-hover:text-jb-accent transition-colors" />
          {!compact && !isMobile && <span className="text-[9px] font-black uppercase tracking-wider text-slate-600 group-hover:text-jb-accent transition-colors">History</span>}
        </button>
      </div>
    </>
  );
};
