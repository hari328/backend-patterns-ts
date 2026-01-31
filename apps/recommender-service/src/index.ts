import express from 'express';
import { SQSConsumer } from '@repo/sqs-consumer';
import { env, postsStreamQueueConfig } from './config/env';
import { PostCreatedHandler } from './handlers/post-created.handler';
import { HashtagsController } from './controllers/hashtags.controller';
import { HashtagService } from './services/hashtag.service';
import { HashtagsRepository } from './repositories/hashtags.repository';

async function main() {
  console.log('[Recommender Service] Starting...');
  console.log(`[Recommender Service] Environment: ${env.NODE_ENV}`);
  console.log(`[Recommender Service] Port: ${env.PORT}`);

  // Initialize Express app
  const app = express();
  app.use(express.json());

  // Initialize dependencies
  const hashtagRepository = new HashtagsRepository();
  const hashtagService = new HashtagService(hashtagRepository);
  const hashtagsController = new HashtagsController(hashtagService);

  // Routes
  app.get('/api/hashtags/top', hashtagsController.getTopHashtags.bind(hashtagsController));

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  // Start HTTP server
  const server = app.listen(env.PORT, () => {
    console.log(`[Recommender Service] HTTP server listening on port ${env.PORT}`);
  });

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
  const shutdown = async () => {
    console.log('[Recommender Service] Shutting down gracefully...');

    // Stop HTTP server
    server.close(() => {
      console.log('[Recommender Service] HTTP server closed');
    });

    // Stop SQS consumer
    await consumer.stop();

    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  console.log('[Recommender Service] Ready to process messages!');
}

main().catch((error) => {
  console.error('[Recommender Service] Fatal error:', error);
  process.exit(1);
});

