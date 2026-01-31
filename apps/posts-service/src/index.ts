import express from 'express';
import postsRoutes from './routes/posts.routes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/api', postsRoutes);

app.listen(PORT, () => {
  console.log(`Posts service listening on port ${PORT}`);
});

