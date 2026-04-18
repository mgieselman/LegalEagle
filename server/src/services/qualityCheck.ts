/**
 * Upload-time document quality checks — duplicate detection only.
 * Content quality analysis (blur, DPI, readability) belongs in the extraction pipeline.
 */
import type { QualityIssue } from '../db/schema';
import { z } from 'zod/v4';

// Input validation schema
const qualityCheckInputSchema = z.object({
  content: z.instanceof(Buffer),
  filename: z.string().min(1).max(255).refine(name => !name.includes('../') && !name.includes('..\\'), 'Invalid filename'),
  mimeType: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9/\-.]*$/, 'Invalid MIME type'),
  fileHash: z.string().regex(/^[a-f0-9]{64}$/, 'Invalid SHA-256 hash'),
});

export async function checkDocumentQuality(
  content: Buffer,
  filename: string,
  mimeType: string,
  fileHash: string,
  existingDocuments: { originalFilename: string; fileHash: string }[]
): Promise<QualityIssue[]> {
  // Validate inputs
  const validation = qualityCheckInputSchema.safeParse({
    content,
    filename,
    mimeType,
    fileHash,
  });

  if (!validation.success) {
    return [{
      type: 'validation_error',
      message: 'Invalid input parameters',
      severity: 'error',
      canRetry: false,
    }];
  }

  const issues: QualityIssue[] = [];

  // Check for duplicate by file hash (SHA-256)
  const hashDuplicate = existingDocuments.find(doc => doc.fileHash === fileHash);
  if (hashDuplicate) {
    issues.push({
      type: 'duplicate',
      message: `Identical file already uploaded as "${hashDuplicate.originalFilename}"`,
      severity: 'error',
      canRetry: false,
    });
  }

  return issues;
}
