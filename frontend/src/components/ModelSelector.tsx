import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Sparkles, Zap, Brain, Globe, Cpu } from 'lucide-react';
import { cn } from '../lib/utils';

export interface ModelOption {
  provider: 'gemini' | 'groq' | 'deepseek' | 'openrouter' | 'ollama';
  model: string;
  displayName: string;
  sublabel: string;
  color: string;
  bgColor: string;
  icon: React.ElementType;
}

export const MODEL_OPTIONS: ModelOption[] = [
  { provider: 'gemini',     model: 'gemini-2.0-flash',              displayName: 'Gemini Flash',    sublabel: 'Google AI',   color: 'text-blue-400',    bgColor: 'bg-blue-500/10',    icon: Sparkles },
  { provider: 'gemini',     model: 'gemini-1.5-pro',                displayName: 'Gemini 1.5 Pro',  sublabel: 'Google AI',   color: 'text-blue-400',    bgColor: 'bg-blue-500/10',    icon: Sparkles },
  { provider: 'groq',       model: 'llama-3.3-70b-versatile',       displayName: 'Llama 3.3 70B',   sublabel: 'Groq LPU',    color: 'text-orange-400',  bgColor: 'bg-orange-500/10',  icon: Zap      },
  { provider: 'deepseek',   model: 'deepseek-r1-distill-llama-70b', displayName: 'DeepSeek R1',     sublabel: 'Reasoning',   color: 'text-emerald-400', bgColor: 'bg-emerald-500/10', icon: Brain    },
  { provider: 'openrouter', model: 'auto',                           displayName: 'OpenRouter Auto', sublabel: 'Multi-Model', color: 'text-purple-400',  bgColor: 'bg-purple-500/10',  icon: Globe    },
  { provider: 'ollama',     model: 'qwen2.5-coder:7b',              displayName: 'Qwen 2.5',        sublabel: 'Local Edge',  color: 'text-cyan-400',    bgColor: 'bg-cyan-500/10',    icon: Cpu      },
];

interface ModelSelectorProps {
  value: ModelOption;
  onChange: (option: ModelOption) => void;
  label?: string;
  disabled?: boolean;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({ value, onChange, label, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const Icon = value.icon;

  const handleToggle = () => {
    if (disabled) return;
    if (!isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 6, left: rect.left });
    }
    setIsOpen((prev) => !prev);
  };

  // Close on scroll or resize so the dropdown doesn't drift off its trigger
  useEffect(() => {
    if (!isOpen) return;
    const close = () => setIsOpen(false);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [isOpen]);

  // Portal dropdown — renders at document.body to escape any overflow:hidden parent
  const dropdown = (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Full-screen click-away backdrop */}
          <div className="fixed inset-0 z-[9998]" onClick={() => setIsOpen(false)} />

          {/* Dropdown panel */}
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.95 }}
            transition={{ duration: 0.12 }}
            style={{ position: 'fixed', top: dropdownPos.top, left: dropdownPos.left }}
            className="z-[9999] min-w-[180px] bg-black/95 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-2xl shadow-[0_20px_40px_-10px_rgba(0,0,0,0.8)]"
          >
            <div className="p-1.5">
              {MODEL_OPTIONS.map((opt) => {
                const OptIcon = opt.icon;
                const isActive = opt.provider === value.provider && opt.model === value.model;
                return (
                  <button
                    key={`${opt.provider}/${opt.model}`}
                    onClick={() => { onChange(opt); setIsOpen(false); }}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all duration-150',
                      isActive ? 'bg-white/10' : 'hover:bg-white/5',
                    )}
                  >
                    <div className={cn('rounded-lg p-1', opt.bgColor)}>
                      <OptIcon size={13} className={opt.color} />
                    </div>
                    <div className="flex-1 text-left">
                      <span className="text-[11px] font-bold text-white block leading-tight">{opt.displayName}</span>
                      <span className="text-[9px] text-slate-500 leading-none">{opt.sublabel}</span>
                    </div>
                    {isActive && (
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]" />
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return (
    <div className="relative flex flex-col gap-1">
      {label && (
        <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">{label}</span>
      )}
      <button
        ref={triggerRef}
        onClick={handleToggle}
        disabled={disabled}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-full border backdrop-blur-sm transition-all duration-200',
          'bg-black/60 border-white/10 hover:border-white/20 hover:bg-black/80',
          disabled && 'opacity-40 cursor-not-allowed',
        )}
      >
        <div className={cn('rounded-full p-1', value.bgColor)}>
          <Icon size={11} className={value.color} />
        </div>
        <span className="text-[10px] font-bold text-white uppercase tracking-wider whitespace-nowrap">
          {value.displayName}
        </span>
        <ChevronDown
          size={10}
          className={cn('text-slate-500 transition-transform duration-200', isOpen && 'rotate-180')}
        />
      </button>

      {/* Portal: mounts at document.body, so no parent overflow:hidden can clip it */}
      {typeof document !== 'undefined' && ReactDOM.createPortal(dropdown, document.body)}
    </div>
  );
};
