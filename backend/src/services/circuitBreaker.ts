import { storageService } from './storageService';
import { logger } from '../utils/logger';

enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

interface CircuitData {
  state: CircuitState;
  failures: number;
  successes: number;
  openedAt: number | null;
}

const DEFAULT_DATA: CircuitData = {
  state: CircuitState.CLOSED,
  failures: 0,
  successes: 0,
  openedAt: null
};

// Long TTL — we manage state transitions manually, not via key expiry
const STATE_TTL_SECONDS = 3600; // 1 hour, auto-cleanup for abandoned circuits

export class CircuitBreakerService {
  private readonly FAILURE_THRESHOLD = 5;
  private readonly SUCCESS_THRESHOLD = 2;
  private readonly COOL_DOWN_MS = 60 * 1000;

  private stateKey(providerId: string): string {
    return `cb:${providerId}:state`;
  }

  private async getData(providerId: string): Promise<CircuitData> {
    const data = await storageService.get<CircuitData>(this.stateKey(providerId));
    return data ?? { ...DEFAULT_DATA };
  }

  private async setData(providerId: string, data: CircuitData): Promise<void> {
    await storageService.set(this.stateKey(providerId), data, STATE_TTL_SECONDS);
  }

  async recordFailure(providerId: string): Promise<void> {
    const data = await this.getData(providerId);

    if (data.state === CircuitState.HALF_OPEN) {
      // Any failure in HALF_OPEN immediately re-opens
      logger.warn(`[CircuitBreaker] Failure during HALF_OPEN for ${providerId}, re-opening`);
      await this.setData(providerId, {
        state: CircuitState.OPEN,
        failures: 0,
        successes: 0,
        openedAt: Date.now()
      });
      return;
    }

    data.failures += 1;

    if (data.failures >= this.FAILURE_THRESHOLD) {
      logger.warn(`[CircuitBreaker] Opening circuit for ${providerId} (${data.failures} failures)`);
      await this.setData(providerId, {
        state: CircuitState.OPEN,
        failures: 0,
        successes: 0,
        openedAt: Date.now()
      });
    } else {
      await this.setData(providerId, data);
    }
  }

  async recordSuccess(providerId: string): Promise<void> {
    const data = await this.getData(providerId);

    if (data.state === CircuitState.HALF_OPEN) {
      data.successes += 1;
      if (data.successes >= this.SUCCESS_THRESHOLD) {
        logger.info(`[CircuitBreaker] Closing circuit for ${providerId} (${data.successes} successes in HALF_OPEN)`);
        await this.setData(providerId, { ...DEFAULT_DATA });
      } else {
        await this.setData(providerId, data);
      }
      return;
    }

    if (data.state === CircuitState.CLOSED && data.failures > 0) {
      // Reset failures on success
      data.failures = 0;
      await this.setData(providerId, data);
    }
  }

  async isOpen(providerId: string): Promise<boolean> {
    const data = await this.getData(providerId);

    if (data.state === CircuitState.OPEN && data.openedAt) {
      if (Date.now() - data.openedAt >= this.COOL_DOWN_MS) {
        // Transition to HALF_OPEN — allow a probe request through
        logger.info(`[CircuitBreaker] Circuit for ${providerId} moved to HALF_OPEN`);
        await this.setData(providerId, {
          state: CircuitState.HALF_OPEN,
          failures: 0,
          successes: 0,
          openedAt: data.openedAt
        });
        return false; // Allow probe
      }
      return true; // Still in cooldown
    }

    return data.state === CircuitState.OPEN;
  }

  async isAvailable(providerId: string): Promise<boolean> {
    const data = await this.getData(providerId);
    return data.state !== CircuitState.OPEN;
  }
}

export const circuitBreaker = new CircuitBreakerService();
