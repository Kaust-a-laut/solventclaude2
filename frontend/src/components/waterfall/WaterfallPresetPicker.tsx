import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';
import { useAppStore } from '../../store/useAppStore';
import { WATERFALL_PRESET_LIST, type WaterfallPresetMeta } from '../../lib/waterfallPresets';
import { STAGE_CONFIGS, type StageKey } from './WaterfallStageCard';
import { Layers, ChevronDown, Trophy, SlidersHorizontal, AlertTriangle } from 'lucide-react';

const STAGE_ORDER: StageKey[] = ['planner', 'executor', 'reviewer'];

// ─── Model availability types ──────────────────────────────────────────────

interface UnavailableModel {
  model: string;
  provider: string;
  available: boolean;
  usedInPresets: string[];
}

interface UpgradeSuggestion {
  current: { model: string; provider: string };
  successor: { model: string; provider: string };
  note: string;
  usedInPresets: string[];
}

/** Check if a preset has any unavailable models, return list of affected stage labels */
function getPresetWarnings(
  preset: WaterfallPresetMeta,
  unavailable: UnavailableModel[],
): string[] {
  if (unavailable.length === 0) return [];
  const warnings: string[] = [];
  for (const stage of STAGE_ORDER) {
    const sel = preset.selection[stage];
    if (typeof sel === 'object') {
      const isDown = unavailable.some(u => u.provider === sel.provider && u.model === sel.model);
      if (isDown) warnings.push(preset.stageLabels[stage]);
    }
  }
  return warnings;
}

function upgradeKey(u: UpgradeSuggestion): string {
  return `${u.current.provider}:${u.current.model}→${u.successor.model}`;
}

interface PresetUpgrade {
  stage: StageKey;
  stageLabel: string;
  currentModel: string;
  successorModel: string;
  successorProvider: string;
  note: string;
  key: string;
}

/** Get non-dismissed upgrade suggestions for a preset */
function getPresetUpgrades(
  preset: WaterfallPresetMeta,
  upgrades: UpgradeSuggestion[],
  dismissed: Set<string>,
): PresetUpgrade[] {
  if (upgrades.length === 0) return [];
  const results: PresetUpgrade[] = [];
  for (const stage of STAGE_ORDER) {
    const sel = preset.selection[stage];
    if (typeof sel === 'object') {
      for (const u of upgrades) {
        if (u.current.provider === sel.provider && u.current.model === sel.model) {
          const k = upgradeKey(u);
          if (!dismissed.has(k)) {
            results.push({
              stage,
              stageLabel: preset.stageLabels[stage],
              currentModel: u.current.model,
              successorModel: u.successor.model,
              successorProvider: u.successor.provider,
              note: u.note,
              key: k,
            });
          }
        }
      }
    }
  }
  return results;
}

// ─── Score badge color ──────────────────────────────────────────────────────

const gradeBadge = (grade: string | null, category: string) => {
  if (category === 'demo') return { text: 'text-amber-400', bg: 'bg-amber-500/15', border: 'border-amber-500/20', label: 'DEMO' };
  if (grade === null) return { text: 'text-slate-500', bg: 'bg-white/5', border: 'border-white/10', label: 'NEW' };
  if (grade.startsWith('A')) return { text: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/20', label: grade };
  if (grade.startsWith('B')) return { text: 'text-sky-400', bg: 'bg-sky-500/15', border: 'border-sky-500/20', label: grade };
  if (grade.startsWith('C')) return { text: 'text-amber-400', bg: 'bg-amber-500/15', border: 'border-amber-500/20', label: grade };
  return { text: 'text-red-400', bg: 'bg-red-500/15', border: 'border-red-500/20', label: grade };
};

// ─── Provider Swap Panel ────────────────────────────────────────────────────

const ProviderSwapPanel = ({ preset }: { preset: WaterfallPresetMeta }) => {
  const { setWaterfallCustomStage } = useAppStore();

  const stagesWithAlts = STAGE_ORDER.filter((stage) => {
    const sel = preset.selection[stage];
    if (typeof sel !== 'object') return false;
    return getProviderAlternatives(sel.provider, sel.model) !== null;
  });

  if (stagesWithAlts.length === 0) return null;

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="overflow-hidden"
    >
      <div className="pt-2 pb-1 px-1 space-y-1.5">
        {stagesWithAlts.map((stage) => {
          const cfg = STAGE_CONFIGS[stage];
          const Icon = cfg.icon;
          const sel = preset.selection[stage] as { model: string; provider: string };
          const alts = getProviderAlternatives(sel.provider, sel.model)!;

          return (
            <div key={stage} className="flex items-center gap-2">
              <div className={cn('w-4 h-4 rounded flex items-center justify-center shrink-0', cfg.bgColor)}>
                <Icon size={8} className={cfg.textColor} />
              </div>
              <span className="text-[9px] font-bold text-slate-600 uppercase tracking-wider w-16 shrink-0">
                {cfg.displayName}
              </span>
              <div className="flex items-center gap-1">
                {alts.group.variants.map((v) => (
                  <button
                    key={v.provider}
                    onClick={(e) => {
                      e.stopPropagation();
                      setWaterfallCustomStage(stage, { model: v.model, provider: v.provider });
                    }}
                    className={cn(
                      'px-1.5 py-0.5 rounded text-[8px] font-bold transition-all border',
                      v.provider === alts.current.provider
                        ? 'bg-jb-purple/15 border-jb-purple/30 text-jb-purple'
                        : 'bg-white/[0.03] border-white/[0.06] text-slate-600 hover:text-slate-400 hover:border-white/15',
                    )}
                  >
                    {v.providerLabel}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};

// ─── Recommended Row ────────────────────────────────────────────────────────

const RecommendedRow = ({
  preset,
  isSelected,
  isExpanded,
  isDefault,
  onSelect,
  onToggleExpand,
  warnings,
}: {
  preset: WaterfallPresetMeta;
  isSelected: boolean;
  isExpanded: boolean;
  isDefault: boolean;
  onSelect: () => void;
  onToggleExpand: () => void;
  warnings: string[];
}) => {
  const badge = gradeBadge(preset.grade, preset.category);
  const isFast = preset.speed !== '~5m+';

  return (
    <div>
      <div
        className={cn(
          'rounded-lg border transition-all duration-200 cursor-pointer select-none px-3 py-2.5',
          isSelected
            ? 'bg-[rgba(157,91,210,0.06)] border-[rgba(157,91,210,0.2)] shadow-[0_0_16px_-4px_rgba(157,91,210,0.15)]'
            : 'bg-[rgba(255,255,255,0.015)] border-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.15)]',
        )}
        onClick={onSelect}
      >
        <div className="flex items-center gap-2.5">
          {isDefault && (
            <div className="w-[5px] h-[5px] rounded-full bg-jb-purple shrink-0" />
          )}
          <span className={cn(
            'text-[11px] font-extrabold tracking-tight shrink-0',
            isSelected ? 'text-[#e2e8f0]' : 'text-[#cbd5e1]',
          )}>
            {preset.name}
          </span>
          <span className="text-[9px] text-[#64748b] truncate">
            — {preset.tagline}
          </span>
          <div className="flex-1" />
          <span className={cn(
            'text-[9px] font-mono shrink-0',
            isFast ? 'text-[#34d399]' : 'text-[#475569]',
          )}>
            {preset.speed}
          </span>
          <div className={cn('px-1.5 py-0.5 rounded-md border text-[10px] font-black tabular-nums shrink-0', badge.bg, badge.border, badge.text)}>
            {badge.label}
          </div>
          {warnings.length > 0 && (
            <AlertTriangle size={10} className="text-amber-400 shrink-0" />
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
            className="shrink-0 text-slate-700 hover:text-slate-400 transition-colors"
          >
            <ChevronDown size={10} className={cn('transition-transform', isExpanded && 'rotate-180')} />
          </button>
        </div>
        <div className="mt-1.5">
          <span className="text-[8px] text-[#334155]">
            {preset.stageLabels.planner} → {preset.stageLabels.executor} → {preset.stageLabels.reviewer}
          </span>
        </div>
      </div>
      <AnimatePresence>
        {isExpanded && (
          <ProviderSwapPanel preset={preset} />
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Top Tier Card ──────────────────────────────────────────────────────────

const TopTierCard = ({
  preset,
  isSelected,
  onSelect,
}: {
  preset: WaterfallPresetMeta;
  isSelected: boolean;
  onSelect: () => void;
}) => {
  const badge = gradeBadge(preset.grade, preset.category);

  return (
    <div
      className={cn(
        'rounded-md border transition-all duration-200 cursor-pointer select-none px-2 py-1.5',
        isSelected
          ? 'bg-[rgba(157,91,210,0.06)] border-[rgba(157,91,210,0.2)]'
          : 'bg-[rgba(255,255,255,0.015)] border-[rgba(255,255,255,0.04)] hover:border-[rgba(255,255,255,0.15)]',
      )}
      onClick={onSelect}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={cn(
          'text-[9px] font-bold truncate',
          isSelected ? 'text-white' : 'text-[#94a3b8]',
        )}>
          {preset.name}
        </span>
        <div className={cn('px-1 py-0.5 rounded border text-[9px] font-black tabular-nums shrink-0', badge.bg, badge.border, badge.text)}>
          {badge.label}
        </div>
      </div>
    </div>
  );
};

// ─── Solo Pill ──────────────────────────────────────────────────────────────

const SoloPill = ({
  preset,
  isSelected,
  onSelect,
}: {
  preset: WaterfallPresetMeta;
  isSelected: boolean;
  onSelect: () => void;
}) => {
  const displayName = preset.name.replace(/^Solo:\s*/, '');

  return (
    <button
      onClick={onSelect}
      className={cn(
        'rounded-[5px] border transition-all duration-200 px-1.5 py-1 text-center',
        isSelected
          ? 'bg-[rgba(157,91,210,0.06)] border-[rgba(157,91,210,0.2)] text-[#94a3b8]'
          : 'bg-[rgba(255,255,255,0.02)] border-[rgba(255,255,255,0.04)] text-[#64748b] hover:border-[rgba(255,255,255,0.15)]',
      )}
    >
      <span className="text-[8px] font-semibold">{displayName}</span>
    </button>
  );
};

// ─── Custom Stage Row ───────────────────────────────────────────────────────

export const CUSTOM_MODELS: { label: string; value: string; provider: string; group: string }[] = [
  // Groq
  { label: 'GPT-OSS 120B',   value: 'openai/gpt-oss-120b',               provider: 'groq',       group: 'Groq' },
  { label: 'Qwen3 32B',      value: 'qwen/qwen3-32b',                    provider: 'groq',       group: 'Groq' },
  { label: 'Kimi K2',        value: 'moonshotai/kimi-k2-instruct-0905',  provider: 'groq',       group: 'Groq' },
  { label: 'Llama 3.3 70B',  value: 'llama-3.3-70b-versatile',           provider: 'groq',       group: 'Groq' },
  { label: 'Llama 4 Maverick', value: 'meta-llama/llama-4-maverick-17b-128e-instruct', provider: 'groq', group: 'Groq' },
  // OpenRouter
  { label: 'Llama 3.3 70B',   value: 'meta-llama/llama-3.3-70b-instruct:free', provider: 'openrouter', group: 'OpenRouter' },
  { label: 'Hermes 3 405B',  value: 'nousresearch/hermes-3-llama-3.1-405b:free', provider: 'openrouter', group: 'OpenRouter' },
  { label: 'Qwen3.6 Plus',   value: 'qwen/qwen3.6-plus:free',            provider: 'openrouter', group: 'OpenRouter' },
  { label: 'MiMo V2 Omni',   value: 'xiaomi/mimo-v2-omni',               provider: 'openrouter', group: 'OpenRouter' },
  { label: 'Healer Alpha',   value: 'deepinfra/healerdoctor-healer-alpha', provider: 'openrouter', group: 'OpenRouter' },
  { label: 'Hunter Alpha',   value: 'openrouter/hunter-alpha',            provider: 'openrouter', group: 'OpenRouter' },
  { label: 'GLM 4.5 Air',    value: 'z-ai/glm-4.5-air:free',             provider: 'openrouter', group: 'OpenRouter' },
  { label: 'GLM-5.1',        value: 'z-ai/glm-5.1',                      provider: 'openrouter', group: 'OpenRouter' },
  // DashScope
  { label: 'Qwen 3.6 Plus',  value: 'qwen3.6-plus',                     provider: 'dashscope',  group: 'DashScope' },
  { label: 'Qwen3 Coder+',   value: 'qwen3-coder-plus',                  provider: 'dashscope',  group: 'DashScope' },
  { label: 'Qwen3 Max',      value: 'qwen3-max',                         provider: 'dashscope',  group: 'DashScope' },
  // Cerebras
  { label: 'Qwen3 235B',     value: 'qwen-3-235b-a22b-instruct-2507',    provider: 'cerebras',   group: 'Cerebras' },
  { label: 'Llama 3.1 8B',   value: 'llama3.1-8b',                       provider: 'cerebras',   group: 'Cerebras' },
  // Fireworks
  { label: 'Kimi K2.5',        value: 'accounts/fireworks/models/kimi-k2p5',                     provider: 'fireworks', group: 'Fireworks' },
  { label: 'GLM-5',            value: 'accounts/fireworks/models/glm-5',                         provider: 'fireworks', group: 'Fireworks' },
  { label: 'GLM-4.7',          value: 'accounts/fireworks/models/glm-4p7',                       provider: 'fireworks', group: 'Fireworks' },
  { label: 'DeepSeek V3',      value: 'accounts/fireworks/models/deepseek-v3',                   provider: 'fireworks', group: 'Fireworks' },
  { label: 'GPT-OSS 120B',     value: 'accounts/fireworks/models/gpt-oss-120b',                  provider: 'fireworks', group: 'Fireworks' },
  { label: 'GPT-OSS 20B',      value: 'accounts/fireworks/models/gpt-oss-20b',                   provider: 'fireworks', group: 'Fireworks' },
  { label: 'MiniMax M2',       value: 'accounts/fireworks/models/minimax-m2',                    provider: 'fireworks', group: 'Fireworks' },
  { label: 'Qwen 3.6 Plus',    value: 'accounts/fireworks/models/qwen3p6-plus',                  provider: 'fireworks', group: 'Fireworks' },
  { label: 'Llama 4 Maverick', value: 'accounts/fireworks/models/llama4-maverick-instruct-basic', provider: 'fireworks', group: 'Fireworks' },
  { label: 'Llama 3.3 70B',    value: 'accounts/fireworks/models/llama-v3p3-70b-instruct',       provider: 'fireworks', group: 'Fireworks' },
  // Ollama Cloud
  { label: 'GLM-4.7',        value: 'glm-4.7:cloud',                     provider: 'ollama',     group: 'Ollama Cloud' },
  { label: 'GLM-5',          value: 'glm-5:cloud',                       provider: 'ollama',     group: 'Ollama Cloud' },
  { label: 'GLM-5.1',        value: 'glm-5.1:cloud',                     provider: 'ollama',     group: 'Ollama Cloud' },
  { label: 'Kimi K2.5',      value: 'kimi-k2.5:cloud',                   provider: 'ollama',     group: 'Ollama Cloud' },
  { label: 'DeepSeek V3.2',  value: 'deepseek-v3.2:cloud',               provider: 'ollama',     group: 'Ollama Cloud' },
  { label: 'MiniMax M2',     value: 'minimax-m2.1:cloud',                provider: 'ollama',     group: 'Ollama Cloud' },
  { label: 'Nemotron 3S',    value: 'nemotron-3-super:cloud',             provider: 'ollama',     group: 'Ollama Cloud' },
  { label: 'Kimi Thinking',  value: 'kimi-k2-thinking:cloud',            provider: 'ollama',     group: 'Ollama Cloud' },
  { label: 'Qwen 3.5',       value: 'qwen3.5:cloud',                     provider: 'ollama',     group: 'Ollama Cloud' },
  { label: 'Qwen3 Coder 480B', value: 'qwen3-coder:480b-cloud',          provider: 'ollama',     group: 'Ollama Cloud' },
];

const groups = [...new Set(CUSTOM_MODELS.map(m => m.group))];

// ─── Cross-provider model mapping ──────────────────────────────────────────
// Models available on multiple providers under different model IDs.
// Enables one-click provider switching in the custom stage rows.

interface ProviderVariant {
  provider: string;
  model: string;
  providerLabel: string;
}

interface CrossProviderGroup {
  name: string;
  variants: ProviderVariant[];
}

const CROSS_PROVIDER_MODELS: CrossProviderGroup[] = [
  {
    name: 'GPT-OSS 120B',
    variants: [
      { provider: 'groq', model: 'openai/gpt-oss-120b', providerLabel: 'Groq' },
      { provider: 'fireworks', model: 'accounts/fireworks/models/gpt-oss-120b', providerLabel: 'Fireworks' },
    ],
  },
  {
    name: 'Kimi K2.5',
    variants: [
      { provider: 'ollama', model: 'kimi-k2.5:cloud', providerLabel: 'Ollama' },
      { provider: 'fireworks', model: 'accounts/fireworks/models/kimi-k2p5', providerLabel: 'Fireworks' },
    ],
  },
  {
    name: 'GLM-4.7',
    variants: [
      { provider: 'ollama', model: 'glm-4.7:cloud', providerLabel: 'Ollama' },
      { provider: 'fireworks', model: 'accounts/fireworks/models/glm-4p7', providerLabel: 'Fireworks' },
    ],
  },
  {
    name: 'GLM-5',
    variants: [
      { provider: 'ollama', model: 'glm-5:cloud', providerLabel: 'Ollama' },
      { provider: 'fireworks', model: 'accounts/fireworks/models/glm-5', providerLabel: 'Fireworks' },
    ],
  },
  {
    name: 'GLM-5.1',
    variants: [
      { provider: 'ollama', model: 'glm-5.1:cloud', providerLabel: 'Ollama' },
      { provider: 'openrouter', model: 'z-ai/glm-5.1', providerLabel: 'OpenRouter' },
    ],
  },
  {
    name: 'Qwen 3.6 Plus',
    variants: [
      { provider: 'dashscope', model: 'qwen3.6-plus', providerLabel: 'DashScope' },
      { provider: 'fireworks', model: 'accounts/fireworks/models/qwen3p6-plus', providerLabel: 'Fireworks' },
      { provider: 'openrouter', model: 'qwen/qwen3.6-plus:free', providerLabel: 'OpenRouter' },
    ],
  },
  {
    name: 'DeepSeek V3',
    variants: [
      { provider: 'ollama', model: 'deepseek-v3.2:cloud', providerLabel: 'Ollama' },
      { provider: 'fireworks', model: 'accounts/fireworks/models/deepseek-v3', providerLabel: 'Fireworks' },
    ],
  },
  {
    name: 'Llama 3.3 70B',
    variants: [
      { provider: 'groq', model: 'llama-3.3-70b-versatile', providerLabel: 'Groq' },
      { provider: 'openrouter', model: 'meta-llama/llama-3.3-70b-instruct:free', providerLabel: 'OpenRouter' },
      { provider: 'fireworks', model: 'accounts/fireworks/models/llama-v3p3-70b-instruct', providerLabel: 'Fireworks' },
    ],
  },
  {
    name: 'Llama 4 Maverick',
    variants: [
      { provider: 'groq', model: 'meta-llama/llama-4-maverick-17b-128e-instruct', providerLabel: 'Groq' },
      { provider: 'fireworks', model: 'accounts/fireworks/models/llama4-maverick-instruct-basic', providerLabel: 'Fireworks' },
    ],
  },
  {
    name: 'MiniMax M2',
    variants: [
      { provider: 'ollama', model: 'minimax-m2.1:cloud', providerLabel: 'Ollama' },
      { provider: 'fireworks', model: 'accounts/fireworks/models/minimax-m2', providerLabel: 'Fireworks' },
    ],
  },
];

const crossProviderLookup = new Map<string, CrossProviderGroup>();
for (const group of CROSS_PROVIDER_MODELS) {
  for (const v of group.variants) {
    crossProviderLookup.set(`${v.provider}:${v.model}`, group);
  }
}

function getProviderAlternatives(provider: string, model: string): { group: CrossProviderGroup; current: ProviderVariant } | null {
  const group = crossProviderLookup.get(`${provider}:${model}`);
  if (!group || group.variants.length < 2) return null;
  const current = group.variants.find(v => v.provider === provider && v.model === model);
  if (!current) return null;
  return { group, current };
}

// ─── Custom Stage Row ───────────────────────────────────────────────────────

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

  const currentKey = typeof currentSelection === 'object'
    ? `${currentSelection.provider}:${currentSelection.model}`
    : '';

  const alternatives = typeof currentSelection === 'object'
    ? getProviderAlternatives(currentSelection.provider, currentSelection.model)
    : null;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5 w-28 shrink-0">
          <div className={cn('w-6 h-6 rounded-lg flex items-center justify-center', cfg.bgColor)}>
            <Icon size={12} className={cfg.textColor} />
          </div>
          <span className="text-[12px] font-black text-slate-500 uppercase tracking-wider">
            {cfg.displayName}
          </span>
        </div>
        <select
          value={currentKey}
          onChange={(e) => {
            const [provider = '', ...modelParts] = e.target.value.split(':');
            const model = modelParts.join(':');
            onChange(model, provider);
          }}
          className="flex-1 bg-white/[0.03] border border-white/[0.08] rounded-xl px-3.5 py-2 text-[12px] text-slate-300 font-medium outline-none focus:border-jb-purple/30 transition-colors appearance-none cursor-pointer"
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
      {alternatives && (
        <div className="flex items-center gap-1.5 pl-[7.75rem]">
          {alternatives.group.variants.map((v) => (
            <button
              key={v.provider}
              onClick={() => onChange(v.model, v.provider)}
              className={cn(
                'px-2 py-0.5 rounded-md text-[10px] font-bold transition-all border',
                v.provider === alternatives.current.provider
                  ? 'bg-jb-purple/15 border-jb-purple/30 text-jb-purple'
                  : 'bg-white/[0.03] border-white/[0.06] text-slate-600 hover:text-slate-400 hover:border-white/15',
              )}
            >
              {v.providerLabel}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Main Component ─────────────────────────────────────────────────────────

export const WaterfallPresetPicker = ({
  unavailableModels,
  upgradeSuggestions,
  dismissedKeys,
  onDismissUpgrade: _onDismissUpgrade,
  onSwapModel: _onSwapModel,
}: {
  unavailableModels: UnavailableModel[];
  upgradeSuggestions: UpgradeSuggestion[];
  dismissedKeys: Set<string>;
  onDismissUpgrade: (key: string) => void;
  onSwapModel: (stage: StageKey, model: string, provider: string) => void;
}) => {
  const {
    waterfallPresetKey,
    waterfallModelSelection,
    setWaterfallPreset,
    setWaterfallCustomStage,
  } = useAppStore();

  const [expandedPreset, setExpandedPreset] = useState<string | null>(null);
  const [showCustom, setShowCustom] = useState(waterfallPresetKey === 'custom');

  const recommended = WATERFALL_PRESET_LIST.filter(p => p.category === 'recommended');
  const topTier = WATERFALL_PRESET_LIST.filter(p => p.category === 'top');
  const solo = WATERFALL_PRESET_LIST.filter(p => p.category === 'solo');

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
      <div className="p-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Layers size={14} className="text-slate-500" />
            <span className="text-[12px] font-black text-slate-600 uppercase tracking-widest">
              Pipeline Preset
            </span>
          </div>
          <button
            onClick={handleCustomToggle}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[12px] font-bold uppercase tracking-wider transition-all',
              showCustom
                ? 'bg-jb-purple/10 border-jb-purple/25 text-jb-purple'
                : 'bg-white/[0.03] border-white/[0.08] text-slate-600 hover:text-slate-400 hover:border-white/15',
            )}
          >
            <SlidersHorizontal size={11} />
            Custom
          </button>
        </div>

        {!showCustom && (
          <>
            {/* ── RECOMMENDED ── */}
            <div className="space-y-2">
              <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest">
                RECOMMENDED · benchmarked across 4 prompts
              </span>
              <div className="space-y-1.5">
                {recommended.map((preset) => (
                  <RecommendedRow
                    key={preset.key}
                    preset={preset}
                    isSelected={waterfallPresetKey === preset.key}
                    isExpanded={expandedPreset === preset.key}
                    isDefault={preset.key === 'kimi-coder'}
                    onSelect={() => handleSelect(preset.key)}
                    onToggleExpand={() => setExpandedPreset(expandedPreset === preset.key ? null : preset.key)}
                    warnings={getPresetWarnings(preset, unavailableModels)}
                  />
                ))}
              </div>
            </div>

            {/* ── TOP TIER ── */}
            <div className="space-y-2">
              <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest">
                TOP TIER
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {topTier.map((preset) => (
                  <TopTierCard
                    key={preset.key}
                    preset={preset}
                    isSelected={waterfallPresetKey === preset.key}
                    onSelect={() => {
                      handleSelect(preset.key);
                      setExpandedPreset(expandedPreset === preset.key ? null : preset.key);
                    }}
                  />
                ))}
              </div>
              <AnimatePresence>
                {topTier.some(p => p.key === expandedPreset) && (() => {
                  const expanded = topTier.find(p => p.key === expandedPreset);
                  return expanded ? <ProviderSwapPanel preset={expanded} /> : null;
                })()}
              </AnimatePresence>
            </div>

            {/* ── SOLO ── */}
            <div className="space-y-2">
              <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest">
                SOLO · single model, all stages
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {solo.map((preset) => (
                  <SoloPill
                    key={preset.key}
                    preset={preset}
                    isSelected={waterfallPresetKey === preset.key}
                    onSelect={() => handleSelect(preset.key)}
                  />
                ))}
              </div>
            </div>
          </>
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
              <div className="pt-3 border-t border-white/[0.04] space-y-3">
                <span className="text-[12px] text-slate-700 font-mono block">Select a model for each pipeline stage</span>
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
          <div className="flex items-center gap-2">
            <Trophy size={11} className="text-slate-700" />
            <span className="text-[12px] text-slate-700 font-mono">
              Scores from automated pipeline benchmarks · results may vary
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
