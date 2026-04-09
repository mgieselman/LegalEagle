import type { ValidationFinding } from './types';

const TOLERANCE = 1.0; // $1 tolerance for rounding

/**
 * Validate internal consistency of a paystub extraction.
 */
export function validatePaystub(data: Record<string, unknown>, documentId: string): ValidationFinding[] {
  const findings: ValidationFinding[] = [];
  const gross = data.gross_pay as number | undefined;
  const net = data.net_pay as number | undefined;

  if (gross !== undefined && net !== undefined) {
    // Sum known deductions
    const deductions = [
      data.federal_tax,
      data.state_tax,
      data.social_security,
      data.medicare,
      data.health_insurance,
      data.retirement_401k,
    ].filter((v): v is number => typeof v === 'number');

    const otherDeductions = data.other_deductions as Array<{ amount: number }> | undefined;
    if (otherDeductions) {
      for (const d of otherDeductions) {
        if (typeof d.amount === 'number') deductions.push(d.amount);
      }
    }

    if (deductions.length > 0) {
      const totalDeductions = deductions.reduce((a, b) => a + b, 0);
      const expectedNet = gross - totalDeductions;
      if (Math.abs(expectedNet - net) > TOLERANCE) {
        findings.push({
          validationType: 'internal_consistency',
          severity: 'warning',
          message: `Gross pay ($${gross.toFixed(2)}) minus deductions ($${totalDeductions.toFixed(2)}) = $${expectedNet.toFixed(2)}, but net pay is $${net.toFixed(2)}`,
          documentId,
        });
      }
    }

    // YTD checks
    const ytdGross = data.ytd_gross as number | undefined;
    if (ytdGross !== undefined && ytdGross < gross) {
      findings.push({
        validationType: 'internal_consistency',
        severity: 'warning',
        message: `YTD gross ($${ytdGross.toFixed(2)}) is less than current period gross ($${gross.toFixed(2)})`,
        documentId,
      });
    }
  }

  // Date ordering
  const periodStart = data.pay_period_start as string | undefined;
  const periodEnd = data.pay_period_end as string | undefined;
  if (periodStart && periodEnd && periodStart > periodEnd) {
    findings.push({
      validationType: 'internal_consistency',
      severity: 'error',
      message: `Pay period start (${periodStart}) is after pay period end (${periodEnd})`,
      documentId,
    });
  }

  return findings;
}

/**
 * Validate internal consistency of a bank statement extraction.
 */
export function validateBankStatement(data: Record<string, unknown>, documentId: string): ValidationFinding[] {
  const findings: ValidationFinding[] = [];
  const beginning = data.beginning_balance as number | undefined;
  const ending = data.ending_balance as number | undefined;
  const deposits = data.total_deposits as number | undefined;
  const withdrawals = data.total_withdrawals as number | undefined;

  if (beginning !== undefined && ending !== undefined && deposits !== undefined && withdrawals !== undefined) {
    const expected = beginning + deposits - withdrawals;
    if (Math.abs(expected - ending) > TOLERANCE) {
      findings.push({
        validationType: 'internal_consistency',
        severity: 'warning',
        message: `Beginning balance ($${beginning.toFixed(2)}) + deposits ($${deposits.toFixed(2)}) - withdrawals ($${withdrawals.toFixed(2)}) = $${expected.toFixed(2)}, but ending balance is $${ending.toFixed(2)}`,
        documentId,
      });
    }
  }

  // Check transaction dates within statement period
  const periodStart = data.statement_period_start as string | undefined;
  const periodEnd = data.statement_period_end as string | undefined;
  const transactions = data.transactions as Array<{ date: string }> | undefined;

  if (periodStart && periodEnd && transactions) {
    for (const tx of transactions) {
      if (tx.date < periodStart || tx.date > periodEnd) {
        findings.push({
          validationType: 'internal_consistency',
          severity: 'warning',
          message: `Transaction date ${tx.date} is outside statement period ${periodStart} to ${periodEnd}`,
          documentId,
        });
        break; // Only report once
      }
    }
  }

  return findings;
}

/**
 * Run internal validation checks for a document based on its doc class.
 */
export function validateInternal(
  docClass: string,
  extractedData: Record<string, unknown>,
  documentId: string,
): ValidationFinding[] {
  switch (docClass) {
    case 'paystub':
      return validatePaystub(extractedData, documentId);
    case 'bank_statement_checking':
    case 'bank_statement_savings':
      return validateBankStatement(extractedData, documentId);
    default:
      return [];
  }
}
