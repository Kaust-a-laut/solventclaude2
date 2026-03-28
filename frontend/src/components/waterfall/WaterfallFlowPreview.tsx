import React from 'react';
import { cn } from '../../lib/utils';
import { useAppStore } from '../../store/useAppStore';
import { STAGE_CONFIGS, type StageKey } from './WaterfallStageCard';
import { WATERFALL_PRESETS_BY_KEY } from '../../lib/waterfallPresets';
import { ArrowDown, Workflow } from 'lucide-react';
import { motion } from 'framer-motion';

const STAGE_ORDER: StageKey[] = ['architect', 'reasoner', 'executor', 'reviewer'];

// Resolve model label for a stage from the current preset
function resolveModelLabel(
  stage: StageKey,
  presetKey: string,
): { model: string; provider: string } {
  const preset = WATERFALL_PRESETS_BY_KEY[presetKey];
  if (!preset) return { model: 'Custom', provider: '' };
  return {
    model: preset.stageLabels[stage],
    provider: typeof preset.selection[stage] === 'object'
      ? (preset.selection[stage] as { provider: string }).provider
      : '',
  };
}

export const WaterfallFlowPreview = () => {
  const { waterfallPresetKey } = useAppStore();

  return (
    <div className="glass-panel rounded-[2rem] overflow-hidden h-fit sticky top-6">
      <div className="p-6 space-y-5">

        {/* Header */}
        <div className="flex items-center gap-2.5">
          <Workflow size={14} className="text-slate-500" />
          <span className="text-[12px] font-black text-slate-600 uppercase tracking-widest">
            Pipeline Flow
          </span>
        </div>

        {/* Stage flow */}
        <div className="flex flex-col">
          {STAGE_ORDER.map((stage, i) => {
            const cfg = STAGE_CONFIGS[stage];
            const Icon = cfg.icon;
            const { model, provider } = resolveModelLabel(stage, waterfallPresetKey);
            const isLast = i === STAGE_ORDER.length - 1;

            return (
              <React.Fragment key={stage}>
                <motion.div
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08, duration: 0.3 }}
                  className="flex items-center gap-4"
                >
                  {/* Icon node */}
                  <div className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border',
                    cfg.bgColor,
                    `border-${cfg.color}/20`,
                  )}>
                    <Icon size={18} className={cfg.textColor} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <span className={cn('text-[12px] font-black uppercase tracking-wider block', cfg.textColor)}>
                      {cfg.displayName}
                    </span>
                    <span className="text-[13px] font-bold text-white block truncate">
                      {model}
                    </span>
                    {provider && (
                      <span className="text-[11px] text-slate-500 font-medium capitalize">
                        {provider}
                      </span>
                    )}
                  </div>
                </motion.div>

                {/* Connector */}
                {!isLast && (
                  <div className="flex items-center ml-[19px] py-1">
                    <div className="flex flex-col items-center">
                      <div className="w-px h-4 bg-gradient-to-b from-white/10 to-white/5" />
                      <ArrowDown size={10} className="text-slate-700 -my-0.5" />
                      <div className="w-px h-4 bg-gradient-to-b from-white/5 to-white/10" />
                    </div>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Description footer */}
        <div className="pt-3 border-t border-white/[0.04]">
          <p className="text-[12px] text-slate-600 leading-relaxed">
            Each stage streams its output to the next. The planner decomposes, the strategist reasons, the executioner implements, and the reviewer scores.
          </p>
        </div>
      </div>
    </div>
  );
};
