import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check, Search } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface SelectOption {
  value: string;
  label: string;
  group?: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  searchable?: boolean;
  disabled?: boolean;
  className?: string;
}

export const CustomSelect = ({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  searchable = false,
  disabled = false,
  className,
}: CustomSelectProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [dropDirection, setDropDirection] = useState<'down' | 'up'>('down');
  const ref = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(o => o.value === value);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Determine drop direction
  useEffect(() => {
    if (!open || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setDropDirection(rect.bottom + 320 > window.innerHeight ? 'up' : 'down');
  }, [open]);

  // Focus search input when opening
  useEffect(() => {
    if (open && searchable) {
      requestAnimationFrame(() => searchInputRef.current?.focus());
    }
  }, [open, searchable]);

  // Filter options
  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase();
    return options.filter(o =>
      o.label.toLowerCase().includes(q) ||
      o.value.toLowerCase().includes(q) ||
      (o.group && o.group.toLowerCase().includes(q))
    );
  }, [options, search]);

  // Group options
  const groups = useMemo(() => {
    const grouped = new Map<string, SelectOption[]>();
    for (const opt of filtered) {
      const g = opt.group || '';
      if (!grouped.has(g)) grouped.set(g, []);
      grouped.get(g)!.push(opt);
    }
    return grouped;
  }, [filtered]);

  // Flat list for keyboard navigation
  const flatFiltered = filtered;

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightIndex(i => Math.min(i + 1, flatFiltered.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightIndex >= 0 && highlightIndex < flatFiltered.length) {
          onChange(flatFiltered[highlightIndex].value);
          setOpen(false);
          setSearch('');
        }
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        setSearch('');
        break;
    }
  };

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightIndex < 0 || !listRef.current) return;
    const items = listRef.current.querySelectorAll('[data-option]');
    items[highlightIndex]?.scrollIntoView({ block: 'nearest' });
  }, [highlightIndex]);

  const handleSelect = (val: string) => {
    onChange(val);
    setOpen(false);
    setSearch('');
  };

  return (
    <div className={cn("relative", className)} ref={ref} onKeyDown={handleKeyDown}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => { if (!disabled) { setOpen(v => !v); setHighlightIndex(-1); } }}
        disabled={disabled}
        className={cn(
          "w-full flex items-center justify-between bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-3 text-xs font-bold text-slate-300 outline-none transition-all",
          disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:border-white/20",
          open && "border-white/20"
        )}
      >
        <span className={cn(!selectedOption && "text-slate-600")}>
          {selectedOption?.label || placeholder}
        </span>
        <ChevronDown size={12} className={cn("text-slate-500 transition-transform", open && "rotate-180")} />
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: dropDirection === 'down' ? -8 : 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: dropDirection === 'down' ? -8 : 8, scale: 0.97 }}
            transition={{ type: 'spring', damping: 28, stiffness: 400 }}
            className={cn(
              "absolute left-0 right-0 z-[300] bg-[#0a0a0f] border border-white/10 rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.7)] overflow-hidden",
              dropDirection === 'down' ? "top-full mt-2" : "bottom-full mb-2"
            )}
            style={{ willChange: 'transform' }}
          >
            {/* Search */}
            {searchable && (
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5">
                <Search size={12} className="text-slate-600 flex-shrink-0" />
                <input
                  ref={searchInputRef}
                  value={search}
                  onChange={e => { setSearch(e.target.value); setHighlightIndex(0); }}
                  placeholder="Filter..."
                  className="flex-1 bg-transparent border-none outline-none text-xs text-slate-300 placeholder:text-slate-700"
                />
              </div>
            )}

            {/* Options */}
            <div ref={listRef} className="max-h-[320px] overflow-y-auto scrollbar-thin p-1.5">
              {filtered.length === 0 ? (
                <div className="px-4 py-3 text-[10px] text-slate-600 text-center">No matches</div>
              ) : (
                Array.from(groups.entries()).map(([group, opts]) => (
                  <div key={group}>
                    {group && (
                      <div className="px-3 pt-2.5 pb-1 text-[8px] font-black text-slate-600 uppercase tracking-widest">
                        {group}
                      </div>
                    )}
                    {opts.map(opt => {
                      const flatIndex = flatFiltered.indexOf(opt);
                      const isSelected = opt.value === value;
                      const isHighlighted = flatIndex === highlightIndex;
                      return (
                        <button
                          key={opt.value}
                          data-option
                          type="button"
                          onClick={() => handleSelect(opt.value)}
                          className={cn(
                            "w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-xs transition-all text-left",
                            isHighlighted && "bg-white/[0.06]",
                            isSelected ? "text-jb-accent font-bold" : "text-slate-300 hover:bg-white/[0.05]"
                          )}
                        >
                          <span>{opt.label}</span>
                          {isSelected && <Check size={12} className="text-jb-accent flex-shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
