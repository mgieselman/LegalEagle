/**
 * W-2 form field extractor.
 * W-2s store all dollar values in PDF form fields — text-layer extractors score 0.000.
 * Receives pre-extracted form fields (from a single pdfjs-dist pass in the pipeline)
 * rather than re-loading the PDF, avoiding a redundant parse.
 */
import type { W2Data } from '../schemas';
import type { RuleExtractionResult } from './types';
import { parseDollar } from './utils';

// IMPORTANT: More-specific entries MUST precede less-specific ones.
// "ss_wages" contains "wages" → Box 3 checked before Box 1.
// "medicare_wages" contains "wages" → Box 5 checked before Box 1.
const FIELD_KEYWORD_MAP: Array<{ keywords: string[]; field: keyof W2Data }> = [
  // Box 3: Social security wages
  { keywords: ['box3', 'f2_3', 'ss_wage', 'soc_sec_wage', 'social_sec_w'], field: 'social_security_wages' },
  // Box 4: Social security tax
  { keywords: ['box4', 'f2_4', 'ss_tax', 'soc_sec_tax', 'social_sec_t'], field: 'social_security_tax' },
  // Box 5: Medicare wages
  { keywords: ['box5', 'f2_5', 'med_wage', 'medicare_w', 'med_tips', 'medicare'], field: 'medicare_wages' },
  // Box 6: Medicare tax
  { keywords: ['box6', 'f2_6', 'med_tax', 'medicare_t'], field: 'medicare_tax' },
  // Box 1: Wages — after all more-specific entries above
  { keywords: ['box1', 'f2_1', 'wages', 'wag_tip', 'c1_'], field: 'wages' },
  // Box 2: Federal income tax withheld
  { keywords: ['box2', 'f2_2', 'federal', 'fed_tax', 'inc_tax_wh'], field: 'federal_tax_withheld' },
  // Employer fields
  { keywords: ['employer_name', 'emp_name', 'employer_n', 'c_name', 'payer_name'], field: 'employer_name' },
  { keywords: ['ein', 'employer_id', 'fed_id', 'emp_id_no'], field: 'employer_ein' },
  // Employee fields
  { keywords: ['employee_name', 'empl_name', 'emp_name_e'], field: 'employee_name' },
  { keywords: ['ssn', 'employee_ssn', 'soc_sec_no', 'emp_ssn'], field: 'employee_ssn_last4' },
  // Tax year
  { keywords: ['tax_year', 'taxyear', 'year'], field: 'tax_year' },
  // State fields (Box 15–17)
  { keywords: ['state_w', 'state_wage', 'box16', 'f2_16'], field: 'state_wages' },
  { keywords: ['state_tax', 'box17', 'f2_17'], field: 'state_tax' },
  { keywords: ['state', 'box15', 'f2_15'], field: 'state' },
];

const DOLLAR_FIELDS = new Set<keyof W2Data>([
  'wages', 'federal_tax_withheld', 'social_security_wages',
  'social_security_tax', 'medicare_wages', 'medicare_tax',
  'state_wages', 'state_tax',
]);

const DOLLAR_BOX_FIELDS: (keyof W2Data)[] = [
  'wages', 'federal_tax_withheld', 'social_security_wages',
  'social_security_tax', 'medicare_wages', 'medicare_tax',
];

function matchFieldName(pdfFieldName: string): keyof W2Data | null {
  const normalized = pdfFieldName.toLowerCase().replace(/[\s-]/g, '_');
  for (const { keywords, field } of FIELD_KEYWORD_MAP) {
    for (const kw of keywords) {
      if (normalized.includes(kw)) return field;
    }
  }
  return null;
}

/**
 * Extract W-2 data from pre-extracted PDF form fields.
 * The caller (pipeline) provides form fields from a single pdfjs-dist pass —
 * no second PDF load needed here.
 *
 * Returns confidence 0 if no fields are present (PDF has no form layer →
 * caller falls through to Claude).
 */
export function extractW2ByFormFields(formFields: Record<string, string>): RuleExtractionResult<W2Data> {
  const data: Partial<W2Data> = {};
  const fieldConfidences: Record<string, number> = {};
  const warnings: string[] = [];

  if (Object.keys(formFields).length === 0) {
    return {
      data,
      fieldConfidences,
      warnings: ['No PDF form fields found — W-2 may be a scanned image, falling through to Claude'],
      confidence: 0,
    };
  }

  for (const [pdfField, rawValue] of Object.entries(formFields)) {
    const w2Field = matchFieldName(pdfField);
    if (!w2Field || data[w2Field] !== undefined) continue; // first match wins

    if (DOLLAR_FIELDS.has(w2Field)) {
      const val = parseDollar(rawValue);
      if (val !== null) {
        (data as Record<string, unknown>)[w2Field] = val;
        fieldConfidences[w2Field] = 0.95;
      }
    } else if (w2Field === 'employee_ssn_last4') {
      const digits = rawValue.replace(/\D/g, '');
      if (digits.length >= 4) {
        data.employee_ssn_last4 = digits.slice(-4);
        fieldConfidences.employee_ssn_last4 = 0.95;
      }
    } else {
      (data as Record<string, unknown>)[w2Field] = rawValue.trim();
      fieldConfidences[w2Field] = 0.9;
    }
  }

  // Confidence: based on how many of the 6 key dollar boxes were found
  const foundBoxes = DOLLAR_BOX_FIELDS.filter((f) => data[f] !== undefined).length;
  let confidence = 0;
  if (foundBoxes >= 4) {
    confidence = 0.90 + (foundBoxes - 4) * 0.02; // 0.90, 0.92, 0.94
  } else if (foundBoxes >= 2) {
    confidence = 0.50 + foundBoxes * 0.10;        // 0.70, 0.80
  } else if (foundBoxes >= 1) {
    confidence = 0.40;
  }
  if (data.employer_name) confidence += 0.02;
  if (data.employer_ein)  confidence += 0.02;
  confidence = Math.min(confidence, 1.0);

  if (!data.wages)                warnings.push('wages (Box 1) not found in PDF form fields');
  if (!data.federal_tax_withheld) warnings.push('federal_tax_withheld (Box 2) not found in PDF form fields');
  if (!data.employer_name)        warnings.push('employer_name not found in PDF form fields');
  if (foundBoxes < 4) warnings.push(`Only ${foundBoxes}/6 dollar boxes found — W-2 may use non-standard field names`);

  return { data, fieldConfidences, warnings, confidence };
}
