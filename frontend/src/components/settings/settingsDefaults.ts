import { APP_CONFIG } from '../../lib/config';

// ── Tab metadata ──────────────────────────────────────────────────────────────

export const TAB_TITLES: Record<string, string> = {
  models:     'Models & Providers',
  behavior:   'Behavior & Tuning',
  'api-keys': 'API Keys',
  memory:     'Project Memory',
};

export const TAB_SUBTITLES: Record<string, string> = {
  models:     'Configure AI providers, model selection and image generation',
  behavior:   'Tune inference parameters and assistant capabilities',
  'api-keys': 'Securely store provider credentials — stored locally only',
  memory:     'Index your workspace for context-aware responses',
};

// ── API key provider configs ──────────────────────────────────────────────────

export const API_KEY_CONFIGS = [
  { id: 'gemini',      label: 'Google Gemini',     description: 'Powers Gemini 1.5 / 2.0 / 2.5 models and Imagen image generation', placeholder: 'AIzaSy...',     docsUrl: 'https://aistudio.google.com/app/apikey' },
  { id: 'groq',        label: 'Groq',              description: 'Llama 3.3 70B, Mixtral — ultra-fast LPU inference',                placeholder: 'gsk_...',       docsUrl: 'https://console.groq.com/keys' },
  { id: 'deepseek',    label: 'DeepSeek',          description: 'deepseek-chat and deepseek-reasoner models',                        placeholder: 'sk-...',        docsUrl: 'https://platform.deepseek.com/api_keys' },
  { id: 'openrouter',  label: 'OpenRouter',        description: 'Access hundreds of models through a single API endpoint',           placeholder: 'sk-or-v1-...', docsUrl: 'https://openrouter.ai/keys' },
  { id: 'dashscope',   label: 'DashScope (Qwen)',  description: 'Qwen3-Coder, Qwen3.5, Qwen-Max — Alibaba Cloud native API',       placeholder: 'sk-...',        docsUrl: 'https://dashscope.console.aliyun.com/apiKey' },
  { id: 'cerebras',    label: 'Cerebras',          description: 'Ultra-fast wafer-scale inference — Llama, GPT-OSS, Qwen3, GLM-4.7', placeholder: 'csk-...',       docsUrl: 'https://cloud.cerebras.ai/' },
  { id: 'huggingface', label: 'Hugging Face',      description: 'Free SDXL image generation via the Hugging Face Inference API',     placeholder: 'hf_...',        docsUrl: 'https://huggingface.co/settings/tokens' },
  { id: 'serper',      label: 'Serper (Search)',    description: 'Enables web search — required for Browse and Waterfall tools',      placeholder: 'your-key...',   docsUrl: 'https://serper.dev/api-key' },
] as const;

// ── Settings defaults (mirrors createSettingsSlice initial values) ───────────

export const SETTINGS_DEFAULTS = {
  globalProvider: 'auto' as const,
  selectedCloudModel: APP_CONFIG.models.cloud.primary,
  selectedCloudProvider: APP_CONFIG.providers.primary,
  selectedLocalModel: APP_CONFIG.models.local.primary,
  selectedOpenRouterModel: 'qwen/qwen-2.5-coder-32b-instruct:free',
  imageProvider: APP_CONFIG.defaults.imageProvider,
  localImageUrl: 'http://127.0.0.1:7860/sdapi/v1/txt2img',
  modeConfigs: APP_CONFIG.modeConfigs,
  temperature: APP_CONFIG.defaults.temperature,
  maxTokens: APP_CONFIG.defaults.maxTokens,
  smartRouterEnabled: true,
  thinkingModeEnabled: false,
  showCodingChat: true,
  auraMode: 'off' as const,
  performanceMode: 'auto' as const,
};

// ── Settings registry for search ──────────────────────────────────────────────

export interface SettingsEntry {
  id: string;
  label: string;
  description: string;
  tab: 'models' | 'behavior' | 'api-keys' | 'memory';
  keywords: string[];
}

export const SETTINGS_REGISTRY: SettingsEntry[] = [
  { id: 'routing-mode',          label: 'Routing Mode',            description: 'Cloud, Local, or Smart Hybrid',                          tab: 'models',   keywords: ['cloud', 'local', 'hybrid', 'provider', 'ollama'] },
  { id: 'default-cloud-model',   label: 'Default Cloud Model',     description: 'Primary model for cloud inference',                      tab: 'models',   keywords: ['gemini', 'groq', 'deepseek', 'openrouter', 'llama'] },
  { id: 'default-local-model',   label: 'Default Local Model',     description: 'Ollama model for local inference',                       tab: 'models',   keywords: ['ollama', 'qwen', 'local'] },
  { id: 'openrouter-override',   label: 'OpenRouter Override',     description: 'Custom OpenRouter model slug',                           tab: 'models',   keywords: ['openrouter', 'model', 'slug'] },
  { id: 'image-provider',        label: 'Image Provider',          description: 'Image generation backend',                               tab: 'models',   keywords: ['imagen', 'sdxl', 'huggingface', 'pollinations', 'image'] },
  { id: 'mode-overrides',        label: 'Per-Mode Overrides',      description: 'Model assignments per app mode',                         tab: 'models',   keywords: ['mode', 'override', 'per-mode'] },
  { id: 'temperature',           label: 'Temperature',             description: 'Response randomness — 0 = deterministic, 1 = creative',  tab: 'behavior', keywords: ['random', 'creative', 'deterministic', 'temp'] },
  { id: 'max-tokens',            label: 'Max Tokens',              description: 'Maximum token budget per request',                       tab: 'behavior', keywords: ['tokens', 'budget', 'limit', 'length'] },
  { id: 'smart-router',          label: 'Smart Router',            description: 'Auto-select best model and provider',                    tab: 'behavior', keywords: ['auto', 'router', 'routing'] },
  { id: 'extended-thinking',     label: 'Extended Thinking',       description: 'Enable deeper reasoning for complex queries',            tab: 'behavior', keywords: ['thinking', 'reasoning', 'deep'] },
  { id: 'coding-assistant',      label: 'Coding Assistant',        description: 'Show IDE panel in sidebar',                              tab: 'behavior', keywords: ['coding', 'ide', 'code'] },
  { id: 'performance-mode',      label: 'Performance Mode',        description: 'Auto, Full, or Lite visual effects',                     tab: 'behavior', keywords: ['performance', 'animation', 'lite', 'full'] },
  { id: 'aura',                  label: 'Environmental Aura',      description: 'Background visual atmosphere',                           tab: 'behavior', keywords: ['aura', 'background', 'visual', 'organic', 'static'] },
  { id: 'api-gemini',            label: 'Gemini API Key',          description: 'Google Gemini credentials',                              tab: 'api-keys', keywords: ['gemini', 'google', 'key'] },
  { id: 'api-groq',              label: 'Groq API Key',            description: 'Groq LPU credentials',                                  tab: 'api-keys', keywords: ['groq', 'key'] },
  { id: 'api-deepseek',          label: 'DeepSeek API Key',        description: 'DeepSeek credentials',                                  tab: 'api-keys', keywords: ['deepseek', 'key'] },
  { id: 'api-openrouter',        label: 'OpenRouter API Key',      description: 'OpenRouter credentials',                                 tab: 'api-keys', keywords: ['openrouter', 'key'] },
  { id: 'memory-index',          label: 'Memory Index',            description: 'Resync workspace memory index',                          tab: 'memory',   keywords: ['memory', 'index', 'resync', 'context'] },
];
