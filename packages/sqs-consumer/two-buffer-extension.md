# Two-Buffer Extension Pattern

## Overview

This document describes how to implement the **Aggregator Pattern** (from Enterprise Integration Patterns) using a two-buffer approach for batch processing SQS messages.

## Pattern Reference

**Source:** [Enterprise Integration Patterns - Aggregator](https://www.enterpriseintegrationpatterns.com/patterns/messaging/Aggregator.html)

**Problem:** How do we combine the results of individual, but related messages so that they can be processed as a whole?

**Solution:** Use a stateful filter, an **Aggregator**, to collect and store individual messages until a complete set of related messages has been received. Then, the Aggregator publishes a single message distilled from the individual messages.

---

## Key Design Decisions

### 1. Correlation
Which incoming messages belong together?
- **Answer:** All messages within a time window or batch size threshold

### 2. Completeness Condition
When are we ready to publish the result?
- **Time-based:** Flush every N seconds (e.g., 5 seconds)
- **Size-based:** Flush when buffer reaches N items (e.g., 100 hashtags)
- **Hybrid:** Whichever comes first (recommended)

### 3. Aggregation Algorithm
How do we combine messages into a single result?
- Merge/deduplicate data from all messages
- Perform batch database operation
- Delete messages from SQS **AFTER** successful DB write

---

## Architecture

### Separation of Concerns

**Consumer's Responsibility:**
- Poll SQS for messages
- Deliver messages to handler
- **Does NOT delete messages** (handler manages deletion)

**Aggregator's Responsibility:**
- Accumulate messages in buffer
- Decide when to flush (completeness condition)
- Write aggregated data to database
- Delete messages from SQS after successful write
- Handle failures (messages retry via visibility timeout)

---

## Implementation

### Step 1: Modify Consumer to Support Manual Deletion

Add a flag to indicate the handler manages message deletion:

```typescript
interface MessageHandler {
  handle(message: Message, metadata: MessageMetadata): Promise<void>;
  manualDeletion?: boolean;  // If true, handler manages deletion
}
```

Modify `SQSConsumer.processMessages()`:

```typescript
private async processMessages(messages: Message[]): Promise<void> {
  const successfulMessages: Message[] = [];
  const retryMessages: Message[] = [];
  
  // Process all messages
  for (const message of messages) {
    await this.processMessage(message, successfulMessages, retryMessages, ...);
  }
  
  // Only delete if handler doesn't manage deletion manually
  if (!this.handler.manualDeletion) {
    if (successfulMessages.length > 0) {
      await this.deleteMessages(successfulMessages);
    }
  }
  // If manualDeletion=true, handler is responsible for deletion
}
```

### Step 2: Implement Aggregator Handler

```typescript
import { SQSClient, DeleteMessageBatchCommand } from '@aws-sdk/client-sqs';
import { MessageHandler, Message, MessageMetadata } from '@repo/sqs-consumer';

class HashtagAggregator implements MessageHandler {
  manualDeletion = true;  // Tell consumer: "I'll handle deletion"
  
  private buffer: Map<string, HashtagData> = new Map();
  private messages: Message[] = [];
  private lastFlushTime = Date.now();
  
  // Completeness thresholds
  private readonly MAX_BATCH_SIZE = 100;
  private readonly MAX_WAIT_TIME_MS = 5000;  // 5 seconds
  
  constructor(
    private sqsClient: SQSClient,
    private queueUrl: string,
    private hashtagService: HashtagService
  ) {}
  
  async handle(message: Message, metadata: MessageMetadata): Promise<void> {
    // Extract and accumulate hashtags
    const hashtags = await this.extractHashtags(message);
    hashtags.forEach(tag => this.buffer.set(tag.name, tag));
    this.messages.push(message);
    
    // Check completeness condition
    if (this.isComplete()) {
      await this.flush();
    }
  }
  
  private isComplete(): boolean {
    const timeSinceLastFlush = Date.now() - this.lastFlushTime;
    
    return (
      this.buffer.size >= this.MAX_BATCH_SIZE ||
      timeSinceLastFlush >= this.MAX_WAIT_TIME_MS
    );
  }
  
  private async flush(): Promise<void> {
    if (this.buffer.size === 0) return;
    
    console.log(`[Aggregator] Flushing ${this.buffer.size} items from ${this.messages.length} messages`);
    
    try {
      // 1. Write to database in batch
      await this.hashtagService.batchUpsertHashtags(
        Array.from(this.buffer.values())
      );
      
      // 2. Delete messages from SQS AFTER successful DB write
      await this.sqsClient.send(new DeleteMessageBatchCommand({
        QueueUrl: this.queueUrl,
        Entries: this.messages.map((msg, index) => ({
          Id: index.toString(),
          ReceiptHandle: msg.ReceiptHandle!,
        })),
      }));
      
      console.log(`[Aggregator] ✅ Successfully flushed and deleted ${this.messages.length} messages`);
      
      // 3. Clear buffer
      this.buffer.clear();
      this.messages = [];
      this.lastFlushTime = Date.now();
      
    } catch (error) {
      console.error('[Aggregator] ❌ Flush failed:', error);
      // Don't clear buffer - messages will be retried when visibility timeout expires
      // SQS will redeliver messages after visibility timeout (30 seconds)
    }
  }
}
```

---

## Important Considerations

### SQS Visibility Timeout

**Problem:** Messages become visible again after visibility timeout (default 30 seconds) if not deleted.

**Solution:** Flush frequently to ensure messages are deleted before timeout expires.

**Recommended Settings:**
- `MAX_WAIT_TIME_MS = 5000` (5 seconds) - Well under 30-second timeout
- `visibilityTimeout = 30` (30 seconds) - SQS setting
- This ensures messages are processed and deleted within timeout window

### Alternative: Extend Visibility Timeout

For larger batches that may take longer than 30 seconds:

```typescript
private async extendVisibility(): Promise<void> {
  await Promise.all(
    this.messages.map(msg =>
      this.sqsClient.send(new ChangeMessageVisibilityCommand({
        QueueUrl: this.queueUrl,
        ReceiptHandle: msg.ReceiptHandle!,
        VisibilityTimeout: 30,  // Extend by another 30 seconds
      }))
    )
  );
}

// Call periodically
setInterval(() => this.extendVisibility(), 20000);  // Every 20 seconds
```

---

## Benefits

1. **Reduced Database Load:** N messages → 1 database operation
2. **Better Throughput:** Batch operations are more efficient
3. **Atomicity:** All messages in batch succeed or fail together
4. **No Data Loss:** Messages only deleted after successful DB write
5. **Pattern-Compliant:** Follows Enterprise Integration Patterns best practices

---

## Trade-offs

**Pros:**
- ✅ Efficient batch processing
- ✅ Reduced database round trips
- ✅ Clear separation of concerns

**Cons:**
- ⚠️ Increased latency (up to MAX_WAIT_TIME_MS)
- ⚠️ More complex error handling
- ⚠️ Need to manage visibility timeout

---

## When to Use

Use this pattern when:
- Processing high volumes of messages (1000+ per minute)
- Database writes are expensive or rate-limited
- Messages can be batched logically (e.g., hashtag counting, analytics)
- Some latency is acceptable (seconds, not milliseconds)

Don't use this pattern when:
- Real-time processing is critical
- Messages must be processed individually
- Low message volume (< 100 per minute)

