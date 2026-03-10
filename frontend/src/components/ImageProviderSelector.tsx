import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Zap, Globe, Cpu, ChevronDown, ChevronUp, CheckCircle2, Lock, Wifi } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAppStore } from '../store/useAppStore';

// ─── Provider definitions ────────────────────────────────────────────────────

type ProviderId = 'pollinations' | 'huggingface' | 'fal' | 'local';

interface ProviderDef {
  id: ProviderId;
  label: string;
  desc: string;
  free: boolean;
  offline?: boolean;
  keyName: string | null;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}

const IMAGE_PROVIDERS: ProviderDef[] = [
  {
    id:       'pollinations',
    label:    'Pollinations',
    desc:     'Free · No key required',
    free:     true,
    keyName:  null,
    icon:     Globe,
    color:    'text-emerald-400',
    bgColor:  'bg-emerald-500/10',
  },
  {
    id:       'huggingface',
    label:    'Hugging Face',
    desc:     'Requires API key · SDXL models',
    free:     false,
    keyName:  'huggingface',
    icon:     Sparkles,
    color:    'text-yellow-400',
    bgColor:  'bg-yellow-500/10',
  },
  {
    id:       'fal',
    label:    'FAL.ai',
    desc:     'Flux Pro · Fast generation',
    free:     false,
    keyName:  'fal',
    icon:     Zap,
    color:    'text-jb-orange',
    bgColor:  'bg-jb-orange/10',
  },
  {
    id:       'local',
    label:    'Local SD',
    desc:     'Juggernaut XL · Offline',
    free:     true,
    offline:  true,
    keyName:  null,
    icon:     Cpu,
    color:    'text-cyan-400',
    bgColor:  'bg-cyan-500/10',
  },
];

// ─── Component ───────────────────────────────────────────────────────────────

interface ImageProviderSelectorProps {
  localLoaded?: boolean;
}

export const ImageProviderSelector: React.FC<ImageProviderSelectorProps> = ({ localLoaded = false }) => {
  const { imageProvider, setImageProvider, apiKeys } = useAppStore();
  const [expanded, setExpanded] = useState(false);

  const activeProvider = IMAGE_PROVIDERS.find((p) => p.id === imageProvider) ?? IMAGE_PROVIDERS[0];
  const ActiveIcon = activeProvider.icon;

  // Whether a paid provider has its key configured
  const hasKey = (p: ProviderDef): boolean => {
    if (p.free) return true;
    return !!(p.keyName && apiKeys?.[p.keyName]);
  };

  // Whether this provider is usable right now
  const isUsable = (p: ProviderDef): boolean => {
    if (p.offline) return localLoaded;
    return hasKey(p);
  };

  return (
    <div className="rounded-[1.5rem] overflow-hidden border border-white/5 bg-white/[0.02]">
      {/* Header row — always visible */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 p-3 hover:bg-white/[0.02] transition-colors"
      >
        <div className={cn('rounded-lg p-1.5 shrink-0', activeProvider.bgColor)}>
          <ActiveIcon size={13} className={activeProvider.color} />
        </div>
        <div className="flex-1 text-left">
          <span className="text-[9px] font-black text-white uppercase tracking-widest block leading-tight">
            {activeProvider.label}
          </span>
          <span className="text-[10px] text-slate-400 leading-none">{activeProvider.desc}</span>
        </div>

        {/* Status badge */}
        {isUsable(activeProvider) ? (
          <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
        ) : (
          <Lock size={11} className="text-amber-500 shrink-0" />
        )}

        {expanded ? (
          <ChevronUp size={12} className="text-slate-600 shrink-0" />
        ) : (
          <ChevronDown size={12} className="text-slate-600 shrink-0" />
        )}
      </button>

      {/* Expanded picker */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-white/5"
          >
            <div className="p-2 grid grid-cols-1 gap-1">
              {IMAGE_PROVIDERS.map((p) => {
                const Icon    = p.icon;
                const active  = p.id === imageProvider;
                const usable  = isUsable(p);
                const keyOk   = hasKey(p);

                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      setImageProvider(p.id);
                      setExpanded(false);
                    }}
                    disabled={!usable && !p.free}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all text-left',
                      active  ? 'bg-white/10'    : 'hover:bg-white/5',
                      !usable && !p.free && 'opacity-50',
                    )}
                  >
                    <div className={cn('rounded-lg p-1 shrink-0', p.bgColor)}>
                      <Icon size={12} className={p.color} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] font-bold text-white block leading-tight truncate">{p.label}</span>
                      <span className="text-[10px] text-slate-400 leading-none truncate block">{p.desc}</span>
                    </div>

                    {/* Badges */}
                    <div className="flex items-center gap-1 shrink-0">
                      {p.free && (
                        <span className="px-1.5 py-0.5 rounded-full text-[7px] font-black uppercase bg-emerald-500/15 border border-emerald-500/25 text-emerald-400">
                          Free
                        </span>
                      )}
                      {!p.free && !keyOk && (
                        <span className="px-1.5 py-0.5 rounded-full text-[7px] font-black uppercase bg-amber-500/15 border border-amber-500/25 text-amber-400">
                          Key
                        </span>
                      )}
                      {p.offline && (
                        <Wifi
                          size={10}
                          className={cn(localLoaded ? 'text-emerald-500' : 'text-rose-500')}
                        />
                      )}
                      {active && (
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Footer hint for paid providers */}
            <div className="px-3 pb-3">
              <p className="text-[9px] text-slate-500 font-medium leading-relaxed">
                API keys for paid providers can be configured in Settings.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
