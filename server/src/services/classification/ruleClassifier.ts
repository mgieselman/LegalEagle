import type { ClassificationResult, DocClass } from './types';

interface PatternMatch {
  docClass: DocClass;
  confidence: number;
}

const FILENAME_PATTERNS: Array<{ pattern: RegExp; docClass: DocClass; confidence: number }> = [
  { pattern: /paystub|pay.?stub|earnings.?statement/i, docClass: 'paystub', confidence: 0.70 },
  { pattern: /w-?2|wage.?and.?tax/i, docClass: 'w2', confidence: 0.75 },
  { pattern: /1099/i, docClass: '1099', confidence: 0.75 },
  { pattern: /1040|tax.?return/i, docClass: 'tax_return', confidence: 0.75 },
  { pattern: /bank.?statement|checking.?statement/i, docClass: 'bank_statement_checking', confidence: 0.65 },
  { pattern: /savings.?statement/i, docClass: 'bank_statement_savings', confidence: 0.65 },
  { pattern: /credit.?card.?statement/i, docClass: 'credit_card_statement', confidence: 0.65 },
  { pattern: /401.?k|retirement/i, docClass: '401k_statement', confidence: 0.60 },
  { pattern: /ira.?statement/i, docClass: 'ira_statement', confidence: 0.60 },
  { pattern: /payroll/i, docClass: 'payroll_export', confidence: 0.60 },
];

const CONTENT_PATTERNS: Array<{ pattern: RegExp; docClass: DocClass; confidence: number }> = [
  { pattern: /pay\s*statement|earnings\s*statement|pay\s*period/i, docClass: 'paystub', confidence: 0.90 },
  { pattern: /gross\s*pay.*net\s*pay|net\s*pay.*gross\s*pay/i, docClass: 'paystub', confidence: 0.88 },
  { pattern: /wage\s*and\s*tax\s*statement|form\s*w-?2/i, docClass: 'w2', confidence: 0.95 },
  { pattern: /form\s*1099/i, docClass: '1099', confidence: 0.90 },
  { pattern: /form\s*1040|u\.?s\.?\s*individual\s*income\s*tax/i, docClass: 'tax_return', confidence: 0.92 },
  { pattern: /statement\s*period.*checking|checking.*account\s*statement/i, docClass: 'bank_statement_checking', confidence: 0.88 },
  { pattern: /statement\s*period.*savings|savings.*account\s*statement/i, docClass: 'bank_statement_savings', confidence: 0.88 },
  { pattern: /account\s*statement.*beginning\s*balance|beginning\s*balance.*ending\s*balance/i, docClass: 'bank_statement_checking', confidence: 0.80 },
  { pattern: /credit\s*card\s*statement|previous\s*balance.*new\s*charges/i, docClass: 'credit_card_statement', confidence: 0.88 },
  { pattern: /401\s*\(?\s*k\s*\)?\s*statement|retirement\s*plan\s*statement/i, docClass: '401k_statement', confidence: 0.85 },
  { pattern: /individual\s*retirement\s*account|ira\s*statement/i, docClass: 'ira_statement', confidence: 0.85 },
];

/**
 * Rule-based document classifier. Checks filename patterns and content patterns.
 * Returns the highest-confidence match.
 */
export function classifyByRules(filename: string, textContent: string): ClassificationResult {
  const matches: PatternMatch[] = [];

  // Check filename patterns
  for (const { pattern, docClass, confidence } of FILENAME_PATTERNS) {
    if (pattern.test(filename)) {
      matches.push({ docClass, confidence });
    }
  }

  // Check content patterns (first 3000 chars for speed)
  const contentSlice = textContent.slice(0, 3000);
  for (const { pattern, docClass, confidence } of CONTENT_PATTERNS) {
    if (pattern.test(contentSlice)) {
      matches.push({ docClass, confidence });
    }
  }

  if (matches.length === 0) {
    return { docClass: 'unclassified', confidence: 0, method: 'rule_engine' };
  }

  // If we have both filename and content matches for the same class, boost confidence
  const classScores = new Map<DocClass, number>();
  for (const match of matches) {
    const existing = classScores.get(match.docClass) ?? 0;
    classScores.set(match.docClass, Math.max(existing, match.confidence));
  }

  // Find the best match
  let bestClass: DocClass = 'unclassified';
  let bestConfidence = 0;
  for (const [docClass, confidence] of classScores) {
    if (confidence > bestConfidence) {
      bestClass = docClass;
      bestConfidence = confidence;
    }
  }

  return { docClass: bestClass, confidence: bestConfidence, method: 'rule_engine' };
}
