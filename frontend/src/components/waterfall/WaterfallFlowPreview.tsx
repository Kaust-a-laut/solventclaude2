import React, { useState } from 'react';
import { cn } from '../../lib/utils';
import { useAppStore } from '../../store/useAppStore';
import { STAGE_CONFIGS, type StageKey } from './WaterfallStageCard';
import { WATERFALL_PRESETS_BY_KEY } from '../../lib/waterfallPresets';
import { ArrowDown, Workflow, ArrowUpCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const STAGE_ORDER: StageKey[] = ['planner', 'executor', 'reviewer'];

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

interface UpgradeSuggestion {
  current: { model: string; provider: string };
  successor: { model: string; provider: string };
  note: string;
  usedInPresets: string[];
}

function upgradeKey(u: UpgradeSuggestion): string {
  return `${u.current.provider}:${u.current.model}→${u.successor.model}`;
}

export const WaterfallFlowPreview = ({
  upgradeSuggestions,
  dismissedKeys,
  onDismissUpgrade,
  onSwapModel,
}: {
  upgradeSuggestions: UpgradeSuggestion[];
  dismissedKeys: Set<string>;
  onDismissUpgrade: (key: string) => void;
  onSwapModel: (stage: StageKey, model: string, provider: string) => void;
}) => {
  const { waterfallPresetKey } = useAppStore();
  const [activePopover, setActivePopover] = useState<StageKey | null>(null);
  const preset = WATERFALL_PRESETS_BY_KEY[waterfallPresetKey];

  function getStageUpgrades(stage: StageKey): { successor: string; provider: string; note: string; key: string; currentModel: string }[] {
    if (!preset) return [];
    const sel = preset.selection[stage];
    if (typeof sel !== 'object') return [];
    const results: { successor: string; provider: string; note: string; key: string; currentModel: string }[] = [];
    for (const u of upgradeSuggestions) {
      if (u.current.provider === sel.provider && u.current.model === sel.model) {
        const k = upgradeKey(u);
        if (!dismissedKeys.has(k)) {
          results.push({
            successor: u.successor.model,
            provider: u.successor.provider,
            note: u.note,
            key: k,
            currentModel: u.current.model,
          });
        }
      }
    }
    return results;
  }

  return (
    <div className="glass-panel rounded-[2rem] overflow-hidden h-fit sticky top-6">
      <div className="p-6 space-y-5">

        {/* Header */}
        <div className="flex items-center gap-2.5">
          <Workflow size={14} className="text-slate-300" />
          <span className="text-[12px] font-black text-slate-400 uppercase tracking-widest">
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
                      <span className="text-[11px] text-slate-300 font-medium capitalize">
                        {provider}
                      </span>
                    )}
                  </div>

                  {/* Upgrade icon */}
                  {(() => {
                    const stageUpgrades = getStageUpgrades(stage);
                    if (stageUpgrades.length === 0) return null;
                    return (
                      <button
                        onClick={() => setActivePopover(activePopover === stage ? null : stage)}
                        className={cn(
                          'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border transition-all',
                          activePopover === stage
                            ? 'bg-blue-500/15 border-blue-500/30'
                            : 'bg-white/[0.03] border-white/[0.08] hover:border-white/15',
                        )}
                      >
                        <ArrowUpCircle size={14} className="text-blue-400" />
                      </button>
                    );
                  })()}
                </motion.div>

                {/* Upgrade popover */}
                <AnimatePresence>
                  {activePopover === stage && (() => {
                    const stageUpgrades = getStageUpgrades(stage);
                    if (stageUpgrades.length === 0) return null;
                    return (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="overflow-hidden ml-14"
                      >
                        <div className="py-2 space-y-1.5">
                          {stageUpgrades.map(u => (
                            <div key={u.key} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                              <div className="flex-1 min-w-0">
                                <div className="text-[10px] text-slate-400 font-medium truncate">{u.currentModel}</div>
                                <div className="text-[11px] text-slate-300 font-medium truncate">→ {u.successor}</div>
                              </div>
                              <button
                                onClick={() => { onSwapModel(stage, u.successor, u.provider); onDismissUpgrade(u.key); setActivePopover(null); }}
                                className={cn('shrink-0 px-2.5 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-wider transition-colors', cfg.bgColor, cfg.textColor, 'border-white/10 hover:border-white/20')}
                              >
                                Use
                              </button>
                              <button
                                onClick={() => onDismissUpgrade(u.key)}
                                className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-400 transition-colors"
                              >
                                <X size={10} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    );
                  })()}
                </AnimatePresence>

                {/* Connector */}
                {!isLast && (
                  <div className="flex items-center ml-[19px] py-1">
                    <div className="flex flex-col items-center">
                      <div className="w-px h-4 bg-gradient-to-b from-white/10 to-white/5" />
                      <ArrowDown size={10} className="text-slate-400 -my-0.5" />
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
          <p className="text-[12px] text-slate-400 leading-relaxed">
            Each stage streams its output to the next. The planner decomposes and strategizes, the executor implements, and the reviewer scores.
          </p>
        </div>
      </div>
    </div>
  );
};
