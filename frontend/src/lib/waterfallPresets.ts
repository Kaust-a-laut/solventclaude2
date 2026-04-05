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
    description: 'GLM\'s structured planning with Groq-speed execution',
    score: 94,
    speed: '~1-2m',
    tier: 'top',
    selection: {
      architect: { model: 'glm-4.7:cloud', provider: 'ollama' },
      reasoner:  { model: 'qwen/qwen3-32b', provider: 'groq' },
      executor:  { model: 'moonshotai/kimi-k2-instruct-0905', provider: 'groq' },
      reviewer:  { model: 'meta-llama/llama-3.3-70b-instruct:free', provider: 'openrouter' },
    },
    stageLabels: { architect: 'GLM-4.7', reasoner: 'Qwen3 32B', executor: 'Kimi K2', reviewer: 'Llama 3.3 70B' },
  },
  {
    key: 'glm-kimi',
    name: 'GLM-Kimi',
    description: 'Kimi\'s methodical reasoning with consistent quality',
    score: 93,
    speed: '~2-3m',
    tier: 'top',
    selection: {
      architect: { model: 'glm-4.7:cloud', provider: 'ollama' },
      reasoner:  { model: 'kimi-k2.5:cloud', provider: 'ollama' },
      executor:  { model: 'moonshotai/kimi-k2-instruct-0905', provider: 'groq' },
      reviewer:  { model: 'meta-llama/llama-3.3-70b-instruct:free', provider: 'openrouter' },
    },
    stageLabels: { architect: 'GLM-4.7', reasoner: 'Kimi K2.5', executor: 'Kimi K2', reviewer: 'Llama 3.3 70B' },
  },
  {
    key: 'groq-speed',
    name: 'Groq Speed',
    description: 'Ultra-fast inference, all Groq-hosted models',
    score: 91,
    speed: '~30s',
    tier: 'top',
    selection: {
      architect: { model: 'openai/gpt-oss-120b', provider: 'groq' },
      reasoner:  { model: 'qwen/qwen3-32b', provider: 'groq' },
      executor:  { model: 'moonshotai/kimi-k2-instruct-0905', provider: 'groq' },
      reviewer:  { model: 'meta-llama/llama-3.3-70b-instruct:free', provider: 'openrouter' },
    },
    stageLabels: { architect: 'GPT-OSS 120B', reasoner: 'Qwen3 32B', executor: 'Kimi K2', reviewer: 'Llama 3.3 70B' },
  },
  {
    key: 'kimi-duo',
    name: 'Kimi Duo',
    description: 'Kimi handles both reasoning and execution end-to-end',
    score: 89,
    speed: '~2-3m',
    tier: 'top',
    selection: {
      architect: { model: 'openai/gpt-oss-120b', provider: 'groq' },
      reasoner:  { model: 'kimi-k2.5:cloud', provider: 'ollama' },
      executor:  { model: 'moonshotai/kimi-k2-instruct-0905', provider: 'groq' },
      reviewer:  { model: 'meta-llama/llama-3.3-70b-instruct:free', provider: 'openrouter' },
    },
    stageLabels: { architect: 'GPT-OSS 120B', reasoner: 'Kimi K2.5', executor: 'Kimi K2', reviewer: 'Llama 3.3 70B' },
  },

  // ── Standard tier — tested, honest reviewer, viable ──────────────────────
  {
    key: 'deepseek-kimi',
    name: 'DeepSeek-Kimi',
    description: 'DeepSeek\'s deep chain-of-thought, trades speed for depth',
    score: 88,
    speed: '~2-3m',
    tier: 'standard',
    selection: {
      architect: { model: 'openai/gpt-oss-120b', provider: 'groq' },
      reasoner:  { model: 'deepseek-v3.2:cloud', provider: 'ollama' },
      executor:  { model: 'moonshotai/kimi-k2-instruct-0905', provider: 'groq' },
      reviewer:  { model: 'meta-llama/llama-3.3-70b-instruct:free', provider: 'openrouter' },
    },
    stageLabels: { architect: 'GPT-OSS 120B', reasoner: 'DeepSeek V3.2', executor: 'Kimi K2', reviewer: 'Llama 3.3 70B' },
  },
  {
    key: 'glm-nemotron',
    name: 'GLM-Nemotron',
    description: 'Efficient multi-provider with Nemotron reasoning',
    score: 85,
    speed: '~2-3m',
    tier: 'standard',
    selection: {
      architect: { model: 'glm-4.7:cloud', provider: 'ollama' },
      reasoner:  { model: 'nemotron-3-super:cloud', provider: 'ollama' },
      executor:  { model: 'moonshotai/kimi-k2-instruct-0905', provider: 'groq' },
      reviewer:  { model: 'meta-llama/llama-3.3-70b-instruct:free', provider: 'openrouter' },
    },
    stageLabels: { architect: 'GLM-4.7', reasoner: 'Nemotron 3S', executor: 'Kimi K2', reviewer: 'Llama 3.3 70B' },
  },
  {
    key: 'ollama-ultima',
    name: 'Ollama Ultima',
    description: 'Largest models available, prioritizes depth over speed',
    score: 78,
    speed: '~5m+',
    tier: 'standard',
    selection: {
      architect: { model: 'qwen3.5:cloud', provider: 'ollama' },
      reasoner:  { model: 'kimi-k2-thinking:cloud', provider: 'ollama' },
      executor:  { model: 'qwen3-coder:480b-cloud', provider: 'ollama' },
      reviewer:  { model: 'meta-llama/llama-3.3-70b-instruct:free', provider: 'openrouter' },
    },
    stageLabels: { architect: 'Qwen 3.5', reasoner: 'Kimi Thinking', executor: 'Qwen3 Coder 480B', reviewer: 'Llama 3.3 70B' },
  },

  // ── Solo tier — single model all stages, avoids cross-provider rate limits ─
  {
    key: 'solo-gemini-pro',
    name: 'Solo: Gemini 3 Pro',
    description: 'All stages on Gemini 3 Pro — single provider, no rate-limit conflicts',
    score: null,
    speed: '~1-2m',
    tier: 'standard',
    selection: {
      architect: { model: 'gemini-3-pro-preview', provider: 'gemini' },
      reasoner:  { model: 'gemini-3-pro-preview', provider: 'gemini' },
      executor:  { model: 'gemini-3-pro-preview', provider: 'gemini' },
      reviewer:  { model: 'gemini-3-pro-preview', provider: 'gemini' },
    },
    stageLabels: { architect: 'Gemini 3 Pro', reasoner: 'Gemini 3 Pro', executor: 'Gemini 3 Pro', reviewer: 'Gemini 3 Pro' },
  },
  {
    key: 'solo-gemini-flash',
    name: 'Solo: Gemini 3 Flash',
    description: 'All stages on Gemini 3 Flash — fast, single provider',
    score: null,
    speed: '~30s',
    tier: 'standard',
    selection: {
      architect: { model: 'gemini-3-flash-preview', provider: 'gemini' },
      reasoner:  { model: 'gemini-3-flash-preview', provider: 'gemini' },
      executor:  { model: 'gemini-3-flash-preview', provider: 'gemini' },
      reviewer:  { model: 'gemini-3-flash-preview', provider: 'gemini' },
    },
    stageLabels: { architect: 'Gemini 3 Flash', reasoner: 'Gemini 3 Flash', executor: 'Gemini 3 Flash', reviewer: 'Gemini 3 Flash' },
  },
  {
    key: 'solo-gpt-oss',
    name: 'Solo: GPT-OSS 120B',
    description: 'All stages on GPT-OSS 120B via Groq — ultra-fast single model',
    score: null,
    speed: '~30s',
    tier: 'standard',
    selection: {
      architect: { model: 'openai/gpt-oss-120b', provider: 'groq' },
      reasoner:  { model: 'openai/gpt-oss-120b', provider: 'groq' },
      executor:  { model: 'openai/gpt-oss-120b', provider: 'groq' },
      reviewer:  { model: 'openai/gpt-oss-120b', provider: 'groq' },
    },
    stageLabels: { architect: 'GPT-OSS 120B', reasoner: 'GPT-OSS 120B', executor: 'GPT-OSS 120B', reviewer: 'GPT-OSS 120B' },
  },
  {
    key: 'solo-qwen36',
    name: 'Solo: Qwen 3.6 Plus',
    description: 'All stages on Qwen 3.6 Plus via DashScope — your own key, no rate limits',
    score: null,
    speed: '~1-2m',
    tier: 'standard',
    selection: {
      architect: { model: 'qwen3.6-plus', provider: 'dashscope' },
      reasoner:  { model: 'qwen3.6-plus', provider: 'dashscope' },
      executor:  { model: 'qwen3.6-plus', provider: 'dashscope' },
      reviewer:  { model: 'qwen3.6-plus', provider: 'dashscope' },
    },
    stageLabels: { architect: 'Qwen 3.6 Plus', reasoner: 'Qwen 3.6 Plus', executor: 'Qwen 3.6 Plus', reviewer: 'Qwen 3.6 Plus' },
  },
  {
    key: 'solo-glm',
    name: 'Solo: GLM-4.7',
    description: 'All stages on GLM-4.7 via Ollama Cloud — strong all-rounder',
    score: null,
    speed: '~2-3m',
    tier: 'standard',
    selection: {
      architect: { model: 'glm-4.7:cloud', provider: 'ollama' },
      reasoner:  { model: 'glm-4.7:cloud', provider: 'ollama' },
      executor:  { model: 'glm-4.7:cloud', provider: 'ollama' },
      reviewer:  { model: 'glm-4.7:cloud', provider: 'ollama' },
    },
    stageLabels: { architect: 'GLM-4.7', reasoner: 'GLM-4.7', executor: 'GLM-4.7', reviewer: 'GLM-4.7' },
  },
  {
    key: 'solo-kimi-k2.5',
    name: 'Solo: Kimi K2.5',
    description: 'All stages on Kimi K2.5 via Ollama Cloud — deep reasoning',
    score: null,
    speed: '~2-3m',
    tier: 'standard',
    selection: {
      architect: { model: 'kimi-k2.5:cloud', provider: 'ollama' },
      reasoner:  { model: 'kimi-k2.5:cloud', provider: 'ollama' },
      executor:  { model: 'kimi-k2.5:cloud', provider: 'ollama' },
      reviewer:  { model: 'kimi-k2.5:cloud', provider: 'ollama' },
    },
    stageLabels: { architect: 'Kimi K2.5', reasoner: 'Kimi K2.5', executor: 'Kimi K2.5', reviewer: 'Kimi K2.5' },
  },
  {
    key: 'solo-kimi-k2',
    name: 'Solo: Kimi K2',
    description: 'All stages on Kimi K2 via Groq — fast execution-focused model',
    score: null,
    speed: '~30s',
    tier: 'standard',
    selection: {
      architect: { model: 'moonshotai/kimi-k2-instruct-0905', provider: 'groq' },
      reasoner:  { model: 'moonshotai/kimi-k2-instruct-0905', provider: 'groq' },
      executor:  { model: 'moonshotai/kimi-k2-instruct-0905', provider: 'groq' },
      reviewer:  { model: 'moonshotai/kimi-k2-instruct-0905', provider: 'groq' },
    },
    stageLabels: { architect: 'Kimi K2', reasoner: 'Kimi K2', executor: 'Kimi K2', reviewer: 'Kimi K2' },
  },

  // ── Demo tier — generous reviewers, useful for demos ─────────────────────
  {
    key: 'reliable',
    name: 'Reliable',
    description: 'Tuned for zero failures and consistent output',
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
