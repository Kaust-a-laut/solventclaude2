import { ChatMessage, CompletionOptions } from './ai';

export interface IPlugin {
  /** Unique identifier for the plugin */
  id: string;
  
  /** Human-readable name of the plugin */
  name: string;
  
  /** Brief description of what the plugin does */
  description: string;
  
  /** Version of the plugin */
  version: string;
  
  /** Initialize the plugin with configuration */
  initialize?(config: Record<string, any>): Promise<void>;
  
  /** Check if the plugin is ready to be used */
  isReady(): boolean;
}

export interface ProviderCapabilities {
  /** Maximum context window in tokens */
  contextWindow: number;
  /** Supports vision/image input */
  supportsVision: boolean;
  /** Supports function/tool calling */
  supportsFunctionCalling: boolean;
  /** Supports streaming responses */
  supportsStreaming: boolean;
  /** Cost per 1000 tokens */
  costPer1k: {
    input: number;
    output: number;
  };
}

export interface ProviderHealth {
  isHealthy: boolean;
  lastChecked: number;
  latency: number;
  errorRate: number;
}

export interface IProviderPlugin extends IPlugin {
  /** Default model for this provider */
  defaultModel?: string;

  /** Provider capabilities */
  capabilities?: ProviderCapabilities;

  /** Get current health status */
  getHealth?(): Promise<ProviderHealth>;

  /** Perform health check */
  healthCheck?(): Promise<boolean>;

  /** Generate a completion */
  complete(
    messages: ChatMessage[],
    options: CompletionOptions
  ): Promise<string>;

  /** Generate a streaming completion */
  stream?(
    messages: ChatMessage[],
    options: CompletionOptions
  ): AsyncGenerator<string>;

  /** Generate embeddings */
  embed?(
    text: string
  ): Promise<number[]>;

  /** Generate vision content */
  vision?(
    prompt: string,
    images: { data: string; mimeType: string }[],
    options?: CompletionOptions
  ): Promise<string>;
}

export interface IToolPlugin extends IPlugin {
  /** JSON schema for the tool's parameters */
  schema: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, unknown>;
      required: string[];
    };
  };

  /** Execute the tool with given arguments */
  execute(args: Record<string, unknown>): Promise<unknown>;

  /** Validate arguments before execution */
  validate?(args: Record<string, unknown>): { isValid: boolean; errors?: string[] };
}