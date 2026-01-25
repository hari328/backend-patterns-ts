import { Redis } from 'ioredis';
import { IdempotencyStore } from '../interfaces/idempotency-store';

/**
 * Redis-based idempotency store
 * Uses Redis for distributed idempotency checks across multiple consumers
 */
export class RedisIdempotencyStore implements IdempotencyStore {
  private readonly keyPrefix: string;

  /**
   * Create a new Redis idempotency store
   * @param redis - ioredis client instance
   * @param keyPrefix - Prefix for Redis keys (default: 'idempotency:')
   */
  constructor(
    private readonly redis: Redis,
    keyPrefix: string = 'idempotency:'
  ) {
    this.keyPrefix = keyPrefix;
  }

  async hasProcessed(messageId: string): Promise<boolean> {
    const key = this.getKey(messageId);
    const exists = await this.redis.exists(key);
    return exists === 1;
  }

  async markProcessed(messageId: string, ttlSeconds: number): Promise<void> {
    const key = this.getKey(messageId);
    // SETEX: Set key with expiration in seconds
    // Value is '1' (we only care about existence, not the value)
    await this.redis.setex(key, ttlSeconds, '1');
  }

  async remove(messageId: string): Promise<void> {
    const key = this.getKey(messageId);
    await this.redis.del(key);
  }

  /**
   * Get the full Redis key for a message ID
   * @param messageId - Message identifier
   * @returns Full Redis key with prefix
   */
  private getKey(messageId: string): string {
    return `${this.keyPrefix}${messageId}`;
  }

  /**
   * Close the Redis connection
   * Call this when shutting down the application
   */
  async disconnect(): Promise<void> {
    await this.redis.quit();
  }
}

