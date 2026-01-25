/**
 * Interface for idempotency store
 * Prevents duplicate message processing
 */
export interface IdempotencyStore {
  /**
   * Check if a message has already been processed
   * @param messageId - Unique message identifier
   * @returns true if message was already processed, false otherwise
   */
  hasProcessed(messageId: string): Promise<boolean>;

  /**
   * Mark a message as processed (or in-progress)
   * @param messageId - Unique message identifier
   * @param ttlSeconds - Time to live in seconds (how long to remember this message)
   */
  markProcessed(messageId: string, ttlSeconds: number): Promise<void>;

  /**
   * Remove a message from the idempotency store
   * Used when processing fails and message should be retried
   * @param messageId - Unique message identifier
   */
  remove(messageId: string): Promise<void>;
}

