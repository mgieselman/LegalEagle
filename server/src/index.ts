import './env';
import express from 'express';
import cors from 'cors';
import path from 'path';
import formsRouter from './routes/forms';
import reviewRouter from './routes/review';
import downloadRouter from './routes/download';
import { autoSeed } from './services/autoSeed';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// API routes
app.use('/api/forms', formsRouter);
app.use('/api/forms', reviewRouter);
app.use('/api/forms', downloadRouter);

// Serve static files in production
const clientDist = path.join(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get('/{*splat}', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

// Auto-seed if database is empty
autoSeed();

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
