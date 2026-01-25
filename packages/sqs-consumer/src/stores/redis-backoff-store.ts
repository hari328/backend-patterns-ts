import { Redis } from 'ioredis';
import { BackoffStore, RetryStrategy } from '../interfaces/backoff-store';
import { addMilliseconds, isAfter } from 'date-fns';

export type TimeUnit = 'ms' | 'sec' | 'min' | 'hour';

/**
 * Redis-based backoff store
 * Uses Redis for distributed backoff tracking across multiple consumers
 */
export class RedisBackoffStore implements BackoffStore {
  private readonly keyPrefix: string;

  /**
   * Create a new Redis backoff store
   * @param redis - ioredis client instance
   * @param keyPrefix - Prefix for Redis keys (default: 'backoff:')
   */
  constructor(
    private readonly redis: Redis,
    keyPrefix: string = 'backoff:'
  ) {
    this.keyPrefix = keyPrefix;
  }

  private toMilliseconds(value: number, unit: TimeUnit): number {
    switch (unit) {
      case 'ms':
        return value;
      case 'sec':
        return value * 1000;
      case 'min':
        return value * 60 * 1000;
      case 'hour':
        return value * 60 * 60 * 1000;
    }
  }

  async canProcess(messageId: string): Promise<boolean> {
    const key = this.getKey(messageId);
    const entry = await this.redis.hgetall(key);

    // If no entry exists, message can be processed
    if (!entry || !entry.retryCount) {
      return true;
    }

    // Parse entry data
    const retryCount = parseInt(entry.retryCount, 10);
    const lastFailureTime = new Date(parseInt(entry.lastFailureTime, 10));
    const baseDelay = parseFloat(entry.baseDelay);
    const baseDelayUnit = entry.baseDelayUnit as TimeUnit;
    const strategy = entry.strategy as RetryStrategy;

    // Calculate delay based on strategy
    const baseDelayMs = this.toMilliseconds(baseDelay, baseDelayUnit);
    const delayMs = strategy === 'fixed' 
      ? baseDelayMs 
      : baseDelayMs * Math.pow(2, retryCount - 1);

    const nextRetryTime = addMilliseconds(lastFailureTime, delayMs);
    const now = new Date();

    return isAfter(now, nextRetryTime) || now.getTime() === nextRetryTime.getTime();
  }

  async recordFailure(
    messageId: string,
    baseDelayMs: number = 1000,
    strategy: RetryStrategy = 'exponential'
  ): Promise<number> {
    const key = this.getKey(messageId);
    
    // Get current retry count
    const currentRetryCount = await this.redis.hget(key, 'retryCount');
    const retryCount = currentRetryCount ? parseInt(currentRetryCount, 10) + 1 : 1;
    const lastFailureTime = Date.now();

    // Store entry data in Redis hash
    await this.redis.hset(key, {
      retryCount: retryCount.toString(),
      lastFailureTime: lastFailureTime.toString(),
      baseDelay: baseDelayMs.toString(),
      baseDelayUnit: 'ms',
      strategy,
    });

    // Calculate next retry time
    const delay = strategy === 'fixed' 
      ? baseDelayMs 
      : baseDelayMs * Math.pow(2, retryCount - 1);

    return lastFailureTime + delay;
  }

  async getRetryCount(messageId: string): Promise<number> {
    const key = this.getKey(messageId);
    const retryCount = await this.redis.hget(key, 'retryCount');
    return retryCount ? parseInt(retryCount, 10) : 0;
  }

  async clear(messageId: string): Promise<void> {
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

