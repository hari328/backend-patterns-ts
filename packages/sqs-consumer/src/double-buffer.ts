/**
 * Double Buffer for batching writes to reduce database load
 * 
 * Pattern:
 * - Buffer A (active): Accumulates incoming updates
 * - Buffer B (flushing): Being written to database
 * - Swap buffers periodically to enable non-blocking writes
 */

export interface DoubleBufferConfig {
  flushIntervalMs: number;  // How often to flush (e.g., 10000 = 10 seconds)
  maxBufferSize?: number;   // Optional: flush when buffer reaches this size
}

export type FlushCallback<T> = (data: Map<string, T>) => Promise<void>;

export class DoubleBuffer<T> {
  private bufferA: Map<string, T> = new Map();
  private bufferB: Map<string, T> = new Map();
  private activeBuffer: Map<string, T>;
  private flushBuffer: Map<string, T>;
  private flushTimer?: NodeJS.Timeout;
  private isFlushing = false;
  private config: DoubleBufferConfig;
  private flushCallback: FlushCallback<T>;

  constructor(config: DoubleBufferConfig, flushCallback: FlushCallback<T>) {
    this.config = config;
    this.flushCallback = flushCallback;
    this.activeBuffer = this.bufferA;
    this.flushBuffer = this.bufferB;
  }

  /**
   * Start the periodic flush timer
   */
  start(): void {
    console.log(`[DoubleBuffer] Starting with flush interval: ${this.config.flushIntervalMs}ms`);
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.config.flushIntervalMs);
  }

  /**
   * Stop the flush timer and perform final flush
   */
  async stop(): Promise<void> {
    console.log('[DoubleBuffer] Stopping...');
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
    // Final flush
    await this.flush();
  }

  /**
   * Add or update a value in the active buffer
   */
  set(key: string, value: T): void {
    this.activeBuffer.set(key, value);

    // Optional: flush if buffer size exceeds threshold
    if (this.config.maxBufferSize && this.activeBuffer.size >= this.config.maxBufferSize) {
      console.log(`[DoubleBuffer] Buffer size threshold reached (${this.activeBuffer.size}), triggering flush`);
      this.flush();
    }
  }

  /**
   * Update a value using a reducer function
   * Useful for accumulating counts: (prev, curr) => prev + curr
   */
  update(key: string, value: T, reducer: (prev: T, curr: T) => T): void {
    const existing = this.activeBuffer.get(key);
    if (existing !== undefined) {
      this.activeBuffer.set(key, reducer(existing, value));
    } else {
      this.activeBuffer.set(key, value);
    }

    // Optional: flush if buffer size exceeds threshold
    if (this.config.maxBufferSize && this.activeBuffer.size >= this.config.maxBufferSize) {
      console.log(`[DoubleBuffer] Buffer size threshold reached (${this.activeBuffer.size}), triggering flush`);
      this.flush();
    }
  }

  /**
   * Get current active buffer size
   */
  getActiveBufferSize(): number {
    return this.activeBuffer.size;
  }

  /**
   * Swap buffers and flush the old active buffer
   */
  private async flush(): Promise<void> {
    // Skip if already flushing or active buffer is empty
    if (this.isFlushing || this.activeBuffer.size === 0) {
      return;
    }

    this.isFlushing = true;

    try {
      // Swap buffers
      const temp = this.activeBuffer;
      this.activeBuffer = this.flushBuffer;
      this.flushBuffer = temp;

      console.log(`[DoubleBuffer] Flushing ${this.flushBuffer.size} items...`);

      // Flush the old active buffer (now flushBuffer)
      await this.flushCallback(this.flushBuffer);

      console.log(`[DoubleBuffer] Flush completed successfully`);

      // Clear the flushed buffer
      this.flushBuffer.clear();
    } catch (error) {
      console.error('[DoubleBuffer] Flush failed:', error);
      // On error, swap back to preserve data
      const temp = this.activeBuffer;
      this.activeBuffer = this.flushBuffer;
      this.flushBuffer = temp;
      throw error;
    } finally {
      this.isFlushing = false;
    }
  }

  /**
   * Force an immediate flush (useful for testing or graceful shutdown)
   */
  async forceFlush(): Promise<void> {
    await this.flush();
  }
}

