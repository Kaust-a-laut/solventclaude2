export interface IStorageProvider {
  get(key: string): Promise<any | null>;
  set(key: string, value: any, ttl?: number): Promise<void>;
  saveTrace(data: any): Promise<string>;
}

import fs from 'fs/promises';
import path from 'path';
import { randomBytes } from 'node:crypto';

export class FileStorageProvider implements IStorageProvider {
  private baseDir: string;
  private cacheDir: string;
  private tracesDir: string;

  constructor() {
    this.baseDir = path.join(process.cwd(), '.solvent');
    this.cacheDir = path.join(this.baseDir, 'cache');
    this.tracesDir = path.join(this.baseDir, 'traces');
    this.init();
  }

  private async init() {
    await fs.mkdir(this.cacheDir, { recursive: true });
    await fs.mkdir(this.tracesDir, { recursive: true });
  }

  async get(key: string): Promise<any | null> {
    const cachePath = path.join(this.cacheDir, `${key}.json`);
    try {
      const data = await fs.readFile(cachePath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  async set(key: string, value: any): Promise<void> {
    const cachePath = path.join(this.cacheDir, `${key}.json`);
    await fs.writeFile(cachePath, JSON.stringify(value, null, 2));
  }

  async saveTrace(data: any): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const traceId = `trace-${timestamp}-${randomBytes(4).toString('hex')}`;
    const tracePath = path.join(this.tracesDir, `${traceId}.json`);
    await fs.writeFile(tracePath, JSON.stringify({
        id: traceId,
        timestamp: new Date().toISOString(),
        ...data
    }, null, 2));
    return traceId;
  }
}
