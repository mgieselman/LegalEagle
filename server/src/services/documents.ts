/**
 * Document service — CRUD for uploaded documents with tenant scoping.
 */
import { eq, and, isNull } from 'drizzle-orm';
import db from '../db';
import { documents, type Document, type QualityIssue } from '../db/schema';

export interface DocumentSummary {
  id: string;
  originalFilename: string;
  mimeType: string;
  fileSizeBytes: number;
  docClass: string | null;
  belongsTo: string;
  processingStatus: string;
  classificationConfidence: number | null;
  classificationMethod: string | null;
  createdAt: string;
  qualityIssues?: QualityIssue[];
}

function toSummary(doc: Document): DocumentSummary {
  return {
    id: doc.id,
    originalFilename: doc.originalFilename,
    mimeType: doc.mimeType,
    fileSizeBytes: doc.fileSizeBytes,
    docClass: doc.docClass,
    belongsTo: doc.belongsTo,
    processingStatus: doc.processingStatus,
    classificationConfidence: doc.classificationConfidence,
    classificationMethod: doc.classificationMethod,
    createdAt: doc.createdAt,
    qualityIssues: doc.qualityIssues ? JSON.parse(doc.qualityIssues as string) : undefined,
  };
}

export function listDocuments(caseId: string, lawFirmId: string): DocumentSummary[] {
  const rows = db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.caseId, caseId),
        eq(documents.lawFirmId, lawFirmId),
        isNull(documents.deletedAt),
      ),
    )
    .all();
  return rows.map(toSummary);
}

export function getDocument(id: string, lawFirmId: string): Document | undefined {
  return db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.id, id),
        eq(documents.lawFirmId, lawFirmId),
        isNull(documents.deletedAt),
      ),
    )
    .get();
}

export interface CreateDocumentInput {
  id: string;
  caseId: string;
  uploadedBy: string;
  originalFilename: string;
  blobPath: string;
  mimeType: string;
  fileSizeBytes: number;
  fileHash: string;
  docClass?: string;
  belongsTo?: string;
  uploadBatchId?: string;
  qualityIssues?: QualityIssue[];
}

export function createDocument(input: CreateDocumentInput, lawFirmId: string): DocumentSummary {
  const now = new Date().toISOString();
  db.insert(documents)
    .values({
      id: input.id,
      caseId: input.caseId,
      lawFirmId,
      uploadedBy: input.uploadedBy,
      originalFilename: input.originalFilename,
      blobPath: input.blobPath,
      mimeType: input.mimeType,
      fileSizeBytes: input.fileSizeBytes,
      fileHash: input.fileHash,
      docClass: input.docClass as Document['docClass'],
      belongsTo: (input.belongsTo ?? 'debtor') as Document['belongsTo'],
      uploadBatchId: input.uploadBatchId,
      qualityIssues: input.qualityIssues ? JSON.stringify(input.qualityIssues) : '[]',
      createdAt: now,
    })
    .run();

  return {
    id: input.id,
    originalFilename: input.originalFilename,
    mimeType: input.mimeType,
    fileSizeBytes: input.fileSizeBytes,
    docClass: input.docClass ?? null,
    belongsTo: input.belongsTo ?? 'debtor',
    processingStatus: 'uploaded',
    classificationConfidence: null,
    classificationMethod: null,
    createdAt: now,
    qualityIssues: input.qualityIssues,
  };
}

export function deleteDocument(id: string, lawFirmId: string): boolean {
  const result = db
    .update(documents)
    .set({ deletedAt: new Date().toISOString() })
    .where(
      and(
        eq(documents.id, id),
        eq(documents.lawFirmId, lawFirmId),
        isNull(documents.deletedAt),
      ),
    )
    .run();
  return result.changes > 0;
}

export function updateProcessingStatus(
  id: string,
  status: Document['processingStatus'],
  lawFirmId: string,
): boolean {
  const result = db
    .update(documents)
    .set({ processingStatus: status })
    .where(and(eq(documents.id, id), eq(documents.lawFirmId, lawFirmId)))
    .run();
  return result.changes > 0;
}

export function updateClassification(
  id: string,
  docClass: Document['docClass'],
  confidence: number,
  method: 'rule_engine' | 'ai',
  lawFirmId: string,
): boolean {
  const result = db
    .update(documents)
    .set({
      docClass,
      classificationConfidence: confidence,
      classificationMethod: method,
    })
    .where(and(eq(documents.id, id), eq(documents.lawFirmId, lawFirmId)))
    .run();
  return result.changes > 0;
}

export function findDuplicateByHash(
  caseId: string,
  fileHash: string,
  lawFirmId: string,
): Document | undefined {
  return db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.caseId, caseId),
        eq(documents.fileHash, fileHash),
        eq(documents.lawFirmId, lawFirmId),
        isNull(documents.deletedAt),
      ),
    )
    .get();
}
