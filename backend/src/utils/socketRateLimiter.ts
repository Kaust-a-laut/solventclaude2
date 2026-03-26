/**
 * Per-socket sliding-window rate limiter.
 * Tracks event counts per socket ID within a configurable window.
 */

interface WindowEntry {
  timestamps: number[];
}

export class SocketRateLimiter {
  private windows: Map<string, Map<string, WindowEntry>> = new Map();
  private readonly windowMs: number;

  constructor(windowMs = 60_000) {
    this.windowMs = windowMs;
  }

  /**
   * Check whether an event from a given socket is allowed.
   * @returns true if the event is allowed, false if rate-limited
   */
  check(socketId: string, event: string, maxPerWindow: number): boolean {
    const now = Date.now();
    const cutoff = now - this.windowMs;

    if (!this.windows.has(socketId)) {
      this.windows.set(socketId, new Map());
    }
    const socketEvents = this.windows.get(socketId)!;

    if (!socketEvents.has(event)) {
      socketEvents.set(event, { timestamps: [] });
    }
    const entry = socketEvents.get(event)!;

    // Prune expired timestamps
    entry.timestamps = entry.timestamps.filter(t => t > cutoff);

    if (entry.timestamps.length >= maxPerWindow) {
      return false;
    }

    entry.timestamps.push(now);
    return true;
  }

  /**
   * Remove all tracking data for a disconnected socket.
   */
  cleanup(socketId: string): void {
    this.windows.delete(socketId);
  }
}
