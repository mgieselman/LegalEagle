import { describe, it, expect } from 'vitest';
import { checkDocumentQuality } from '../services/qualityCheck';

const VALID_HASH_A = 'a'.repeat(64);
const VALID_HASH_B = 'b'.repeat(64);
const VALID_HASH_C = 'c'.repeat(64);

describe('Document Quality Check Service', () => {
  const mockExistingDocuments = [
    {
      originalFilename: 'existing-paystub.pdf',
      fileHash: VALID_HASH_A,
    },
    {
      originalFilename: 'existing-bank-statement.pdf',
      fileHash: VALID_HASH_B,
    },
  ];

  describe('Duplicate Detection', () => {
    it('should detect duplicate files by hash', async () => {
      const issues = await checkDocumentQuality(
        Buffer.from('test content'),
        'new-paystub.pdf',
        'application/pdf',
        VALID_HASH_A,
        mockExistingDocuments,
      );

      expect(issues).toHaveLength(1);
      expect(issues[0]).toEqual({
        type: 'duplicate',
        message: 'Identical file already uploaded as "existing-paystub.pdf"',
        severity: 'error',
        canRetry: false,
      });
    });

    it('should not flag unique files as duplicates', async () => {
      const issues = await checkDocumentQuality(
        Buffer.from('test content'),
        'unique-document.pdf',
        'application/pdf',
        VALID_HASH_C,
        mockExistingDocuments,
      );

      expect(issues).toHaveLength(0);
    });

    it('should return empty array when no existing documents', async () => {
      const issues = await checkDocumentQuality(
        Buffer.from('test content'),
        'document.pdf',
        'application/pdf',
        VALID_HASH_C,
        [],
      );

      expect(issues).toHaveLength(0);
    });
  });

  describe('Input Validation', () => {
    it('returns validation_error for a non-SHA-256 hash', async () => {
      const issues = await checkDocumentQuality(
        Buffer.from('test content'),
        'document.pdf',
        'application/pdf',
        'not-a-real-hash',
        [],
      );

      expect(issues).toHaveLength(1);
      expect(issues[0].type).toBe('validation_error');
    });

    it('returns validation_error for an empty filename', async () => {
      const issues = await checkDocumentQuality(
        Buffer.from('test content'),
        '',
        'application/pdf',
        VALID_HASH_A,
        [],
      );

      expect(issues).toHaveLength(1);
      expect(issues[0].type).toBe('validation_error');
    });

    it('returns validation_error for a path-traversal filename', async () => {
      const issues = await checkDocumentQuality(
        Buffer.from('test content'),
        '../etc/passwd.pdf',
        'application/pdf',
        VALID_HASH_A,
        [],
      );

      expect(issues).toHaveLength(1);
      expect(issues[0].type).toBe('validation_error');
    });
  });
});
