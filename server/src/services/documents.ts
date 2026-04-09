/**
 * Document service — CRUD for uploaded documents with tenant scoping.
 */
import { eq, and, isNull } from 'drizzle-orm';
import db from '../db';
import { documents, type Document } from '../db/schema';

export interface DocumentSummary {
  id: string;
  originalFilename: string;
  mimeType: string;
  fileSizeBytes: number;
  docClass: string | null;
  belongsTo: string;
  processingStatus: string;
  createdAt: string;
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
    createdAt: doc.createdAt,
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
    createdAt: now,
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
