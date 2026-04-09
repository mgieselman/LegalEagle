import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const TEST_DB_PATH = path.join(__dirname, '../../data/test-extraction-svc.db');
process.env.DATABASE_PATH = TEST_DB_PATH;

describe('Extraction Results Service', () => {
  const FIRM_ID = 'firm-001';
  const DOC_ID = 'doc-test-001';
  let createExtractionResult: typeof import('../services/extractionResults').createExtractionResult;
  let getLatestExtraction: typeof import('../services/extractionResults').getLatestExtraction;
  let listExtractionVersions: typeof import('../services/extractionResults').listExtractionVersions;
  let updateExtractionStatus: typeof import('../services/extractionResults').updateExtractionStatus;
  let createCorrectedExtraction: typeof import('../services/extractionResults').createCorrectedExtraction;

  beforeAll(async () => {
    const dbDir = path.dirname(TEST_DB_PATH);
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
    try { fs.unlinkSync(TEST_DB_PATH); } catch { /* ignore */ }

    const { autoSeed } = await import('../services/autoSeed');
    autoSeed();

    // Insert a test document so FK constraints pass
    const dbMod = await import('../db');
    const { documents } = await import('../db/schema');
    dbMod.default.insert(documents).values({
      id: DOC_ID,
      caseId: 'case-001',
      lawFirmId: FIRM_ID,
      uploadedBy: 'user-001',
      originalFilename: 'test.pdf',
      blobPath: 'test/path.pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: 1024,
      fileHash: 'testhash',
      createdAt: new Date().toISOString(),
    }).run();

    const svc = await import('../services/extractionResults');
    createExtractionResult = svc.createExtractionResult;
    getLatestExtraction = svc.getLatestExtraction;
    listExtractionVersions = svc.listExtractionVersions;
    updateExtractionStatus = svc.updateExtractionStatus;
    createCorrectedExtraction = svc.createCorrectedExtraction;
  });

  afterAll(() => {
    const sqlite = new Database(TEST_DB_PATH);
    sqlite.close();
    try { fs.unlinkSync(TEST_DB_PATH); } catch { /* ignore */ }
    try { fs.unlinkSync(TEST_DB_PATH + '-wal'); } catch { /* ignore */ }
    try { fs.unlinkSync(TEST_DB_PATH + '-shm'); } catch { /* ignore */ }
  });

  let firstExtractionId: string;

  it('creates an extraction result (version 1)', () => {
    const result = createExtractionResult({
      documentId: DOC_ID,
      extractionMethod: 'ai_parse',
      confidenceScore: 0.85,
      extractedData: JSON.stringify({ employer: 'Acme Corp', gross_pay: 5000 }),
      status: 'needs_review',
    }, FIRM_ID);

    expect(result.version).toBe(1);
    expect(result.extractionMethod).toBe('ai_parse');
    expect(result.confidenceScore).toBe(0.85);
    firstExtractionId = result.id;
  });

  it('gets latest extraction by document ID', () => {
    const latest = getLatestExtraction(DOC_ID, FIRM_ID);
    expect(latest).toBeDefined();
    expect(latest!.version).toBe(1);
    expect(latest!.status).toBe('needs_review');
  });

  it('returns undefined for nonexistent document', () => {
    expect(getLatestExtraction('nonexistent', FIRM_ID)).toBeUndefined();
  });

  it('enforces tenant isolation', () => {
    expect(getLatestExtraction(DOC_ID, 'other-firm')).toBeUndefined();
  });

  it('updates extraction status', () => {
    const updated = updateExtractionStatus(
      firstExtractionId,
      'reviewed_accepted',
      'user-001',
      'Looks good',
      FIRM_ID,
    );
    expect(updated).toBe(true);

    const latest = getLatestExtraction(DOC_ID, FIRM_ID);
    expect(latest!.status).toBe('reviewed_accepted');
    expect(latest!.reviewedBy).toBe('user-001');
    expect(latest!.reviewNotes).toBe('Looks good');
  });

  it('creates a corrected extraction (version 2)', () => {
    const corrected = createCorrectedExtraction(
      DOC_ID,
      JSON.stringify({ employer: 'Acme Corp', gross_pay: 5200 }),
      'user-001',
      'Fixed gross pay',
      FIRM_ID,
    );

    expect(corrected.version).toBe(2);
    expect(corrected.extractionMethod).toBe('human_entry');
    expect(corrected.confidenceScore).toBe(1.0);
    expect(corrected.status).toBe('reviewed_corrected');
  });

  it('getLatest returns the highest version', () => {
    const latest = getLatestExtraction(DOC_ID, FIRM_ID);
    expect(latest!.version).toBe(2);
    expect(latest!.extractionMethod).toBe('human_entry');
  });

  it('lists all versions', () => {
    const versions = listExtractionVersions(DOC_ID, FIRM_ID);
    expect(versions).toHaveLength(2);
    expect(versions[0].version).toBe(2); // desc order
    expect(versions[1].version).toBe(1);
  });
});
