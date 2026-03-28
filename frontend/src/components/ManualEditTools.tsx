import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, RotateCw, FlipHorizontal, FlipVertical, RefreshCw } from 'lucide-react';
import { cn } from '../lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface EditState {
  brightness: number;
  contrast: number;
  saturation: number;
  blur: number;
  rotation: number;
  flipH: boolean;
  flipV: boolean;
  activeFilter: string | null; // preset name or null
}

export const DEFAULT_EDIT_STATE: EditState = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  blur: 0,
  rotation: 0,
  flipH: false,
  flipV: false,
  activeFilter: 'Original',
};

// activeTab is now driven by the parent ToolGrid (no internal tab state)
export interface ManualEditToolsProps {
  activeTab: 'adjust' | 'filters' | 'transform';
  onPreviewChange: (cssFilter: string, rotation: number, flipH: boolean, flipV: boolean) => void;
  onApply: (cssFilter: string, rotation: number, flipH: boolean, flipV: boolean) => void;
  disabled: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const buildCssFilter = (state: EditState): string => {
  if (state.activeFilter && state.activeFilter !== 'Original' && state.activeFilter !== 'Custom') {
    return FILTER_PRESETS.find((p) => p.name === state.activeFilter)?.filter ?? 'none';
  }
  const parts: string[] = [];
  if (state.brightness !== 100) parts.push(`brightness(${state.brightness}%)`);
  if (state.contrast  !== 100) parts.push(`contrast(${state.contrast}%)`);
  if (state.saturation !== 100) parts.push(`saturate(${state.saturation}%)`);
  if (state.blur !== 0)        parts.push(`blur(${state.blur}px)`);
  return parts.length > 0 ? parts.join(' ') : 'none';
};

// ─── Filter Presets ───────────────────────────────────────────────────────────

interface FilterPreset {
  name: string;
  filter: string;
}

const FILTER_PRESETS: FilterPreset[] = [
  { name: 'Original', filter: 'none' },
  { name: 'Mono',     filter: 'grayscale(100%)' },
  { name: 'Sepia',    filter: 'sepia(80%)' },
  { name: 'Vivid',    filter: 'saturate(200%) contrast(110%)' },
  { name: 'Cool',     filter: 'hue-rotate(20deg) saturate(120%)' },
  { name: 'Warm',     filter: 'sepia(30%) saturate(150%)' },
  { name: 'Fade',     filter: 'opacity(80%) saturate(70%) brightness(110%)' },
  { name: 'Noir',     filter: 'grayscale(100%) contrast(150%) brightness(90%)' },
];

// ─── SliderRow (exported so ExportTool can import it) ─────────────────────────

export interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  unit?: string;
  onChange: (v: number) => void;
  disabled?: boolean;
}

export const SliderRow = ({ label, value, min, max, unit = '%', onChange, disabled }: SliderRowProps) => (
  <div className="space-y-1.5">
    <div className="flex items-center justify-between">
      <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">{label}</span>
      <span className="text-[11px] font-mono text-slate-400">{value}{unit}</span>
    </div>
    <div className="relative">
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className={cn(
          'w-full h-1.5 rounded-full appearance-none outline-none cursor-pointer',
          'bg-white/[0.06] accent-jb-accent',
          disabled && 'opacity-40 cursor-not-allowed',
        )}
      />
    </div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

export const ManualEditTools: React.FC<ManualEditToolsProps> = ({
  activeTab,
  onPreviewChange,
  onApply,
  disabled,
}) => {
  const [state, setState] = useState<EditState>(DEFAULT_EDIT_STATE);

  // ── Helper: update state and fire preview ──────────────────────────────────
  const update = useCallback((patch: Partial<EditState>) => {
    setState((prev) => {
      const next = { ...prev, ...patch };
      const css  = buildCssFilter(next);
      onPreviewChange(css, next.rotation, next.flipH, next.flipV);
      return next;
    });
  }, [onPreviewChange]);

  const onSlider = (field: 'brightness' | 'contrast' | 'saturation' | 'blur') => (v: number) => {
    update({ [field]: v, activeFilter: 'Custom' });
  };

  const selectPreset = (preset: FilterPreset) => {
    update({
      activeFilter: preset.name,
      ...(preset.name !== 'Custom' ? { brightness: 100, contrast: 100, saturation: 100, blur: 0 } : {}),
    });
  };

  const rotateCW  = () => update({ rotation: (state.rotation + 90)  % 360 });
  const rotateCCW = () => update({ rotation: ((state.rotation - 90) + 360) % 360 });
  const flipH     = () => update({ flipH: !state.flipH });
  const flipV     = () => update({ flipV: !state.flipV });

  const reset = () => {
    setState(DEFAULT_EDIT_STATE);
    onPreviewChange('none', 0, false, false);
  };

  const apply = () => {
    const css = buildCssFilter(state);
    onApply(css, state.rotation, state.flipH, state.flipV);
  };

  const hasChanges =
    state.brightness !== 100 ||
    state.contrast   !== 100 ||
    state.saturation !== 100 ||
    state.blur       !== 0   ||
    state.rotation   !== 0   ||
    state.flipH              ||
    state.flipV              ||
    (state.activeFilter !== null && state.activeFilter !== 'Original');

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 rounded-[2rem] bg-white/[0.02] border border-white/5 shadow-2xl relative overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-1.5 rounded-full bg-jb-accent animate-pulse shadow-[0_0_8px_rgba(60,113,247,0.8)]" />
          <span className="text-[11px] font-black text-white uppercase tracking-widest">Edit Tools</span>
        </div>
        {hasChanges && (
          <button
            onClick={reset}
            disabled={disabled}
            className="flex items-center gap-1.5 text-[11px] font-black text-slate-500 uppercase tracking-widest hover:text-white transition-colors"
          >
            <RefreshCw size={10} /> Reset
          </button>
        )}
      </div>

      {/* Tab content — controlled by parent's activeTab prop, no internal tab bar */}
      <AnimatePresence mode="wait">
        {activeTab === 'adjust' && (
          <motion.div
            key="adjust"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="space-y-4"
          >
            <SliderRow label="Brightness" value={state.brightness} min={0} max={200} onChange={onSlider('brightness')} disabled={disabled} />
            <SliderRow label="Contrast"   value={state.contrast}   min={0} max={200} onChange={onSlider('contrast')}   disabled={disabled} />
            <SliderRow label="Saturation" value={state.saturation} min={0} max={200} onChange={onSlider('saturation')} disabled={disabled} />
            <SliderRow label="Blur"       value={state.blur}       min={0} max={10}  unit="px" onChange={onSlider('blur')} disabled={disabled} />
          </motion.div>
        )}

        {activeTab === 'filters' && (
          <motion.div
            key="filters"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="grid grid-cols-4 gap-2"
          >
            {FILTER_PRESETS.map((preset) => {
              const isActive = state.activeFilter === preset.name;
              return (
                <button
                  key={preset.name}
                  onClick={() => selectPreset(preset)}
                  disabled={disabled}
                  className={cn(
                    'flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all',
                    isActive
                      ? 'bg-jb-accent/15 border border-jb-accent/30'
                      : 'bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] hover:border-white/10',
                    disabled && 'opacity-40 cursor-not-allowed',
                  )}
                >
                  <div
                    className="w-8 h-8 rounded-lg overflow-hidden relative"
                    style={{ background: 'linear-gradient(135deg, #6366f1 0%, #f59e0b 50%, #10b981 100%)' }}
                  >
                    <div className="absolute inset-0" style={{ filter: preset.filter, background: 'inherit' }} />
                  </div>
                  <span className={cn('text-[11px] font-black uppercase tracking-wider', isActive ? 'text-jb-accent' : 'text-slate-500')}>
                    {preset.name}
                  </span>
                </button>
              );
            })}
          </motion.div>
        )}

        {activeTab === 'transform' && (
          <motion.div
            key="transform"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="space-y-3"
          >
            <div>
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest block mb-2">Rotate</span>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={rotateCCW} disabled={disabled}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/[0.03] border border-white/5 text-[11px] font-black uppercase text-slate-400 hover:text-white hover:border-white/10 transition-all disabled:opacity-40"
                >
                  <RotateCcw size={13} /> 90° CCW
                </button>
                <button onClick={rotateCW} disabled={disabled}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/[0.03] border border-white/5 text-[11px] font-black uppercase text-slate-400 hover:text-white hover:border-white/10 transition-all disabled:opacity-40"
                >
                  <RotateCw size={13} /> 90° CW
                </button>
              </div>
            </div>

            <div>
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest block mb-2">Flip</span>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={flipH} disabled={disabled}
                  className={cn('flex items-center justify-center gap-2 py-2.5 rounded-xl border text-[11px] font-black uppercase transition-all disabled:opacity-40',
                    state.flipH ? 'bg-jb-accent/10 border-jb-accent/30 text-jb-accent' : 'bg-white/[0.03] border-white/5 text-slate-400 hover:text-white hover:border-white/10')}
                >
                  <FlipHorizontal size={13} /> Horizontal
                </button>
                <button onClick={flipV} disabled={disabled}
                  className={cn('flex items-center justify-center gap-2 py-2.5 rounded-xl border text-[11px] font-black uppercase transition-all disabled:opacity-40',
                    state.flipV ? 'bg-jb-accent/10 border-jb-accent/30 text-jb-accent' : 'bg-white/[0.03] border-white/5 text-slate-400 hover:text-white hover:border-white/10')}
                >
                  <FlipVertical size={13} /> Vertical
                </button>
              </div>
            </div>

            {(state.rotation !== 0 || state.flipH || state.flipV) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 text-[11px] font-mono text-slate-600"
              >
                {state.rotation !== 0 && <div>rot: {state.rotation}°</div>}
                {state.flipH            && <div>flip-h: on</div>}
                {state.flipV            && <div>flip-v: on</div>}
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Apply button */}
      {hasChanges && (
        <motion.button
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={apply}
          disabled={disabled}
          className="mt-4 w-full flex items-center justify-center gap-2 py-3 bg-jb-accent/10 border border-jb-accent/20 text-jb-accent rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-jb-accent hover:text-white transition-all shadow-lg disabled:opacity-40"
        >
          Apply Changes
        </motion.button>
      )}
    </div>
  );
};
