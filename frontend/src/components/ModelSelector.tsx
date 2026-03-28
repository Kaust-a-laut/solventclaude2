import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Sparkles, Zap, Brain, Globe, Cpu, Bot, Flame } from 'lucide-react';
import { cn } from '../lib/utils';

export interface ModelOption {
  provider: 'gemini' | 'groq' | 'deepseek' | 'openrouter' | 'ollama' | 'dashscope' | 'cerebras';
  model: string;
  displayName: string;
  sublabel: string;
  color: string;
  bgColor: string;
  icon: React.ElementType;
}

export const MODEL_OPTIONS: ModelOption[] = [
  { provider: 'gemini',     model: 'gemini-3.1-pro-preview',        displayName: 'Gemini 3.1 Pro',        sublabel: 'Google AI · Latest', color: 'text-blue-400',    bgColor: 'bg-blue-500/10',    icon: Sparkles },
  { provider: 'gemini',     model: 'gemini-3.1-flash-lite-preview', displayName: 'Gemini 3.1 Flash Lite', sublabel: 'Google AI · Fast',   color: 'text-blue-400',    bgColor: 'bg-blue-500/10',    icon: Sparkles },
  { provider: 'gemini',     model: 'gemini-3-flash-preview',        displayName: 'Gemini 3 Flash',        sublabel: 'Google AI',          color: 'text-blue-400',    bgColor: 'bg-blue-500/10',    icon: Sparkles },
  { provider: 'gemini',     model: 'gemini-2.5-flash',              displayName: 'Gemini 2.5 Flash',      sublabel: 'Google AI',          color: 'text-blue-400',    bgColor: 'bg-blue-500/10',    icon: Sparkles },
  { provider: 'gemini',     model: 'gemini-2.5-pro',                displayName: 'Gemini 2.5 Pro',        sublabel: 'Google AI',          color: 'text-blue-400',    bgColor: 'bg-blue-500/10',    icon: Sparkles },
  { provider: 'groq',       model: 'llama-3.3-70b-versatile',       displayName: 'Llama 3.3 70B',   sublabel: 'Groq LPU',    color: 'text-orange-400',  bgColor: 'bg-orange-500/10',  icon: Zap      },
  { provider: 'deepseek',   model: 'deepseek-r1-distill-llama-70b', displayName: 'DeepSeek R1',     sublabel: 'Reasoning',   color: 'text-emerald-400', bgColor: 'bg-emerald-500/10', icon: Brain    },
  { provider: 'openrouter', model: 'auto',                           displayName: 'OpenRouter Auto', sublabel: 'Multi-Model', color: 'text-purple-400',  bgColor: 'bg-purple-500/10',  icon: Globe    },
  { provider: 'ollama',     model: 'qwen2.5-coder:7b',              displayName: 'Qwen 2.5',        sublabel: 'Local Edge',  color: 'text-cyan-400',    bgColor: 'bg-cyan-500/10',    icon: Cpu      },
];

/**
 * Curated model list for the Agent Chat panel.
 * Only includes providers that support the tool-calling loop (BaseOpenAIService)
 * and models with strong function-calling / agentic capabilities.
 */
export const AGENT_MODEL_OPTIONS: ModelOption[] = [
  // ── Groq (LPU · Ultra-fast inference) ─────────────────────────────────────
  { provider: 'groq',       model: 'compound-beta',                                displayName: 'Groq Compound',      sublabel: 'Agentic · Auto-routed',  color: 'text-amber-400',   bgColor: 'bg-amber-500/10',   icon: Bot   },
  { provider: 'groq',       model: 'compound-beta-mini',                           displayName: 'Compound Mini',      sublabel: 'Agentic · Fast',         color: 'text-amber-400',   bgColor: 'bg-amber-500/10',   icon: Bot   },
  { provider: 'groq',       model: 'moonshotai/kimi-k2-instruct-0905',             displayName: 'Kimi K2',            sublabel: 'Moonshot · Top Agent',   color: 'text-rose-400',    bgColor: 'bg-rose-500/10',    icon: Flame },
  { provider: 'groq',       model: 'meta-llama/llama-4-maverick-17b-128e-instruct', displayName: 'Llama 4 Maverick',  sublabel: 'Meta · 128 Experts',     color: 'text-orange-400',  bgColor: 'bg-orange-500/10',  icon: Zap   },
  { provider: 'groq',       model: 'qwen/qwen3-32b',                               displayName: 'Qwen 3 32B',        sublabel: 'Alibaba · Strong Coder', color: 'text-sky-400',     bgColor: 'bg-sky-500/10',     icon: Brain },
  { provider: 'groq',       model: 'openai/gpt-oss-120b',                          displayName: 'GPT-OSS 120B',       sublabel: 'OpenAI Open · Large',    color: 'text-green-400',   bgColor: 'bg-green-500/10',   icon: Brain },
  { provider: 'groq',       model: 'llama-3.3-70b-versatile',                      displayName: 'Llama 3.3 70B',      sublabel: 'Meta · Reliable',        color: 'text-orange-400',  bgColor: 'bg-orange-500/10',  icon: Zap   },

  // ── OpenRouter (Premium + Free models) ────────────────────────────────────
  { provider: 'openrouter', model: 'anthropic/claude-sonnet-4',                     displayName: 'Claude Sonnet 4',    sublabel: 'Anthropic · Best Tools', color: 'text-yellow-400',  bgColor: 'bg-yellow-500/10',  icon: Sparkles },
  { provider: 'openrouter', model: 'openai/gpt-4o',                                displayName: 'GPT-4o',             sublabel: 'OpenAI · Flagship',      color: 'text-green-400',   bgColor: 'bg-green-500/10',   icon: Brain },
  { provider: 'openrouter', model: 'minimax/minimax-01',                            displayName: 'MiniMax-01',         sublabel: 'MiniMax · 456B MoE',     color: 'text-teal-400',    bgColor: 'bg-teal-500/10',    icon: Brain },
  { provider: 'openrouter', model: 'qwen/qwen3-235b-a22b:free',                    displayName: 'Qwen 3 235B',        sublabel: 'Free · Massive',         color: 'text-sky-400',     bgColor: 'bg-sky-500/10',     icon: Globe },
  { provider: 'openrouter', model: 'meta-llama/llama-4-maverick:free',              displayName: 'Llama 4 Maverick',   sublabel: 'Free · MoE',             color: 'text-purple-400',  bgColor: 'bg-purple-500/10',  icon: Globe },
  { provider: 'openrouter', model: 'deepseek/deepseek-chat-v3-0324:free',          displayName: 'DeepSeek V3',         sublabel: 'Free · Strong Coder',    color: 'text-emerald-400', bgColor: 'bg-emerald-500/10', icon: Globe },

  // ── DeepSeek (Direct API) ─────────────────────────────────────────────────
  { provider: 'deepseek',   model: 'deepseek-chat',                                displayName: 'DeepSeek V3',         sublabel: 'Direct · Tool Use',      color: 'text-emerald-400', bgColor: 'bg-emerald-500/10', icon: Brain },

  // ── DashScope (Alibaba · Qwen native API) ────────────────────────────────
  { provider: 'dashscope',  model: 'qwen3-coder-plus',                             displayName: 'Qwen3 Coder+',        sublabel: 'DashScope · Top Coder',  color: 'text-sky-400',     bgColor: 'bg-sky-500/10',     icon: Brain },
  { provider: 'dashscope',  model: 'qwen3-coder-flash',                            displayName: 'Qwen3 Coder Flash',   sublabel: 'DashScope · Fast Code',  color: 'text-sky-400',     bgColor: 'bg-sky-500/10',     icon: Zap   },
  { provider: 'dashscope',  model: 'qwen3-max',                                    displayName: 'Qwen3 Max',           sublabel: 'DashScope · Flagship',   color: 'text-sky-400',     bgColor: 'bg-sky-500/10',     icon: Flame },
  { provider: 'dashscope',  model: 'qwen3.5-plus',                                 displayName: 'Qwen 3.5 Plus',       sublabel: 'DashScope · Latest',     color: 'text-sky-400',     bgColor: 'bg-sky-500/10',     icon: Brain },
  { provider: 'dashscope',  model: 'qwen3-next-80b-a3b-instruct',                  displayName: 'Qwen3 Coder Next',    sublabel: 'DashScope · Efficient',  color: 'text-sky-400',     bgColor: 'bg-sky-500/10',     icon: Zap   },

  // ── Cerebras (Wafer-scale · Ultra-fast inference) ─────────────────────────
  { provider: 'cerebras',  model: 'llama3.1-8b',                                  displayName: 'Llama 3.1 8B',        sublabel: 'Cerebras · Fast',        color: 'text-violet-400',  bgColor: 'bg-violet-500/10',  icon: Zap   },
  { provider: 'cerebras',  model: 'qwen-3-235b-a22b-instruct-2507',               displayName: 'Qwen3 235B',          sublabel: 'Cerebras · Preview',     color: 'text-violet-400',  bgColor: 'bg-violet-500/10',  icon: Brain },
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
                      <span className="text-[11px] text-slate-500 leading-none">{opt.sublabel}</span>
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
        <span className="text-[11px] font-black text-slate-600 uppercase tracking-widest">{label}</span>
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
        <span className="text-[11px] font-bold text-white uppercase tracking-wider whitespace-nowrap">
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
