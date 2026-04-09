import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const TEST_DB_PATH = path.join(__dirname, '../../data/test-auth-routes.db');
process.env.DATABASE_PATH = TEST_DB_PATH;

describe('Auth Routes', () => {
  let app: express.Express;

  beforeAll(async () => {
    const dbDir = path.dirname(TEST_DB_PATH);
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
    try { fs.unlinkSync(TEST_DB_PATH); } catch { /* ignore */ }

    const { autoSeed } = await import('../services/autoSeed');
    autoSeed();

    const { DevAuthProvider } = await import('../auth/devAuthProvider');
    const { createAuthMiddleware } = await import('../auth/middleware');
    const { createAuthRouter } = await import('../routes/auth');

    const provider = new DevAuthProvider();
    app = express();
    app.use(express.json());
    app.use('/api/auth', createAuthMiddleware(provider));
    app.use('/api/auth', createAuthRouter(provider));
  });

  afterAll(() => {
    const sqlite = new Database(TEST_DB_PATH);
    sqlite.close();
    try { fs.unlinkSync(TEST_DB_PATH); } catch { /* ignore */ }
    try { fs.unlinkSync(TEST_DB_PATH + '-wal'); } catch { /* ignore */ }
    try { fs.unlinkSync(TEST_DB_PATH + '-shm'); } catch { /* ignore */ }
  });

  it('POST /api/auth/login should return token for valid staff email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@hartfordlegal.com' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.role).toBe('admin');
    expect(res.body.user.name).toBe('Sarah Chen');
  });

  it('POST /api/auth/login should return 401 for unknown email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'unknown@test.com' });
    expect(res.status).toBe(401);
  });

  it('POST /api/auth/login should validate email format', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
  });

  it('POST /api/auth/client/login should return token for valid client email', async () => {
    const res = await request(app)
      .post('/api/auth/client/login')
      .send({ email: 'rmartinez78@gmail.com' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.client.role).toBe('client');
    expect(res.body.client.name).toBe('Robert Martinez');
  });

  it('GET /api/auth/me should return current user', async () => {
    // Login first
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'paralegal@hartfordlegal.com' });
    const token = loginRes.body.token;

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('paralegal');
    expect(res.body.name).toBe('Maria Lopez');
  });
});
