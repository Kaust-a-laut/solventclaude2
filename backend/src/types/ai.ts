export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'model';
  content: string;
  image?: string | null;
}

export interface CompletionOptions {
  model: string;
  temperature?: number;
  maxTokens?: number;
  shouldSearch?: boolean;
  apiKey?: string;
  jsonMode?: boolean;
  signal?: AbortSignal;
}

export interface ImageContent {
  data: string;
  mimeType: string;
}

export interface SearchResult {
  title: string;
  link: string;
  snippet?: string;
}

export interface IAIProvider {
  name: string;
  defaultModel?: string;
  initialize?(options: Record<string, unknown>): Promise<void>;

  generateChatCompletion(
    messages: ChatMessage[],
    options: CompletionOptions
  ): Promise<string>;

  generateChatStream?(
    messages: ChatMessage[],
    options: CompletionOptions
  ): AsyncGenerator<string>;

  generateVisionContent?(
    prompt: string,
    images: ImageContent[],
    options?: CompletionOptions
  ): Promise<string>;
}

// Deprecated alias for backward compatibility until refactor is complete
export type AIProvider = IAIProvider;

export interface PageContent {
  title: string;
  content: string;
  excerpt?: string;
  siteName?: string;
  author?: string;
  publishedDate?: string;
  url: string;
}

export interface ChatRequestData {
  provider: string;
  model: string;
  messages: ChatMessage[];
  image?: ImageContent | null;
  mode?: string;
  smartRouter?: boolean;
  fallbackModel?: string;
  imageProvider?: string;
  temperature?: number;
  maxTokens?: number;
  apiKeys?: Record<string, string>;
  thinkingModeEnabled?: boolean;
  activeFile?: string;
  deviceInfo?: {
    isMobile: boolean;
    isTablet: boolean;
    isDesktop: boolean;
    windowSize: { width: number; height: number };
  };
  notepadContent?: string;
  openFiles?: Array<{ path: string; content: string }>;
  codingHistory?: ChatMessage[];
  browserContext?: {
    history: string[];
    lastSearchResults?: SearchResult[];
  };
  signal?: AbortSignal;
}
