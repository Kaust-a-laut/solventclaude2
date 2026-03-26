import { IProviderPlugin } from '../../types/plugins';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../../config';
import { ChatMessage, CompletionOptions } from '../../types/ai';

export class GeminiProviderPlugin implements IProviderPlugin {
  id = 'gemini';
  name = 'Google Gemini';
  description = 'Google\'s Gemini AI provider';
  version = '1.0.0';
  defaultModel = 'gemini-1.5-flash';
  capabilities = {
    supportsVision: true,
    supportsStreaming: true,
    supportsEmbeddings: true,
    contextWindow: 1000000,  // Gemini 1.5 Pro
    maxOutputTokens: 8192,
    supportsFunctionCalling: true,
    costPer1k: { input: 0.075, output: 0.30 } // Prices in USD per 1000 tokens
  };

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.genAI) return false;

      // Perform a minimal API call to check health
      const model = this.genAI.getGenerativeModel({ model: this.defaultModel || 'gemini-1.5-flash' });
      const result = await model.generateContent('Hello');
      return !!result.response.text();
    } catch (error) {
      console.error(`[Gemini] Health check failed:`, error);
      return false;
    }
  }

  async getHealth(): Promise<import('../../types/plugins').ProviderHealth> {
    const startTime = Date.now();
    const isHealthy = await this.healthCheck();
    const latency = Date.now() - startTime;

    // In a real implementation, we'd track error rates over time
    const errorRate = 0; // Placeholder

    return {
      isHealthy,
      lastChecked: Date.now(),
      latency,
      errorRate
    };
  }

  private genAI: GoogleGenerativeAI | null = null;
  private isInitialized = false;

  async initialize(options: Record<string, any>): Promise<void> {
    const apiKey = options.apiKey || config.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Gemini API Key missing. Please provide it in settings or .env file.');
    }
    
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.isInitialized = true;
  }

  isReady(): boolean {
    return this.isInitialized && !!this.genAI;
  }

  async complete(messages: ChatMessage[], options: CompletionOptions): Promise<string> {
    if (!this.genAI) {
      throw new Error('Gemini provider not initialized');
    }

    const { model, temperature = 0.7, maxTokens = 2048, apiKey, jsonMode } = options;
    const effectiveApiKey = apiKey || config.GEMINI_API_KEY;

    // Use a local client to avoid mutating this.genAI under concurrency
    const genAI = effectiveApiKey ? new GoogleGenerativeAI(effectiveApiKey) : this.genAI!;

    const modelInstance = genAI.getGenerativeModel({
      model: model || this.defaultModel,
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
        ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
      }
    });

    const history = messages.slice(0, -1).map(m => ({
      role: (m.role === 'user' || m.role === 'system') ? 'user' : 'model',
      parts: [{ text: m.content }]
    }));

    const chat = modelInstance.startChat({ history });
    const lastMessage = messages[messages.length - 1].content;
    const result = await chat.sendMessage(lastMessage);
    const response = await result.response;
    const text = response.text();
    if (!text || text.length === 0) {
      throw new Error(`Gemini returned empty response for model ${model || this.defaultModel}`);
    }
    return text;
  }

  async *stream(messages: ChatMessage[], options: CompletionOptions): AsyncGenerator<string> {
    if (!this.genAI) {
      throw new Error('Gemini provider not initialized');
    }

    const { model, temperature = 0.7, maxTokens = 2048 } = options;

    const modelInstance = this.genAI.getGenerativeModel({
      model: model || this.defaultModel,
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
      }
    });

    const history = messages.slice(0, -1).map(m => ({
      role: (m.role === 'user' || m.role === 'system') ? 'user' : 'model',
      parts: [{ text: m.content }]
    }));

    const chat = modelInstance.startChat({ history });
    const lastMessage = messages[messages.length - 1].content;
    const result = await chat.sendMessageStream(lastMessage);

    for await (const chunk of result.stream) {
      yield chunk.text();
    }
  }

  async vision(
    prompt: string,
    images: { data: string; mimeType: string }[],
    options?: CompletionOptions
  ): Promise<string> {
    if (!this.genAI) {
      throw new Error('Gemini provider not initialized');
    }

    const { model, temperature = 0.7, maxTokens = 2048, apiKey } = options || {};
    const effectiveApiKey = apiKey || config.GEMINI_API_KEY;

    // Use a local client to avoid mutating this.genAI under concurrency
    const genAI = effectiveApiKey ? new GoogleGenerativeAI(effectiveApiKey) : this.genAI!;

    const modelInstance = genAI.getGenerativeModel({
      model: model || 'gemini-3-flash-preview',
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
      }
    });

    const imageParts = images.map(img => ({
      inlineData: {
        data: img.data,
        mimeType: img.mimeType
      }
    }));

    const result = await modelInstance.generateContent([prompt, ...imageParts]);
    const response = await result.response;
    return response.text();
  }

  async embed(text: string): Promise<number[]> {
    if (!this.genAI) {
      throw new Error('Gemini provider not initialized');
    }

    const model = this.genAI.getGenerativeModel({ model: "text-embedding-004" });
    const result = await model.embedContent(text);
    return result.embedding.values;
  }
}

// Export as default for dynamic loading
export default GeminiProviderPlugin;