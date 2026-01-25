export type RetryStrategy = 'exponential' | 'fixed';

export interface BackoffStore {

  canProcess(messageId: string): Promise<boolean>;

  recordFailure(messageId: string, baseDelayMs?: number, strategy?: RetryStrategy): Promise<number>;

  getRetryCount(messageId: string): Promise<number>;

  clear(messageId: string): Promise<void>;
}

