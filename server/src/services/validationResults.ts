/**
 * Validation Results service — stores consistency check findings for documents/cases.
 */
import { eq, and, isNull } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import db from '../db';
import { validationResults, type ValidationResult } from '../db/schema';

export interface ValidationResultRow {
  id: string;
  caseId: string;
  documentId: string | null;
  validationType: string;
  severity: string;
  message: string;
  detailsJson: string | null;
  isDismissed: boolean;
  createdAt: string;
}

function toRow(r: ValidationResult): ValidationResultRow {
  return {
    id: r.id,
    caseId: r.caseId,
    documentId: r.documentId,
    validationType: r.validationType,
    severity: r.severity,
    message: r.message,
    detailsJson: r.detailsJson,
    isDismissed: r.isDismissed,
    createdAt: r.createdAt,
  };
}

export interface CreateValidationInput {
  caseId: string;
  documentId?: string;
  validationType: 'internal_consistency' | 'cross_document' | 'temporal_gap' | 'questionnaire_mismatch';
  severity: 'error' | 'warning' | 'info';
  message: string;
  detailsJson?: string;
}

export function createValidationResult(
  input: CreateValidationInput,
  lawFirmId: string,
): ValidationResultRow {
  const id = uuidv4();
  const now = new Date().toISOString();
  db.insert(validationResults)
    .values({
      id,
      caseId: input.caseId,
      documentId: input.documentId ?? null,
      lawFirmId,
      validationType: input.validationType,
      severity: input.severity,
      message: input.message,
      detailsJson: input.detailsJson ?? null,
      createdAt: now,
    })
    .run();

  return {
    id,
    caseId: input.caseId,
    documentId: input.documentId ?? null,
    validationType: input.validationType,
    severity: input.severity,
    message: input.message,
    detailsJson: input.detailsJson ?? null,
    isDismissed: false,
    createdAt: now,
  };
}

/** List all non-deleted, non-dismissed validation results for a case. */
export function listCaseValidations(caseId: string, lawFirmId: string): ValidationResultRow[] {
  return db
    .select()
    .from(validationResults)
    .where(
      and(
        eq(validationResults.caseId, caseId),
        eq(validationResults.lawFirmId, lawFirmId),
        isNull(validationResults.deletedAt),
      ),
    )
    .all()
    .map(toRow);
}

/** List validation results for a specific document. */
export function listDocumentValidations(documentId: string, lawFirmId: string): ValidationResultRow[] {
  return db
    .select()
    .from(validationResults)
    .where(
      and(
        eq(validationResults.documentId, documentId),
        eq(validationResults.lawFirmId, lawFirmId),
        isNull(validationResults.deletedAt),
      ),
    )
    .all()
    .map(toRow);
}

/** Dismiss a validation warning (user acknowledges it). */
export function dismissValidation(id: string, dismissedBy: string, lawFirmId: string): boolean {
  const result = db
    .update(validationResults)
    .set({
      isDismissed: true,
      dismissedBy,
      dismissedAt: new Date().toISOString(),
    })
    .where(and(eq(validationResults.id, id), eq(validationResults.lawFirmId, lawFirmId)))
    .run();
  return result.changes > 0;
}

/** Soft-delete all validations for a document (before re-processing). */
export function clearDocumentValidations(documentId: string, lawFirmId: string): void {
  db.update(validationResults)
    .set({ deletedAt: new Date().toISOString() })
    .where(
      and(
        eq(validationResults.documentId, documentId),
        eq(validationResults.lawFirmId, lawFirmId),
        isNull(validationResults.deletedAt),
      ),
    )
    .run();
}
