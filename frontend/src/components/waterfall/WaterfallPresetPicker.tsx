import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';
import { useAppStore } from '../../store/useAppStore';
import { WATERFALL_PRESET_LIST, type WaterfallPresetMeta } from '../../lib/waterfallPresets';
import { STAGE_CONFIGS, type StageKey } from './WaterfallStageCard';
import { Layers, ChevronDown, Zap, Clock, Trophy, SlidersHorizontal, AlertTriangle, ArrowUpCircle } from 'lucide-react';
import { API_BASE_URL } from '../../lib/config';
import { toast } from 'sonner';

const STAGE_ORDER: StageKey[] = ['architect', 'reasoner', 'executor', 'reviewer'];

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

interface ModelScanResult {
  scannedAt: string;
  unavailable: UnavailableModel[];
  upgrades: UpgradeSuggestion[];
  scanErrors: string[];
}

function useModelAvailability() {
  const [unavailableModels, setUnavailableModels] = useState<UnavailableModel[]>([]);
  const [upgradeSuggestions, setUpgradeSuggestions] = useState<UpgradeSuggestion[]>([]);

  useEffect(() => {
    fetch(`${API_BASE_URL}/health/models`)
      .then(res => res.ok ? res.json() : null)
      .then((data: ModelScanResult | null) => {
        if (data?.unavailable) setUnavailableModels(data.unavailable);
        if (data?.upgrades) setUpgradeSuggestions(data.upgrades);
      })
      .catch(() => {});
  }, []);

  return { unavailableModels, upgradeSuggestions };
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

const DISMISS_KEY = 'solvent:dismissed-upgrades';

function getDismissedUpgrades(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function dismissUpgrade(key: string) {
  const dismissed = getDismissedUpgrades();
  dismissed.add(key);
  localStorage.setItem(DISMISS_KEY, JSON.stringify([...dismissed]));
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
  warnings,
  upgrades,
  onDismissUpgrade,
  onSwapModel,
}: {
  preset: WaterfallPresetMeta;
  isSelected: boolean;
  isExpanded: boolean;
  onSelect: () => void;
  onToggleExpand: () => void;
  warnings: string[];
  upgrades: PresetUpgrade[];
  onDismissUpgrade: (key: string) => void;
  onSwapModel: (stage: StageKey, model: string, provider: string) => void;
}) => {
  const [showSwapMenu, setShowSwapMenu] = useState(false);
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
      <div className="px-4 py-3.5 flex flex-col gap-2.5">
        {/* Top row: name + score */}
        <div className="flex items-center justify-between gap-2">
          <span className={cn(
            'text-[13px] font-extrabold tracking-tight',
            isSelected ? 'text-white' : 'text-slate-300',
          )}>
            {preset.name}
          </span>
          <div className={cn('px-2 py-0.5 rounded-md border text-[12px] font-black tabular-nums', badge.bg, badge.border, badge.text)}>
            {badge.label}
          </div>
        </div>

        {/* Description + speed */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12px] text-slate-300 leading-tight line-clamp-1 flex-1">
            {preset.description}
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            <SpdIcon size={11} className={spd.color} />
            <span className={cn('text-[12px] font-mono', spd.color)}>{preset.speed}</span>
          </div>
        </div>

        {/* Unavailability warning */}
        {warnings.length > 0 && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle size={11} className="text-amber-400 shrink-0" />
            <span className="text-[11px] text-amber-400 font-medium leading-tight">
              {warnings.length === 1 ? `${warnings[0]} offline` : `${warnings.length} models offline`}
            </span>
          </div>
        )}

        {/* Upgrade suggestions — clickable to expand swap menu */}
        {upgrades.length > 0 && (
          <div>
            <button
              onClick={(e) => { e.stopPropagation(); setShowSwapMenu(!showSwapMenu); }}
              className="w-full flex items-center gap-1.5 px-2 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/15 transition-colors"
            >
              <ArrowUpCircle size={11} className="text-blue-400 shrink-0" />
              <span className="text-[11px] text-blue-400 font-semibold leading-tight flex-1 text-left">
                {upgrades.length === 1 ? `${upgrades[0]!.successorModel} available` : `${upgrades.length} upgrades available`}
              </span>
              <ChevronDown size={10} className={cn('text-blue-400 transition-transform', showSwapMenu && 'rotate-180')} />
            </button>
            <AnimatePresence>
              {showSwapMenu && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="overflow-hidden"
                >
                  <div className="pt-2 space-y-1.5">
                    {upgrades.map(u => (
                      <div key={u.key} className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-white/[0.02] border border-white/[0.04]">
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] text-slate-500 font-medium truncate">{u.stageLabel}: {u.currentModel}</div>
                          <div className="text-[11px] text-blue-400 font-semibold truncate">→ {u.successorModel}</div>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); onSwapModel(u.stage, u.successorModel, u.successorProvider); onDismissUpgrade(u.key); }}
                          className="shrink-0 px-2 py-0.5 rounded-md bg-blue-500/15 border border-blue-500/25 text-[10px] text-blue-400 font-bold uppercase tracking-wider hover:bg-blue-500/25 transition-colors"
                        >
                          Use
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); onDismissUpgrade(u.key); }}
                          className="shrink-0 px-1.5 py-0.5 rounded-md text-[10px] text-slate-600 font-medium hover:text-slate-400 transition-colors"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Expand toggle */}
        {isSelected && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
            className="flex items-center gap-1.5 text-[12px] font-bold text-slate-600 hover:text-slate-400 transition-colors pt-0.5"
          >
            <ChevronDown size={12} className={cn('transition-transform', isExpanded && 'rotate-180')} />
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
            <div className="px-4 pb-3.5 pt-1.5 border-t border-white/[0.04] space-y-2">
              {STAGE_ORDER.map((stage) => {
                const cfg = STAGE_CONFIGS[stage];
                const Icon = cfg.icon;
                const label = preset.stageLabels[stage];
                const isOffline = warnings.includes(label);
                return (
                  <div key={stage} className="flex items-center gap-2.5">
                    <div className={cn('w-5 h-5 rounded flex items-center justify-center', cfg.bgColor)}>
                      <Icon size={10} className={cfg.textColor} />
                    </div>
                    <span className="text-[12px] font-black text-slate-600 uppercase tracking-wider w-20">
                      {cfg.displayName}
                    </span>
                    <span className={cn('text-[12px] font-medium', isOffline ? 'text-amber-400 line-through decoration-amber-500/40' : 'text-slate-400')}>
                      {label}
                    </span>
                    {isOffline && <AlertTriangle size={10} className="text-amber-400" />}
                    {upgrades.filter(u => u.stageLabel === label).map(u => (
                      <span key={u.key} className="flex items-center gap-1 text-[11px] text-blue-400 font-medium">
                        <ArrowUpCircle size={9} /> {u.successorModel}
                      </span>
                    ))}
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
  { label: 'Llama 3.3 70B',   value: 'meta-llama/llama-3.3-70b-instruct:free', provider: 'openrouter', group: 'OpenRouter' },
  { label: 'Hermes 3 405B',  value: 'nousresearch/hermes-3-llama-3.1-405b:free', provider: 'openrouter', group: 'OpenRouter' },
  { label: 'Qwen3.6 Plus',   value: 'qwen/qwen3.6-plus:free',            provider: 'openrouter', group: 'OpenRouter' },
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
  const { unavailableModels, upgradeSuggestions } = useModelAvailability();
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(() => getDismissedUpgrades());

  const handleDismissUpgrade = (key: string) => {
    dismissUpgrade(key);
    setDismissedKeys(prev => new Set([...prev, key]));
  };

  const handleSwapModel = (stage: StageKey, model: string, provider: string) => {
    setWaterfallCustomStage(stage, { model, provider });
    setShowCustom(true);
  };

  // Fire toasts for non-dismissed upgrade suggestions (max 3)
  useEffect(() => {
    if (upgradeSuggestions.length === 0) return;
    const dismissed = getDismissedUpgrades();
    const toShow = upgradeSuggestions
      .filter(u => !dismissed.has(upgradeKey(u)))
      .slice(0, 3);

    const timer = setTimeout(() => {
      for (const u of toShow) {
        const k = upgradeKey(u);
        toast.info(u.note, {
          description: `Used by: ${u.usedInPresets.join(', ')}`,
          duration: 8000,
          action: {
            label: 'Dismiss',
            onClick: () => handleDismissUpgrade(k),
          },
        });
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [upgradeSuggestions]); // eslint-disable-line react-hooks/exhaustive-deps

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

        {/* Top preset cards */}
        <div className="grid grid-cols-2 gap-2.5">
          {topPresets.map((preset) => (
            <PresetCard
              key={preset.key}
              preset={preset}
              isSelected={waterfallPresetKey === preset.key}
              isExpanded={expandedPreset === preset.key}
              onSelect={() => handleSelect(preset.key)}
              onToggleExpand={() => setExpandedPreset(expandedPreset === preset.key ? null : preset.key)}
              warnings={getPresetWarnings(preset, unavailableModels)}
              upgrades={getPresetUpgrades(preset, upgradeSuggestions, dismissedKeys)}
              onDismissUpgrade={handleDismissUpgrade}
              onSwapModel={handleSwapModel}
            />
          ))}
        </div>

        {/* Other presets — collapsed row */}
        {otherPresets.length > 0 && !showCustom && (
          <div className="flex gap-2 overflow-x-auto scrollbar-none pb-0.5">
            {otherPresets.map((preset) => {
              const badge = scoreBadge(preset.score, preset.tier);
              const isSelected = waterfallPresetKey === preset.key;
              const otherWarnings = getPresetWarnings(preset, unavailableModels);
              const otherUpgrades = getPresetUpgrades(preset, upgradeSuggestions, dismissedKeys);
              return (
                <button
                  key={preset.key}
                  onClick={() => handleSelect(preset.key)}
                  className={cn(
                    'shrink-0 flex items-center gap-2.5 px-3.5 py-2 rounded-xl border transition-all text-[12px] font-bold',
                    isSelected
                      ? 'bg-jb-purple/[0.08] border-jb-purple/30 text-white'
                      : 'bg-white/[0.02] border-white/[0.06] text-slate-500 hover:text-slate-300 hover:border-white/15',
                  )}
                >
                  {otherWarnings.length > 0 && <AlertTriangle size={11} className="text-amber-400" />}
                  {otherUpgrades.length > 0 && <ArrowUpCircle size={11} className="text-blue-400" />}
                  {preset.name}
                  <span className={cn('text-[12px] font-mono', badge.text)}>{badge.label}</span>
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
