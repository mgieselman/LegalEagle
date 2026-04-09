import type { ValidationFinding } from './types';
import { validateInternal } from './internalChecks';
import { validateCrossDocument } from './crossDocumentChecks';
import { validateTemporalCoverage } from './temporalChecks';

export type { ValidationFinding } from './types';

/**
 * Run internal consistency checks for a single document.
 */
export function validateDocument(
  docClass: string,
  extractedData: Record<string, unknown>,
  documentId: string,
): ValidationFinding[] {
  return validateInternal(docClass, extractedData, documentId);
}

/**
 * Run cross-document and temporal checks for an entire case.
 */
export function validateCase(caseId: string, lawFirmId: string): ValidationFinding[] {
  const crossDoc = validateCrossDocument(caseId, lawFirmId);
  const temporal = validateTemporalCoverage(caseId, lawFirmId);
  return [...crossDoc, ...temporal];
}
