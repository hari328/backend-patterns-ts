import express from 'express';
import { SQSConsumer } from '@repo/sqs-consumer';
import { env, postsStreamQueueConfig } from './config/env';
import { PostCreatedHandler } from './handlers/post-created.handler';
import { HashtagsController } from './controllers/hashtags.controller';
import { HashtagService } from './services/hashtag.service';
import { HashtagsRepository } from './repositories/hashtags.repository';
import { logger } from './logger';

async function main() {
  logger.info('Starting', { environment: env.NODE_ENV, port: env.PORT });

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
    logger.info('HTTP server listening', { port: env.PORT });
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
    logger.info('Shutting down gracefully');

    // Stop HTTP server
    server.close(() => {
      logger.info('HTTP server closed');
    });

    // Stop SQS consumer
    await consumer.stop();

    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  logger.info('Ready to process messages');
}

main().catch((error) => {
  console.error('[Recommender Service] Fatal error:', error);
  process.exit(1);
});


