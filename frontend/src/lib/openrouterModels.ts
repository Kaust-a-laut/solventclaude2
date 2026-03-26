// Shared OpenRouter free model definitions.
// Single source of truth — imported by ChatHeader, CompareArea, and DebateArea.

export const OPENROUTER_FREE_CHAT_MODELS = [
  { label: 'Llama 4 Maverick (Free)',    value: 'meta-llama/llama-4-maverick:free' },
  { label: 'Llama 4 Scout (Free)',        value: 'meta-llama/llama-4-scout:free' },
  { label: 'Llama 3.3 70B (Free)',        value: 'meta-llama/llama-3.3-70b-instruct:free' },
  { label: 'Llama 3.1 8B (Free)',         value: 'meta-llama/llama-3.1-8b-instruct:free' },
  { label: 'DeepSeek R1 (Free)',          value: 'deepseek/deepseek-r1:free' },
  { label: 'DeepSeek V3 (Free)',          value: 'deepseek/deepseek-chat-v3-0324:free' },
  { label: 'Gemini 2.0 Flash Exp (Free)', value: 'google/gemini-2.0-flash-exp:free' },
  { label: 'Gemma 3 27B (Free)',          value: 'google/gemma-3-27b-it:free' },
  { label: 'Gemma 3 12B (Free)',          value: 'google/gemma-3-12b-it:free' },
  { label: 'Qwen 2.5 Coder 32B (Free)',  value: 'qwen/qwen-2.5-coder-32b-instruct:free' },
  { label: 'Qwen 2.5 72B (Free)',         value: 'qwen/qwen-2.5-72b-instruct:free' },
  { label: 'Qwen3 235B (Free)',           value: 'qwen/qwen3-235b-a22b:free' },
  { label: 'Mistral 7B (Free)',           value: 'mistralai/mistral-7b-instruct:free' },
  { label: 'Phi-4 Reasoning+ (Free)',     value: 'microsoft/phi-4-reasoning-plus:free' },
  { label: 'DeepHermes 3 8B (Free)',      value: 'nousresearch/deephermes-3-llama-3-8b-preview:free' },
] as const;

// For CompareArea / DebateArea ALL_MODELS format
export const OPENROUTER_FREE_ALL_MODELS = OPENROUTER_FREE_CHAT_MODELS.map(m => ({
  provider: 'openrouter' as const,
  model: m.value,
  label: m.label,
  group: 'OpenRouter Free' as const,
}));
