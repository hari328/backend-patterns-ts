import express from 'express';
import postsRoutes from './routes/posts.routes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use('/api', postsRoutes);

app.listen(PORT, () => {
  console.log(`Posts service listening on port ${PORT}`);
});

