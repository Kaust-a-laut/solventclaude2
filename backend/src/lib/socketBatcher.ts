import { Server } from 'socket.io';

export class SocketBatcher {
  private pending: Map<string, unknown[]> = new Map();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private io: Server;
  private batchWindowMs: number;

  constructor(io: Server, batchWindowMs = 100) {
    this.io = io;
    this.batchWindowMs = batchWindowMs;
  }

  emit(event: string, data: unknown) {
    const queue = this.pending.get(event) || [];
    queue.push(data);
    this.pending.set(event, queue);
    this.scheduleFlush();
  }

  private scheduleFlush() {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.flush();
    }, this.batchWindowMs);
  }

  private flush() {
    this.timer = null;
    for (const [event, items] of this.pending.entries()) {
      if (items.length === 1) {
        this.io.emit(event, items[0]);
      } else {
        this.io.emit(`${event}:batch`, items);
      }
    }
    this.pending.clear();
  }

  emitImmediate(event: string, data: unknown) {
    this.io.emit(event, data);
  }

  destroy() {
    if (this.timer) clearTimeout(this.timer);
    this.pending.clear();
  }
}
