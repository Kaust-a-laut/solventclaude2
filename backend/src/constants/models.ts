export const MODELS = {
  GEMINI: {
    PRO_3: 'gemini-3-pro-preview',
    FLASH_3: 'gemini-3-flash-preview',
    PRO_2_5: 'gemini-2.5-pro',
    FLASH_2_5: 'gemini-2.5-flash',
    PRO_1_5: 'gemini-1.5-pro',
    FLASH_2_0: 'gemini-2.0-flash',
    FLASH_1_5: 'gemini-1.5-flash',
  },
  GROQ: {
    LLAMA_3_3_70B: 'llama-3.3-70b-versatile',
    LLAMA_3_1_8B: 'llama-3.1-8b-instant',
    MIXTRAL_8X7B: 'mixtral-8x7b-32768'
  },
  GROQ_MODELS: [
    // Agentic (compound AI systems)
    'compound-beta',
    'compound-beta-mini',
    // Production
    'llama-3.3-70b-versatile',
    'llama-3.1-70b-versatile',
    'llama-3.1-8b-instant',
    'llama3-70b-8192',
    'llama3-8b-8192',
    'gemma2-9b-it',
    'mixtral-8x7b-32768',
    // Preview
    'meta-llama/llama-4-scout-17b-16e-instruct',
    'meta-llama/llama-4-maverick-17b-128e-instruct',
    'llama-3.3-70b-specdec',
    'llama-3.1-70b-specdec',
    'qwen-qwq-32b',
    'qwen/qwen3-32b',
    'deepseek-r1-distill-llama-70b',
    'deepseek-r1-distill-qwen-32b',
    'openai/gpt-oss-120b',
    'moonshotai/kimi-k2-instruct-0905',
  ],
  OLLAMA: {
    QWEN_CODER: 'qwen2.5-coder:7b',
    LLAMA_3: 'llama3',
    DEEPSEEK_CODER: 'deepseek-coder-v2'
  },
  OLLAMA_CLOUD: [
    'glm-4.7:cloud',
    'glm-5:cloud',
    'kimi-k2.5:cloud',
    'kimi-k2-thinking:cloud',
    'deepseek-v3.1:671b-cloud',
    'deepseek-v3.2:cloud',
    'qwen3.5:cloud',
    'qwen3-coder:480b-cloud',
    'nemotron-3-super:cloud',
    'minimax-m2.1:cloud',
    'cogito-2.1:671b-cloud',
  ],
  OPENROUTER: {
    CLAUDE_SONNET_4: 'anthropic/claude-sonnet-4',
    CLAUDE_3_5_SONNET: 'anthropic/claude-3.5-sonnet',
    GPT_4O: 'openai/gpt-4o',
    MINIMAX_01: 'minimax/minimax-01',
    QWEN_CODER_32B: 'qwen/qwen-2.5-coder-32b-instruct',
  },
  DASHSCOPE: {
    QWEN3_CODER_PLUS: 'qwen3-coder-plus',
    QWEN3_CODER_FLASH: 'qwen3-coder-flash',
    QWEN3_MAX: 'qwen3-max',
    QWEN3_5_PLUS: 'qwen3.5-plus',
    QWEN_PLUS: 'qwen-plus',
    QWEN_TURBO: 'qwen-turbo',
  },
  DASHSCOPE_MODELS: [
    'qwen3-coder-plus',
    'qwen3-coder-flash',
    'qwen3-max',
    'qwen3.5-plus',
    'qwen-plus',
    'qwen-turbo',
    'qwen3-235b-a22b',
    'qwen3-32b',
    'qwen3-next-80b-a3b-instruct',
  ],
  OPENROUTER_FREE: [
    // OpenRouter frontier
    'openrouter/hunter-alpha',
    'openrouter/healer-alpha',
    // Meta Llama 4
    'meta-llama/llama-4-maverick:free',
    'meta-llama/llama-4-scout:free',
    'meta-llama/llama-3.3-70b-instruct:free',
    'meta-llama/llama-3.1-8b-instruct:free',
    // Nvidia
    'nvidia/nemotron-3-super-120b-a12b:free',
    // Qwen
    'qwen/qwen3.6-plus:free',
    // Google
    'google/gemini-2.0-flash-exp:free',
    'google/gemma-3-27b-it:free',
    'google/gemma-3-12b-it:free',
    // Qwen
    'qwen/qwen-2.5-coder-32b-instruct:free',
    'qwen/qwen-2.5-72b-instruct:free',
    'qwen/qwen3-235b-a22b:free',
    'qwen/qwen3-coder:free',
    // Others
    'mistralai/mistral-7b-instruct:free',
    'microsoft/phi-4-reasoning-plus:free',
    'nousresearch/deephermes-3-llama-3-8b-preview:free',
  ]
};

export interface WaterfallModelOption {
  model: string;
  provider: string;
  label: string;
  score: string;  // headline benchmark for display
}

export interface WaterfallPhaseConfig {
  OPTION_A: WaterfallModelOption;
  OPTION_B: WaterfallModelOption;
  LOCAL: string;
}

export interface CustomModelOverride {
  model: string;
  provider: string;
}

export type WaterfallPhaseSelection = 'A' | 'B' | CustomModelOverride;

export type WaterfallModelSelection = Record<'architect' | 'reasoner' | 'executor' | 'reviewer', WaterfallPhaseSelection>;

export interface WaterfallPreset {
  name: string;
  description: string;
  selection: WaterfallModelSelection;
}

export const WATERFALL_PRESETS: Record<string, WaterfallPreset> = {
  // --- Honest reviewer (Healer Alpha) presets — scores are real ---
  'best-quality': {
    name: 'Best Quality',
    description: 'Highest confirmed Healer score (95). Phi-4 R+ may be offline — falls back to Qwen3 32B.',
    selection: {
      architect: { model: 'openai/gpt-oss-120b', provider: 'groq' },
      reasoner:  { model: 'microsoft/phi-4-reasoning-plus:free', provider: 'openrouter' },
      executor:  { model: 'moonshotai/kimi-k2-instruct-0905', provider: 'groq' },
      reviewer:  { model: 'meta-llama/llama-3.3-70b-instruct:free', provider: 'openrouter' },
    },
  },
  'kimi-duo': {
    name: 'Kimi Duo',
    description: 'Kimi K2.5 reasons, Kimi K2 executes. Healer score: 92. Slower reasoner (Ollama cloud).',
    selection: {
      architect: { model: 'openai/gpt-oss-120b', provider: 'groq' },
      reasoner:  { model: 'kimi-k2.5:cloud', provider: 'ollama' },
      executor:  { model: 'moonshotai/kimi-k2-instruct-0905', provider: 'groq' },
      reviewer:  { model: 'meta-llama/llama-3.3-70b-instruct:free', provider: 'openrouter' },
    },
  },
  'groq-speed': {
    name: 'Groq Speed',
    description: 'All-Groq pipeline + MiMo reviewer. Score: 91. Fastest honest pipeline (~30s).',
    selection: {
      architect: { model: 'openai/gpt-oss-120b', provider: 'groq' },
      reasoner:  { model: 'qwen/qwen3-32b', provider: 'groq' },
      executor:  { model: 'moonshotai/kimi-k2-instruct-0905', provider: 'groq' },
      reviewer:  { model: 'meta-llama/llama-3.3-70b-instruct:free', provider: 'openrouter' },
    },
  },
  'deepseek-kimi': {
    name: 'DeepSeek-Kimi',
    description: 'DeepSeek V3.2 (685B) reasons, Kimi K2 executes. Healer score: 85. Strong reasoner, slower (Ollama cloud).',
    selection: {
      architect: { model: 'openai/gpt-oss-120b', provider: 'groq' },
      reasoner:  { model: 'deepseek-v3.2:cloud', provider: 'ollama' },
      executor:  { model: 'moonshotai/kimi-k2-instruct-0905', provider: 'groq' },
      reviewer:  { model: 'meta-llama/llama-3.3-70b-instruct:free', provider: 'openrouter' },
    },
  },
  'reliable': {
    name: 'Reliable',
    description: 'Zero failures, generous reviewer — good for demos. GLM score: 97+.',
    selection: { architect: 'B', reasoner: 'B', executor: 'B', reviewer: 'B' },
  },
  // --- High raw scores (generous reviewers) ---
  'gemini-review': {
    name: 'Gemini Review',
    description: 'Highest raw score when Gemini works (98) — 50% reviewer failure rate.',
    selection: {
      architect: { model: 'openai/gpt-oss-120b', provider: 'groq' },
      reasoner:  { model: 'qwen/qwen3-32b', provider: 'groq' },
      executor:  { model: 'qwen3-coder-plus', provider: 'dashscope' },
      reviewer:  { model: 'gemini-3-pro-preview', provider: 'gemini' },
    },
  },
  'maverick': {
    name: 'Maverick',
    description: 'Llama 4 Maverick architect + Gemma reviewer — scored 100 (generous).',
    selection: {
      architect: { model: 'meta-llama/llama-4-maverick-17b-128e-instruct:free', provider: 'openrouter' },
      reasoner:  { model: 'qwen/qwen3-32b', provider: 'groq' },
      executor:  { model: 'qwen3-coder-plus', provider: 'dashscope' },
      reviewer:  { model: 'google/gemma-3-27b-it:free', provider: 'openrouter' },
    },
  },
  'glm-speed': {
    name: 'GLM Speed',
    description: 'GLM-4.7 architects, Qwen3 32B reasons (Groq), Kimi K2 executes. Highest hard-prompt score (94). Best overall.',
    selection: {
      architect: { model: 'glm-4.7:cloud', provider: 'ollama' },
      reasoner:  { model: 'qwen/qwen3-32b', provider: 'groq' },
      executor:  { model: 'moonshotai/kimi-k2-instruct-0905', provider: 'groq' },
      reviewer:  { model: 'meta-llama/llama-3.3-70b-instruct:free', provider: 'openrouter' },
    },
  },
  'glm-kimi': {
    name: 'GLM-Kimi',
    description: 'GLM-4.7 architects, Kimi K2.5 reasons, Kimi K2 executes. Hard-prompt score: 93. Strong + consistent.',
    selection: {
      architect: { model: 'glm-4.7:cloud', provider: 'ollama' },
      reasoner:  { model: 'kimi-k2.5:cloud', provider: 'ollama' },
      executor:  { model: 'moonshotai/kimi-k2-instruct-0905', provider: 'groq' },
      reviewer:  { model: 'meta-llama/llama-3.3-70b-instruct:free', provider: 'openrouter' },
    },
  },
  'glm-nemotron': {
    name: 'GLM-Nemotron',
    description: 'GLM-4.7 architects, Nemotron 3 Super reasons, Kimi K2 executes. Score: 85. Fast reasoner.',
    selection: {
      architect: { model: 'glm-4.7:cloud', provider: 'ollama' },
      reasoner:  { model: 'nemotron-3-super:cloud', provider: 'ollama' },
      executor:  { model: 'moonshotai/kimi-k2-instruct-0905', provider: 'groq' },
      reviewer:  { model: 'meta-llama/llama-3.3-70b-instruct:free', provider: 'openrouter' },
    },
  },
  'ollama-ultima': {
    name: 'Ollama Ultima',
    description: 'Qwen 3.5 Architect + Kimi Thinking Reasoner + Qwen3 Coder 480B Executor. Maximum intelligence.',
    selection: {
      architect: { model: 'qwen3.5:cloud', provider: 'ollama' },
      reasoner:  { model: 'kimi-k2-thinking:cloud', provider: 'ollama' },
      executor:  { model: 'qwen3-coder:480b-cloud', provider: 'ollama' },
      reviewer:  { model: 'meta-llama/llama-3.3-70b-instruct:free', provider: 'openrouter' },
    },
  },
  'deepseek-ultra': {
    name: 'DeepSeek Ultra',
    description: 'DeepSeek V3.1 (671B) Reasoning + Qwen3 Coder 480B. State-of-the-art open source pipeline.',
    selection: {
      architect: { model: 'deepseek-v3.1:671b-cloud', provider: 'ollama' },
      reasoner:  { model: 'deepseek-v3.1:671b-cloud', provider: 'ollama' },
      executor:  { model: 'qwen3-coder:480b-cloud', provider: 'ollama' },
      reviewer:  { model: 'meta-llama/llama-3.3-70b-instruct:free', provider: 'openrouter' },
    },
  },
  // --- Solo presets — single model all stages, avoids cross-provider rate limits ---
  'solo-gemini-pro': {
    name: 'Solo: Gemini 3 Pro',
    description: 'All stages on Gemini 3 Pro.',
    selection: {
      architect: { model: 'gemini-3-pro-preview', provider: 'gemini' },
      reasoner:  { model: 'gemini-3-pro-preview', provider: 'gemini' },
      executor:  { model: 'gemini-3-pro-preview', provider: 'gemini' },
      reviewer:  { model: 'gemini-3-pro-preview', provider: 'gemini' },
    },
  },
  'solo-gemini-flash': {
    name: 'Solo: Gemini 3 Flash',
    description: 'All stages on Gemini 3 Flash.',
    selection: {
      architect: { model: 'gemini-3-flash-preview', provider: 'gemini' },
      reasoner:  { model: 'gemini-3-flash-preview', provider: 'gemini' },
      executor:  { model: 'gemini-3-flash-preview', provider: 'gemini' },
      reviewer:  { model: 'gemini-3-flash-preview', provider: 'gemini' },
    },
  },
  'solo-gpt-oss': {
    name: 'Solo: GPT-OSS 120B',
    description: 'All stages on GPT-OSS 120B via Groq.',
    selection: {
      architect: { model: 'openai/gpt-oss-120b', provider: 'groq' },
      reasoner:  { model: 'openai/gpt-oss-120b', provider: 'groq' },
      executor:  { model: 'openai/gpt-oss-120b', provider: 'groq' },
      reviewer:  { model: 'openai/gpt-oss-120b', provider: 'groq' },
    },
  },
  'solo-qwen36': {
    name: 'Solo: Qwen 3.6 Plus',
    description: 'All stages on Qwen 3.6 Plus via OpenRouter free tier.',
    selection: {
      architect: { model: 'qwen/qwen3.6-plus:free', provider: 'openrouter' },
      reasoner:  { model: 'qwen/qwen3.6-plus:free', provider: 'openrouter' },
      executor:  { model: 'qwen/qwen3.6-plus:free', provider: 'openrouter' },
      reviewer:  { model: 'qwen/qwen3.6-plus:free', provider: 'openrouter' },
    },
  },
  'solo-glm': {
    name: 'Solo: GLM-4.7',
    description: 'All stages on GLM-4.7 via Ollama Cloud.',
    selection: {
      architect: { model: 'glm-4.7:cloud', provider: 'ollama' },
      reasoner:  { model: 'glm-4.7:cloud', provider: 'ollama' },
      executor:  { model: 'glm-4.7:cloud', provider: 'ollama' },
      reviewer:  { model: 'glm-4.7:cloud', provider: 'ollama' },
    },
  },
  'solo-kimi-k2.5': {
    name: 'Solo: Kimi K2.5',
    description: 'All stages on Kimi K2.5 via Ollama Cloud.',
    selection: {
      architect: { model: 'kimi-k2.5:cloud', provider: 'ollama' },
      reasoner:  { model: 'kimi-k2.5:cloud', provider: 'ollama' },
      executor:  { model: 'kimi-k2.5:cloud', provider: 'ollama' },
      reviewer:  { model: 'kimi-k2.5:cloud', provider: 'ollama' },
    },
  },
  'solo-kimi-k2': {
    name: 'Solo: Kimi K2',
    description: 'All stages on Kimi K2 via Groq.',
    selection: {
      architect: { model: 'moonshotai/kimi-k2-instruct-0905', provider: 'groq' },
      reasoner:  { model: 'moonshotai/kimi-k2-instruct-0905', provider: 'groq' },
      executor:  { model: 'moonshotai/kimi-k2-instruct-0905', provider: 'groq' },
      reviewer:  { model: 'moonshotai/kimi-k2-instruct-0905', provider: 'groq' },
    },
  },
};

export const WATERFALL_DEFAULT_SELECTION: WaterfallModelSelection = {
  architect: 'B', reasoner: 'B', executor: 'B', reviewer: 'B'
};

export const WATERFALL_CONFIG: Record<string, WaterfallPhaseConfig> = {
  // Architect: requirements analysis + architectural planning (needs strongest reasoning)
  PHASE_1_ARCHITECT: {
    OPTION_A: { model: 'qwen3.5:cloud',            provider: 'ollama',    label: 'Qwen 3.5 Cloud',   score: 'NEW'           },
    OPTION_B: { model: 'openai/gpt-oss-120b',     provider: 'groq',      label: 'GPT-OSS 120B',     score: 'MMLU-Pro 90%'  },
    LOCAL: 'deepseek-r1:latest'
  },
  // Reasoner: blueprint → execution plan (needs speed + structured output)
  PHASE_2_REASONER: {
    OPTION_A: { model: 'kimi-k2-thinking:cloud',  provider: 'ollama',    label: 'Kimi Thinking',    score: 'NEW'           },
    OPTION_B: { model: 'qwen/qwen3-32b',           provider: 'groq',      label: 'Qwen3 32B',        score: '535 t/s'       },
    LOCAL: 'deepseek-r1:latest'
  },
  // Executor: plan → production-ready code (needs best code generation)
  PHASE_3_EXECUTOR: {
    OPTION_A: { model: 'qwen3-coder:480b-cloud', provider: 'ollama',    label: 'Qwen3 Coder 480B', score: 'NEW'           },
    OPTION_B: { model: 'qwen3-coder-plus',        provider: 'dashscope', label: 'Qwen3 Coder+',    score: 'SWE-bench 71%' },
    LOCAL: 'deepseek-r1:latest'
  },
  // Reviewer: code audit + quality scoring (needs deep analysis + structured output)
  // Free-tier models rotate on OpenRouter — keep these updated when models go offline.
  PHASE_4_REVIEWER: {
    OPTION_A: { model: 'meta-llama/llama-3.3-70b-instruct:free', provider: 'openrouter', label: 'Llama 3.3 70B', score: 'MMLU 86%' },
    OPTION_B: { model: 'nousresearch/hermes-3-llama-3.1-405b:free', provider: 'openrouter', label: 'Hermes 405B', score: '405B' },
    LOCAL: 'deepseek-r1:latest'
  }
};

export const CONTEXT_LIMITS: Record<string, number> = {
  // Gemini: Massive Context
  'gemini-1.5-pro': 2000000, 
  'gemini-2.0-flash': 1000000,
  'gemini-1.5-flash': 1000000,
  
  // Groq: High Context
  'llama-3.3-70b-versatile': 128000,
  'mixtral-8x7b-32768': 32768,
  'llama-3.1-8b-instant': 128000,

  // Local/Ollama: Constrained (conservative defaults)
  'qwen2.5-coder:7b': 32768,
  'llama3': 8192,
  'deepseek-coder-v2': 16384,

  // Ollama Cloud
  'qwen3.5:cloud': 131072,
  'qwen3-coder:480b-cloud': 131072,
  'kimi-k2-thinking:cloud': 131072,
  'kimi-k2.5:cloud': 131072,
  'deepseek-v3.1:671b-cloud': 163840,
  'deepseek-v3.2:cloud': 163840,
  'glm-5:cloud': 131072,
  'glm-4.7:cloud': 131072,
  'nemotron-3-super:cloud': 131072,
  'minimax-m2.1:cloud': 131072,
  'cogito-2.1:671b-cloud': 131072,

  // DashScope (Qwen)
  'qwen3-coder-plus': 131072,
  'qwen3-coder-flash': 131072,
  'qwen3-max': 131072,
  'qwen3.5-plus': 131072,
  'qwen-plus': 131072,
  'qwen-turbo': 131072,
  'qwen3-235b-a22b': 131072,
  'qwen3-next-80b-a3b-instruct': 131072,

  // OpenRouter frontier
  'openrouter/hunter-alpha': 1048576,
  'openrouter/healer-alpha': 262144,

  // DeepSeek
  'deepseek/deepseek-r1:free': 163840,
  'deepseek/deepseek-chat-v3-0324:free': 163840,

  // Default fallback
  'default': 8192
};

export const getModelContextLimit = (modelName: string): number => {
  if (!modelName) return CONTEXT_LIMITS['default'] ?? 8192;
  const limit = CONTEXT_LIMITS[modelName];
  if (limit !== undefined) return limit;
  if (modelName.includes('gemini')) return 1000000;
  if (modelName.includes('llama-3')) return 128000;
  if (modelName.includes('gpt-4')) return 128000;
  if (modelName.includes('claude-3')) return 200000;
  if (modelName.includes('qwen')) return 131072;
  
  return CONTEXT_LIMITS['default'] ?? 8192;
};

/**
 * Per-request total token limits (input + output) for models with tight quotas.
 * Groq free tier enforces these as "TPM" but they apply per-request.
 * Only models with known tight limits are listed — unlisted models have no cap.
 */
export const REQUEST_TOKEN_LIMITS: Record<string, number> = {
  'qwen/qwen3-32b':                        6000,
  'deepseek-r1-distill-qwen-32b':          6000,
  'qwen-qwq-32b':                          6000,
  'meta-llama/llama-4-scout-17b-16e-instruct': 8000,
  'meta-llama/llama-4-maverick-17b-128e-instruct': 8000,
};

/**
 * Cap maxTokens to stay within a model's per-request total token limit.
 * Returns the original maxTokens if the model has no known limit.
 */
export function capMaxTokens(model: string, inputTokenEstimate: number, requestedMaxTokens: number): number {
  const limit = REQUEST_TOKEN_LIMITS[model];
  if (!limit) return requestedMaxTokens;
  const available = Math.max(256, limit - inputTokenEstimate - 50); // 50-token safety margin
  if (available < requestedMaxTokens) {
    console.log(`[TokenCap] ${model}: capping maxTokens from ${requestedMaxTokens} to ${available} (limit=${limit}, input~${inputTokenEstimate})`);
  }
  return Math.min(requestedMaxTokens, available);
};