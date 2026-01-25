import { IdempotencyStore } from '../interfaces/idempotency-store';

export class InMemoryIdempotencyStore implements IdempotencyStore {
  private processedMessages: Map<string, number> = new Map(); // messageId -> expiryTimestamp

  async hasProcessed(messageId: string): Promise<boolean> {
    this.cleanupExpired();
    return this.processedMessages.has(messageId);
  }

  async markProcessed(messageId: string, ttlSeconds: number): Promise<void> {
    const expiryTimestamp = Date.now() + ttlSeconds * 1000;
    this.processedMessages.set(messageId, expiryTimestamp);
  }

  async remove(messageId: string): Promise<void> {
    this.processedMessages.delete(messageId);
  }

  private cleanupExpired(): void {
    const now = Date.now();
    for (const [messageId, expiryTimestamp] of this.processedMessages.entries()) {
      if (expiryTimestamp <= now) {
        this.processedMessages.delete(messageId);
      }
    }
  }

  
  clear(): void {
    this.processedMessages.clear();
  }

  size(): number {
    this.cleanupExpired();
    return this.processedMessages.size;
  }
}

