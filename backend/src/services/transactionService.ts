import fs from 'fs/promises';
import path from 'path';
import { PROJECT_ROOT } from '../utils/fileSystem';
import { logger } from '../utils/logger';

interface TransactionLogEntry {
  id: string;
  timestamp: string;
  tool: string;
  args: Record<string, unknown>;
  status: 'pending' | 'success' | 'failed' | 'denied';
  result?: unknown;
  error?: string;
  cycleId?: string;
}

export class TransactionService {
  private logPath: string;

  constructor() {
    this.logPath = path.join(PROJECT_ROOT, '.solvent_audit.jsonl');
  }

  async logStart(tool: string, args: Record<string, unknown>, cycleId?: string): Promise<string> {
    const id = Math.random().toString(36).substring(7);
    const entry: TransactionLogEntry = {
      id,
      timestamp: new Date().toISOString(),
      tool,
      args,
      status: 'pending',
      cycleId
    };
    await this.appendLog(entry);
    return id;
  }

  async logComplete(id: string, result: unknown) {
    await this.appendLog({ id, status: 'success', result, timestamp: new Date().toISOString() } as TransactionLogEntry);
  }

  async logError(id: string, error: string) {
    await this.appendLog({ id, status: 'failed', error, timestamp: new Date().toISOString() } as TransactionLogEntry);
  }

  async logDenial(tool: string, args: Record<string, unknown>, reason: string) {
     const id = Math.random().toString(36).substring(7);
     await this.appendLog({
       id,
       timestamp: new Date().toISOString(),
       tool,
       args,
       status: 'denied',
       error: reason
     });
  }

  private async appendLog(entry: TransactionLogEntry) {
    try {
      const line = JSON.stringify(entry) + '\n';
      await fs.appendFile(this.logPath, line);
    } catch (error) {
      logger.error('[TransactionService] Failed to write audit log', error);
    }
  }
}

export const transactionService = new TransactionService();
