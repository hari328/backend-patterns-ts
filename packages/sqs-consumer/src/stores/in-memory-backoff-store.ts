import { BackoffStore } from '../interfaces/backoff-store';
import { addMilliseconds, addSeconds, addMinutes, addHours, isAfter } from 'date-fns';

export type TimeUnit = 'ms' | 'sec' | 'min' | 'hour';
export type RetryStrategy = 'exponential' | 'fixed';

interface BackoffEntry {
  retryCount: number;
  lastFailureTime: Date;
  baseDelay: number;
  baseDelayUnit: TimeUnit;
  strategy: RetryStrategy;
}

export class InMemoryBackoffStore implements BackoffStore {
  private backoffEntries: Map<string, BackoffEntry> = new Map();

  private addTime(date: Date, value: number, unit: TimeUnit): Date {
    switch (unit) {
      case 'ms':
        return addMilliseconds(date, value);
      case 'sec':
        return addSeconds(date, value);
      case 'min':
        return addMinutes(date, value);
      case 'hour':
        return addHours(date, value);
    }
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
    const entry = this.backoffEntries.get(messageId);

    if (!entry) {
      return true;
    }

    // Calculate delay based on strategy
    const baseDelayMs = this.toMilliseconds(entry.baseDelay, entry.baseDelayUnit);
    const delayMs = entry.strategy === 'fixed'
      ? baseDelayMs
      : baseDelayMs * Math.pow(2, entry.retryCount - 1);

    const nextRetryTime = addMilliseconds(entry.lastFailureTime, delayMs);
    const now = new Date();

    return isAfter(now, nextRetryTime) || now.getTime() === nextRetryTime.getTime();
  }

  async recordFailure(
    messageId: string,
    baseDelayMs: number = 1000,
    strategy: RetryStrategy = 'exponential'
  ): Promise<number> {
    const entry = this.backoffEntries.get(messageId);
    const retryCount = entry ? entry.retryCount + 1 : 1;
    const lastFailureTime = new Date();

    this.backoffEntries.set(messageId, {
      retryCount,
      lastFailureTime,
      baseDelay: baseDelayMs,
      baseDelayUnit: 'ms',
      strategy,
    });

    const delay = strategy === 'fixed'
      ? baseDelayMs
      : baseDelayMs * Math.pow(2, retryCount - 1);

    return lastFailureTime.getTime() + delay;
  }

  async getRetryCount(messageId: string): Promise<number> {
    const entry = this.backoffEntries.get(messageId);
    return entry ? entry.retryCount : 0;
  }

  async clear(messageId: string): Promise<void> {
    this.backoffEntries.delete(messageId);
  }

  clearAll(): void {
    this.backoffEntries.clear();
  }

  size(): number {
    return this.backoffEntries.size;
  }

  getLastFailureTime(messageId: string): number | null {
    const entry = this.backoffEntries.get(messageId);
    return entry ? entry.lastFailureTime.getTime() : null;
  }
}

