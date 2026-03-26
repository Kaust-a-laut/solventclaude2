// Centralized model definitions used across CompareArea, DebateArea, and ChatHeader.
// Single source of truth — prevents drift between components.

import { GROQ_ALL_MODELS, GROQ_CHAT_MODELS } from './groqModels';
import { OPENROUTER_FREE_ALL_MODELS, OPENROUTER_FREE_CHAT_MODELS } from './openrouterModels';
import { DASHSCOPE_ALL_MODELS, DASHSCOPE_CHAT_MODELS } from './dashscopeModels';
import { CEREBRAS_ALL_MODELS, CEREBRAS_CHAT_MODELS } from './cerebrasModels';

// ── Ollama Cloud models ──────────────────────────────────────────────────────

export const OLLAMA_CLOUD_CHAT_MODELS = [
  { label: 'GLM-4.7',              value: 'glm-4.7:cloud' },
  { label: 'GLM-5',                value: 'glm-5:cloud' },
  { label: 'Kimi K2.5',            value: 'kimi-k2.5:cloud' },
  { label: 'Kimi K2 Thinking',     value: 'kimi-k2-thinking:cloud' },
  { label: 'DeepSeek V3.1 (671B)', value: 'deepseek-v3.1:671b-cloud' },
  { label: 'DeepSeek V3.2',        value: 'deepseek-v3.2:cloud' },
  { label: 'Qwen 3.5',             value: 'qwen3.5:cloud' },
  { label: 'Qwen3 Coder (480B)',   value: 'qwen3-coder:480b-cloud' },
  { label: 'Nemotron 3 Super',     value: 'nemotron-3-super:cloud' },
  { label: 'MiniMax M2.1',         value: 'minimax-m2.1:cloud' },
  { label: 'Cogito 2.1 (671B)',    value: 'cogito-2.1:671b-cloud' },
] as const;

// ── Gemini models (shared across ChatHeader + Compare/Debate) ────────────────

export const GEMINI_CHAT_MODELS = [
  { label: 'Gemini 3.1 Pro',        value: 'gemini-3.1-pro-preview' },
  { label: 'Gemini 3.1 Flash Lite', value: 'gemini-3.1-flash-lite-preview' },
  { label: 'Gemini 3 Flash',        value: 'gemini-3-flash-preview' },
  { label: 'Gemini 2.5 Pro',        value: 'gemini-2.5-pro' },
  { label: 'Gemini 2.5 Flash',      value: 'gemini-2.5-flash' },
  { label: 'Gemini 2.5 Flash Lite', value: 'gemini-2.5-flash-lite' },
] as const;

// ── ALL_MODELS — flat list with provider/model/label/group ───────────────────
// Used by CompareArea, DebateArea, and ModelPickerDropdown

export const ALL_MODELS = [
  ...GEMINI_CHAT_MODELS.map(m => ({
    provider: 'gemini' as const,
    model: m.value,
    label: m.label,
    group: 'Gemini' as const,
  })),
  ...GROQ_ALL_MODELS,
  { provider: 'deepseek',   model: 'deepseek-r1-distill-llama-70b',  label: 'DeepSeek R1',           group: 'DeepSeek' },
  { provider: 'openrouter', model: 'anthropic/claude-sonnet-4',      label: 'Claude Sonnet 4',       group: 'OpenRouter' },
  { provider: 'openrouter', model: 'deepseek/deepseek-chat-v3-0324', label: 'DeepSeek V3',           group: 'OpenRouter' },
  ...OPENROUTER_FREE_ALL_MODELS,
  ...DASHSCOPE_ALL_MODELS,
  ...CEREBRAS_ALL_MODELS,
  ...OLLAMA_CLOUD_CHAT_MODELS.map(m => ({
    provider: 'ollama' as const,
    model: m.value,
    label: m.label,
    group: 'Ollama Cloud' as const,
  })),
  { provider: 'ollama',     model: 'qwen2.5-coder:7b',               label: 'Qwen 2.5 Coder 7B',    group: 'Local' },
  { provider: 'ollama',     model: 'qwen2.5-coder:14b',              label: 'Qwen 2.5 Coder 14B',   group: 'Local' },
  { provider: 'ollama',     model: 'deepseek-r1:8b',                 label: 'DeepSeek R1 8B',        group: 'Local' },
  { provider: 'ollama',     model: 'llama3.1:8b',                    label: 'Llama 3.1 8B',          group: 'Local' },
  { provider: 'ollama',     model: 'mistral:7b',                     label: 'Mistral 7B',            group: 'Local' },
];

// ── PROVIDER_GROUPS — grouped format for ChatHeader dropdown ─────────────────

export const PROVIDER_GROUPS = [
  {
    id: 'groq',
    label: 'Groq',
    models: [...GROQ_CHAT_MODELS],
  },
  {
    id: 'gemini',
    label: 'Gemini',
    models: [...GEMINI_CHAT_MODELS],
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    models: [
      { label: 'Claude Sonnet 4',   value: 'anthropic/claude-sonnet-4' },
      { label: 'Claude Sonnet 4.5', value: 'anthropic/claude-sonnet-4.5' },
      { label: 'Gemini 2.5 Flash',  value: 'google/gemini-2.5-flash' },
      { label: 'Gemini 2.5 Pro',    value: 'google/gemini-2.5-pro' },
      { label: 'DeepSeek V3',       value: 'deepseek/deepseek-chat-v3-0324' },
      { label: 'Llama 4 Scout',     value: 'meta-llama/llama-4-scout-17b-16e-instruct' },
      ...OPENROUTER_FREE_CHAT_MODELS,
    ],
  },
  {
    id: 'dashscope',
    label: 'DashScope (Qwen)',
    models: [...DASHSCOPE_CHAT_MODELS],
  },
  {
    id: 'cerebras',
    label: 'Cerebras',
    models: [...CEREBRAS_CHAT_MODELS],
  },
  {
    id: 'ollama',
    label: 'Ollama Cloud',
    models: [...OLLAMA_CLOUD_CHAT_MODELS],
  },
] as const;

// ── Helpers — encode/decode provider:model composite keys ────────────────────

export const toKey = (provider: string, model: string) => `${provider}:${model}`;

export const fromKey = (key: string) => {
  const i = key.indexOf(':');
  return { provider: key.slice(0, i), model: key.slice(i + 1) };
};

// ── Safe URL hostname parser ─────────────────────────────────────────────────

export const safeHostname = (url: string): string => {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
};
