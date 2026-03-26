import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';
import { useAppStore } from '../../store/useAppStore';
import { WATERFALL_PRESET_LIST, type WaterfallPresetMeta } from '../../lib/waterfallPresets';
import { STAGE_CONFIGS, type StageKey } from './WaterfallStageCard';
import { Layers, ChevronDown, Zap, Clock, Trophy, SlidersHorizontal } from 'lucide-react';

const STAGE_ORDER: StageKey[] = ['architect', 'reasoner', 'executor', 'reviewer'];

// ─── Score badge color ──────────────────────────────────────────────────────

const scoreBadge = (score: number | null, tier: string) => {
  if (tier === 'demo') return { text: 'text-amber-400', bg: 'bg-amber-500/15', border: 'border-amber-500/20', label: 'DEMO' };
  if (score === null) return { text: 'text-slate-500', bg: 'bg-white/5', border: 'border-white/10', label: 'NEW' };
  if (score >= 90) return { text: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/20', label: `${score}` };
  if (score >= 85) return { text: 'text-sky-400', bg: 'bg-sky-500/15', border: 'border-sky-500/20', label: `${score}` };
  return { text: 'text-slate-400', bg: 'bg-white/5', border: 'border-white/10', label: `${score}` };
};

const speedIcon = (speed: string) => {
  if (speed === '~30s') return { icon: Zap, color: 'text-emerald-400' };
  if (speed.includes('1-2')) return { icon: Zap, color: 'text-sky-400' };
  return { icon: Clock, color: 'text-slate-500' };
};

// ─── Preset Card ────────────────────────────────────────────────────────────

const PresetCard = ({
  preset,
  isSelected,
  isExpanded,
  onSelect,
  onToggleExpand,
}: {
  preset: WaterfallPresetMeta;
  isSelected: boolean;
  isExpanded: boolean;
  onSelect: () => void;
  onToggleExpand: () => void;
}) => {
  const badge = scoreBadge(preset.score, preset.tier);
  const spd = speedIcon(preset.speed);
  const SpdIcon = spd.icon;

  return (
    <div
      className={cn(
        'rounded-2xl border transition-all duration-200 cursor-pointer select-none',
        isSelected
          ? 'bg-jb-purple/[0.08] border-jb-purple/30 shadow-[0_0_24px_-6px_rgba(157,91,210,0.25)]'
          : 'bg-white/[0.02] border-white/[0.06] hover:border-white/15 hover:bg-white/[0.04]',
      )}
      onClick={onSelect}
    >
      <div className="px-3.5 py-3 flex flex-col gap-2">
        {/* Top row: name + score */}
        <div className="flex items-center justify-between gap-2">
          <span className={cn(
            'text-[11px] font-extrabold tracking-tight',
            isSelected ? 'text-white' : 'text-slate-300',
          )}>
            {preset.name}
          </span>
          <div className={cn('px-1.5 py-0.5 rounded-md border text-[9px] font-black tabular-nums', badge.bg, badge.border, badge.text)}>
            {badge.label}
          </div>
        </div>

        {/* Description + speed */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-slate-400 leading-tight line-clamp-1 flex-1">
            {preset.description}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            <SpdIcon size={9} className={spd.color} />
            <span className={cn('text-[8px] font-mono', spd.color)}>{preset.speed}</span>
          </div>
        </div>

        {/* Expand toggle */}
        {isSelected && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
            className="flex items-center gap-1 text-[8px] font-bold text-slate-600 hover:text-slate-400 transition-colors pt-0.5"
          >
            <ChevronDown size={10} className={cn('transition-transform', isExpanded && 'rotate-180')} />
            {isExpanded ? 'Hide models' : 'Show models'}
          </button>
        )}
      </div>

      {/* Expanded model breakdown */}
      <AnimatePresence>
        {isSelected && isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3.5 pb-3 pt-1 border-t border-white/[0.04] space-y-1.5">
              {STAGE_ORDER.map((stage) => {
                const cfg = STAGE_CONFIGS[stage];
                const Icon = cfg.icon;
                const label = preset.stageLabels[stage];
                return (
                  <div key={stage} className="flex items-center gap-2">
                    <div className={cn('w-4 h-4 rounded flex items-center justify-center', cfg.bgColor)}>
                      <Icon size={9} className={cfg.textColor} />
                    </div>
                    <span className="text-[8px] font-black text-slate-600 uppercase tracking-wider w-16">
                      {cfg.displayName}
                    </span>
                    <span className="text-[9px] text-slate-400 font-medium">{label}</span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Custom Stage Row ───────────────────────────────────────────────────────

const CUSTOM_MODELS: { label: string; value: string; provider: string; group: string }[] = [
  // Groq
  { label: 'GPT-OSS 120B',   value: 'openai/gpt-oss-120b',               provider: 'groq',       group: 'Groq' },
  { label: 'Qwen3 32B',      value: 'qwen/qwen3-32b',                    provider: 'groq',       group: 'Groq' },
  { label: 'Kimi K2',        value: 'moonshotai/kimi-k2-instruct-0905',  provider: 'groq',       group: 'Groq' },
  { label: 'Llama 3.3 70B',  value: 'llama-3.3-70b-versatile',           provider: 'groq',       group: 'Groq' },
  { label: 'Llama 4 Maverick', value: 'meta-llama/llama-4-maverick-17b-128e-instruct', provider: 'groq', group: 'Groq' },
  // OpenRouter
  { label: 'MiMo V2 Omni',   value: 'xiaomi/mimo-v2-omni',               provider: 'openrouter', group: 'OpenRouter' },
  { label: 'Healer Alpha',   value: 'deepinfra/healerdoctor-healer-alpha', provider: 'openrouter', group: 'OpenRouter' },
  { label: 'Hunter Alpha',   value: 'openrouter/hunter-alpha',            provider: 'openrouter', group: 'OpenRouter' },
  { label: 'GLM 4.5 Air',    value: 'z-ai/glm-4.5-air:free',             provider: 'openrouter', group: 'OpenRouter' },
  // DashScope
  { label: 'Qwen3 Coder+',   value: 'qwen3-coder-plus',                  provider: 'dashscope',  group: 'DashScope' },
  { label: 'Qwen3 Max',      value: 'qwen3-max',                         provider: 'dashscope',  group: 'DashScope' },
  // Cerebras
  { label: 'Qwen3 235B',     value: 'qwen-3-235b-a22b-instruct-2507',    provider: 'cerebras',   group: 'Cerebras' },
  { label: 'Llama 3.1 8B',   value: 'llama3.1-8b',                       provider: 'cerebras',   group: 'Cerebras' },
  // Ollama Cloud
  { label: 'GLM-4.7',        value: 'glm-4.7:cloud',                     provider: 'ollama',     group: 'Ollama Cloud' },
  { label: 'Kimi K2.5',      value: 'kimi-k2.5:cloud',                   provider: 'ollama',     group: 'Ollama Cloud' },
  { label: 'DeepSeek V3.2',  value: 'deepseek-v3.2:cloud',               provider: 'ollama',     group: 'Ollama Cloud' },
  { label: 'Nemotron 3S',    value: 'nemotron-3-super:cloud',             provider: 'ollama',     group: 'Ollama Cloud' },
  { label: 'Kimi Thinking',  value: 'kimi-k2-thinking:cloud',            provider: 'ollama',     group: 'Ollama Cloud' },
  { label: 'Qwen 3.5',       value: 'qwen3.5:cloud',                     provider: 'ollama',     group: 'Ollama Cloud' },
  { label: 'Qwen3 Coder 480B', value: 'qwen3-coder:480b-cloud',          provider: 'ollama',     group: 'Ollama Cloud' },
];

const groups = [...new Set(CUSTOM_MODELS.map(m => m.group))];

const CustomStageRow = ({
  stage,
  currentSelection,
  onChange,
}: {
  stage: StageKey;
  currentSelection: string | { model: string; provider: string };
  onChange: (model: string, provider: string) => void;
}) => {
  const cfg = STAGE_CONFIGS[stage];
  const Icon = cfg.icon;

  // Derive current value as provider:model key
  const currentKey = typeof currentSelection === 'object'
    ? `${currentSelection.provider}:${currentSelection.model}`
    : '';

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 w-24 shrink-0">
        <div className={cn('w-5 h-5 rounded-lg flex items-center justify-center', cfg.bgColor)}>
          <Icon size={10} className={cfg.textColor} />
        </div>
        <span className="text-[8px] font-black text-slate-500 uppercase tracking-wider">
          {cfg.displayName}
        </span>
      </div>
      <select
        value={currentKey}
        onChange={(e) => {
          const [provider, ...modelParts] = e.target.value.split(':');
          const model = modelParts.join(':');
          onChange(model, provider);
        }}
        className="flex-1 bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-1.5 text-[10px] text-slate-300 font-medium outline-none focus:border-jb-purple/30 transition-colors appearance-none cursor-pointer"
      >
        {groups.map((group) => (
          <optgroup key={group} label={group} className="bg-[#0a0a0f]">
            {CUSTOM_MODELS.filter(m => m.group === group).map((m) => (
              <option key={`${m.provider}:${m.value}`} value={`${m.provider}:${m.value}`}>
                {m.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
};

// ─── Main Component ─────────────────────────────────────────────────────────

export const WaterfallPresetPicker = () => {
  const {
    waterfallPresetKey,
    waterfallModelSelection,
    setWaterfallPreset,
    setWaterfallCustomStage,
  } = useAppStore();

  const [expandedPreset, setExpandedPreset] = useState<string | null>(null);
  const [showCustom, setShowCustom] = useState(waterfallPresetKey === 'custom');

  const topPresets = WATERFALL_PRESET_LIST.filter(p => p.tier === 'top');
  const otherPresets = WATERFALL_PRESET_LIST.filter(p => p.tier !== 'top');

  const handleSelect = (key: string) => {
    setWaterfallPreset(key);
    setShowCustom(false);
    if (expandedPreset !== key) setExpandedPreset(null);
  };

  const handleCustomToggle = () => {
    setShowCustom(!showCustom);
    if (!showCustom) setExpandedPreset(null);
  };

  return (
    <div className="glass-panel rounded-[2rem] overflow-hidden">
      <div className="p-5 space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers size={12} className="text-slate-500" />
            <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">
              Pipeline Preset
            </span>
          </div>
          <button
            onClick={handleCustomToggle}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[8px] font-bold uppercase tracking-wider transition-all',
              showCustom
                ? 'bg-jb-purple/10 border-jb-purple/25 text-jb-purple'
                : 'bg-white/[0.03] border-white/[0.08] text-slate-600 hover:text-slate-400 hover:border-white/15',
            )}
          >
            <SlidersHorizontal size={9} />
            Custom
          </button>
        </div>

        {/* Top preset cards */}
        <div className="grid grid-cols-2 gap-2">
          {topPresets.map((preset) => (
            <PresetCard
              key={preset.key}
              preset={preset}
              isSelected={waterfallPresetKey === preset.key}
              isExpanded={expandedPreset === preset.key}
              onSelect={() => handleSelect(preset.key)}
              onToggleExpand={() => setExpandedPreset(expandedPreset === preset.key ? null : preset.key)}
            />
          ))}
        </div>

        {/* Other presets — collapsed row */}
        {otherPresets.length > 0 && !showCustom && (
          <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
            {otherPresets.map((preset) => {
              const badge = scoreBadge(preset.score, preset.tier);
              const isSelected = waterfallPresetKey === preset.key;
              return (
                <button
                  key={preset.key}
                  onClick={() => handleSelect(preset.key)}
                  className={cn(
                    'shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all text-[9px] font-bold',
                    isSelected
                      ? 'bg-jb-purple/[0.08] border-jb-purple/30 text-white'
                      : 'bg-white/[0.02] border-white/[0.06] text-slate-500 hover:text-slate-300 hover:border-white/15',
                  )}
                >
                  {preset.name}
                  <span className={cn('text-[8px] font-mono', badge.text)}>{badge.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Custom panel */}
        <AnimatePresence>
          {showCustom && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="pt-3 border-t border-white/[0.04] space-y-2.5">
                <span className="text-[8px] text-slate-700 font-mono block">Select a model for each pipeline stage</span>
                {STAGE_ORDER.map((stage) => (
                  <CustomStageRow
                    key={stage}
                    stage={stage}
                    currentSelection={waterfallModelSelection[stage]}
                    onChange={(model, provider) => setWaterfallCustomStage(stage, { model, provider })}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer hint */}
        <div className="pt-2 border-t border-white/[0.04]">
          <div className="flex items-center gap-1.5">
            <Trophy size={9} className="text-slate-700" />
            <span className="text-[8px] text-slate-700 font-mono">
              Scores from 60 pipeline runs · MiMo V2 reviewer · Hard prompt
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
