import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const TEST_DB_PATH = path.join(__dirname, '../../data/test-cases.db');
process.env.DATABASE_PATH = TEST_DB_PATH;

describe('Cases API', () => {
  let app: express.Express;

  beforeAll(async () => {
    const dbDir = path.dirname(TEST_DB_PATH);
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
    try { fs.unlinkSync(TEST_DB_PATH); } catch { /* ignore */ }

    const { autoSeed } = await import('../services/autoSeed');
    autoSeed();

    const { DevAuthProvider } = await import('../auth/devAuthProvider');
    const { createAuthMiddleware } = await import('../auth/middleware');
    const casesRouter = (await import('../routes/cases')).default;

    const provider = new DevAuthProvider();
    app = express();
    app.use(express.json());
    app.use(createAuthMiddleware(provider));
    app.use('/api/cases', casesRouter);
  });

  afterAll(() => {
    const sqlite = new Database(TEST_DB_PATH);
    sqlite.close();
    try { fs.unlinkSync(TEST_DB_PATH); } catch { /* ignore */ }
    try { fs.unlinkSync(TEST_DB_PATH + '-wal'); } catch { /* ignore */ }
    try { fs.unlinkSync(TEST_DB_PATH + '-shm'); } catch { /* ignore */ }
  });

  it('should list seeded cases', async () => {
    const res = await request(app).get('/api/cases');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(4);
    // Should include client names from join
    expect(res.body[0].clientFirstName).toBeDefined();
  });

  it('should get a case with its questionnaire', async () => {
    const res = await request(app).get('/api/cases/case-001');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('review');
    expect(res.body.questionnaire).toBeDefined();
    expect(res.body.questionnaire.data.fullName).toBe('Robert James Martinez');
    expect(res.body.client).toBeDefined();
  });

  it('should create a new case for existing client', async () => {
    const res = await request(app)
      .post('/api/cases')
      .send({ clientId: 'client-001', chapter: '13' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.questionnaireId).toBeDefined();
  });

  it('should reject case for nonexistent client', async () => {
    const res = await request(app)
      .post('/api/cases')
      .send({ clientId: 'nonexistent', chapter: '7' });
    expect(res.status).toBe(404);
  });

  it('should reject invalid chapter', async () => {
    const res = await request(app)
      .post('/api/cases')
      .send({ clientId: 'client-001', chapter: '11' });
    expect(res.status).toBe(400);
  });

  it('should update case status', async () => {
    const res = await request(app)
      .put('/api/cases/case-002')
      .send({ status: 'documents' });
    expect(res.status).toBe(200);

    // Verify update
    const getRes = await request(app).get('/api/cases/case-002');
    expect(getRes.body.status).toBe('documents');
  });

  it('should soft delete a case', async () => {
    const res = await request(app).delete('/api/cases/case-004');
    expect(res.status).toBe(200);

    // Should not appear in list
    const listRes = await request(app).get('/api/cases');
    const found = listRes.body.find((c: { id: string }) => c.id === 'case-004');
    expect(found).toBeUndefined();
  });

  it('should return 404 for nonexistent case', async () => {
    const res = await request(app).get('/api/cases/nonexistent');
    expect(res.status).toBe(404);
  });
});
