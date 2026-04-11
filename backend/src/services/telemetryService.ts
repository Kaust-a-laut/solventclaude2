import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger';

interface TelemetryEvent {
  id: string;
  timestamp: string;
  type: 'chat' | 'image' | 'waterfall' | 'search';
  model: string;
  provider: string;
  latencyMs: number;
  tokensIn?: number; // Estimate or actual
  tokensOut?: number;
  status: 'success' | 'error';
  error?: string;
  meta?: Record<string, unknown>;
}

class TelemetryService {
  private logPath: string;

  constructor() {
    this.logPath = path.resolve(__dirname, '../../../.solvent_telemetry.jsonl');
  }

  async logTransaction(event: Omit<TelemetryEvent, 'timestamp'>) {
    const entry: TelemetryEvent = {
      ...event,
      timestamp: new Date().toISOString()
    };

    // 1. Structured Console Log (for real-time dev visibility)
    // We use a specific prefix [TELEMETRY] so log aggregators can parse it
    console.log(`[TELEMETRY] ${JSON.stringify(entry)}`);

    // 2. Persistent Append-Only Log (JSONL)
    const line = JSON.stringify(entry) + '\n';
    try {
      await fs.appendFile(this.logPath, line);
    } catch (err) {
      logger.error('Failed to write telemetry:', err);
    }
  }

  // Optional: Simple analytics
  async getStats() {
    // In a real app, this would read the file and aggregate
    // For now, we return a placeholder or implement a simple tail
    return { status: "active", logPath: this.logPath };
  }
}

export const telemetryService = new TelemetryService();
