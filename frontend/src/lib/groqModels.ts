// Shared Groq model definitions.
// Single source of truth — imported by ChatHeader, CompareArea, and DebateArea.

export const GROQ_CHAT_MODELS = [
  // Production
  { label: 'Llama 3.3 70B',          value: 'llama-3.3-70b-versatile' },
  { label: 'Llama 3.1 70B',          value: 'llama-3.1-70b-versatile' },
  { label: 'Llama 3.1 8B',           value: 'llama-3.1-8b-instant' },
  { label: 'Llama 3 70B',            value: 'llama3-70b-8192' },
  { label: 'Llama 3 8B',             value: 'llama3-8b-8192' },
  { label: 'Gemma 2 9B',             value: 'gemma2-9b-it' },
  { label: 'Mixtral 8x7B',           value: 'mixtral-8x7b-32768' },
  // Preview
  { label: 'Llama 4 Scout 17B',      value: 'meta-llama/llama-4-scout-17b-16e-instruct' },
  { label: 'Llama 4 Maverick 17B',   value: 'meta-llama/llama-4-maverick-17b-128e-instruct' },
  { label: 'Llama 3.3 70B SpecDec',  value: 'llama-3.3-70b-specdec' },
  { label: 'Llama 3.1 70B SpecDec',  value: 'llama-3.1-70b-specdec' },
  { label: 'Qwen QwQ 32B',           value: 'qwen-qwq-32b' },
  { label: 'Qwen3 32B',              value: 'qwen/qwen3-32b' },
  { label: 'DeepSeek R1 Distill 70B', value: 'deepseek-r1-distill-llama-70b' },
  { label: 'DeepSeek R1 Distill 32B', value: 'deepseek-r1-distill-qwen-32b' },
  { label: 'GPT OSS 120B',           value: 'openai/gpt-oss-120b' },
  { label: 'Kimi K2',                value: 'moonshotai/kimi-k2-instruct-0905' },
] as const;

// For CompareArea / DebateArea ALL_MODELS format
export const GROQ_ALL_MODELS = GROQ_CHAT_MODELS.map(m => ({
  provider: 'groq' as const,
  model: m.value,
  label: m.label,
  group: 'Groq' as const,
}));
