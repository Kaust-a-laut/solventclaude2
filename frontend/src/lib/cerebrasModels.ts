// Cerebras wafer-scale inference models
// Production + Preview tiers

export const CEREBRAS_CHAT_MODELS = [
  { label: 'Llama 3.1 8B',    value: 'llama3.1-8b' },
  { label: 'Qwen3 235B',      value: 'qwen-3-235b-a22b-instruct-2507' },
] as const;

export const CEREBRAS_ALL_MODELS = CEREBRAS_CHAT_MODELS.map(m => ({
  provider: 'cerebras' as const,
  model: m.value,
  label: m.label,
  group: 'Cerebras' as const,
}));
