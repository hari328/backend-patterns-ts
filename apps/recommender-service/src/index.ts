import { SQSConsumer } from '@repo/sqs-consumer';
import { env, postsStreamQueueConfig } from './config/env';
import { PostCreatedHandler } from './handlers/post-created.handler';

async function main() {
  console.log('[Recommender Service] Starting...');
  console.log(`[Recommender Service] Environment: ${env.NODE_ENV}`);
  console.log(`[Recommender Service] Port: ${env.PORT}`);

  // Create SQS Consumer for posts-stream queue
  const consumer = new SQSConsumer(
    {
      sqsConfig: postsStreamQueueConfig,
      sqsClientConfig: {
        region: env.AWS_REGION,
        endpoint: env.AWS_ENDPOINT,
        credentials:
          env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
            ? {
                accessKeyId: env.AWS_ACCESS_KEY_ID,
                secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
              }
            : undefined,
      },
      pollIntervalMs: 1000,
      processInParallel: postsStreamQueueConfig.processingMode === 'parallel',
    },
    new PostCreatedHandler()
  );

  // Start consuming messages
  await consumer.start();

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('[Recommender Service] SIGTERM received, shutting down gracefully...');
    await consumer.stop();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('[Recommender Service] SIGINT received, shutting down gracefully...');
    await consumer.stop();
    process.exit(0);
  });

  console.log('[Recommender Service] Ready to process messages!');
}

main().catch((error) => {
  console.error('[Recommender Service] Fatal error:', error);
  process.exit(1);
});

