import { logger } from '../utils/logger';

// Interface allows swapping for Redis later
export interface IStorage {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds?: number): Promise<void>;
  incr(key: string): Promise<number>;
  del(key: string): Promise<void>;
}

export class StorageService implements IStorage {
  // In-memory fallback. Circuit breaker state is lost on restart.
  // In production, replace this implementation with a Redis-backed store.
  private memory = new Map<string, { val: unknown, exp: number }>();

  constructor() {
    if (process.env.NODE_ENV === 'production') {
      console.warn('[StorageService] WARNING: Using in-memory storage in production. Circuit breaker state will not survive restarts. Configure a Redis-backed StorageService for production use.');
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const data = this.memory.get(key);
    if (!data) return null;
    if (data.exp !== 0 && Date.now() > data.exp) {
      this.memory.delete(key);
      return null;
    }
    return data.val as T;
  }

  async set(key: string, value: unknown, ttlSeconds: number = 0): Promise<void> {
    const exp = ttlSeconds === 0 ? 0 : Date.now() + (ttlSeconds * 1000);
    this.memory.set(key, { val: value, exp });
  }

  async incr(key: string): Promise<number> {
    const current = await this.get<number>(key) || 0;
    const next = current + 1;
    await this.set(key, next);
    return next;
  }
  
  async del(key: string): Promise<void> {
    this.memory.delete(key);
  }
}

export const storageService = new StorageService();