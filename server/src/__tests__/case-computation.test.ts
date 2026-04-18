import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
// Import the functions to test (these would need to be exported from the routes file)
// For testing purposes, we'll recreate the logic here as the functions are currently private
import { eq, and, isNull } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { documents, questionnaires, validationResults } from '../db/schema';

const TEST_DB_PATH = path.join(__dirname, '../../data/test-case-computation.db');

// TODO: The CREATE TABLE statements in this test file drifted from db/schema.ts
// (missing law_firm_id column + other columns). Rewrite to reuse the real schema
// via drizzle migrations or setupTestDatabase, instead of hand-rolled DDL.
describe.skip('Case Progress and Attention Computation', () => {
  let db: ReturnType<typeof drizzle>;
  let sqliteDb: Database.Database;

  beforeEach(() => {
    const dbDir = path.dirname(TEST_DB_PATH);
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

    sqliteDb = new Database(TEST_DB_PATH);
    db = drizzle(sqliteDb);
    
    // Create test tables
    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        case_id TEXT NOT NULL,
        firm_id TEXT NOT NULL,
        original_filename TEXT NOT NULL,
        processing_status TEXT NOT NULL,
        deleted_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS questionnaires (
        id TEXT PRIMARY KEY,
        case_id TEXT NOT NULL,
        firm_id TEXT NOT NULL,
        data TEXT NOT NULL DEFAULT '{}',
        version INTEGER NOT NULL DEFAULT 1,
        deleted_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS extraction_results (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        extracted_data TEXT,
        confidence_score REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS validation_results (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        severity TEXT NOT NULL,
        message TEXT NOT NULL,
        is_dismissed BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  });

  afterEach(() => {
    sqliteDb.close();
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  function listDocuments(caseId: string, firmId: string) {
    return db
      .select({
        id: documents.id,
        processingStatus: documents.processingStatus,
      })
      .from(documents)
      .where(
        and(
          eq(documents.caseId, caseId),
          eq(documents.firmId, firmId),
          isNull(documents.deletedAt)
        )
      )
      .all();
  }

  function listCaseValidations(caseId: string, firmId: string) {
    const caseDocuments = listDocuments(caseId, firmId);
    const docIds = caseDocuments.map(d => d.id);
    
    if (docIds.length === 0) return [];

    return db
      .select({
        id: validationResults.id,
        documentId: validationResults.documentId,
        severity: validationResults.severity,
        isDismissed: validationResults.isDismissed,
      })
      .from(validationResults)
      .where(
        and(
          validationResults.documentId.in?.(docIds) ?? eq(validationResults.documentId, docIds[0])
        )
      )
      .all();
  }

  function computeCaseProgress(caseId: string, firmId: string): { docs: string; sections: string } {
    // Document progress: count reviewed/accepted documents
    const docs = listDocuments(caseId, firmId);
    const acceptedDocs = docs.filter(d => d.processingStatus === 'reviewed').length;
    const totalDocs = docs.length;

    // Questionnaire progress: count non-empty sections
    const questionnaire = db
      .select({ data: questionnaires.data })
      .from(questionnaires)
      .where(and(eq(questionnaires.caseId, caseId), isNull(questionnaires.deletedAt)))
      .get();

    let filledSections = 0;
    const totalSections = 27; // Fixed number of sections

    if (questionnaire) {
      try {
        const data = JSON.parse(questionnaire.data) as Record<string, unknown>;
        // Count sections that have at least one non-empty string or non-empty array field
        filledSections = Object.keys(data).filter(key => {
          const value = data[key];
          if (typeof value === 'string') return value.trim() !== '';
          if (Array.isArray(value)) return value.length > 0;
          if (typeof value === 'object' && value !== null) {
            return Object.values(value as Record<string, unknown>).some(subValue => {
              if (typeof subValue === 'string') return subValue.trim() !== '';
              if (Array.isArray(subValue)) return subValue.length > 0;
              return subValue != null;
            });
          }
          return value != null;
        }).length;
      } catch {
        // Invalid JSON, consider 0 sections filled
      }
    }

    return {
      docs: `${acceptedDocs}/${totalDocs}`,
      sections: `${filledSections}/${totalSections}`,
    };
  }

  function computeCaseAttention(caseId: string, firmId: string): { count: number; hasErrors: boolean } {
    // Documents needing review
    const docs = listDocuments(caseId, firmId);
    const needsReview = docs.filter(d => d.processingStatus === 'needs_review' || d.processingStatus === 'extracted').length;

    // Non-dismissed validation warnings
    const validations = listCaseValidations(caseId, firmId);
    const activeValidations = validations.filter(v => !v.isDismissed);
    const errorValidations = activeValidations.filter(v => v.severity === 'error');

    return {
      count: needsReview + activeValidations.length,
      hasErrors: errorValidations.length > 0,
    };
  }

  describe('computeCaseProgress', () => {
    it('should calculate document progress correctly', () => {
      const caseId = 'case-1';
      const firmId = 'firm-1';

      // Insert test documents
      db.insert(documents).values([
        { id: 'doc-1', caseId, firmId, originalFilename: 'doc1.pdf', processingStatus: 'reviewed', deletedAt: null },
        { id: 'doc-2', caseId, firmId, originalFilename: 'doc2.pdf', processingStatus: 'extracted', deletedAt: null },
        { id: 'doc-3', caseId, firmId, originalFilename: 'doc3.pdf', processingStatus: 'reviewed', deletedAt: null },
      ]).run();

      const result = computeCaseProgress(caseId, firmId);
      
      expect(result.docs).toBe('2/3'); // 2 reviewed out of 3 total
    });

    it('should calculate questionnaire progress correctly', () => {
      const caseId = 'case-1';
      const firmId = 'firm-1';

      // Insert questionnaire with some filled sections
      const questionnaireData = {
        section1: 'filled data',
        section2: '',
        section3: ['array', 'with', 'data'],
        section4: [],
        section5: { subfield: 'filled' },
        section6: { subfield: '' },
        section7: null,
        section8: 'another filled field',
      };

      db.insert(questionnaires).values({
        id: 'q-1',
        caseId,
        firmId,
        data: JSON.stringify(questionnaireData),
        version: 1,
        deletedAt: null,
      }).run();

      const result = computeCaseProgress(caseId, firmId);
      
      // Should count: section1 (string), section3 (array), section5 (object with data), section8 (string)
      expect(result.sections).toBe('4/27');
    });

    it('should handle case with no documents', () => {
      const caseId = 'case-empty';
      const firmId = 'firm-1';

      const result = computeCaseProgress(caseId, firmId);
      
      expect(result.docs).toBe('0/0');
    });

    it('should handle case with no questionnaire', () => {
      const caseId = 'case-no-q';
      const firmId = 'firm-1';

      const result = computeCaseProgress(caseId, firmId);
      
      expect(result.sections).toBe('0/27');
    });

    it('should ignore deleted documents', () => {
      const caseId = 'case-1';
      const firmId = 'firm-1';

      db.insert(documents).values([
        { id: 'doc-1', caseId, firmId, originalFilename: 'doc1.pdf', processingStatus: 'reviewed', deletedAt: null },
        { id: 'doc-2', caseId, firmId, originalFilename: 'doc2.pdf', processingStatus: 'reviewed', deletedAt: new Date().toISOString() },
      ]).run();

      const result = computeCaseProgress(caseId, firmId);
      
      expect(result.docs).toBe('1/1'); // Should only count non-deleted document
    });

    it('should handle malformed questionnaire JSON', () => {
      const caseId = 'case-1';
      const firmId = 'firm-1';

      db.insert(questionnaires).values({
        id: 'q-1',
        caseId,
        firmId,
        data: 'invalid json{',
        version: 1,
        deletedAt: null,
      }).run();

      const result = computeCaseProgress(caseId, firmId);
      
      expect(result.sections).toBe('0/27'); // Should handle invalid JSON gracefully
    });
  });

  describe('computeCaseAttention', () => {
    it('should count documents needing review', () => {
      const caseId = 'case-1';
      const firmId = 'firm-1';

      db.insert(documents).values([
        { id: 'doc-1', caseId, firmId, originalFilename: 'doc1.pdf', processingStatus: 'needs_review', deletedAt: null },
        { id: 'doc-2', caseId, firmId, originalFilename: 'doc2.pdf', processingStatus: 'extracted', deletedAt: null },
        { id: 'doc-3', caseId, firmId, originalFilename: 'doc3.pdf', processingStatus: 'reviewed', deletedAt: null },
      ]).run();

      const result = computeCaseAttention(caseId, firmId);
      
      expect(result.count).toBe(2); // 2 docs needing review (needs_review + extracted)
      expect(result.hasErrors).toBe(false);
    });

    it('should count active validation warnings', () => {
      const caseId = 'case-1';
      const firmId = 'firm-1';

      // Insert documents and validation results
      db.insert(documents).values([
        { id: 'doc-1', caseId, firmId, originalFilename: 'doc1.pdf', processingStatus: 'reviewed', deletedAt: null },
      ]).run();

      db.insert(validationResults).values([
        { id: 'val-1', documentId: 'doc-1', severity: 'warning', message: 'Warning 1', isDismissed: false },
        { id: 'val-2', documentId: 'doc-1', severity: 'error', message: 'Error 1', isDismissed: false },
        { id: 'val-3', documentId: 'doc-1', severity: 'warning', message: 'Warning 2', isDismissed: true }, // Dismissed
      ]).run();

      const result = computeCaseAttention(caseId, firmId);
      
      expect(result.count).toBe(2); // 2 active validations (not counting dismissed)
      expect(result.hasErrors).toBe(true); // Has error-level validation
    });

    it('should detect error validations correctly', () => {
      const caseId = 'case-1';
      const firmId = 'firm-1';

      db.insert(documents).values([
        { id: 'doc-1', caseId, firmId, originalFilename: 'doc1.pdf', processingStatus: 'reviewed', deletedAt: null },
      ]).run();

      db.insert(validationResults).values([
        { id: 'val-1', documentId: 'doc-1', severity: 'warning', message: 'Warning 1', isDismissed: false },
        { id: 'val-2', documentId: 'doc-1', severity: 'warning', message: 'Warning 2', isDismissed: false },
      ]).run();

      const result = computeCaseAttention(caseId, firmId);
      
      expect(result.count).toBe(2);
      expect(result.hasErrors).toBe(false); // No error-level validations
    });

    it('should combine document and validation counts', () => {
      const caseId = 'case-1';
      const firmId = 'firm-1';

      // Documents needing review
      db.insert(documents).values([
        { id: 'doc-1', caseId, firmId, originalFilename: 'doc1.pdf', processingStatus: 'needs_review', deletedAt: null },
        { id: 'doc-2', caseId, firmId, originalFilename: 'doc2.pdf', processingStatus: 'reviewed', deletedAt: null },
      ]).run();

      // Validation results
      db.insert(validationResults).values([
        { id: 'val-1', documentId: 'doc-1', severity: 'warning', message: 'Warning 1', isDismissed: false },
        { id: 'val-2', documentId: 'doc-2', severity: 'error', message: 'Error 1', isDismissed: false },
      ]).run();

      const result = computeCaseAttention(caseId, firmId);
      
      expect(result.count).toBe(3); // 1 doc needing review + 2 validations
      expect(result.hasErrors).toBe(true);
    });

    it('should ignore validations for deleted documents', () => {
      const caseId = 'case-1';
      const firmId = 'firm-1';

      db.insert(documents).values([
        { id: 'doc-1', caseId, firmId, originalFilename: 'doc1.pdf', processingStatus: 'reviewed', deletedAt: null },
        { id: 'doc-2', caseId, firmId, originalFilename: 'doc2.pdf', processingStatus: 'reviewed', deletedAt: new Date().toISOString() },
      ]).run();

      db.insert(validationResults).values([
        { id: 'val-1', documentId: 'doc-1', severity: 'warning', message: 'Warning 1', isDismissed: false },
        { id: 'val-2', documentId: 'doc-2', severity: 'error', message: 'Error for deleted doc', isDismissed: false },
      ]).run();

      const result = computeCaseAttention(caseId, firmId);
      
      expect(result.count).toBe(1); // Only validation for non-deleted document
      expect(result.hasErrors).toBe(false); // Error was for deleted document
    });

    it('should handle case with no documents or validations', () => {
      const caseId = 'case-empty';
      const firmId = 'firm-1';

      const result = computeCaseAttention(caseId, firmId);
      
      expect(result.count).toBe(0);
      expect(result.hasErrors).toBe(false);
    });
  });
});