import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const TEST_DB_PATH = path.join(__dirname, '../../data/test-documents-svc.db');
process.env.DATABASE_PATH = TEST_DB_PATH;

describe('Documents Service', () => {
  const FIRM_ID = 'firm-001';
  const CASE_ID = 'case-001';
  let createDocument: typeof import('../services/documents').createDocument;
  let listDocuments: typeof import('../services/documents').listDocuments;
  let getDocument: typeof import('../services/documents').getDocument;
  let deleteDocument: typeof import('../services/documents').deleteDocument;
  let findDuplicateByHash: typeof import('../services/documents').findDuplicateByHash;

  beforeAll(async () => {
    const dbDir = path.dirname(TEST_DB_PATH);
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
    try { fs.unlinkSync(TEST_DB_PATH); } catch { /* ignore */ }

    const { autoSeed } = await import('../services/autoSeed');
    autoSeed();

    const svc = await import('../services/documents');
    createDocument = svc.createDocument;
    listDocuments = svc.listDocuments;
    getDocument = svc.getDocument;
    deleteDocument = svc.deleteDocument;
    findDuplicateByHash = svc.findDuplicateByHash;
  });

  afterAll(() => {
    const sqlite = new Database(TEST_DB_PATH);
    sqlite.close();
    try { fs.unlinkSync(TEST_DB_PATH); } catch { /* ignore */ }
    try { fs.unlinkSync(TEST_DB_PATH + '-wal'); } catch { /* ignore */ }
    try { fs.unlinkSync(TEST_DB_PATH + '-shm'); } catch { /* ignore */ }
  });

  it('creates a document and returns a summary', () => {
    const result = createDocument({
      id: 'doc-001',
      caseId: CASE_ID,
      uploadedBy: 'user-001',
      originalFilename: 'paystub-jan.pdf',
      blobPath: `${FIRM_ID}/client-001/${CASE_ID}/originals/doc-001.pdf`,
      mimeType: 'application/pdf',
      fileSizeBytes: 1024,
      fileHash: 'abc123hash',
    }, FIRM_ID);

    expect(result.id).toBe('doc-001');
    expect(result.originalFilename).toBe('paystub-jan.pdf');
    expect(result.processingStatus).toBe('uploaded');
    expect(result.belongsTo).toBe('debtor');
  });

  it('lists documents for a case', () => {
    const docs = listDocuments(CASE_ID, FIRM_ID);
    expect(docs).toHaveLength(1);
    expect(docs[0].id).toBe('doc-001');
  });

  it('gets a single document by ID', () => {
    const doc = getDocument('doc-001', FIRM_ID);
    expect(doc).toBeDefined();
    expect(doc!.originalFilename).toBe('paystub-jan.pdf');
    expect(doc!.fileHash).toBe('abc123hash');
  });

  it('returns undefined for nonexistent document', () => {
    expect(getDocument('nonexistent', FIRM_ID)).toBeUndefined();
  });

  it('enforces tenant isolation', () => {
    expect(getDocument('doc-001', 'other-firm')).toBeUndefined();
    expect(listDocuments(CASE_ID, 'other-firm')).toHaveLength(0);
  });

  it('finds duplicate by hash', () => {
    const dup = findDuplicateByHash(CASE_ID, 'abc123hash', FIRM_ID);
    expect(dup).toBeDefined();
    expect(dup!.id).toBe('doc-001');
  });

  it('returns undefined when no duplicate exists', () => {
    expect(findDuplicateByHash(CASE_ID, 'newhash', FIRM_ID)).toBeUndefined();
  });

  it('soft-deletes a document', () => {
    const deleted = deleteDocument('doc-001', FIRM_ID);
    expect(deleted).toBe(true);

    // No longer visible in list or get
    expect(listDocuments(CASE_ID, FIRM_ID)).toHaveLength(0);
    expect(getDocument('doc-001', FIRM_ID)).toBeUndefined();
  });

  it('returns false when deleting nonexistent document', () => {
    expect(deleteDocument('nonexistent', FIRM_ID)).toBe(false);
  });

  it('duplicate check ignores soft-deleted documents', () => {
    expect(findDuplicateByHash(CASE_ID, 'abc123hash', FIRM_ID)).toBeUndefined();
  });
});
