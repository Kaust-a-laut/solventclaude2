import { describe, it, expect } from 'vitest';
import { ProviderSemaphore } from './providerSemaphore';

describe('ProviderSemaphore', () => {
  it('should allow up to maxConcurrent tasks', async () => {
    const sem = new ProviderSemaphore(2);
    let running = 0;
    let maxRunning = 0;

    const task = () => sem.run(async () => {
      running++;
      maxRunning = Math.max(maxRunning, running);
      await new Promise(r => setTimeout(r, 50));
      running--;
    });

    await Promise.all([task(), task(), task(), task()]);
    expect(maxRunning).toBe(2);
  });

  it('should return the task result', async () => {
    const sem = new ProviderSemaphore(1);
    const result = await sem.run(async () => 42);
    expect(result).toBe(42);
  });

  it('should propagate errors without leaking slots', async () => {
    const sem = new ProviderSemaphore(1);

    await expect(sem.run(async () => {
      throw new Error('boom');
    })).rejects.toThrow('boom');

    // Slot should be released — this should not hang
    const result = await sem.run(async () => 'ok');
    expect(result).toBe('ok');
  });

  it('should report pending count', async () => {
    const sem = new ProviderSemaphore(1);
    let resolve1!: () => void;
    const blocker = new Promise<void>(r => { resolve1 = r; });

    const p1 = sem.run(() => blocker);
    // Give the second task time to queue
    await new Promise(r => setTimeout(r, 10));
    const p2Promise = sem.run(async () => 'queued');

    expect(sem.pending).toBe(1);
    resolve1();
    await p1;
    await p2Promise;
    expect(sem.pending).toBe(0);
  });
});
