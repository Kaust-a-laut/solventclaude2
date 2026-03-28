import { readFileSync, existsSync } from 'fs';
import { writeFile } from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger';

interface CoreEntry {
  key: string;
  value: string;
  updatedAt: string;
}

export interface CoreMemoryOptions {
  maxSlots?: number;
}

const DEFAULT_KEY_LIMITS: Record<string, number> = {
  user_name: 100,
  user_email: 200,
  project_name: 200,
  project_context: 2000,
  active_goals: 1500,
  tech_stack: 1000,
  default: 500
};

const DATA_DIR = path.resolve(__dirname, '../..');
const SESSION_ID_REGEX = /^[a-zA-Z0-9\-_]+$/;

export class CoreMemory {
  private entries: Map<string, CoreEntry> = new Map();
  private pendingSave: Promise<void> = Promise.resolve();

  constructor(
    private readonly filePath: string,
    private readonly maxSlots: number = 50,
    private readonly keyLimits: Record<string, number> = DEFAULT_KEY_LIMITS
  ) {
    this.load();
  }

  get(key: string): string | undefined {
    return this.entries.get(key)?.value;
  }

  set(key: string, value: string): void {
    if (!this.entries.has(key) && this.entries.size >= this.maxSlots) {
      throw new Error('Core memory full — delete an entry before adding a new one');
    }

    const limit = this.keyLimits[key] ?? this.keyLimits['default']!;
    if (value.length > limit) {
      throw new Error(`Value exceeds max length ${limit} for key "${key}". Consider storing details in vector memory instead.`);
    }

    this.entries.set(key, {
      key,
      value,
      updatedAt: new Date().toISOString()
    });
    this.save();
  }

  delete(key: string): boolean {
    const deleted = this.entries.delete(key);
    if (deleted) this.save();
    return deleted;
  }

  getAll(): CoreEntry[] {
    return Array.from(this.entries.values());
  }

  toContextBlock(): string {
    if (this.entries.size === 0) return '';
    const lines = Array.from(this.entries.values())
      .map(e => `${e.key}: ${e.value}`)
      .join('\n');
    return lines;
  }

  save(): void {
    const data = Array.from(this.entries.values());
    this.pendingSave = writeFile(this.filePath, JSON.stringify(data, null, 2))
      .catch((err: unknown) => {
        logger.error('[CoreMemory] Failed to save:', err instanceof Error ? err.message : String(err));
      });
  }

  async flush(): Promise<void> {
    await this.pendingSave;
  }

  private load(): void {
    try {
      if (existsSync(this.filePath)) {
        const raw = readFileSync(this.filePath, 'utf-8');
        const data: CoreEntry[] = JSON.parse(raw);
        for (const entry of data) {
          this.entries.set(entry.key, entry);
        }
      }
    } catch (err: unknown) {
      logger.warn('[CoreMemory] Failed to load, starting fresh:', err instanceof Error ? err.message : String(err));
    }
  }
}

export class CoreMemoryFactory {
  static createForSession(sessionId: string, options?: CoreMemoryOptions): CoreMemory {
    if (!SESSION_ID_REGEX.test(sessionId)) {
      throw new Error(`Invalid sessionId: "${sessionId}". Only alphanumeric characters, hyphens, and underscores are allowed.`);
    }
    const filePath = path.join(DATA_DIR, `.solvent_core_memory_${sessionId}.json`);
    return new CoreMemory(filePath, options?.maxSlots ?? 50);
  }

  static createGlobal(options?: CoreMemoryOptions): CoreMemory {
    const filePath = path.join(DATA_DIR, '.solvent_core_memory.json');
    return new CoreMemory(filePath, options?.maxSlots ?? 50);
  }
}

export const coreMemory = CoreMemoryFactory.createGlobal({ maxSlots: 50 });
