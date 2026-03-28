import React, { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Cloud, Cpu, Zap, ChevronDown, Sparkles, Globe, Brain } from 'lucide-react';
import { cn } from '../lib/utils';

const providers = [
  { id: 'gemini', label: 'Gemini', sublabel: 'Google AI', icon: Sparkles, color: 'text-blue-400', bgColor: 'bg-blue-500/10' },
  { id: 'groq', label: 'Groq', sublabel: 'LPU Speed', icon: Zap, color: 'text-orange-400', bgColor: 'bg-orange-500/10' },
  { id: 'deepseek', label: 'DeepSeek', sublabel: 'Reasoning', icon: Brain, color: 'text-emerald-400', bgColor: 'bg-emerald-500/10' },
  { id: 'openrouter', label: 'OpenRouter', sublabel: 'Multi-Model', icon: Globe, color: 'text-purple-400', bgColor: 'bg-purple-500/10' },
  { id: 'ollama', label: 'Local', sublabel: 'Ollama', icon: Cpu, color: 'text-cyan-400', bgColor: 'bg-cyan-500/10' },
];

interface ProviderQuickSwitchProps {
  compact?: boolean;
}

export const ProviderQuickSwitch: React.FC<ProviderQuickSwitchProps> = ({ compact = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { selectedCloudProvider, setSelectedCloudProvider, isProcessing } = useAppStore();

  const current = providers.find(p => p.id === selectedCloudProvider) ?? providers[0]!;
  const Icon = current.icon;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isProcessing}
        className={cn(
          "flex items-center gap-2 rounded-full border backdrop-blur-sm transition-all duration-300",
          "bg-black/60 border-white/10 hover:border-white/20 hover:bg-black/80",
          isProcessing && "opacity-50 cursor-not-allowed",
          compact ? "px-2 py-1.5" : "px-3 py-2"
        )}
      >
        <div className={cn("rounded-full p-1", current.bgColor)}>
          <Icon size={compact ? 12 : 14} className={current.color} />
        </div>
        {!compact && (
          <span className="text-[11px] font-bold text-white uppercase tracking-wider">
            {current.label}
          </span>
        )}
        <ChevronDown
          size={compact ? 10 : 12}
          className={cn(
            "text-slate-500 transition-transform duration-300",
            isOpen && "rotate-180"
          )}
        />

        {/* Processing indicator */}
        {isProcessing && (
          <div className="absolute -top-1 -right-1 w-2.5 h-2.5">
            <div className="absolute inset-0 rounded-full bg-jb-accent animate-ping" />
            <div className="absolute inset-0 rounded-full bg-jb-accent" />
          </div>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />

            {/* Dropdown */}
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute top-full mt-2 right-0 bg-black/95 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-2xl shadow-[0_20px_40px_-10px_rgba(0,0,0,0.8)] z-[70] min-w-[200px]"
            >
              <div className="p-2">
                <p className="px-3 py-2 text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">
                  Select Provider
                </p>

                {providers.map((provider) => {
                  const ProvIcon = provider.icon;
                  const isActive = provider.id === selectedCloudProvider;

                  return (
                    <button
                      key={provider.id}
                      onClick={() => {
                        setSelectedCloudProvider(provider.id as any);
                        setIsOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200",
                        isActive
                          ? "bg-white/10"
                          : "hover:bg-white/5"
                      )}
                    >
                      <div className={cn("rounded-lg p-1.5", provider.bgColor)}>
                        <ProvIcon size={16} className={provider.color} />
                      </div>
                      <div className="flex-1 text-left">
                        <span className="text-xs font-bold text-white block">{provider.label}</span>
                        <span className="text-[11px] text-slate-500">{provider.sublabel}</span>
                      </div>
                      {isActive && (
                        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Footer hint */}
              <div className="px-4 py-2 border-t border-white/5 bg-white/[0.02]">
                <p className="text-[11px] text-slate-600 text-center">
                  Provider affects all new requests
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
