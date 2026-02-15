import '@repo/tracing';
import express from 'express';
import postsRoutes from './routes/posts.routes';
import { metricsMiddleware, metricsEndpoint } from '@repo/metrics';
import { logger } from './logger';
import { registry } from './metrics';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(metricsMiddleware(registry));

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/metrics', metricsEndpoint(registry));

app.use('/api', postsRoutes);

app.listen(PORT, () => {
  logger.info('Server started', { port: PORT });
});

