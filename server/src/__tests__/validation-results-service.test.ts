import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const TEST_DB_PATH = path.join(__dirname, '../../data/test-validation-svc.db');
process.env.DATABASE_PATH = TEST_DB_PATH;

describe('Validation Results Service', () => {
  const FIRM_ID = 'firm-001';
  const CASE_ID = 'case-001';
  const DOC_ID = 'doc-val-001';
  let createValidationResult: typeof import('../services/validationResults').createValidationResult;
  let listCaseValidations: typeof import('../services/validationResults').listCaseValidations;
  let listDocumentValidations: typeof import('../services/validationResults').listDocumentValidations;
  let dismissValidation: typeof import('../services/validationResults').dismissValidation;
  let clearDocumentValidations: typeof import('../services/validationResults').clearDocumentValidations;

  beforeAll(async () => {
    const dbDir = path.dirname(TEST_DB_PATH);
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
    try { fs.unlinkSync(TEST_DB_PATH); } catch { /* ignore */ }

    const { autoSeed } = await import('../services/autoSeed');
    autoSeed();

    // Insert a test document
    const dbMod = await import('../db');
    const { documents } = await import('../db/schema');
    dbMod.default.insert(documents).values({
      id: DOC_ID,
      caseId: CASE_ID,
      lawFirmId: FIRM_ID,
      uploadedBy: 'user-001',
      originalFilename: 'test.pdf',
      blobPath: 'test/path.pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: 1024,
      fileHash: 'valhash',
      createdAt: new Date().toISOString(),
    }).run();

    const svc = await import('../services/validationResults');
    createValidationResult = svc.createValidationResult;
    listCaseValidations = svc.listCaseValidations;
    listDocumentValidations = svc.listDocumentValidations;
    dismissValidation = svc.dismissValidation;
    clearDocumentValidations = svc.clearDocumentValidations;
  });

  afterAll(() => {
    const sqlite = new Database(TEST_DB_PATH);
    sqlite.close();
    try { fs.unlinkSync(TEST_DB_PATH); } catch { /* ignore */ }
    try { fs.unlinkSync(TEST_DB_PATH + '-wal'); } catch { /* ignore */ }
    try { fs.unlinkSync(TEST_DB_PATH + '-shm'); } catch { /* ignore */ }
  });

  let warningId: string;

  it('creates a validation result', () => {
    const result = createValidationResult({
      caseId: CASE_ID,
      documentId: DOC_ID,
      validationType: 'internal_consistency',
      severity: 'warning',
      message: 'Gross pay minus deductions does not equal net pay',
    }, FIRM_ID);

    expect(result.severity).toBe('warning');
    expect(result.isDismissed).toBe(false);
    warningId = result.id;
  });

  it('creates a case-level validation (no documentId)', () => {
    createValidationResult({
      caseId: CASE_ID,
      validationType: 'temporal_gap',
      severity: 'info',
      message: 'Missing paystubs for February 2026',
    }, FIRM_ID);
  });

  it('lists validations by case', () => {
    const results = listCaseValidations(CASE_ID, FIRM_ID);
    expect(results).toHaveLength(2);
  });

  it('lists validations by document', () => {
    const results = listDocumentValidations(DOC_ID, FIRM_ID);
    expect(results).toHaveLength(1);
    expect(results[0].validationType).toBe('internal_consistency');
  });

  it('enforces tenant isolation', () => {
    expect(listCaseValidations(CASE_ID, 'other-firm')).toHaveLength(0);
  });

  it('dismisses a validation', () => {
    const dismissed = dismissValidation(warningId, 'user-001', FIRM_ID);
    expect(dismissed).toBe(true);

    const results = listDocumentValidations(DOC_ID, FIRM_ID);
    expect(results[0].isDismissed).toBe(true);
  });

  it('clears document validations (soft-delete)', () => {
    clearDocumentValidations(DOC_ID, FIRM_ID);

    const results = listDocumentValidations(DOC_ID, FIRM_ID);
    expect(results).toHaveLength(0);

    // Case-level validation (no documentId) still exists
    const caseResults = listCaseValidations(CASE_ID, FIRM_ID);
    expect(caseResults).toHaveLength(1); // temporal_gap remains
  });
});
