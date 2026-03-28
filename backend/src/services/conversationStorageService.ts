import { randomUUID } from 'node:crypto';
import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger';
import { Message } from '../types/frontend';

export interface StoredSession {
  id: string;
  mode: string;
  title: string;
  messages: StoredMessage[];
  createdAt: number;
  updatedAt: number;
  parentMessageId?: string;
  parentSessionId?: string;
  metadata: {
    modelsUsed: string[];
    messageCount: number;
    tokenEstimate: number;
    tags: string[];
  };
}

export interface StoredMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'model';
  content: string;
  model?: string;
  image?: string | null;
  thinking?: string;
  isGeneratedImage?: boolean;
  imageUrl?: string;
  timestamp: number;
}

const SESSIONS_DIR = path.resolve(__dirname, '../../../.solvent_sessions');
const INDEX_FILE = path.join(SESSIONS_DIR, 'index.json');

export class ConversationStorageService {
  constructor() {
    this.ensureStorageDirectory();
  }

  private async ensureStorageDirectory() {
    try {
      await fs.mkdir(SESSIONS_DIR, { recursive: true });
      logger.info(`[ConversationStorage] Session directory ready: ${SESSIONS_DIR}`);
    } catch (error) {
      logger.error('[ConversationStorage] Failed to create session directory', error);
    }
  }

  private getSessionFilePath(sessionId: string): string {
    if (!/^[a-zA-Z0-9_-]+$/.test(sessionId)) {
      throw new Error('Invalid session ID');
    }
    return path.join(SESSIONS_DIR, `${sessionId}.json`);
  }

  /**
   * Save a session to disk
   */
  async saveSession(session: StoredSession): Promise<void> {
    try {
      const filePath = this.getSessionFilePath(session.id);
      
      // Check for concurrent modification
      try {
        const existingData = await fs.readFile(filePath, 'utf-8');
        const existing = JSON.parse(existingData);
        if (existing.updatedAt > session.updatedAt) {
          logger.warn('[ConversationStorage] Concurrent modification detected, skipping save');
          return; // Skip save - newer version exists
        }
      } catch (e: any) {
        if (e.code !== 'ENOENT') throw e; // File doesn't exist is OK
      }
      
      await fs.writeFile(filePath, JSON.stringify(session, null, 2), 'utf-8');
      await this.updateIndex(session);
      logger.debug(`[ConversationStorage] Saved session ${session.id}`);
    } catch (error) {
      logger.error('[ConversationStorage] Failed to save session', error);
      throw error;
    }
  }

  /**
   * Load a session from disk
   */
  async loadSession(sessionId: string): Promise<StoredSession | null> {
    try {
      const filePath = this.getSessionFilePath(sessionId);
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        logger.warn(`[ConversationStorage] Session ${sessionId} not found`);
        return null;
      }
      logger.error('[ConversationStorage] Failed to load session', error);
      throw error;
    }
  }

  /**
   * List all sessions, optionally filtered by mode
   */
  async listSessions(mode?: string): Promise<StoredSession[]> {
    try {
      const indexData = await fs.readFile(INDEX_FILE, 'utf-8');
      const index: StoredSession[] = JSON.parse(indexData);
      
      if (mode) {
        return index.filter(s => s.mode === mode);
      }
      
      // Sort by updatedAt descending
      return index.sort((a, b) => b.updatedAt - a.updatedAt);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return [];
      }
      logger.error('[ConversationStorage] Failed to list sessions', error);
      throw error;
    }
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<void> {
    try {
      const filePath = this.getSessionFilePath(sessionId);
      await fs.unlink(filePath);
      await this.removeFromIndex(sessionId);
      logger.info(`[ConversationStorage] Deleted session ${sessionId}`);
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        logger.error('[ConversationStorage] Failed to delete session', error);
        throw error;
      }
    }
  }

  /**
   * Search across all sessions for a query
   */
  async searchSessions(query: string, limit: number = 20): Promise<{ session: StoredSession, match: StoredMessage }[]> {
    try {
      const sessions = await this.listSessions();
      const results: { session: StoredSession, match: StoredMessage }[] = [];
      const queryLower = query.toLowerCase();

      for (const session of sessions) {
        for (const message of session.messages) {
          if (message.content.toLowerCase().includes(queryLower)) {
            results.push({ session, match: message });
            if (results.length >= limit) {
              return results;
            }
            break; // One match per session is enough
          }
        }
      }

      return results;
    } catch (error) {
      logger.error('[ConversationStorage] Search failed', error);
      return [];
    }
  }

  /**
   * Generate a title from the first message
   */
  generateTitle(firstMessage: string): string {
    const truncated = firstMessage.slice(0, 50);
    return truncated + (firstMessage.length > 50 ? '...' : '');
  }

  /**
   * Convert frontend Message[] to StoredMessage[]
   */
  toStoredMessages(messages: Message[]): StoredMessage[] {
    return messages.map(m => ({
      id: m.id || randomUUID(),
      role: m.role,
      content: m.content,
      model: m.model,
      image: m.image,
      thinking: m.thinking,
      isGeneratedImage: m.isGeneratedImage,
      imageUrl: m.imageUrl,
      timestamp: Date.now()
    }));
  }

  /**
   * Convert StoredMessage[] to frontend Message[]
   */
  toFrontendMessages(messages: StoredMessage[]): Message[] {
    return messages.map(m => ({
      id: m.id,
      role: m.role,
      content: m.content,
      model: m.model,
      image: m.image,
      thinking: m.thinking,
      isGeneratedImage: m.isGeneratedImage,
      imageUrl: m.imageUrl
    }));
  }

  /**
   * Update the session index
   */
  private async updateIndex(session: StoredSession): Promise<void> {
    try {
      let index: StoredSession[] = [];
      try {
        const data = await fs.readFile(INDEX_FILE, 'utf-8');
        index = JSON.parse(data);
      } catch {
        // Index doesn't exist yet
      }

      const existingIndex = index.findIndex(s => s.id === session.id);
      if (existingIndex >= 0) {
        index[existingIndex] = session;
      } else {
        index.push(session);
      }

      await fs.writeFile(INDEX_FILE, JSON.stringify(index, null, 2), 'utf-8');
    } catch (error) {
      logger.error('[ConversationStorage] Index update failed', error);
    }
  }

  /**
   * Remove a session from the index
   */
  private async removeFromIndex(sessionId: string): Promise<void> {
    try {
      const data = await fs.readFile(INDEX_FILE, 'utf-8');
      const index: StoredSession[] = JSON.parse(data);
      const filtered = index.filter(s => s.id !== sessionId);
      await fs.writeFile(INDEX_FILE, JSON.stringify(filtered, null, 2), 'utf-8');
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        logger.error('[ConversationStorage] Index removal failed', error);
      }
    }
  }
}
