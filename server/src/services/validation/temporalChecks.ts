import type { ValidationFinding } from './types';
import { listDocuments } from '../documents';
import { getLatestExtraction } from '../extractionResults';

const MONTHS_NEEDED = 6;

/**
 * Check temporal coverage of financial documents for means test requirements.
 */
export function validateTemporalCoverage(
  caseId: string,
  lawFirmId: string,
): ValidationFinding[] {
  const findings: ValidationFinding[] = [];
  const docs = listDocuments(caseId, lawFirmId);

  // Collect pay period dates from paystubs
  const paystubMonths = new Set<string>();
  const bankStatementMonths = new Set<string>();

  for (const doc of docs) {
    const extraction = getLatestExtraction(doc.id, lawFirmId);
    if (!extraction) continue;

    const data = JSON.parse(extraction.extractedData) as Record<string, unknown>;

    if (doc.docClass === 'paystub') {
      const periodEnd = data.pay_period_end as string | undefined;
      if (periodEnd) {
        paystubMonths.add(periodEnd.substring(0, 7)); // YYYY-MM
      }
    }

    if (doc.docClass === 'bank_statement_checking' || doc.docClass === 'bank_statement_savings') {
      const periodEnd = data.statement_period_end as string | undefined;
      if (periodEnd) {
        bankStatementMonths.add(periodEnd.substring(0, 7));
      }
    }
  }

  // Check paystub coverage
  if (paystubMonths.size > 0 && paystubMonths.size < MONTHS_NEEDED) {
    const sorted = [...paystubMonths].sort();
    findings.push({
      validationType: 'temporal_gap',
      severity: 'warning',
      message: `Only ${paystubMonths.size} month(s) of paystubs found (${sorted.join(', ')}). Means test requires ${MONTHS_NEEDED} months.`,
    });
  }

  if (paystubMonths.size === 0 && docs.some((d) => d.processingStatus === 'extracted' || d.processingStatus === 'reviewed')) {
    findings.push({
      validationType: 'temporal_gap',
      severity: 'info',
      message: 'No paystubs with date information found. Upload paystubs covering the last 6 months for means test.',
    });
  }

  // Check bank statement coverage
  if (bankStatementMonths.size > 0 && bankStatementMonths.size < MONTHS_NEEDED) {
    const sorted = [...bankStatementMonths].sort();
    findings.push({
      validationType: 'temporal_gap',
      severity: 'info',
      message: `Only ${bankStatementMonths.size} month(s) of bank statements found (${sorted.join(', ')}). Consider uploading ${MONTHS_NEEDED} months for complete coverage.`,
    });
  }

  return findings;
}
