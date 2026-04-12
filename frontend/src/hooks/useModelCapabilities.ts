import { useAppStore } from '../store/useAppStore';
import { AGENT_MODEL_OPTIONS, type ModelOption } from '../components/ModelSelector';

export type ModelTier = 'full-agentic' | 'code-only';

export interface AgentModelTraits {
  toolUse: 'strong' | 'basic';
  multimodal: boolean;
  contextWindow: number;
}

export interface AgentModel extends Omit<ModelOption, 'sublabel' | 'color' | 'bgColor' | 'icon'> {
  tier: ModelTier;
  traits: AgentModelTraits;
}

export function useModelCapabilities() {
  const selectedModel = useAppStore((s) => s.selectedCloudModel);
  const selectedProvider = useAppStore((s) => s.selectedCloudProvider);

  const activeModel = AGENT_MODEL_OPTIONS.find(
    (m) => m.model === selectedModel && m.provider === selectedProvider
  );

  const tier = getModelTier(activeModel);
  const traits = getModelTraits(activeModel);

  return {
    canUseRuntimeTools: tier === 'full-agentic',
    canUseScreenshots: traits.multimodal === true,
    canUseClickToEdit: tier === 'full-agentic',
    tier,
    traits,
    activeModel: activeModel ?? null,
  };
}

function getModelTier(model: ModelOption | undefined): ModelTier {
  if (!model) return 'code-only';
  const fullAgentic = [
    'accounts/fireworks/models/kimi-k2p5',
    'qwen3-coder-plus',
    'anthropic/claude-sonnet-4',
    'openai/gpt-4o',
    'accounts/fireworks/models/glm-4p7',
    'accounts/fireworks/models/glm-5',
    'qwen3.6-plus',
    'compound-beta',
    'moonshotai/kimi-k2-instruct-0905',
    'deepseek-chat',
    'qwen3-coder-flash',
  ];
  return fullAgentic.includes(model.model) ? 'full-agentic' : 'code-only';
}

function getModelTraits(model: ModelOption | undefined): AgentModelTraits {
  if (!model) return { toolUse: 'basic', multimodal: false, contextWindow: 8192 };

  const multimodalModels = [
    'anthropic/claude-sonnet-4',
    'openai/gpt-4o',
  ];

  return {
    toolUse: getModelTier(model) === 'full-agentic' ? 'strong' : 'basic',
    multimodal: multimodalModels.includes(model.model),
    contextWindow: getContextWindow(model.model),
  };
}

function getContextWindow(modelId: string): number {
  const limits: Record<string, number> = {
    'anthropic/claude-sonnet-4': 200000,
    'openai/gpt-4o': 128000,
    'accounts/fireworks/models/kimi-k2p5': 262144,
    'qwen3-coder-plus': 131072,
    'accounts/fireworks/models/glm-4p7': 202800,
    'accounts/fireworks/models/glm-5': 202800,
    'qwen3.6-plus': 131072,
    'compound-beta': 128000,
    'moonshotai/kimi-k2-instruct-0905': 128000,
    'deepseek-chat': 128000,
    'qwen3-coder-flash': 131072,
    'accounts/fireworks/models/llama4-maverick-instruct-basic': 131072,
    'accounts/fireworks/models/minimax-m2': 196608,
    'qwen/qwen3-32b': 131072,
    'qwen-3-235b-a22b-instruct-2507': 131072,
    'qwen3-next-80b-a3b-instruct': 131072,
    'llama-3.3-70b-versatile': 128000,
  };
  return limits[modelId] ?? 8192;
}
