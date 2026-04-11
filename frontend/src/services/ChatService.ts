import { fetchWithRetry } from '../lib/api-client';
import { API_BASE_URL, BASE_URL } from '../lib/config';
import { parseGraphData } from '../lib/graph-parser';
import type { SearchResultSet, PageContent } from '../store/types';

const THINKING_MODEL_LOCAL = 'deepseek-r1:8b';
const THINKING_MODEL_CLOUD = 'deepseek-r1-distill-llama-70b';

import { NATIVE_THINKING_MODELS } from '../lib/thinkingModels';
export { NATIVE_THINKING_MODELS };

// --- Type Definitions ---

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  image?: string | null;
  timestamp?: number;
}

export interface ModeConfig {
  provider: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export interface DeviceInfo {
  type: 'desktop' | 'mobile' | 'tablet';
  browser?: string;
  os?: string;
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  score?: number;
}

export interface CodingHistoryEntry {
  task: string;
  outcome: 'success' | 'failure' | 'partial';
  timestamp: number;
}

export interface BrowserContext {
  history: string[];
  lastSearchResults?: SearchResult[];
}

export interface ChatParams {
  messages: ChatMessage[];
  currentMode: string;
  modeConfigs: Record<string, ModeConfig>;
  selectedLocalModel: string;
  selectedCloudModel: string;
  selectedCloudProvider: string;
  globalProvider: 'cloud' | 'local' | 'auto';
  temperature: number;
  maxTokens: number;
  deviceInfo: DeviceInfo;
  notepadContent: string;
  openFiles?: Array<{ path: string; content: string }>;
  codingHistory?: CodingHistoryEntry[];
  browserContext?: BrowserContext;
  apiKeys: Record<string, string>;
  thinkingModeEnabled?: boolean;
  imageProvider?: string;
  activeFile?: string | null;
  sessionId?: string | null;
}

export interface ChatResponse {
  response: string;
  updatedNotepad: string | null;
  newGraphData: { nodes: unknown[]; edges: unknown[] };
  model: string;
  info?: string;
  isGeneratedImage?: boolean;
  imageUrl?: string;
  provenance?: unknown;
  traceId?: string;
}

export interface ImageGenerationOptions {
  size?: string;
  quality?: string;
  [key: string]: unknown;
}

export class ChatService {
  static async sendMessage(params: ChatParams, content: string, image: string | null = null) {
    const {
      messages, currentMode, modeConfigs, selectedCloudModel,
      selectedLocalModel, selectedCloudProvider, globalProvider,
      temperature, maxTokens, deviceInfo, notepadContent, apiKeys,
      thinkingModeEnabled, openFiles, browserContext, imageProvider,
      codingHistory, activeFile
    } = params;

    // 1. Resolve Provider and Model
    const config = modeConfigs[currentMode] || { provider: 'auto', model: selectedCloudModel };
    let provider = config.provider;
    let model = config.model;

    if (thinkingModeEnabled) {
      // Resolve the model first (same logic as non-thinking path)
      if (provider === 'auto') {
        if (globalProvider === 'local') {
          provider = 'ollama';
          model = selectedLocalModel;
        } else {
          provider = selectedCloudProvider || 'gemini';
          model = selectedCloudModel;
        }
      } else if (globalProvider === 'local' && provider !== 'ollama') {
        provider = 'ollama';
        model = selectedLocalModel;
      }
      // Only swap if the resolved model doesn't have native thinking
      if (!NATIVE_THINKING_MODELS.has(model)) {
        if (globalProvider === 'local') {
          provider = 'ollama';
          model = THINKING_MODEL_LOCAL;
        } else {
          provider = 'groq';
          model = THINKING_MODEL_CLOUD;
        }
      }
    } else if (provider === 'auto') {
      if (globalProvider === 'local') {
        provider = 'ollama';
        model = selectedLocalModel;
      } else {
        // Use the globally selected cloud provider (Gemini, Groq, etc.)
        provider = selectedCloudProvider || 'gemini';
        model = selectedCloudModel;
      }
    } else if (globalProvider === 'local' && provider !== 'ollama') {
      // Force local if requested globally, unless already local
      provider = 'ollama';
      model = selectedLocalModel;
    }

    const smartRouter = config.provider === 'auto' && provider === 'gemini' && !thinkingModeEnabled;
    const userMessage = { role: 'user', content, image };

    // 2. Puter Provider Implementation (Client-side)
    if (provider === 'puter') {
      try {
        const puterMessages = messages.map(m => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content
        }));
        puterMessages.push({ role: 'user', content });

        const response = await window.puter.ai.chat(puterMessages, { 
          model: model || 'deepseek-chat' 
        });
        
        return {
          response: typeof response === 'string' ? response : response.message?.content || response.toString(),
          updatedNotepad: null,
          newGraphData: { nodes: [], edges: [] },
          model: model || 'deepseek-chat',
          info: 'Direct Puter.js delivery'
        };
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error('[Puter] Client-side failure:', errorMessage);
        // Fallback to backend if puter fails
      }
    }

    // 3. Execute Request (Backend)
    const data = await fetchWithRetry(`${API_BASE_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider,
        model,
        messages: [...messages, userMessage],
        image,
        mode: currentMode,
        smartRouter,
        temperature: thinkingModeEnabled ? 0.3 : temperature, // Lower temperature for more focused thinking
        maxTokens,
        deviceInfo,
        notepadContent,
        openFiles,
        codingHistory,
        browserContext,
        apiKeys,
        thinkingModeEnabled,
        imageProvider,
        activeFile: activeFile || undefined,
        sessionId: params.sessionId || undefined
      }),
      retries: 3
    }) as {
      response?: string;
      model?: string;
      info?: unknown;
      isGeneratedImage?: boolean;
      imageUrl?: string;
      [key: string]: unknown;
    };

    if (!data.response) throw new Error('Invalid response from server.');

    // 3. Parse and Process Response
    let finalResponse: string = data.response;
    let updatedNotepad: string | null = null;

    const notepadMatch = finalResponse.match(/<update_notepad>([\s\S]*?)<\/update_notepad>/);
    if (notepadMatch && notepadMatch[1]) {
      updatedNotepad = notepadMatch[1].trim();
      finalResponse = finalResponse.replace(/<update_notepad>[\s\S]*?<\/update_notepad>/, '').trim();
    }

    const newGraphData = parseGraphData(data.response);

    // Prepend BASE_URL if it's a relative path for generated images
    let imageUrl = data.imageUrl;
    if (imageUrl && !imageUrl.startsWith('http')) {
      imageUrl = `${BASE_URL}${imageUrl}`;
    }

    return {
      response: finalResponse,
      updatedNotepad,
      newGraphData,
      model: data.model || model,
      info: data.info,
      isGeneratedImage: data.isGeneratedImage,
      imageUrl: imageUrl,
      provenance: data.provenance,
      traceId: data.traceId
    };
  }

  static async generateImage(prompt: string, provider?: string, apiKeys?: Record<string, string>, options: ImageGenerationOptions = {}) {
    const data = await fetchWithRetry(`${API_BASE_URL}/generate-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        provider: provider || 'gemini',
        apiKeys,
        ...options
      }),
      retries: 2
    }) as Record<string, unknown>;

    if (!data.imageUrl) {
      throw new Error(data.error as string || 'Failed to generate image');
    }

    // Prepend BASE_URL if it's a relative path
    const fullImageUrl = (data.imageUrl as string).startsWith('http') ? data.imageUrl as string : `${BASE_URL}${data.imageUrl}`;
    return fullImageUrl;
  }

  static async search(query: string, page?: number, expandedQuery?: string): Promise<SearchResultSet & { organic?: any[] }> {
    const data = await fetchWithRetry(`${API_BASE_URL}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, page, expandedQuery }),
      retries: 2
    }) as SearchResultSet & { organic?: any[] };

    return data;
  }

  static async browse(url: string): Promise<PageContent> {
    const data = await fetchWithRetry(`${API_BASE_URL}/browse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
      retries: 1
    }) as PageContent;

    return data;
  }

  static async summarizePage(content: string, instruction?: string) {
    const data = await fetchWithRetry(`${API_BASE_URL}/browse/summarize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, instruction }),
      retries: 1
    }) as Record<string, unknown>;

    return data;
  }

  static async askAboutPage(content: string, question: string) {
    const data = await fetchWithRetry(`${API_BASE_URL}/browse/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, question }),
      retries: 1
    }) as Record<string, unknown>;

    return data;
  }

  static async deprecateMemory(id: string, reason: string) {
    const data = await fetchWithRetry(`${API_BASE_URL}/memory/deprecate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, reason }),
      retries: 2
    }) as Record<string, unknown>;
    return data;
  }

  static async checkLocalImageStatus() {
    try {
      const data = await fetchWithRetry(`${API_BASE_URL}/local-image-status`) as Record<string, unknown>;
      return data;
    } catch (e: unknown) {
      return { loaded: false };
    }
  }
}
