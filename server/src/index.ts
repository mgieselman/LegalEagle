import './env';
import express from 'express';
import cors from 'cors';
import path from 'path';
import formsRouter from './routes/forms';
import reviewRouter from './routes/review';
import downloadRouter from './routes/download';
import casesRouter from './routes/cases';
import clientsRouter from './routes/clients';
import clientPortalRouter from './routes/clientPortal';
import documentsRouter from './routes/documents';
import { autoSeed } from './services/autoSeed';
import { DevAuthProvider } from './auth/devAuthProvider';
import { createAuthMiddleware } from './auth/middleware';
import { createAuthRouter } from './routes/auth';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Auto-seed if database is empty (must run before auth middleware uses DB)
autoSeed();

// Auth provider — DevAuthProvider for now, swap for real provider later
const authProvider = new DevAuthProvider();

// Auth login routes (no auth middleware required for login itself)
app.use('/api/auth', createAuthMiddleware(authProvider));
app.use('/api/auth', createAuthRouter(authProvider));

// Protected API routes
app.use('/api/forms', createAuthMiddleware(authProvider));
app.use('/api/forms', formsRouter);
app.use('/api/forms', reviewRouter);
app.use('/api/forms', downloadRouter);
app.use('/api/cases', createAuthMiddleware(authProvider));
app.use('/api/cases', casesRouter);
app.use('/api/clients', createAuthMiddleware(authProvider));
app.use('/api/clients', clientsRouter);
app.use('/api/documents', createAuthMiddleware(authProvider));
app.use('/api/documents', documentsRouter);
app.use('/api/client-portal', createAuthMiddleware(authProvider));
app.use('/api/client-portal', clientPortalRouter);

// Serve static files in production
const clientDist = path.join(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get('/{*splat}', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
