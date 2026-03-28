import ollama from 'ollama';
import { AIProvider, ChatMessage, CompletionOptions } from '../types/ai';
import { normalizeMessagesForOllama } from '../utils/messageUtils';
import { logger } from '../utils/logger';

const OLLAMA_TIMEOUT_MS = parseInt(process.env.OLLAMA_TIMEOUT_MS || '120000', 10);

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      val => { clearTimeout(timer); resolve(val); },
      err => { clearTimeout(timer); reject(err); }
    );
  });
}

export class OllamaService implements AIProvider {
  readonly name = 'ollama';

  private readonly EMBEDDING_MODEL = 'nomic-embed-text';

  async generateChatCompletion(messages: ChatMessage[], options: CompletionOptions): Promise<string> {
    const normalizedMessages = normalizeMessagesForOllama(messages);

    const response = await withTimeout(ollama.chat({
      model: options.model,
      messages: normalizedMessages,
      stream: false,
      options: {
        temperature: options.temperature,
        num_predict: options.maxTokens
      }
    }), OLLAMA_TIMEOUT_MS, 'Ollama chat');
    return response.message.content;
  }

  async listModels() {
    return await ollama.list();
  }

  async *generateChatStream(messages: ChatMessage[], options: CompletionOptions): AsyncGenerator<string> {
    const normalizedMessages = normalizeMessagesForOllama(messages);

    const response = await withTimeout(ollama.chat({
      model: options.model,
      messages: normalizedMessages,
      stream: true,
      options: {
        temperature: options.temperature,
        num_predict: options.maxTokens
      }
    }), OLLAMA_TIMEOUT_MS, 'Ollama stream');

    for await (const part of response) {
      yield part.message.content;
    }
  }

  /**
   * Generate embeddings using Ollama's nomic-embed-text model
   * Fallback when Gemini embeddings are unavailable
   */
  async embed(text: string): Promise<number[]> {
    try {
      const response = await withTimeout(ollama.embed({
        model: this.EMBEDDING_MODEL,
        input: text
      }), OLLAMA_TIMEOUT_MS, 'Ollama embed');
      
      if (!response.embeddings || response.embeddings.length === 0) {
        logger.warn('[OllamaService] Embedding returned empty array');
        return new Array(768).fill(0);
      }

      return response.embeddings[0]!;
    } catch (error) {
      logger.error('[OllamaService] Embedding generation failed:', error);
      throw error; // Re-throw to allow fallback chain to continue
    }
  }
}
