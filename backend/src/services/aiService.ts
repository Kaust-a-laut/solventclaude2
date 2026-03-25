import { AIProviderFactory } from './aiProviderFactory';
import { WaterfallService, WaterfallStep } from './waterfallService';
import { contextService } from './contextService';
import { ChatRequestData, ChatMessage, CompletionOptions } from '../types/ai';
import { randomUUID as uuidv4 } from 'crypto';
import path from 'path';
import fs from 'fs/promises';
import { SolventError } from '../utils/errors';
import { searchService } from './searchService';
import { vectorService } from './vectorService';
import { pollinationsService } from './pollinationsService';
import { localImageService } from './localImageService';
import { huggingFaceService } from './huggingFaceService';
import { falService } from './falService';
import { memoryConsolidationService } from './memoryConsolidationService';
import { logger } from '../utils/logger';
import { config, APP_CONSTANTS } from '../config';
import { MODELS } from '../constants/models';
import type { WaterfallModelSelection } from '../constants/models';
import { telemetryService } from './telemetryService';
import { supervisorService } from './supervisorService';
import type { AgentEvent } from '../types/agentEvents';
import { BaseOpenAIService } from './baseOpenAIService';
import { normalizeMessages } from '../utils/messageUtils';
import { fitConversation } from '../utils/conversationWindow';
import { getContextBudget } from '../utils/tokenEstimator';

// --- Named Constants ---

/**
 * Keywords that indicate image generation intent
 */
const IMAGE_INTENT_KEYWORDS = [
  'generate an image', 'create an image', 'draw', 'paint', 'make a picture',
  'show me a picture', 'generate a picture', 'imagine', 'visualize',
  'generate image', 'make image', 'render', 'create image'
];

/**
 * Regex pattern for explicit image generation intent at start of message
 */
const EXPLICIT_IMAGE_INTENT_REGEX = /^(?:(draw|imagine|visualize)\b|(generate|make|create|render)\b.{0,60}\b(image|picture|photo|art|illustration|graphic|sketch|painting)\b)/i;

/**
 * Regex pattern for removing image intent phrases from prompt
 */
const IMAGE_INTENT_CLEANUP_REGEX = /generate an image of|create an image of|draw|paint|make a picture of|show me a picture of|generate a picture of|create a picture of|imagine|render|visualize|generate image of|make image of|generate|draw|make|create|please|can you|could you|i want you to|i'd like you to/gi;

/**
 * Regex pattern for detecting code-related requests in vision mode
 */
const CODE_REQUEST_REGEX = /code|build|implement|create|react|html|css|component/i;

/**
 * Gemini model fallback chain
 */
const GEMINI_MODEL_CHAIN = ['gemini-3.1-pro-preview', 'gemini-3.1-flash-lite-preview', 'gemini-3-flash-preview', 'gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'];

// --- Types ---

interface ImageIntentResult {
  isImageRequest: boolean;
  imagePrompt: string;
}

interface CompletionResponse {
  response: string;
  model: string;
  info?: string;
  waterfall?: any;
  provenance?: any;
  isGeneratedImage?: boolean;
  imageUrl?: string;
}

interface EnrichedContextResult {
  messages: ChatMessage[];
  provenance: any;
}

// --- AIService Class ---

export class AIService {
  private waterfallService = new WaterfallService();

  async performSearch(query: string, page?: number) {
    return searchService.webSearch(query, page);
  }

  async runWaterfallStep(step: WaterfallStep, input: string, context: unknown, globalProvider?: string) {
    return this.waterfallService.runStep(step, input, context, globalProvider);
  }

  async processChat(data: ChatRequestData): Promise<CompletionResponse> {
    const startTime = Date.now();
    const { provider, model, image, mode, smartRouter, fallbackModel, temperature, maxTokens, apiKeys, thinkingModeEnabled, imageProvider } = data;

    try {
      const lastUserMessage = data.messages[data.messages.length - 1]?.content || "";

      // --- GUARDIAN ANGEL HOOK (Proactive Value) ---
      const contextFocus = `${lastUserMessage} ${data.openFiles ? data.openFiles.map(f => f.path).join(', ') : ''}`;
      supervisorService.provideGuidance(contextFocus).catch(err => {
        logger.warn(`[AIService] Guardian Angel check failed: ${err.message}`);
      });
      // ---------------------------------------------

      // 1. Detect Image Intent
      const imageIntent = this.detectImageIntent(lastUserMessage, mode);
      if (imageIntent.isImageRequest) {
        return this.handleImageRequest(imageIntent.imagePrompt, imageProvider, apiKeys, startTime);
      }

      logger.info(`Processing chat request with provider: ${provider}, model: ${model}`);

      // 2. Enrich Context
      const { messages: enrichedMessages, provenance } = await this.enrichContext(data);
      const normalizedMessages = normalizeMessages(enrichedMessages);

      // 2.5. Fit conversation to token budget (sliding window with summarization)
      const contextBudget = getContextBudget(model, maxTokens || 2048);
      const { messages: windowedMessages, wasTruncated } = await fitConversation(
        normalizedMessages, contextBudget.history
      );
      if (wasTruncated) {
        logger.info(`[AIService] Conversation windowed: ${normalizedMessages.length} -> ${windowedMessages.length} messages`);
      }

      // 3. Inject Thinking Instructions
      const finalMessages = this.injectThinkingMode(windowedMessages, thinkingModeEnabled);

      // 4. Execute Completion
      let responseData: CompletionResponse;
      if (provider === 'gemini') {
        responseData = await this.executeGeminiCompletion(
          finalMessages, model, image, mode, smartRouter !== false, fallbackModel,
          temperature, maxTokens, apiKeys, data.openFiles
        );
      } else {
        responseData = await this.executeProviderCompletion(
          provider, finalMessages, model, temperature, maxTokens, apiKeys,
          fallbackModel, mode, data
        );
      }

      // 5. Attach Provenance
      responseData = this.attachProvenance(responseData, provenance);

      // 6. Consolidate Memory (fire-and-forget)
      this.consolidateMemory(mode, data.messages, responseData);

      // 7. Log Telemetry
      telemetryService.logTransaction({
        id: uuidv4(),
        type: 'chat',
        model: responseData.model || model,
        provider: provider,
        latencyMs: Date.now() - startTime,
        tokensOut: responseData.response?.length ? Math.ceil(responseData.response.length / 4) : 0,
        status: 'success'
      });

      return responseData;

    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      telemetryService.logTransaction({
        id: uuidv4(),
        type: 'chat',
        model: model,
        provider: provider,
        latencyMs: Date.now() - startTime,
        status: 'error',
        error: err.message
      });
      throw error;
    }
  }

  /**
   * Agent chat: uses the event-emitting tool loop so the frontend
   * can display real-time tool activity via SSE.
   */
  async processAgentChat(
    data: ChatRequestData,
    onEvent: (event: AgentEvent) => void
  ): Promise<string> {
    const { provider, model, temperature, maxTokens, apiKeys } = data;

    logger.info(`[AIService] Processing agent chat with provider: ${provider}, model: ${model}`);

    // Enrich context (same as processChat)
    const { messages: enrichedMessages } = await this.enrichContext(data);
    const normalizedMessages = normalizeMessages(enrichedMessages);
    const finalMessages = this.injectThinkingMode(normalizedMessages, data.thinkingModeEnabled);

    // Get the provider instance — must support generateChatCompletionWithEvents
    const selectedProvider = await AIProviderFactory.getProvider(provider);

    if (selectedProvider instanceof BaseOpenAIService) {
      return selectedProvider.generateChatCompletionWithEvents(
        finalMessages,
        {
          model: model || selectedProvider.defaultModel,
          temperature,
          maxTokens,
          apiKey: apiKeys?.[provider],
        },
        onEvent
      );
    }

    // Fallback: provider doesn't support events (e.g., Gemini) — use normal completion
    const response = await selectedProvider.complete(finalMessages, {
      model,
      temperature,
      maxTokens,
      apiKey: apiKeys?.[provider],
    });
    onEvent({ type: 'text_complete', content: response });
    return response;
  }

  // --- Decomposed Methods ---

  /**
   * Detects if the user message has image generation intent.
   * Public so the /api/detect-intent route can call it directly,
   * keeping the regex logic in one place.
   */
  detectImageIntent(message: string, mode?: string): ImageIntentResult {
    const isExplicitIntent = EXPLICIT_IMAGE_INTENT_REGEX.test(
      message.trim().replace(/^(please|can you|could you|i want to|i need to|i'd like to)\s+/i, '')
    );
    const isImageIntent = IMAGE_INTENT_KEYWORDS.some(k => message.toLowerCase().includes(k)) ||
                         /\b(draw|generate|imagine|render|visualize|make|create)\b.*\b(image|picture|photo|graphic|art|sketch)\b/i.test(message) ||
                         isExplicitIntent;

    if (isImageIntent && (mode === 'vision' || isExplicitIntent)) {
      const cleanedPrompt = message.replace(IMAGE_INTENT_CLEANUP_REGEX, '').trim() || message;
      return { isImageRequest: true, imagePrompt: cleanedPrompt };
    }

    return { isImageRequest: false, imagePrompt: '' };
  }

  /**
   * Handles image generation requests.
   */
  private async handleImageRequest(
    prompt: string,
    imageProvider: string | undefined,
    apiKeys: Record<string, string> | undefined,
    startTime: number
  ): Promise<CompletionResponse> {
    logger.info(`[AIService] Image intent detected: "${prompt}"`);
    
    try {
      const result = await this.generateImage(prompt, undefined, apiKeys?.gemini, imageProvider || 'auto', { apiKeys });

      telemetryService.logTransaction({
        id: uuidv4(),
        type: 'image',
        model: imageProvider || 'auto',
        provider: imageProvider || 'auto',
        latencyMs: Date.now() - startTime,
        status: 'success'
      });

      return {
        response: `I've generated the image for you: "${prompt}"`,
        model: imageProvider === 'huggingface' ? 'Hugging Face' : imageProvider === 'local' ? 'Local Juggernaut' : 'Image Router',
        isGeneratedImage: true,
        imageUrl: result.imageUrl
      };
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error(`[AIService] Inline image generation failed: ${error.message}`);
      throw SolventError.provider(`Image generation failed: ${error.message}`);
    }
  }

  /**
   * Enriches messages with context from vector memory.
   */
  private async enrichContext(data: ChatRequestData): Promise<EnrichedContextResult> {
    return contextService.enrichContext(data);
  }

  /**
   * Injects thinking mode instructions if enabled.
   */
  private injectThinkingMode(messages: ChatMessage[], thinkingModeEnabled?: boolean): ChatMessage[] {
    if (!thinkingModeEnabled) return messages;

    const thinkingInstruction: ChatMessage = {
      role: 'system',
      content: `[DEEP THINKING MODE ACTIVE]
You MUST perform structured reasoning inside <thinking> tags BEFORE providing your final answer.

Follow this framework:
1. **Problem Decomposition** — Break the request into discrete sub-problems. Identify what is being asked vs. what is implied.
2. **Constraint Identification** — Check project rules, open files, memory entries, and technical limitations that bound the solution space.
3. **Hypothesis Generation** — Propose 2-3 candidate approaches. State each in one sentence.
4. **Evaluation** — For each approach, identify strengths, risks, and trade-offs. Select the best fit.
5. **Execution Plan** — Outline the specific steps you will take before writing the final answer.

After </thinking>, deliver the answer cleanly without restating the reasoning.`
    };
    return [thinkingInstruction, ...messages];
  }

  /**
   * Executes completion using Gemini provider.
   */
  private async executeGeminiCompletion(
    messages: ChatMessage[],
    model: string,
    image: any,
    mode: string | undefined,
    shouldSearch: boolean,
    fallbackModel: any,
    temp: number | undefined,
    maxTokens: number | undefined,
    apiKeys?: Record<string, string>,
    openFiles?: any[]
  ): Promise<CompletionResponse> {
    const modelChain = GEMINI_MODEL_CHAIN.includes(model)
      ? [model, ...GEMINI_MODEL_CHAIN.filter(m => m !== model)]
      : [model, ...GEMINI_MODEL_CHAIN];
    
    const gemini = await AIProviderFactory.getProvider('gemini');

    try {
      const hasImage = image || messages.some(m => m.image);
      if (hasImage) {
        return this.handleVisionRequest(messages, image, model, temp, maxTokens, apiKeys?.gemini, openFiles);
      }

      for (const currentModel of modelChain) {
        try {
          const response = await gemini.complete(messages, {
            model: currentModel,
            shouldSearch,
            temperature: temp,
            maxTokens,
            apiKey: apiKeys?.gemini
          });
          return { response, model: currentModel };
        } catch (err: unknown) {
          logger.warn(`Gemini ${currentModel} failed, trying next...`);
        }
      }
      throw new Error('Gemini chain exhausted.');
    } catch (e: unknown) {
      const error = e instanceof Error ? e : new Error(String(e));
      return this.handleFallbacks(messages, mode, fallbackModel, temp, maxTokens, error, apiKeys, 'gemini');
    }
  }

  /**
   * Executes completion using a non-Gemini provider with fallback support.
   */
  private async executeProviderCompletion(
    provider: string,
    messages: ChatMessage[],
    model: string,
    temp: number | undefined,
    maxTokens: number | undefined,
    apiKeys: Record<string, string> | undefined,
    fallbackModel: any,
    mode: string | undefined,
    data: ChatRequestData
  ): Promise<CompletionResponse> {
    try {
      const selectedProvider = await AIProviderFactory.getProvider(provider);
      const response = await selectedProvider.complete(messages, {
        model,
        temperature: temp,
        maxTokens,
        apiKey: apiKeys?.[provider]
      });
      return { response, model };
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.warn(`${provider} failed, initiating fallback: ${err.message}`);
      return this.handleFallbacks(messages, mode, fallbackModel, temp, maxTokens, err, apiKeys, provider);
    }
  }

  /**
   * Attaches provenance information to the response.
   */
  private attachProvenance(response: CompletionResponse, provenance: any): CompletionResponse {
    return { ...response, provenance };
  }

  /**
   * Consolidates memory from the conversation (fire-and-forget).
   */
  private consolidateMemory(
    mode: string | undefined,
    messages: ChatMessage[],
    response: CompletionResponse
  ): void {
    if (!mode || !response.response) return;

    const allMessages = [...messages, { role: 'assistant', content: response.response }];
    // Use scheduled consolidation for reliable retry via BullMQ
    memoryConsolidationService.scheduleConsolidation(mode, allMessages as any);
    memoryConsolidationService.scheduleKnowledgeExtraction(response.response);
  }

  // --- Existing Helper Methods (unchanged) ---

  private async handleVisionRequest(messages: ChatMessage[], image: string | null, model: string, temp: number = 0.7, maxTokens: number = 2048, apiKey?: string, openFiles?: Array<{ path: string; content: string }>) {
    const gemini = await AIProviderFactory.getProvider('gemini');
    try {
      const targetImage = image || messages.find(m => m.image)?.image;
      if (!targetImage) throw SolventError.validation('No image for vision mode.');
      const matches = targetImage.match(/^data:(.+);base64,(.+)$/);
      if (!matches) throw SolventError.validation('Invalid image format.');

      const lastMessage = messages[messages.length - 1].content;
      const isCodeRequest = CODE_REQUEST_REGEX.test(lastMessage);

      const response = await gemini.vision!(
        lastMessage,
        [{ data: matches[2], mimeType: matches[1] }],
        {
          model,
          temperature: temp,
          maxTokens,
          apiKey
        }
      );

      if (isCodeRequest) {
        logger.info("[AIService] Vision-to-Code bridge triggered.");
        const waterfallResult = await this.runAgenticWaterfall(`Convert this UI analysis into production code: ${response}`, undefined, APP_CONSTANTS.WATERFALL.MAX_RETRIES, undefined, undefined, openFiles);
        return {
          response: `### Vision Analysis\n${response}\n\n### Generated Implementation\n${waterfallResult.executor.code}`,
          model,
          waterfall: waterfallResult
        };
      }

      return { response, model };
    } catch (error: unknown) {
      if (error instanceof SolventError) throw error;
      const err = error instanceof Error ? error : new Error(String(error));
      throw SolventError.provider(`Vision failed: ${err.message}`);
    }
  }

  private async handleFallbacks(messages: ChatMessage[], mode: string = 'chat', fallbackModel: string = '', temp: number = 0.7, maxTokens: number = 2048, originalError: Error = new Error('Unknown'), apiKeys?: Record<string, string>, failedProvider?: string) {
    // Normalize messages to ensure compatible roles across providers
    const normalizedMessages = messages.map(m => ({
      ...m,
      role: m.role === 'model' ? 'assistant' : m.role
    }));

    if (failedProvider !== 'groq') {
      try {
        const groq = await AIProviderFactory.getProvider('groq');
        const res = await groq.complete(normalizedMessages, { model: 'llama-3.3-70b-versatile', temperature: temp, maxTokens, apiKey: apiKeys?.groq });
        return { response: res, model: 'llama-3.3-70b-versatile', info: 'Groq fallback' };
      } catch (e: unknown) {
        logger.warn('[Fallback] Groq failed', e instanceof Error ? e.message : e);
      }
    }

    if (failedProvider !== 'openrouter') {
      try {
        const openRouter = await AIProviderFactory.getProvider('openrouter');
        const res = await openRouter.complete(normalizedMessages, { model: 'google/gemini-2.0-flash-001:free', temperature: temp, maxTokens, apiKey: apiKeys?.openrouter });
        return { response: res, model: 'openrouter/gemini', info: 'OpenRouter fallback' };
      } catch (e: unknown) {
        logger.warn('[Fallback] OpenRouter failed', e instanceof Error ? e.message : e);
      }
    }

    try {
      const ollama = await AIProviderFactory.getProvider('ollama');
      const res = await ollama.complete(normalizedMessages, { model: 'qwen2.5-coder:7b', temperature: temp, maxTokens, apiKey: apiKeys?.ollama });
      return { response: res, model: 'local/ollama', info: 'Local fallback' };
    } catch (e: unknown) {
       const msg = e instanceof Error ? e.message : String(e);
       throw SolventError.provider(`All providers failed. Last: ${msg}`);
    }
  }

  async generateImage(prompt: string, model?: string, apiKey?: string, provider: string = 'auto', options: any = {}) {
    let targetProvider = provider;
    if (provider === 'auto') {
      targetProvider = (config.HUGGINGFACE_API_KEY || options.apiKeys?.huggingface) ? 'huggingface' : 'pollinations';
    }

    if (targetProvider === 'local') {
      const result = await localImageService.generateImage(prompt, { model, ...options });
      return this.saveImage(result.base64);
    }

    if (targetProvider === 'huggingface') {
      const hfKey = options.apiKeys?.huggingface || config.HUGGINGFACE_API_KEY;
      if (!hfKey) throw SolventError.validation('Hugging Face API Token missing');
      const result = await huggingFaceService.generateImage(prompt, hfKey, model);
      return this.saveImage(result.base64, 'Hugging Face');
    }

    if (targetProvider === 'fal') {
      const falKey = options.apiKeys?.fal || config.FAL_API_KEY;
      if (!falKey) throw SolventError.validation('FAL.ai API key missing — add FAL_API_KEY to .env');
      const result = await falService.generateImage(prompt, falKey);
      return this.saveImage(result.base64, 'FAL.ai');
    }

    try {
      const result = await pollinationsService.generateImage(prompt);
      return this.saveImage(result.base64, 'Pollinations.ai');
    } catch (pollError: any) {
      throw SolventError.provider('All image providers failed.');
    }
  }

  private async saveImage(base64: string, info?: string) {
    const fileName = `generated_${uuidv4()}.png`;
    const dir = path.join(__dirname, '../../generated_images');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, fileName), Buffer.from(base64, 'base64'));
    return { imageUrl: `/generated_images/${fileName}`, fileName, info };
  }

  async listAvailableModels() {
    const providers = await AIProviderFactory.getAllProviders();
    const models: Record<string, string[]> = {};

    for (const provider of providers) {
      if (provider.id === 'openrouter') {
        models[provider.id] = MODELS.OPENROUTER_FREE;
      } else if (provider.id === 'groq') {
        models[provider.id] = MODELS.GROQ_MODELS;
      } else {
        models[provider.id] = [provider.defaultModel || 'default-model'];
      }
    }

    return models;
  }

  async runAgenticWaterfall(prompt: string, globalProvider?: string, maxRetries: number = APP_CONSTANTS.WATERFALL.MAX_RETRIES, onProgress?: (phase: string, data?: any) => void, notepadContent?: string, openFiles?: any[], signal?: AbortSignal, forceProceed: boolean = false, resumeArchitect?: any, modelSelection?: WaterfallModelSelection) {
    return this.waterfallService.runAgenticWaterfall(prompt, globalProvider, maxRetries, onProgress, notepadContent, openFiles, signal, forceProceed, resumeArchitect, modelSelection);
  }

  async runWaterfall(prompt: string, globalProvider?: string, signal?: AbortSignal) {
    return this.runAgenticWaterfall(prompt, globalProvider, undefined, undefined, undefined, undefined, signal);
  }

  async compareModels(
    messages: ChatMessage[],
    opts: { model1?: string; provider1?: string; model2?: string; provider2?: string } = {},
  ) {
    const p1Name = opts.provider1 || 'gemini';
    const p2Name = opts.provider2 || 'ollama';
    const m1 = opts.model1 || undefined;
    const m2 = opts.model2 || undefined;

    const runOne = async (providerName: string, modelOverride: string | undefined): Promise<string> => {
      const provider = await AIProviderFactory.getProvider(providerName);
      const model = modelOverride || provider.defaultModel || 'default';
      return provider.complete(messages, { model });
    };

    const [r1, r2] = await Promise.allSettled([
      runOne(p1Name, m1),
      runOne(p2Name, m2),
    ]);

    return {
      model1: r1.status === 'fulfilled' ? r1.value : `Error: ${r1.reason?.message || r1.reason}`,
      model2: r2.status === 'fulfilled' ? r2.value : `Error: ${r2.reason?.message || r2.reason}`,
    };
  }

  async indexProject() {
    return vectorService.indexProject(process.cwd());
  }

  async deprecateMemory(id: string, reason: string) {
    return vectorService.deprecateEntry(id, reason);
  }

  async checkLocalImageStatus() {
    return localImageService.checkModelAvailability();
  }

  async checkHealth() {
    const providers = await AIProviderFactory.getAllProviders();
    const health: Record<string, any> = {};

    for (const provider of providers) {
      health[provider.id] = provider.isReady() ? 'connected' : 'disconnected';
    }

    health.ollama = await this.checkOllamaHealth();

    return {
      ...health,
      timestamp: new Date().toISOString()
    };
  }

  async getSessionContext() {
    try {
      const recent = await vectorService.getRecentEntries(20);
      const consolidation = recent
        .filter(m => m.metadata.type === 'memory_consolidation' || m.metadata.type === 'meta_summary')
        .pop();

      return consolidation ? consolidation.metadata.text : null;
    } catch (e) {
      return null;
    }
  }

  private async checkOllamaHealth(): Promise<'connected' | 'disconnected'> {
    try {
      const response = await fetch(`${config.OLLAMA_HOST}/api/version`);
      return response.ok ? 'connected' : 'disconnected';
    } catch (e) {
      return 'disconnected';
    }
  }
}

export const aiService = new AIService();
