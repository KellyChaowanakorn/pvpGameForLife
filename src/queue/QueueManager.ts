// Queue interface - swap this implementation to Redis later
export interface QueueEntry {
  socketId: string;
  dbId: number;
  name: string;
  gameType: string;
  joinedAt: number;
}

export interface IQueue {
  add(entry: QueueEntry): void;
  findOpponent(gameType: string, excludeSocketId: string): QueueEntry | null;
  remove(socketId: string): void;
  size(gameType?: string): number;
  getAll(): QueueEntry[];
  cleanup(maxAge: number): QueueEntry[];  // returns expired entries
}

// ===== IN-MEMORY IMPLEMENTATION =====
// Replace this class with RedisQueue when scaling
export class MemoryQueue implements IQueue {
  private queue: QueueEntry[] = [];

  add(entry: QueueEntry): void {
    // Prevent duplicate
    this.remove(entry.socketId);
    this.queue.push(entry);
    console.log(`📥 Queue add: ${entry.name} (${entry.gameType}) | Size: ${this.queue.length}`);
  }

  findOpponent(gameType: string, excludeSocketId: string): QueueEntry | null {
    const idx = this.queue.findIndex(
      (q) => q.gameType === gameType && q.socketId !== excludeSocketId
    );
    if (idx >= 0) {
      return this.queue.splice(idx, 1)[0];
    }
    return null;
  }

  remove(socketId: string): void {
    const before = this.queue.length;
    this.queue = this.queue.filter((q) => q.socketId !== socketId);
    if (this.queue.length < before) {
      console.log(`📤 Queue remove: ${socketId} | Size: ${this.queue.length}`);
    }
  }

  size(gameType?: string): number {
    if (gameType) {
      return this.queue.filter((q) => q.gameType === gameType).length;
    }
    return this.queue.length;
  }

  getAll(): QueueEntry[] {
    return [...this.queue];
  }

  cleanup(maxAge: number): QueueEntry[] {
    const now = Date.now();
    const expired: QueueEntry[] = [];
    this.queue = this.queue.filter((q) => {
      if (now - q.joinedAt > maxAge) {
        expired.push(q);
        return false;
      }
      return true;
    });
    return expired;
  }
}
