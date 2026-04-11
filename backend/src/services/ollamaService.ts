import ollama from 'ollama';
import { AIProvider, ChatMessage, CompletionOptions } from '../types/ai';
import { normalizeMessagesForOllama } from '../utils/messageUtils';
import { logger } from '../utils/logger';

const OLLAMA_TIMEOUT_MS = parseInt(process.env.OLLAMA_TIMEOUT_MS || '120000', 10);
// First embed call may cold-start the model (~90s); subsequent calls are ~4s
const OLLAMA_EMBED_COLD_TIMEOUT_MS = parseInt(process.env.OLLAMA_EMBED_COLD_TIMEOUT_MS || '120000', 10);
const OLLAMA_EMBED_WARM_TIMEOUT_MS = parseInt(process.env.OLLAMA_EMBED_WARM_TIMEOUT_MS || '30000', 10);
// Per-text budget for batch calls (CPU embedding with long code blocks — ~10-15s per text)
const OLLAMA_EMBED_PER_TEXT_MS = parseInt(process.env.OLLAMA_EMBED_PER_TEXT_MS || '15000', 10);

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
  private embedWarmedUp = false;

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
  /**
   * Truncate text to stay within nomic-embed-text's ~8192 token context.
   * Rough heuristic: 1 token ≈ 4 chars, leave margin.
   */
  private truncateForEmbedding(text: string, maxChars = 30000): string {
    return text.length > maxChars ? text.slice(0, maxChars) : text;
  }

  async embed(text: string): Promise<number[]> {
    const timeout = this.embedWarmedUp ? OLLAMA_EMBED_WARM_TIMEOUT_MS : OLLAMA_EMBED_COLD_TIMEOUT_MS;

    const truncated = this.truncateForEmbedding(text);
    const response = await withTimeout(ollama.embed({
      model: this.EMBEDDING_MODEL,
      input: truncated
    }), timeout, 'Ollama embed');

    if (!response.embeddings || response.embeddings.length === 0) {
      logger.warn('[OllamaService] Embedding returned empty array');
      return new Array(768).fill(0);
    }

    if (!this.embedWarmedUp) {
      this.embedWarmedUp = true;
      logger.info('[OllamaService] Embed model loaded and warm');
    }
    return response.embeddings[0]!;
  }

  /**
   * Batch embed multiple texts in a single Ollama API call.
   * Much faster than individual calls on CPU since the model stays loaded.
   */
  /**
   * Batch embed multiple texts via Ollama.
   * Splits into sub-batches of 5 to keep individual API calls manageable on CPU.
   */
  async batchEmbed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    const allResults: number[][] = [];
    const subBatchSize = 5;

    for (let i = 0; i < texts.length; i += subBatchSize) {
      const chunk = texts.slice(i, i + subBatchSize);
      const truncated = chunk.map(t => this.truncateForEmbedding(t));
      const baseTimeout = this.embedWarmedUp ? OLLAMA_EMBED_WARM_TIMEOUT_MS : OLLAMA_EMBED_COLD_TIMEOUT_MS;
      const timeout = baseTimeout + (chunk.length * OLLAMA_EMBED_PER_TEXT_MS);

      const response = await withTimeout(ollama.embed({
        model: this.EMBEDDING_MODEL,
        input: truncated
      }), timeout, `Ollama batchEmbed(${chunk.length})`);

      if (!response.embeddings || response.embeddings.length === 0) {
        logger.warn('[OllamaService] Sub-batch embedding returned empty');
        allResults.push(...chunk.map(() => new Array(768).fill(0)));
      } else {
        if (!this.embedWarmedUp) {
          this.embedWarmedUp = true;
          logger.info('[OllamaService] Embed model loaded and warm');
        }
        allResults.push(...response.embeddings);
      }
    }

    return allResults;
  }
}
