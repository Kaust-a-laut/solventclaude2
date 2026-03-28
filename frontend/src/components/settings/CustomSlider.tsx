import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';

interface CustomSliderProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  accent?: 'blue' | 'purple';
  showTicks?: boolean;
  formatValue?: (v: number) => string;
}

const ACCENT_CLASSES = {
  blue: {
    fill: 'bg-gradient-to-r from-jb-accent/30 to-jb-accent',
    thumb: 'border-jb-accent shadow-[0_0_12px_rgba(60,113,247,0.4)]',
    tooltip: 'text-jb-accent',
  },
  purple: {
    fill: 'bg-gradient-to-r from-jb-purple/30 to-jb-purple',
    thumb: 'border-jb-purple shadow-[0_0_12px_rgba(157,91,210,0.4)]',
    tooltip: 'text-jb-purple',
  },
};

export const CustomSlider = ({
  value,
  onChange,
  min,
  max,
  step,
  accent = 'blue',
  showTicks = false,
  formatValue = (v) => String(v),
}: CustomSliderProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const styles = ACCENT_CLASSES[accent];
  const pct = ((value - min) / (max - min)) * 100;
  const showTooltip = isDragging || isHovering;

  // Generate tick positions
  const ticks = showTicks
    ? Array.from({ length: Math.round((max - min) / step) + 1 }, (_, i) => min + i * step)
    : [];

  const updateFromPointer = useCallback((clientX: number) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const raw = min + ratio * (max - min);
    const snapped = Math.round(raw / step) * step;
    onChange(Math.max(min, Math.min(max, snapped)));
  }, [min, max, step, onChange]);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsDragging(true);
    updateFromPointer(e.clientX);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    updateFromPointer(e.clientX);
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  return (
    <div className="relative py-3">
      {/* Track container */}
      <div
        ref={trackRef}
        className="relative h-2 bg-white/[0.06] rounded-full cursor-pointer"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        {/* Filled portion */}
        <div
          className={cn("absolute top-0 left-0 h-full rounded-full transition-[width] duration-75", styles.fill)}
          style={{ width: `${pct}%` }}
        />

        {/* Thumb */}
        <div
          className={cn(
            "absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white border-2 transition-transform cursor-grab active:cursor-grabbing",
            styles.thumb,
            isDragging && "scale-110"
          )}
          style={{ left: `calc(${pct}% - 10px)` }}
        >
          {/* Tooltip */}
          <AnimatePresence>
            {showTooltip && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.12 }}
                className={cn(
                  "absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-[#0a0a0f] border border-white/10 rounded-lg text-[11px] font-mono whitespace-nowrap pointer-events-none",
                  styles.tooltip
                )}
              >
                {formatValue(value)}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Tick marks */}
      {showTicks && ticks.length > 0 && (
        <div className="relative h-2 mt-1.5">
          {ticks.map(tick => {
            const tickPct = ((tick - min) / (max - min)) * 100;
            return (
              <div
                key={tick}
                className="absolute w-1 h-1 rounded-full bg-white/10"
                style={{ left: `calc(${tickPct}% - 2px)` }}
              />
            );
          })}
        </div>
      )}

      {/* Hidden native input for accessibility */}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="sr-only"
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
      />
    </div>
  );
};
