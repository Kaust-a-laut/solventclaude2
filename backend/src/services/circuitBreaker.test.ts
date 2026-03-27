import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CircuitBreakerService } from './circuitBreaker';

// Mock storageService with a simple in-memory map
const store = new Map<string, { value: any; expiresAt?: number }>();

vi.mock('./storageService', () => ({
  storageService: {
    get: vi.fn(async (key: string) => {
      const entry = store.get(key);
      if (!entry) return null;
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        store.delete(key);
        return null;
      }
      return entry.value;
    }),
    set: vi.fn(async (key: string, value: any, ttl?: number) => {
      store.set(key, {
        value,
        expiresAt: ttl ? Date.now() + ttl * 1000 : undefined
      });
    }),
    del: vi.fn(async (key: string) => { store.delete(key); }),
    incr: vi.fn(async (key: string) => {
      const entry = store.get(key);
      const newVal = (entry?.value ?? 0) + 1;
      store.set(key, { value: newVal });
      return newVal;
    }),
  }
}));

describe('CircuitBreakerService', () => {
  let cb: CircuitBreakerService;

  beforeEach(() => {
    store.clear();
    cb = new CircuitBreakerService();
  });

  it('starts in CLOSED state', async () => {
    expect(await cb.isOpen('test')).toBe(false);
  });

  it('opens after reaching failure threshold', async () => {
    for (let i = 0; i < 5; i++) {
      await cb.recordFailure('test');
    }
    expect(await cb.isOpen('test')).toBe(true);
  });

  it('resets failure count on success in CLOSED state', async () => {
    await cb.recordFailure('test');
    await cb.recordFailure('test');
    await cb.recordSuccess('test');
    // Should be back to 0 failures — 5 more needed to open
    for (let i = 0; i < 4; i++) {
      await cb.recordFailure('test');
    }
    expect(await cb.isOpen('test')).toBe(false);
  });

  it('transitions to HALF_OPEN after cooldown', async () => {
    // Open the circuit
    for (let i = 0; i < 5; i++) {
      await cb.recordFailure('test');
    }
    expect(await cb.isOpen('test')).toBe(true);

    // Fast-forward past cooldown by manipulating the stored state
    const stateKey = 'cb:test:state';
    const state = store.get(stateKey);
    if (state) {
      state.value = { ...state.value, openedAt: Date.now() - 61000 };
    }

    // Should now transition to HALF_OPEN (isOpen returns false to allow probe)
    expect(await cb.isOpen('test')).toBe(false);
  });

  it('closes circuit after success threshold in HALF_OPEN', async () => {
    // Open the circuit
    for (let i = 0; i < 5; i++) {
      await cb.recordFailure('test');
    }

    // Manually set to HALF_OPEN
    store.set('cb:test:state', {
      value: { state: 'HALF_OPEN', openedAt: Date.now() - 61000, failures: 0, successes: 0 }
    });

    await cb.recordSuccess('test');
    await cb.recordSuccess('test');

    // Should be CLOSED now
    expect(await cb.isOpen('test')).toBe(false);
  });

  it('re-opens circuit on failure during HALF_OPEN', async () => {
    store.set('cb:test:state', {
      value: { state: 'HALF_OPEN', openedAt: Date.now() - 61000, failures: 0, successes: 0 }
    });

    await cb.recordFailure('test');
    expect(await cb.isOpen('test')).toBe(true);
  });
});
