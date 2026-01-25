import type { Message } from '@aws-sdk/client-sqs';
import { RetryException, FailureException } from '@repo/sqs-consumer';

/**
 * Handler for processing posts stream messages
 * 
 * Exception handling:
 * - Throw RetryException: Message will be retried (not deleted)
 * - Throw FailureException: Message will be deleted (permanent failure)
 * - Throw any other error: Message will be retried (not deleted)
 */
export async function handlePostsStreamMessage(message: Message): Promise<void> {
  // Parse the message body
  if (!message.Body) {
    throw new FailureException('Message body is empty');
  }

  let data: any;
  try {
    data = JSON.parse(message.Body);
  } catch (error) {
    // Malformed JSON - permanent failure, no point retrying
    throw new FailureException('Invalid JSON in message body', error as Error);
  }

  console.log(`   Processing post:`, data);

  // Validate required fields
  if (!data.postId) {
    // Missing required field - permanent failure
    throw new FailureException('Missing required field: postId');
  }

  // Example: Simulate different scenarios
  if (data.action === 'create') {
    await handleCreatePost(data);
  } else if (data.action === 'update') {
    await handleUpdatePost(data);
  } else if (data.action === 'delete') {
    await handleDeletePost(data);
  } else {
    // Unknown action - permanent failure
    throw new FailureException(`Unknown action: ${data.action}`);
  }
}

async function handleCreatePost(data: any): Promise<void> {
  // Example: Simulate a transient error (e.g., database connection issue)
  // This should be retried
  const isTransientError = Math.random() < 0.1; // 10% chance
  if (isTransientError) {
    throw new RetryException('Database connection failed, will retry');
  }

  // Process the post creation
  console.log(`   ✅ Created post: ${data.postId}`);
}

async function handleUpdatePost(data: any): Promise<void> {
  // Example: Post not found - permanent failure
  const postExists = true; // In real code, check database
  if (!postExists) {
    throw new FailureException(`Post not found: ${data.postId}`);
  }

  // Process the post update
  console.log(`   ✅ Updated post: ${data.postId}`);
}

async function handleDeletePost(data: any): Promise<void> {
  // Example: Simulate rate limiting (should retry)
  const isRateLimited = Math.random() < 0.05; // 5% chance
  if (isRateLimited) {
    throw new RetryException('Rate limited, will retry after backoff');
  }

  // Process the post deletion
  console.log(`   ✅ Deleted post: ${data.postId}`);
}

