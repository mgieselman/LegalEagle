import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import os from 'os';

const TEST_DB_PATH = path.join(__dirname, '../../data/test-documents-api.db');
const TEST_UPLOADS_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'legaleagle-doc-test-'));
process.env.DATABASE_PATH = TEST_DB_PATH;
process.env.BLOB_STORAGE_PATH = TEST_UPLOADS_DIR;

describe('Documents API', () => {
  let app: express.Express;
  const CASE_ID = 'case-001';
  let uploadedDocId: string;

  beforeAll(async () => {
    const dbDir = path.dirname(TEST_DB_PATH);
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
    try { fs.unlinkSync(TEST_DB_PATH); } catch { /* ignore */ }

    const { autoSeed } = await import('../services/autoSeed');
    autoSeed();

    const { DevAuthProvider } = await import('../auth/devAuthProvider');
    const { createAuthMiddleware } = await import('../auth/middleware');
    const documentsRouter = (await import('../routes/documents')).default;

    const provider = new DevAuthProvider();
    app = express();
    app.use(express.json());
    app.use(createAuthMiddleware(provider));
    app.use('/api/documents', documentsRouter);
  });

  afterAll(() => {
    const sqlite = new Database(TEST_DB_PATH);
    sqlite.close();
    try { fs.unlinkSync(TEST_DB_PATH); } catch { /* ignore */ }
    try { fs.unlinkSync(TEST_DB_PATH + '-wal'); } catch { /* ignore */ }
    try { fs.unlinkSync(TEST_DB_PATH + '-shm'); } catch { /* ignore */ }
    fs.rmSync(TEST_UPLOADS_DIR, { recursive: true, force: true });
  });

  it('uploads a PDF file', async () => {
    const res = await request(app)
      .post('/api/documents/upload')
      .field('caseId', CASE_ID)
      .field('belongsTo', 'debtor')
      .attach('file', Buffer.from('fake pdf content'), 'paystub.pdf');

    expect(res.status).toBe(201);
    expect(res.body.originalFilename).toBe('paystub.pdf');
    expect(res.body.processingStatus).toBe('uploaded');
    expect(res.body.id).toBeDefined();
    uploadedDocId = res.body.id;
  });

  it('rejects upload with no file', async () => {
    const res = await request(app)
      .post('/api/documents/upload')
      .field('caseId', CASE_ID);

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('No file');
  });

  it('rejects upload with disallowed extension', async () => {
    const res = await request(app)
      .post('/api/documents/upload')
      .field('caseId', CASE_ID)
      .attach('file', Buffer.from('exe content'), 'malware.exe');

    expect(res.status).toBe(400);
  });

  it('rejects upload without caseId', async () => {
    const res = await request(app)
      .post('/api/documents/upload')
      .attach('file', Buffer.from('data'), 'file.pdf');

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Invalid metadata');
  });

  it('rejects upload for nonexistent case', async () => {
    const res = await request(app)
      .post('/api/documents/upload')
      .field('caseId', 'nonexistent-case')
      .attach('file', Buffer.from('data'), 'file.pdf');

    expect(res.status).toBe(404);
    expect(res.body.error).toContain('Case not found');
  });

  it('rejects duplicate file (same hash)', async () => {
    const res = await request(app)
      .post('/api/documents/upload')
      .field('caseId', CASE_ID)
      .attach('file', Buffer.from('fake pdf content'), 'paystub-copy.pdf');

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('Duplicate');
    expect(res.body.existingFilename).toBe('paystub.pdf');
  });

  it('lists documents for a case', async () => {
    const res = await request(app)
      .get('/api/documents')
      .query({ caseId: CASE_ID });

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].originalFilename).toBe('paystub.pdf');
  });

  it('requires caseId query parameter for list', async () => {
    const res = await request(app).get('/api/documents');
    expect(res.status).toBe(400);
  });

  it('downloads a document', async () => {
    const res = await request(app)
      .get(`/api/documents/${uploadedDocId}/download`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.headers['content-disposition']).toContain('paystub.pdf');
    expect(res.body).toEqual(Buffer.from('fake pdf content'));
  });

  it('returns 404 for downloading nonexistent document', async () => {
    const res = await request(app).get('/api/documents/nonexistent/download');
    expect(res.status).toBe(404);
  });

  it('soft-deletes a document', async () => {
    const res = await request(app).delete(`/api/documents/${uploadedDocId}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify it no longer appears in list
    const listRes = await request(app)
      .get('/api/documents')
      .query({ caseId: CASE_ID });
    expect(listRes.body).toHaveLength(0);
  });

  it('returns 404 when deleting nonexistent document', async () => {
    const res = await request(app).delete('/api/documents/nonexistent');
    expect(res.status).toBe(404);
  });
});
