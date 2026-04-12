import { CUSTOM_MODELS } from './WaterfallPresetPicker';
import type { StageKey } from './WaterfallStageCard';
import type { UpgradeSuggestion, UnavailableModel, ModelScanResult } from './upgradeTypes';

export type { UpgradeSuggestion, UnavailableModel, ModelScanResult };

// ─── Stage order ──────────────────────────────────────────────────────────────

export const STAGE_ORDER: StageKey[] = ['planner', 'executor', 'reviewer'];

// ─── Animation dots ───────────────────────────────────────────────────────────

export const IDLE_DOTS = [
  { color: 'bg-jb-purple',   glow: 'rgba(157,91,210,0.5)',  delay: 0    },
  { color: 'bg-jb-orange',   glow: 'rgba(251,146,60,0.5)',  delay: 0.5  },
  { color: 'bg-emerald-500', glow: 'rgba(16,185,129,0.5)',  delay: 1.0  },
] as const;

export const INIT_DOTS = [
  { color: 'bg-jb-purple', glow: 'rgba(157,91,210,0.6)', delay: 0    },
  { color: 'bg-jb-accent', glow: 'rgba(60,113,247,0.6)', delay: 0.25 },
  { color: 'bg-jb-orange', glow: 'rgba(251,146,60,0.6)', delay: 0.5  },
] as const;

// ─── Model label lookup ───────────────────────────────────────────────────────

export const modelLabelLookup = new Map(CUSTOM_MODELS.map(m => [`${m.provider}:${m.value}`, m.label]));

export const PROVIDER_LABELS: Record<string, string> = {
  groq: 'Groq', fireworks: 'Fireworks', openrouter: 'OpenRouter',
  dashscope: 'DashScope', cerebras: 'Cerebras', ollama: 'Ollama',
  gemini: 'Gemini', deepseek: 'DeepSeek',
};

export function getStageModelLabel(choice: string | { model: string; provider: string }): string | undefined {
  if (typeof choice !== 'object') return undefined;
  const name = modelLabelLookup.get(`${choice.provider}:${choice.model}`) ?? choice.model;
  const provider = PROVIDER_LABELS[choice.provider] ?? choice.provider;
  return `${name} · ${provider}`;
}

// ─── Upgrade dismiss helpers ──────────────────────────────────────────────────

export const DISMISS_KEY = 'solvent:dismissed-upgrades';

export function getDismissedUpgrades(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch { return new Set(); }
}

export function dismissUpgrade(key: string) {
  const dismissed = getDismissedUpgrades();
  dismissed.add(key);
  localStorage.setItem(DISMISS_KEY, JSON.stringify([...dismissed]));
}

export function upgradeKey(u: UpgradeSuggestion): string {
  return `${u.current.provider}:${u.current.model}→${u.successor.model}`;
}
