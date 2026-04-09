import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const TEST_DB_PATH = path.join(__dirname, '../../data/test-auth.db');
process.env.DATABASE_PATH = TEST_DB_PATH;

describe('Auth Middleware', () => {
  let app: express.Express;

  beforeAll(async () => {
    const dbDir = path.dirname(TEST_DB_PATH);
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
    try { fs.unlinkSync(TEST_DB_PATH); } catch { /* ignore */ }

    const { autoSeed } = await import('../services/autoSeed');
    autoSeed();

    const { DevAuthProvider } = await import('../auth/devAuthProvider');
    const { createAuthMiddleware, requireStaff, requireRole } = await import('../auth/middleware');

    app = express();
    app.use(express.json());

    const provider = new DevAuthProvider();
    app.use(createAuthMiddleware(provider));

    // Test routes
    app.get('/test/me', (req, res) => {
      res.json(req.user);
    });

    app.get('/test/staff-only', requireStaff, (_req, res) => {
      res.json({ access: 'granted' });
    });

    app.get('/test/admin-only', requireRole('admin'), (_req, res) => {
      res.json({ access: 'granted' });
    });
  });

  afterAll(() => {
    const sqlite = new Database(TEST_DB_PATH);
    sqlite.close();
    try { fs.unlinkSync(TEST_DB_PATH); } catch { /* ignore */ }
    try { fs.unlinkSync(TEST_DB_PATH + '-wal'); } catch { /* ignore */ }
    try { fs.unlinkSync(TEST_DB_PATH + '-shm'); } catch { /* ignore */ }
  });

  it('should auto-authenticate as admin with no token (dev mode)', async () => {
    const res = await request(app).get('/test/me');
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('admin');
    expect(res.body.lawFirmId).toBe('firm-001');
    expect(res.body.name).toBe('Sarah Chen');
  });

  it('should authenticate with dev-{userId} token', async () => {
    const res = await request(app)
      .get('/test/me')
      .set('Authorization', 'Bearer dev-user-paralegal-001');
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('paralegal');
    expect(res.body.name).toBe('Maria Lopez');
  });

  it('should authenticate with dev-client-{clientId} token', async () => {
    const res = await request(app)
      .get('/test/me')
      .set('Authorization', 'Bearer dev-client-client-001');
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('client');
    expect(res.body.name).toBe('Robert Martinez');
  });

  it('should allow staff to access staff-only routes', async () => {
    const res = await request(app)
      .get('/test/staff-only')
      .set('Authorization', 'Bearer dev-user-admin-001');
    expect(res.status).toBe(200);
  });

  it('should block clients from staff-only routes', async () => {
    const res = await request(app)
      .get('/test/staff-only')
      .set('Authorization', 'Bearer dev-client-client-001');
    expect(res.status).toBe(403);
  });

  it('should allow admin to access admin-only routes', async () => {
    const res = await request(app)
      .get('/test/admin-only')
      .set('Authorization', 'Bearer dev-user-admin-001');
    expect(res.status).toBe(200);
  });

  it('should block paralegal from admin-only routes', async () => {
    const res = await request(app)
      .get('/test/admin-only')
      .set('Authorization', 'Bearer dev-user-paralegal-001');
    expect(res.status).toBe(403);
  });
});
