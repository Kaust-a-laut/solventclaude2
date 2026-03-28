import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Download } from 'lucide-react';
import { cn } from '../lib/utils';
import { SliderRow } from './ManualEditTools';

// ─── Types ────────────────────────────────────────────────────────────────────

type ExportFormat = 'image/png' | 'image/jpeg' | 'image/webp';

const FORMAT_LABELS: Record<ExportFormat, string> = {
  'image/png':  'PNG',
  'image/jpeg': 'JPEG',
  'image/webp': 'WebP',
};

export interface ExportToolProps {
  selectedImage: string | null;
  disabled: boolean;
}

// ─── ToggleSwitch ─────────────────────────────────────────────────────────────

const ToggleSwitch = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
  <button
    onClick={() => onChange(!value)}
    className={cn('w-8 h-4 rounded-full transition-colors relative shrink-0', value ? 'bg-jb-accent' : 'bg-white/10')}
  >
    <span
      className={cn(
        'absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all',
        value ? 'left-[18px]' : 'left-0.5',
      )}
    />
  </button>
);

// ─── ExportTool ───────────────────────────────────────────────────────────────

export const ExportTool: React.FC<ExportToolProps> = ({ selectedImage, disabled }) => {
  const [format, setFormat]               = useState<ExportFormat>('image/png');
  const [quality, setQuality]             = useState(92);
  const [resizeEnabled, setResizeEnabled] = useState(false);
  const [resizeW, setResizeW]             = useState(1920);
  const [resizeH, setResizeH]             = useState(1080);
  const [isExporting, setIsExporting]     = useState(false);

  const handleExport = () => {
    if (!selectedImage) return;
    setIsExporting(true);

    const img = new Image();
    img.onload = () => {
      const w = resizeEnabled ? resizeW : img.naturalWidth;
      const h = resizeEnabled ? resizeH : img.naturalHeight;

      const canvas = document.createElement('canvas');
      canvas.width  = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;

      // White background for JPEG (no alpha channel)
      if (format === 'image/jpeg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
      }

      ctx.drawImage(img, 0, 0, w, h);

      const q = format === 'image/png' ? undefined : quality / 100;
      const dataUrl = canvas.toDataURL(format, q);

      const ext  = format.split('/')[1] === 'jpeg' ? 'jpg' : format.split('/')[1];
      const link = document.createElement('a');
      link.href     = dataUrl;
      link.download = `solvent-export.${ext}`;
      link.click();

      setIsExporting(false);
    };
    img.onerror = () => {
      setIsExporting(false);
    };
    img.src = selectedImage;
  };

  const isDisabled = disabled || !selectedImage || isExporting;

  return (
    <div className="space-y-4">
      {/* Format selector */}
      <div>
        <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest block mb-2">
          Format
        </span>
        <div className="grid grid-cols-3 gap-1.5">
          {(Object.keys(FORMAT_LABELS) as ExportFormat[]).map((f) => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              className={cn(
                'py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all border',
                format === f
                  ? 'bg-jb-accent/15 border-jb-accent/30 text-jb-accent'
                  : 'bg-white/[0.03] border-white/5 text-slate-500 hover:text-white hover:border-white/10',
              )}
            >
              {FORMAT_LABELS[f]}
            </button>
          ))}
        </div>
      </div>

      {/* Quality slider — JPEG / WebP only */}
      {format !== 'image/png' && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.15 }}
        >
          <SliderRow
            label="Quality"
            value={quality}
            min={1}
            max={100}
            unit="%"
            onChange={setQuality}
            disabled={isDisabled}
          />
        </motion.div>
      )}

      {/* Resize toggle */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Resize</span>
        <ToggleSwitch value={resizeEnabled} onChange={setResizeEnabled} />
      </div>

      {/* Width / Height inputs */}
      {resizeEnabled && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.15 }}
          className="grid grid-cols-2 gap-2"
        >
          {(['W', 'H'] as const).map((axis) => {
            const val    = axis === 'W' ? resizeW : resizeH;
            const setter = axis === 'W' ? setResizeW : setResizeH;
            return (
              <div key={axis}>
                <span className="text-[11px] text-slate-600 uppercase tracking-widest block mb-1">{axis}</span>
                <input
                  type="number"
                  min={1}
                  max={8192}
                  value={val}
                  onChange={(e) => setter(Math.max(1, Number(e.target.value)))}
                  className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-2 py-1.5 text-[11px] font-mono text-white outline-none focus:border-jb-accent/40 transition-all"
                />
              </div>
            );
          })}
        </motion.div>
      )}

      {/* Export button */}
      <button
        onClick={handleExport}
        disabled={isDisabled}
        className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-emerald-500 hover:text-black transition-all shadow-lg disabled:opacity-40"
      >
        <Download size={14} />
        {isExporting ? 'Exporting...' : 'Export / Download'}
      </button>

      {/* Size info when no image */}
      {!selectedImage && (
        <p className="text-[11px] text-slate-600 text-center font-medium">Load an image to export it.</p>
      )}
    </div>
  );
};
