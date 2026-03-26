// Thinking model classifications.
// Used by ChatService (routing) and ChatInput (brain icon behavior).

// Models that ALWAYS produce reasoning traces — no toggle needed
export const THINK_ONLY_MODELS = new Set([
  'qwen-qwq-32b',
  'kimi-k2-thinking:cloud',
  'microsoft/phi-4-reasoning-plus:free',
]);

// Models that CAN think but also work without — toggle-able
export const DUAL_MODE_MODELS = new Set([
  'deepseek-r1-distill-llama-70b',
  'deepseek-r1-distill-qwen-32b',
  'cogito-2.1:671b-cloud',
  'deepseek-r1:8b',
  'deepseek-r1:latest',
  'deepseek/deepseek-r1:free',
]);

// Union — any model with thinking capability
export const NATIVE_THINKING_MODELS = new Set([
  ...THINK_ONLY_MODELS,
  ...DUAL_MODE_MODELS,
]);
