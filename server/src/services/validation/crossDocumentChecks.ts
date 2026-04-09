import type { ValidationFinding } from './types';
import { listDocuments } from '../documents';
import { getLatestExtraction } from '../extractionResults';
import { eq, and, isNull } from 'drizzle-orm';
import db from '../../db';
import { questionnaires } from '../../db/schema';

const VARIANCE_THRESHOLD = 0.10; // 10%

/**
 * Cross-document validation: compare data across documents in a case.
 */
export function validateCrossDocument(
  caseId: string,
  lawFirmId: string,
): ValidationFinding[] {
  const findings: ValidationFinding[] = [];
  const docs = listDocuments(caseId, lawFirmId);

  // Collect extractions by doc class
  const paystubExtractions: Array<{ data: Record<string, unknown> }> = [];
  const bankExtractions: Array<{ data: Record<string, unknown> }> = [];
  const w2Extractions: Array<{ data: Record<string, unknown> }> = [];

  for (const doc of docs) {
    const extraction = getLatestExtraction(doc.id, lawFirmId);
    if (!extraction) continue;

    const data = JSON.parse(extraction.extractedData) as Record<string, unknown>;
    switch (doc.docClass) {
      case 'paystub':
        paystubExtractions.push({ data });
        break;
      case 'bank_statement_checking':
      case 'bank_statement_savings':
        bankExtractions.push({ data });
        break;
      case 'w2':
        w2Extractions.push({ data });
        break;
    }
  }

  // Compare paystub net pay total vs bank deposits
  if (paystubExtractions.length > 0 && bankExtractions.length > 0) {
    const totalNetPay = paystubExtractions.reduce((sum, e) => {
      const net = e.data.net_pay as number | undefined;
      return sum + (net ?? 0);
    }, 0);

    const totalDeposits = bankExtractions.reduce((sum, e) => {
      const deposits = e.data.total_deposits as number | undefined;
      return sum + (deposits ?? 0);
    }, 0);

    if (totalNetPay > 0 && totalDeposits > 0) {
      const variance = Math.abs(totalNetPay - totalDeposits) / totalNetPay;
      if (variance > VARIANCE_THRESHOLD) {
        findings.push({
          validationType: 'cross_document',
          severity: 'warning',
          message: `Paystub net pay total ($${totalNetPay.toFixed(2)}) differs from bank deposits ($${totalDeposits.toFixed(2)}) by ${(variance * 100).toFixed(1)}%`,
        });
      }
    }
  }

  // Compare W-2 wages vs paystub gross total
  if (w2Extractions.length > 0 && paystubExtractions.length > 0) {
    const w2Wages = w2Extractions.reduce((sum, e) => {
      const wages = e.data.wages as number | undefined;
      return sum + (wages ?? 0);
    }, 0);

    const paystubGross = paystubExtractions.reduce((sum, e) => {
      const gross = e.data.gross_pay as number | undefined;
      return sum + (gross ?? 0);
    }, 0);

    if (w2Wages > 0 && paystubGross > 0) {
      const variance = Math.abs(w2Wages - paystubGross) / w2Wages;
      if (variance > VARIANCE_THRESHOLD) {
        findings.push({
          validationType: 'cross_document',
          severity: 'warning',
          message: `W-2 wages ($${w2Wages.toFixed(2)}) differ from paystub gross total ($${paystubGross.toFixed(2)}) by ${(variance * 100).toFixed(1)}%`,
        });
      }
    }
  }

  // Compare questionnaire income vs documents
  const questionnaireRow = db
    .select({ data: questionnaires.data })
    .from(questionnaires)
    .where(and(eq(questionnaires.caseId, caseId), eq(questionnaires.lawFirmId, lawFirmId), isNull(questionnaires.deletedAt)))
    .get();

  if (questionnaireRow && paystubExtractions.length > 0) {
    const qData = JSON.parse(questionnaireRow.data) as Record<string, unknown>;
    const reportedIncome = qData.monthlyGrossIncome as number | undefined;

    if (reportedIncome && reportedIncome > 0) {
      const avgMonthlyGross = paystubExtractions.reduce((sum, e) => {
        const gross = e.data.gross_pay as number | undefined;
        return sum + (gross ?? 0);
      }, 0) / paystubExtractions.length;

      // Compare monthly averages
      if (avgMonthlyGross > 0) {
        const variance = Math.abs(reportedIncome - avgMonthlyGross) / reportedIncome;
        if (variance > VARIANCE_THRESHOLD) {
          findings.push({
            validationType: 'questionnaire_mismatch',
            severity: 'warning',
            message: `Questionnaire monthly income ($${reportedIncome.toFixed(2)}) differs from average paystub gross ($${avgMonthlyGross.toFixed(2)}) by ${(variance * 100).toFixed(1)}%`,
          });
        }
      }
    }
  }

  return findings;
}
