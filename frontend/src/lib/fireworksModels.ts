// Fireworks AI models
// OpenAI-compatible API — fast inference for open models

export const FIREWORKS_CHAT_MODELS = [
  // Frontier
  { label: 'Kimi K2.5',              value: 'accounts/fireworks/models/kimi-k2p5' },
  { label: 'GLM-5',                  value: 'accounts/fireworks/models/glm-5' },
  { label: 'GLM-4.7',                value: 'accounts/fireworks/models/glm-4p7' },
  { label: 'DeepSeek V3',            value: 'accounts/fireworks/models/deepseek-v3' },
  { label: 'GPT-OSS 120B',           value: 'accounts/fireworks/models/gpt-oss-120b' },
  { label: 'GPT-OSS 20B',            value: 'accounts/fireworks/models/gpt-oss-20b' },
  { label: 'MiniMax M2',             value: 'accounts/fireworks/models/minimax-m2' },
  // Llama
  { label: 'Llama 4 Maverick',       value: 'accounts/fireworks/models/llama4-maverick-instruct-basic' },
  { label: 'Llama 4 Scout',          value: 'accounts/fireworks/models/llama4-scout-instruct-basic' },
  { label: 'Llama 3.3 70B',          value: 'accounts/fireworks/models/llama-v3p3-70b-instruct' },
  // Qwen
  { label: 'Qwen 3.6 Plus',         value: 'accounts/fireworks/models/qwen3p6-plus' },
  { label: 'Qwen 2.5 72B',          value: 'accounts/fireworks/models/qwen2p5-72b-instruct' },
  { label: 'Mixtral MoE 8x22B',     value: 'accounts/fireworks/models/mixtral-8x22b-instruct' },
] as const;

export const FIREWORKS_ALL_MODELS = FIREWORKS_CHAT_MODELS.map(m => ({
  provider: 'fireworks' as const,
  model: m.value,
  label: m.label,
  group: 'Fireworks' as const,
}));
