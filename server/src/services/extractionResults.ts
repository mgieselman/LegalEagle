/**
 * Extraction Results service — CRUD for structured data extracted from documents.
 * Each correction creates a new version row (immutable audit trail).
 */
import { eq, and, isNull, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import db from '../db';
import { extractionResults, type ExtractionResult } from '../db/schema';

export interface ExtractionResultRow {
  id: string;
  documentId: string;
  extractionMethod: string;
  confidenceScore: number | null;
  extractedData: string; // JSON string
  status: string;
  version: number;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  createdAt: string;
}

function toRow(r: ExtractionResult): ExtractionResultRow {
  return {
    id: r.id,
    documentId: r.documentId,
    extractionMethod: r.extractionMethod,
    confidenceScore: r.confidenceScore,
    extractedData: r.extractedData,
    status: r.status,
    version: r.version,
    reviewedBy: r.reviewedBy,
    reviewedAt: r.reviewedAt,
    reviewNotes: r.reviewNotes,
    createdAt: r.createdAt,
  };
}

export interface CreateExtractionInput {
  documentId: string;
  extractionMethod: 'rule_engine' | 'ai_parse' | 'human_entry';
  confidenceScore: number | null;
  extractedData: string; // JSON string
  status: 'pending' | 'auto_accepted' | 'ai_accepted' | 'needs_review';
}

export function createExtractionResult(
  input: CreateExtractionInput,
  lawFirmId: string,
): ExtractionResultRow {
  const id = uuidv4();
  const now = new Date().toISOString();

  // Get the current max version for this document
  const existing = db
    .select({ version: extractionResults.version })
    .from(extractionResults)
    .where(and(eq(extractionResults.documentId, input.documentId), eq(extractionResults.lawFirmId, lawFirmId)))
    .orderBy(desc(extractionResults.version))
    .get();
  const nextVersion = existing ? existing.version + 1 : 1;

  db.insert(extractionResults)
    .values({
      id,
      documentId: input.documentId,
      lawFirmId,
      extractionMethod: input.extractionMethod,
      confidenceScore: input.confidenceScore,
      extractedData: input.extractedData,
      status: input.status,
      version: nextVersion,
      createdAt: now,
    })
    .run();

  return {
    id,
    documentId: input.documentId,
    extractionMethod: input.extractionMethod,
    confidenceScore: input.confidenceScore,
    extractedData: input.extractedData,
    status: input.status,
    version: nextVersion,
    reviewedBy: null,
    reviewedAt: null,
    reviewNotes: null,
    createdAt: now,
  };
}

/** Get the latest (highest version) extraction result for a document. */
export function getLatestExtraction(
  documentId: string,
  lawFirmId: string,
): ExtractionResultRow | undefined {
  const result = db
    .select()
    .from(extractionResults)
    .where(
      and(
        eq(extractionResults.documentId, documentId),
        eq(extractionResults.lawFirmId, lawFirmId),
        isNull(extractionResults.deletedAt),
      ),
    )
    .orderBy(desc(extractionResults.version))
    .get();
  return result ? toRow(result) : undefined;
}

/** List all extraction result versions for a document. */
export function listExtractionVersions(
  documentId: string,
  lawFirmId: string,
): ExtractionResultRow[] {
  return db
    .select()
    .from(extractionResults)
    .where(
      and(
        eq(extractionResults.documentId, documentId),
        eq(extractionResults.lawFirmId, lawFirmId),
        isNull(extractionResults.deletedAt),
      ),
    )
    .orderBy(desc(extractionResults.version))
    .all()
    .map(toRow);
}

/** Update extraction status (for accept/review). */
export function updateExtractionStatus(
  id: string,
  status: ExtractionResult['status'],
  reviewedBy: string | null,
  reviewNotes: string | null,
  lawFirmId: string,
): boolean {
  const result = db
    .update(extractionResults)
    .set({
      status,
      reviewedBy,
      reviewedAt: new Date().toISOString(),
      reviewNotes,
    })
    .where(and(eq(extractionResults.id, id), eq(extractionResults.lawFirmId, lawFirmId)))
    .run();
  return result.changes > 0;
}

/** Create a corrected extraction (new version with human_entry method). */
export function createCorrectedExtraction(
  documentId: string,
  correctedData: string,
  reviewedBy: string,
  reviewNotes: string,
  lawFirmId: string,
): ExtractionResultRow {
  const result = createExtractionResult(
    {
      documentId,
      extractionMethod: 'human_entry',
      confidenceScore: 1.0,
      extractedData: correctedData,
      status: 'auto_accepted', // accepted since human-verified
    },
    lawFirmId,
  );

  // Update to reviewed_corrected status
  updateExtractionStatus(result.id, 'reviewed_corrected', reviewedBy, reviewNotes, lawFirmId);
  result.status = 'reviewed_corrected';
  result.reviewedBy = reviewedBy;
  result.reviewNotes = reviewNotes;
  return result;
}
