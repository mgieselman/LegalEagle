import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const TEST_DB_PATH = path.join(__dirname, '../../data/test-clients.db');
process.env.DATABASE_PATH = TEST_DB_PATH;

describe('Clients API', () => {
  let app: express.Express;

  beforeAll(async () => {
    const dbDir = path.dirname(TEST_DB_PATH);
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
    try { fs.unlinkSync(TEST_DB_PATH); } catch { /* ignore */ }

    const { autoSeed } = await import('../services/autoSeed');
    autoSeed();

    const { DevAuthProvider } = await import('../auth/devAuthProvider');
    const { createAuthMiddleware } = await import('../auth/middleware');
    const clientsRouter = (await import('../routes/clients')).default;

    const provider = new DevAuthProvider();
    app = express();
    app.use(express.json());
    app.use(createAuthMiddleware(provider));
    app.use('/api/clients', clientsRouter);
  });

  afterAll(() => {
    const sqlite = new Database(TEST_DB_PATH);
    sqlite.close();
    try { fs.unlinkSync(TEST_DB_PATH); } catch { /* ignore */ }
    try { fs.unlinkSync(TEST_DB_PATH + '-wal'); } catch { /* ignore */ }
    try { fs.unlinkSync(TEST_DB_PATH + '-shm'); } catch { /* ignore */ }
  });

  it('should list seeded clients', async () => {
    const res = await request(app).get('/api/clients');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(3);
  });

  it('should create a new client with a case', async () => {
    const res = await request(app)
      .post('/api/clients')
      .send({ firstName: 'Jane', lastName: 'Smith', email: 'jane@test.com', chapter: '7' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.caseId).toBeDefined();
  });

  it('should create a client without a case', async () => {
    const res = await request(app)
      .post('/api/clients')
      .send({ firstName: 'No', lastName: 'Case' });
    expect(res.status).toBe(201);
    expect(res.body.caseId).toBeNull();
  });

  it('should reject missing first name', async () => {
    const res = await request(app)
      .post('/api/clients')
      .send({ lastName: 'Smith' });
    expect(res.status).toBe(400);
  });

  it('should get a specific client', async () => {
    const res = await request(app).get('/api/clients/client-001');
    expect(res.status).toBe(200);
    expect(res.body.firstName).toBe('Robert');
  });

  it('should update a client', async () => {
    const res = await request(app)
      .put('/api/clients/client-001')
      .send({ phone: '555-1234' });
    expect(res.status).toBe(200);
  });

  it('should soft delete a client', async () => {
    // Create a throwaway client
    const createRes = await request(app)
      .post('/api/clients')
      .send({ firstName: 'Delete', lastName: 'Me' });
    const id = createRes.body.id;

    const delRes = await request(app).delete(`/api/clients/${id}`);
    expect(delRes.status).toBe(200);

    // Should not appear in list
    const listRes = await request(app).get('/api/clients');
    const found = listRes.body.find((c: { id: string }) => c.id === id);
    expect(found).toBeUndefined();
  });

  it('should return 404 for nonexistent client', async () => {
    const res = await request(app).get('/api/clients/nonexistent');
    expect(res.status).toBe(404);
  });
});
