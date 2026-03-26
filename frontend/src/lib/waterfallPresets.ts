// Frontend-side waterfall preset definitions.
// Mirrors backend WATERFALL_PRESETS in backend/src/constants/models.ts.
// Keep in sync manually when backend presets change.

export interface PresetStageSelection {
  model: string;
  provider: string;
}

export type PresetSelection = Record<
  'architect' | 'reasoner' | 'executor' | 'reviewer',
  'A' | 'B' | PresetStageSelection
>;

export interface WaterfallPresetMeta {
  key: string;
  name: string;
  description: string;
  score: number | null;       // Hard-prompt score with honest reviewer
  speed: '~30s' | '~1-2m' | '~2-3m' | '~5m+';
  tier: 'top' | 'standard' | 'demo';
  selection: PresetSelection;
  stageLabels: Record<'architect' | 'reasoner' | 'executor' | 'reviewer', string>;
}

export const WATERFALL_PRESET_LIST: WaterfallPresetMeta[] = [
  // ── Top tier — tested, honest reviewer, recommended ──────────────────────
  {
    key: 'glm-speed',
    name: 'GLM Speed',
    description: 'Best overall score. GLM-4.7 architect.',
    score: 94,
    speed: '~1-2m',
    tier: 'top',
    selection: {
      architect: { model: 'glm-4.7:cloud', provider: 'ollama' },
      reasoner:  { model: 'qwen/qwen3-32b', provider: 'groq' },
      executor:  { model: 'moonshotai/kimi-k2-instruct-0905', provider: 'groq' },
      reviewer:  { model: 'xiaomi/mimo-v2-omni', provider: 'openrouter' },
    },
    stageLabels: { architect: 'GLM-4.7', reasoner: 'Qwen3 32B', executor: 'Kimi K2', reviewer: 'MiMo V2' },
  },
  {
    key: 'glm-kimi',
    name: 'GLM-Kimi',
    description: 'Strong + consistent. Kimi K2.5 reasoner.',
    score: 93,
    speed: '~2-3m',
    tier: 'top',
    selection: {
      architect: { model: 'glm-4.7:cloud', provider: 'ollama' },
      reasoner:  { model: 'kimi-k2.5:cloud', provider: 'ollama' },
      executor:  { model: 'moonshotai/kimi-k2-instruct-0905', provider: 'groq' },
      reviewer:  { model: 'xiaomi/mimo-v2-omni', provider: 'openrouter' },
    },
    stageLabels: { architect: 'GLM-4.7', reasoner: 'Kimi K2.5', executor: 'Kimi K2', reviewer: 'MiMo V2' },
  },
  {
    key: 'groq-speed',
    name: 'Groq Speed',
    description: 'Fastest honest pipeline. All-Groq inference.',
    score: 91,
    speed: '~30s',
    tier: 'top',
    selection: {
      architect: { model: 'openai/gpt-oss-120b', provider: 'groq' },
      reasoner:  { model: 'qwen/qwen3-32b', provider: 'groq' },
      executor:  { model: 'moonshotai/kimi-k2-instruct-0905', provider: 'groq' },
      reviewer:  { model: 'xiaomi/mimo-v2-omni', provider: 'openrouter' },
    },
    stageLabels: { architect: 'GPT-OSS 120B', reasoner: 'Qwen3 32B', executor: 'Kimi K2', reviewer: 'MiMo V2' },
  },
  {
    key: 'kimi-duo',
    name: 'Kimi Duo',
    description: 'Kimi reasons + executes. High ceiling.',
    score: 89,
    speed: '~2-3m',
    tier: 'top',
    selection: {
      architect: { model: 'openai/gpt-oss-120b', provider: 'groq' },
      reasoner:  { model: 'kimi-k2.5:cloud', provider: 'ollama' },
      executor:  { model: 'moonshotai/kimi-k2-instruct-0905', provider: 'groq' },
      reviewer:  { model: 'xiaomi/mimo-v2-omni', provider: 'openrouter' },
    },
    stageLabels: { architect: 'GPT-OSS 120B', reasoner: 'Kimi K2.5', executor: 'Kimi K2', reviewer: 'MiMo V2' },
  },

  // ── Standard tier — tested, honest reviewer, viable ──────────────────────
  {
    key: 'deepseek-kimi',
    name: 'DeepSeek-Kimi',
    description: 'DeepSeek V3.2 reasoner. Slower but strong.',
    score: 88,
    speed: '~2-3m',
    tier: 'standard',
    selection: {
      architect: { model: 'openai/gpt-oss-120b', provider: 'groq' },
      reasoner:  { model: 'deepseek-v3.2:cloud', provider: 'ollama' },
      executor:  { model: 'moonshotai/kimi-k2-instruct-0905', provider: 'groq' },
      reviewer:  { model: 'xiaomi/mimo-v2-omni', provider: 'openrouter' },
    },
    stageLabels: { architect: 'GPT-OSS 120B', reasoner: 'DeepSeek V3.2', executor: 'Kimi K2', reviewer: 'MiMo V2' },
  },
  {
    key: 'glm-nemotron',
    name: 'GLM-Nemotron',
    description: 'Fast Nemotron reasoner. Compact pipeline.',
    score: 85,
    speed: '~2-3m',
    tier: 'standard',
    selection: {
      architect: { model: 'glm-4.7:cloud', provider: 'ollama' },
      reasoner:  { model: 'nemotron-3-super:cloud', provider: 'ollama' },
      executor:  { model: 'moonshotai/kimi-k2-instruct-0905', provider: 'groq' },
      reviewer:  { model: 'xiaomi/mimo-v2-omni', provider: 'openrouter' },
    },
    stageLabels: { architect: 'GLM-4.7', reasoner: 'Nemotron 3S', executor: 'Kimi K2', reviewer: 'MiMo V2' },
  },
  {
    key: 'ollama-ultima',
    name: 'Ollama Ultima',
    description: 'Maximum intelligence. All large models.',
    score: 78,
    speed: '~5m+',
    tier: 'standard',
    selection: {
      architect: { model: 'qwen3.5:cloud', provider: 'ollama' },
      reasoner:  { model: 'kimi-k2-thinking:cloud', provider: 'ollama' },
      executor:  { model: 'qwen3-coder:480b-cloud', provider: 'ollama' },
      reviewer:  { model: 'xiaomi/mimo-v2-omni', provider: 'openrouter' },
    },
    stageLabels: { architect: 'Qwen 3.5', reasoner: 'Kimi Thinking', executor: 'Qwen3 Coder 480B', reviewer: 'MiMo V2' },
  },

  // ── Demo tier — generous reviewers, useful for demos ─────────────────────
  {
    key: 'reliable',
    name: 'Reliable',
    description: 'Zero failures, generous reviewer. For demos.',
    score: 97,
    speed: '~30s',
    tier: 'demo',
    selection: { architect: 'B', reasoner: 'B', executor: 'B', reviewer: 'B' },
    stageLabels: { architect: 'GPT-OSS 120B', reasoner: 'Qwen3 32B', executor: 'Qwen3 Coder+', reviewer: 'GLM 4.5 Air' },
  },
];

export const WATERFALL_PRESETS_BY_KEY = Object.fromEntries(
  WATERFALL_PRESET_LIST.map(p => [p.key, p])
) as Record<string, WaterfallPresetMeta>;
