import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';

export interface ModelEntry {
  provider: string;
  model: string;
  label: string;
  group: string;
}

interface ModelPickerDropdownProps {
  value: string;
  onChange: (key: string) => void;
  models: ModelEntry[];
  accent?: 'blue' | 'orange';
  label?: string;
  disabled?: boolean;
}

const toKey = (provider: string, model: string) => `${provider}:${model}`;

export const ModelPickerDropdown = ({
  value,
  onChange,
  models,
  accent = 'blue',
  label,
  disabled = false,
}: ModelPickerDropdownProps) => {
  const [open, setOpen] = useState(false);
  const [align, setAlign] = useState<'left' | 'right'>('left');
  const ref = useRef<HTMLDivElement>(null);

  const groups = [...new Set(models.map(m => m.group))];
  const [activeGroup, setActiveGroup] = useState(groups[0] ?? '');

  const selectedEntry = models.find(m => toKey(m.provider, m.model) === value);
  const selectedLabel = selectedEntry?.label ?? value;

  const accentClass = accent === 'orange' ? 'text-jb-orange' : 'text-jb-accent';
  const accentBg    = accent === 'orange' ? 'bg-jb-orange/10 border-jb-orange/30' : 'bg-jb-accent/10 border-jb-accent/30';
  const accentTab   = accent === 'orange' ? 'bg-jb-orange/20 text-jb-orange border border-jb-orange/30' : 'bg-jb-accent/20 text-jb-accent border border-jb-accent/30';

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (!open || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setAlign(rect.left + 640 > window.innerWidth ? 'right' : 'left');
  }, [open]);

  const handleSelect = (m: ModelEntry) => {
    onChange(toKey(m.provider, m.model));
    setOpen(false);
  };

  const groupModels = models.filter(m => m.group === activeGroup);

  return (
    <div className="flex flex-col gap-1" ref={ref}>
      {label && (
        <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">{label}</span>
      )}
      <div className="relative">
        <button
          onClick={() => !disabled && setOpen(v => !v)}
          disabled={disabled}
          className={cn(
            "flex items-center gap-2 appearance-none bg-black/60 border border-white/10 rounded-2xl pl-4 pr-9 py-3 text-[10px] font-bold uppercase tracking-wider outline-none transition-all",
            accentClass,
            disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:border-white/20"
          )}
        >
          <span className="max-w-[120px] truncate">{selectedLabel}</span>
          <ChevronDown
            size={10}
            className={cn("absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 transition-transform", open && "rotate-180")}
          />
        </button>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ type: 'spring', damping: 28, stiffness: 400 }}
              className={`absolute top-full mt-2 ${align}-0 z-[300] w-[640px] bg-[#0a0a0f] border border-white/10 rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.7)] overflow-hidden`}
              style={{ maxWidth: 'min(640px, 90vw)', willChange: 'transform' }}
            >
              {/* Group tabs */}
              <div className="p-2 border-b border-white/5">
                <div className="flex gap-1 bg-white/[0.03] rounded-lg p-0.5">
                  {groups.map(g => (
                    <button
                      key={g}
                      onClick={() => setActiveGroup(g)}
                      className={cn(
                        "flex-1 py-1 rounded-md text-[8px] font-black uppercase tracking-wider transition-all",
                        activeGroup === g ? accentTab : "text-slate-600 hover:text-slate-400"
                      )}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              {/* 3-column model grid */}
              <div className="grid grid-cols-3 gap-1.5 p-2">
                {groupModels.map(m => {
                  const key = toKey(m.provider, m.model);
                  const isSelected = key === value;
                  return (
                    <button
                      key={key}
                      onClick={() => handleSelect(m)}
                      className={cn(
                        "flex flex-col items-start gap-0.5 p-2.5 rounded-xl border transition-all text-left",
                        isSelected
                          ? accentBg
                          : "bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.05] hover:border-white/10"
                      )}
                    >
                      <span className="text-[7px] font-black uppercase tracking-wider text-slate-600">{m.group}</span>
                      <span className={cn("text-[9px] font-bold leading-tight", isSelected ? accentClass : "text-slate-300")}>
                        {m.label}
                      </span>
                      {isSelected && <Check size={8} className={cn("mt-0.5", accentClass)} />}
                    </button>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="px-3 py-2 border-t border-white/5">
                <p className="text-[8px] text-slate-700 text-center">More models in Settings → Models</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
