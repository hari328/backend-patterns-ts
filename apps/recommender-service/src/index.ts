import express from 'express';
import { env } from './config/env';
import { postsStreamConsumer } from './services/sqs-consumer';

const app = express();

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'recommender-service' });
});

app.get('/api/hello', (_req, res) => {
  res.json({ message: 'Hello from Recommender Service!' });
});

// Start the server
app.listen(env.PORT, async () => {
  console.log(`🚀 Recommender Service running on http://localhost:${env.PORT}`);
  console.log(`   Environment: ${env.NODE_ENV}`);
  console.log(`   AWS Region: ${env.AWS_REGION}`);

  // Start SQS consumer
  try {
    await postsStreamConsumer.start();
  } catch (error) {
    console.error('❌ Failed to start SQS consumer:', error);
    process.exit(1);
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('\n🛑 SIGTERM received, shutting down gracefully...');
  await postsStreamConsumer.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\n🛑 SIGINT received, shutting down gracefully...');
  await postsStreamConsumer.stop();
  process.exit(0);
});