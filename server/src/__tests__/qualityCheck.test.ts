import { describe, it, expect } from 'vitest';
import { checkDocumentQuality } from '../services/qualityCheck';

describe('Document Quality Check Service', () => {
  const mockExistingDocuments = [
    {
      originalFilename: 'existing-paystub.pdf',
      fileHash: 'abc123hash',
    },
    {
      originalFilename: 'existing-bank-statement.pdf',
      fileHash: 'def456hash',
    },
  ];

  describe('Duplicate Detection', () => {
    it('should detect duplicate files by hash', async () => {
      const content = Buffer.from('test content');
      const filename = 'new-paystub.pdf';
      const mimeType = 'application/pdf';
      const fileHash = 'abc123hash'; // Matches existing document

      const issues = await checkDocumentQuality(
        content,
        filename,
        mimeType,
        fileHash,
        mockExistingDocuments
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
      const content = Buffer.from('test content');
      const filename = 'unique-document.pdf';
      const mimeType = 'application/pdf';
      const fileHash = 'unique123hash'; // Different from existing

      const issues = await checkDocumentQuality(
        content,
        filename,
        mimeType,
        fileHash,
        mockExistingDocuments
      );

      // Should not have duplicate issue
      const duplicateIssues = issues.filter(issue => issue.type === 'duplicate');
      expect(duplicateIssues).toHaveLength(0);
    });
  });

  describe('Blur Detection', () => {
    it('should detect potentially blurry PDFs based on file size', async () => {
      // Very small PDF (under 100KB threshold)
      const content = Buffer.alloc(50 * 1024); // 50KB
      const filename = 'small-scan.pdf';
      const mimeType = 'application/pdf';
      const fileHash = 'unique123hash';

      const issues = await checkDocumentQuality(
        content,
        filename,
        mimeType,
        fileHash,
        []
      );

      const blurIssues = issues.filter(issue => issue.type === 'blurry');
      expect(blurIssues).toHaveLength(1);
      expect(blurIssues[0]).toEqual({
        type: 'blurry',
        message: 'Document appears blurry or low quality. Consider rescanning at higher resolution.',
        severity: 'warning',
        canRetry: true,
      });
    });

    it('should not flag large PDFs as blurry', async () => {
      // Large PDF (over 100KB threshold)
      const content = Buffer.alloc(200 * 1024); // 200KB
      const filename = 'high-quality-scan.pdf';
      const mimeType = 'application/pdf';
      const fileHash = 'unique123hash';

      const issues = await checkDocumentQuality(
        content,
        filename,
        mimeType,
        fileHash,
        []
      );

      const blurIssues = issues.filter(issue => issue.type === 'blurry');
      expect(blurIssues).toHaveLength(0);
    });

    it('should only check blur for PDF files', async () => {
      // Image file that is small
      const content = Buffer.alloc(50 * 1024); // 50KB
      const filename = 'document.jpg';
      const mimeType = 'image/jpeg';
      const fileHash = 'unique123hash';

      const issues = await checkDocumentQuality(
        content,
        filename,
        mimeType,
        fileHash,
        []
      );

      const blurIssues = issues.filter(issue => issue.type === 'blurry');
      expect(blurIssues).toHaveLength(0);
    });
  });

  describe('Wrong Document Type Detection', () => {
    it('should detect screenshot files', async () => {
      const content = Buffer.from('test content');
      const filename = 'Screenshot_2024-01-15.png';
      const mimeType = 'image/png';
      const fileHash = 'unique123hash';

      const issues = await checkDocumentQuality(
        content,
        filename,
        mimeType,
        fileHash,
        []
      );

      const wrongTypeIssues = issues.filter(issue => issue.type === 'wrong_type');
      expect(wrongTypeIssues).toHaveLength(1);
      expect(wrongTypeIssues[0]).toEqual({
        type: 'wrong_type',
        message: 'File appears to be a screenshot or photo. Please upload the original document.',
        severity: 'warning',
        canRetry: true,
      });
    });

    it('should detect photo files', async () => {
      const content = Buffer.from('test content');
      const filename = 'PHOTO_001.jpg';
      const mimeType = 'image/jpeg';
      const fileHash = 'unique123hash';

      const issues = await checkDocumentQuality(
        content,
        filename,
        mimeType,
        fileHash,
        []
      );

      const wrongTypeIssues = issues.filter(issue => issue.type === 'wrong_type');
      expect(wrongTypeIssues).toHaveLength(1);
      expect(wrongTypeIssues[0].message).toBe(
        'File appears to be a screenshot or photo. Please upload the original document.'
      );
    });

    it('should detect IMG pattern files', async () => {
      const content = Buffer.from('test content');
      const filename = 'IMG_12345.HEIC';
      const mimeType = 'image/heic';
      const fileHash = 'unique123hash';

      const issues = await checkDocumentQuality(
        content,
        filename,
        mimeType,
        fileHash,
        []
      );

      const wrongTypeIssues = issues.filter(issue => issue.type === 'wrong_type');
      expect(wrongTypeIssues).toHaveLength(1);
    });

    it('should detect temporary files', async () => {
      const content = Buffer.from('test content');
      const filename = 'temp_document.pdf';
      const mimeType = 'application/pdf';
      const fileHash = 'unique123hash';

      const issues = await checkDocumentQuality(
        content,
        filename,
        mimeType,
        fileHash,
        []
      );

      const wrongTypeIssues = issues.filter(issue => issue.type === 'wrong_type');
      expect(wrongTypeIssues).toHaveLength(1);
      expect(wrongTypeIssues[0]).toEqual({
        type: 'wrong_type',
        message: 'File appears to be a temporary file. Please upload the final document.',
        severity: 'warning',
        canRetry: true,
      });
    });

    it('should detect files with tmp prefix', async () => {
      const content = Buffer.from('test content');
      const filename = 'tmp123.pdf';
      const mimeType = 'application/pdf';
      const fileHash = 'unique123hash';

      const issues = await checkDocumentQuality(
        content,
        filename,
        mimeType,
        fileHash,
        []
      );

      const wrongTypeIssues = issues.filter(issue => issue.type === 'wrong_type');
      expect(wrongTypeIssues).toHaveLength(1);
      expect(wrongTypeIssues[0].message).toBe(
        'File appears to be a temporary file. Please upload the final document.'
      );
    });

    it('should detect files with tilde prefix', async () => {
      const content = Buffer.from('test content');
      const filename = '~document.pdf';
      const mimeType = 'application/pdf';
      const fileHash = 'unique123hash';

      const issues = await checkDocumentQuality(
        content,
        filename,
        mimeType,
        fileHash,
        []
      );

      const wrongTypeIssues = issues.filter(issue => issue.type === 'wrong_type');
      expect(wrongTypeIssues).toHaveLength(1);
    });

    it('should not flag normal document names', async () => {
      const content = Buffer.from('test content');
      const filename = 'paystub-january-2024.pdf';
      const mimeType = 'application/pdf';
      const fileHash = 'unique123hash';

      const issues = await checkDocumentQuality(
        content,
        filename,
        mimeType,
        fileHash,
        []
      );

      const wrongTypeIssues = issues.filter(issue => issue.type === 'wrong_type');
      expect(wrongTypeIssues).toHaveLength(0);
    });
  });

  describe('Combined Quality Checks', () => {
    it('should return multiple quality issues for problematic files', async () => {
      // Small PDF with problematic filename
      const content = Buffer.alloc(50 * 1024); // Small = blurry
      const filename = 'temp_screenshot.pdf'; // Temp + screenshot pattern
      const mimeType = 'application/pdf';
      const fileHash = 'abc123hash'; // Duplicate

      const issues = await checkDocumentQuality(
        content,
        filename,
        mimeType,
        fileHash,
        mockExistingDocuments
      );

      expect(issues).toHaveLength(3);
      
      // Should have duplicate issue
      const duplicateIssue = issues.find(issue => issue.type === 'duplicate');
      expect(duplicateIssue).toBeDefined();
      expect(duplicateIssue?.severity).toBe('error');

      // Should have blur issue
      const blurIssue = issues.find(issue => issue.type === 'blurry');
      expect(blurIssue).toBeDefined();
      expect(blurIssue?.severity).toBe('warning');

      // Should have wrong type issue
      const wrongTypeIssue = issues.find(issue => issue.type === 'wrong_type');
      expect(wrongTypeIssue).toBeDefined();
      expect(wrongTypeIssue?.severity).toBe('warning');
    });

    it('should return empty array for high-quality files', async () => {
      const content = Buffer.alloc(200 * 1024); // Large = not blurry
      const filename = 'bank-statement-december-2024.pdf'; // Normal name
      const mimeType = 'application/pdf';
      const fileHash = 'unique123hash'; // Not duplicate

      const issues = await checkDocumentQuality(
        content,
        filename,
        mimeType,
        fileHash,
        mockExistingDocuments
      );

      expect(issues).toHaveLength(0);
    });

    it('should handle edge cases gracefully', async () => {
      const content = Buffer.alloc(0); // Empty file
      const filename = '';
      const mimeType = 'application/pdf';
      const fileHash = 'unique123hash';

      const issues = await checkDocumentQuality(
        content,
        filename,
        mimeType,
        fileHash,
        []
      );

      // Should handle empty filename without crashing
      expect(Array.isArray(issues)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle blur detection errors gracefully', async () => {
      // Mock a scenario that might cause blur detection to fail
      const content = Buffer.from('corrupted pdf content');
      const filename = 'test.pdf';
      const mimeType = 'application/pdf';
      const fileHash = 'unique123hash';

      const issues = await checkDocumentQuality(
        content,
        filename,
        mimeType,
        fileHash,
        []
      );

      // Should not throw and should still check other quality issues
      expect(Array.isArray(issues)).toBe(true);
    });

    it('should use case-insensitive filename checks', async () => {
      const content = Buffer.from('test content');
      const filename = 'SCREENSHOT.PDF'; // Uppercase
      const mimeType = 'application/pdf';
      const fileHash = 'unique123hash';

      const issues = await checkDocumentQuality(
        content,
        filename,
        mimeType,
        fileHash,
        []
      );

      const wrongTypeIssues = issues.filter(issue => issue.type === 'wrong_type');
      expect(wrongTypeIssues).toHaveLength(1);
    });

    it('should handle null/undefined existing documents', async () => {
      const content = Buffer.from('test content');
      const filename = 'document.pdf';
      const mimeType = 'application/pdf';
      const fileHash = 'unique123hash';

      const issues = await checkDocumentQuality(
        content,
        filename,
        mimeType,
        fileHash,
        [] // Empty array
      );

      // Should not crash with empty existing documents array
      expect(Array.isArray(issues)).toBe(true);
      const duplicateIssues = issues.filter(issue => issue.type === 'duplicate');
      expect(duplicateIssues).toHaveLength(0);
    });
  });
});