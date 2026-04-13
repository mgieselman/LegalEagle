/**
 * Rule extractor router.
 * Returns rule-based extraction results for doc classes where rules achieve high accuracy.
 * Falls through (returns null) for all other classes — they go to Claude.
 */
import type { DocClass } from '../../classification/types';
import type { ExtractionData } from '../schemas';
import type { RuleExtractionResult } from './types';
import { extractPaystubByRules } from './paystub';
import { extractBankStatementByRules } from './bankStatement';
import { extractW2ByFormFields } from './w2';

export type { RuleExtractionResult };

/**
 * Attempt rule-based extraction for supported doc classes.
 * `formFields` contains PDF form field values extracted in the same pdfjs-dist pass
 * as text extraction — no second PDF parse needed.
 * Returns null for unsupported classes — caller falls through to Claude.
 */
export function tryRuleExtraction(
  docClass: DocClass,
  textContent: string,
  formFields: Record<string, string>,
): RuleExtractionResult<ExtractionData> | null {
  switch (docClass) {
    case 'payStub.us':
      return extractPaystubByRules(textContent) as RuleExtractionResult<ExtractionData>;

    case 'bankStatement.us.checking':
    case 'bankStatement.us.savings':
      return extractBankStatementByRules(textContent) as RuleExtractionResult<ExtractionData>;

    case 'tax.us.w2':
      return extractW2ByFormFields(formFields) as RuleExtractionResult<ExtractionData>;

    default:
      return null;
  }
}
