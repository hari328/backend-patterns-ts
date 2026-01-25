/**
 * Exception thrown when a message should be retried.
 * The message will NOT be deleted and will become visible again after the visibility timeout.
 */
export class RetryException extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'RetryException';
    
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, RetryException);
    }
  }
}

/**
 * Exception thrown when a message processing has permanently failed.
 * The message will be deleted and will NOT be retried.
 * Use this for messages that are malformed or cannot be processed even with retries.
 */
export class FailureException extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'FailureException';
    
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, FailureException);
    }
  }
}

