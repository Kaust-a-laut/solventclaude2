// Shared DashScope (Qwen) model definitions.
// Single source of truth — imported by allModels.ts for ChatHeader, CompareArea, and DebateArea.

export const DASHSCOPE_CHAT_MODELS = [
  // Coder models — agentic coding + tool use
  { label: 'Qwen3 Coder Plus',       value: 'qwen3-coder-plus' },
  { label: 'Qwen3 Coder Flash',      value: 'qwen3-coder-flash' },
  // Flagship general
  { label: 'Qwen3 Max',              value: 'qwen3-max' },
  { label: 'Qwen 3.5 Plus',          value: 'qwen3.5-plus' },
  // General purpose
  { label: 'Qwen Plus',              value: 'qwen-plus' },
  { label: 'Qwen Turbo',             value: 'qwen-turbo' },
  // Large open-weight MoE
  { label: 'Qwen3 235B A22B',        value: 'qwen3-235b-a22b' },
  { label: 'Qwen3 32B',              value: 'qwen3-32b' },
  // Coder-Next (efficient agentic coder)
  { label: 'Qwen3 Coder Next 80B',   value: 'qwen3-next-80b-a3b-instruct' },
] as const;

// For CompareArea / DebateArea ALL_MODELS format
export const DASHSCOPE_ALL_MODELS = DASHSCOPE_CHAT_MODELS.map(m => ({
  provider: 'dashscope' as const,
  model: m.value,
  label: m.label,
  group: 'DashScope (Qwen)' as const,
}));
