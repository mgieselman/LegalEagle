import Anthropic from '@anthropic-ai/sdk';
import type { DocClass } from '../classification/types';
import type { ExtractionOutput } from './types';
import { getSchemaForDocClass, getExtractionPromptTemplate } from './schemas';

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

For numeric fields, use numbers (not strings). For dates, use YYYY-MM-DD format.
If a field cannot be determined, omit it. Do not guess or fabricate values.`;

/**
 * Extract structured data from document text using Claude AI.
 */
export async function extractWithAI(
  textContent: string,
  docClass: DocClass,
): Promise<ExtractionOutput> {
  const client = getClient();
  const template = getExtractionPromptTemplate(docClass);

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

Document text:
${textContent}`,
      },
    ],
  });

  const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { data: {}, confidence: 0, fieldConfidences: {}, warnings: ['Failed to parse AI extraction response'] };
  }

  const raw = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
  const data = (raw.data ?? raw) as Record<string, unknown>;
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
    data: validated.data as Record<string, unknown>,
    confidence: avgConfidence,
    fieldConfidences,
    warnings,
  };
}
