import express from 'express';

const app = express();
const PORT = process.env.PORT || 6000;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'api-service' });
});

app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello from Node.js server!' });
});

app.listen(PORT, () => {
  console.log(`🚀 API Service running on http://localhost:${PORT}`);
});