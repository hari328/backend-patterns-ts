import express from 'express';
import postsRoutes from './routes/posts.routes';
import { logger } from './logger';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/api', postsRoutes);

app.listen(PORT, () => {
  logger.info('Server started', { port: PORT });
});

