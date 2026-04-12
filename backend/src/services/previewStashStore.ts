// backend/src/services/previewStashStore.ts
export interface ConsoleEntry {
  level: 'log' | 'warn' | 'error';
  message: string;
  timestamp: number;
}

export interface PreviewStash {
  entries: ConsoleEntry[];
  bodyHTML: string | null;
  bodyHash: string | null;
  updatedAt: number;
}

export class PreviewStashStore {
  private store = new Map<string, { data: PreviewStash; expiry: number }>();
  private pruneInterval: ReturnType<typeof setInterval>;

  constructor(private ttlMs: number = 600_000, private pruneIntervalMs: number = 60_000) {
    this.pruneInterval = setInterval(() => this.prune(), pruneIntervalMs);
    this.pruneInterval.unref(); // Don't keep process alive
  }

  set(sessionId: string, data: PreviewStash): void {
    this.store.set(sessionId, {
      data: { ...data, updatedAt: Date.now() },
      expiry: Date.now() + this.ttlMs,
    });
  }

  get(sessionId: string): PreviewStash | null {
    const entry = this.store.get(sessionId);
    if (!entry) return null;
    if (Date.now() > entry.expiry) {
      this.store.delete(sessionId);
      return null;
    }
    return entry.data;
  }

  delete(sessionId: string): void {
    this.store.delete(sessionId);
  }

  private prune(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiry) this.store.delete(key);
    }
  }

  destroy(): void {
    clearInterval(this.pruneInterval);
    this.store.clear();
  }
}

export const previewStashStore = new PreviewStashStore();
