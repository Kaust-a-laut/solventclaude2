import React from 'react';
import { cn } from '../lib/utils';

// ─── Shared types (also imported by SolventSeeArea) ──────────────────────────

export interface SelectionRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type AspectRatio = 'free' | '1:1' | '16:9' | '4:3';

const ASPECT_LABELS: AspectRatio[] = ['free', '1:1', '16:9', '4:3'];

// ─── Discriminated union props ────────────────────────────────────────────────

interface CropModeProps {
  mode: 'crop';
  selection: SelectionRect | null;
  activeAspect: AspectRatio;
  onAspectChange: (r: AspectRatio) => void;
  onApply: () => void;
  onCancel: () => void;
  disabled: boolean;
}

interface SelectModeProps {
  mode: 'select';
  selection: SelectionRect | null;
  onCut: () => void;
  onCopy: () => void;
  onCancel: () => void;
  disabled: boolean;
}

type CropToolProps = CropModeProps | SelectModeProps;

// ─── Component ────────────────────────────────────────────────────────────────

export const CropTool: React.FC<CropToolProps> = (props) => {
  const hasSelection = props.selection !== null;

  if (props.mode === 'crop') {
    return (
      <div className="space-y-3">
        {/* Aspect ratio presets */}
        <div>
          <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest block mb-2">
            Aspect Ratio
          </span>
          <div className="grid grid-cols-4 gap-1.5">
            {ASPECT_LABELS.map((r) => (
              <button
                key={r}
                onClick={() => props.onAspectChange(r)}
                className={cn(
                  'py-2 rounded-xl text-[11px] font-black uppercase tracking-wide transition-all border',
                  props.activeAspect === r
                    ? 'bg-jb-purple/15 border-jb-purple/30 text-jb-purple'
                    : 'bg-white/[0.03] border-white/5 text-slate-500 hover:text-white hover:border-white/10',
                )}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Instruction when nothing drawn */}
        {!hasSelection && (
          <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
            Drag on the image to draw a crop selection.
          </p>
        )}

        {/* Selection size readout */}
        {hasSelection && props.selection && (
          <div className="p-2 rounded-xl bg-white/[0.02] border border-white/5 font-mono text-[11px] text-slate-500">
            {Math.round(props.selection.w)} × {Math.round(props.selection.h)} px
          </div>
        )}

        {/* Actions */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={props.onCancel}
            className="py-2.5 rounded-xl bg-white/[0.03] border border-white/5 text-[11px] font-black uppercase text-slate-500 hover:text-white hover:border-white/10 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={props.onApply}
            disabled={!hasSelection || props.disabled}
            className="py-2.5 rounded-xl bg-jb-purple/10 border border-jb-purple/20 text-jb-purple text-[11px] font-black uppercase hover:bg-jb-purple hover:text-white transition-all disabled:opacity-40"
          >
            Apply Crop
          </button>
        </div>
      </div>
    );
  }

  // ── Select mode ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      {!hasSelection && (
        <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
          Drag on the image to draw a selection, then cut or copy the region.
        </p>
      )}

      {hasSelection && props.selection && (
        <div className="p-2 rounded-xl bg-white/[0.02] border border-white/5 font-mono text-[11px] text-slate-500">
          {Math.round(props.selection.w)} × {Math.round(props.selection.h)} px selected
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={props.onCopy}
          disabled={!hasSelection || props.disabled}
          className="py-2.5 rounded-xl bg-white/[0.03] border border-white/5 text-[11px] font-black uppercase text-slate-400 hover:text-white hover:border-white/10 transition-all disabled:opacity-40"
        >
          Copy
        </button>
        <button
          onClick={props.onCut}
          disabled={!hasSelection || props.disabled}
          className="py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[11px] font-black uppercase hover:bg-rose-500 hover:text-white transition-all disabled:opacity-40"
        >
          Cut
        </button>
      </div>

      <button
        onClick={props.onCancel}
        className="w-full py-2.5 rounded-xl bg-white/[0.03] border border-white/5 text-[11px] font-black uppercase text-slate-500 hover:text-white hover:border-white/10 transition-all"
      >
        Cancel Selection
      </button>
    </div>
  );
};
