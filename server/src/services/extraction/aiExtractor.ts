import Anthropic from '@anthropic-ai/sdk';
import type { DocClass } from '../classification/types';
import type { ExtractionOutput } from './types';
import { getSchemaForDocClass, getExtractionPromptTemplate } from './schemas';
import type { ExtractionData } from './schemas';

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error('ANTHROPIC_API_KEY not set');
    _client = new Anthropic({ apiKey: key });
  }
  return _client;
}

const SYSTEM_PROMPT = `You are a financial document data extractor for a bankruptcy law firm.
Extract structured data from the document text provided.
Return ONLY a JSON object (no markdown, no explanation) with these keys:
- "data": the extracted fields matching the schema provided
- "fieldConfidences": an object mapping each field name to a confidence score (0.0 to 1.0)
- "warnings": an array of strings noting any anomalies, missing data, or concerns

CONFIDENCE SCORING:
- 0.95–1.0: Value read directly from a clearly labeled field with no ambiguity
- 0.80–0.94: Value found via pattern matching with minor ambiguity
- 0.70–0.79: Value inferred or reconstructed from surrounding context
- 0.50–0.69: Value present but poorly labeled or one of multiple candidates
- <0.50: Value is a guess; likely to be wrong

SENSITIVE DATA RULES:
- SSN: Extract last 4 digits only. If the full SSN is visible, extract only the last 4 and add a warning that the full number was present.
- Bank and loan account numbers: Last 4 digits only. Exception: mortgage loan numbers may be extracted in full.
- EINs: May be extracted in full.

BEHAVIORAL RULES:
- Document class mismatch: If the provided doc class appears inconsistent with the document content, add a warning describing the apparent mismatch and attempt extraction using the provided class anyway.
- Required field missing: If a required field cannot be extracted, add a warning naming the missing field. Set all fieldConfidences low so overall confidence falls below 0.5.
- Omit unknown fields: Never emit null, 0, or "" for a field that cannot be determined. Omit the field entirely.
- Do not fabricate: If a value is not present in the document, omit it. Do not guess or interpolate.
- Numeric fields: Always use numbers (not strings). No currency symbols or commas.
- Date fields: ISO 8601 format — YYYY-MM-DD. If only month/year is available, use the first of the month.`;

/**
 * Returns document-class-specific extraction notes to include in the user prompt.
 * These encode the behavioral guidance from the extraction requirements doc.
 */
function getExtractionNotes(docClass: DocClass): string {
  switch (docClass) {
    case 'payStub.us':
      return [
        '- gross_pay must be the period amount, NOT year-to-date (YTD). If only YTD gross is shown, omit gross_pay and add a warning.',
        '- pay_frequency can often be inferred from the pay period start and end dates (e.g., 7-day span = weekly, 14-day = biweekly).',
        '- other_deductions captures labeled deductions that do not fit the named fields (union dues, HSA, garnishments, etc.).',
      ].join('\n');

    case 'profit_loss_statement':
      return [
        '- net_profit may be negative. Use a negative number — do not omit or zero it out.',
        '- Extract only what is explicitly labeled in the document. Do not compute unlabeled line items.',
        '- If this is an IRS Schedule C: gross_revenue = Part I Line 7, total_expenses = Part II Line 28, net_profit = Part II Line 31.',
      ].join('\n');

    case 'tax.us.w2':
      return [
        '- W-2 values are stored in PDF form fields that text-layer extractors often cannot read. If fields appear empty or all-zero, add a warning that form-field extraction may have failed.',
        '- employer_ein is the full EIN (e.g., "25-0965591") — do not truncate.',
        '- Never extract the full SSN. Last 4 digits only for employee_ssn_last4.',
        '- If multiple states appear (Box 15), extract the first state only and add a warning that additional states are present.',
      ].join('\n');

    case 'tax.us.1040':
      return [
        '- IRS Form 1040 prints dollar amounts below their labels, not beside them. Text-layer extraction often misassociates values with lines. Use surrounding context carefully.',
        '- filing_status is typically a checked box — normalize to one of: single, married_jointly, married_separately, head_of_household, qualifying_surviving_spouse.',
        '- Use separate refund_amount and amount_owed fields (never a signed number). Only one should be present per return.',
        '- If this is a state return, set return_type to "state" and extract adjusted_gross_income from the state equivalent line.',
      ].join('\n');

    case 'bankStatement.us.checking':
    case 'bankStatement.us.savings':
      return [
        '- Never extract full account numbers — last 4 digits only for account_number_last4.',
        '- Extract total_deposits and total_withdrawals from printed summary lines only. Do not sum individual transactions.',
        '- If the statement contains more than 50 transactions, skip the transactions array and add a warning.',
        '- If a single document covers multiple accounts, extract the primary account shown first and add a warning that additional accounts are present.',
        '- Use the institution\'s legal name as printed (e.g., "Bank of America, N.A." not "BofA").',
      ].join('\n');

    case 'creditCard':
      return [
        '- issuer is the financial institution, not the card network. For store cards, include the store name (e.g., "Amazon / Synchrony").',
        '- Extract cash_advances explicitly, even if the amount is zero.',
      ].join('\n');

    case 'collection_letter':
      return [
        '- Extract both collection_agency_name and original_creditor when both appear — they are distinct entities.',
        '- amount_claimed is whatever total the letter demands, including any interest or fees the collector has added.',
        '- If the letter references a 30-day dispute window (debt validation notice), add a warning noting this.',
      ].join('\n');

    case 'legal_document':
      return [
        '- Legal documents are frequently photocopies or scans. Assign lower confidence scores for values that are hard to read.',
        '- plaintiff_name is the party initiating the action. If the debtor appears to be the plaintiff rather than the defendant, add a warning.',
        '- If a single upload contains multiple document types (e.g., a summons stapled to a complaint), extract from the primary document and note the attachment in warnings.',
      ].join('\n');

    default:
      return '';
  }
}

/**
 * Extract structured data from document text using Claude AI.
 */
export async function extractWithAI(
  textContent: string,
  docClass: DocClass,
): Promise<ExtractionOutput> {
  const client = getClient();
  const template = getExtractionPromptTemplate(docClass);
  const notes = getExtractionNotes(docClass);
  const notesSection = notes ? `\nExtraction notes:\n${notes}\n` : '';

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Extract data from this ${docClass.replace(/_/g, ' ')} document.

Expected schema:
${template}
${notesSection}
Document text:
${textContent}`,
      },
    ],
  });

  const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { data: {} as ExtractionData, confidence: 0, fieldConfidences: {}, warnings: ['Failed to parse AI extraction response'] };
  }

  const raw = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
  const data = (raw.data ?? raw) as ExtractionData;
  const fieldConfidences = (raw.fieldConfidences ?? {}) as Record<string, number>;
  const warnings = (raw.warnings ?? []) as string[];

  // Validate extracted data against schema
  const schema = getSchemaForDocClass(docClass);
  const validated = schema.safeParse(data);

  if (!validated.success) {
    // Partial extraction — use raw data but lower confidence
    const confidenceValues = Object.values(fieldConfidences);
    const avgConfidence = confidenceValues.length > 0
      ? confidenceValues.reduce((a, b) => a + b, 0) / confidenceValues.length * 0.7 // penalize for schema failure
      : 0.5;

    return {
      data,
      confidence: avgConfidence,
      fieldConfidences,
      warnings: [...warnings, 'Extraction data did not fully match expected schema'],
    };
  }

  // Calculate overall confidence from field confidences
  const confidenceValues = Object.values(fieldConfidences);
  const avgConfidence = confidenceValues.length > 0
    ? confidenceValues.reduce((a, b) => a + b, 0) / confidenceValues.length
    : 0.85; // default if AI didn't provide per-field confidences

  return {
    data: validated.data as ExtractionData,
    confidence: avgConfidence,
    fieldConfidences,
    warnings,
  };
}
