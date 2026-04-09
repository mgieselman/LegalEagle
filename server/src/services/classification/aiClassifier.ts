import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod/v4';
import { DOC_CLASS_VALUES } from '../../validation/documents.schema';
import type { ClassificationResult } from './types';

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) {
      throw new Error('ANTHROPIC_API_KEY not set in environment. Check .env file.');
    }
    _client = new Anthropic({ apiKey: key });
  }
  return _client;
}

const SYSTEM_PROMPT = `You are a financial document classifier for a bankruptcy law firm.
Classify the document into one of these types:
- paystub: Pay statements, earnings statements, paycheck stubs
- bank_statement_checking: Checking account statements
- bank_statement_savings: Savings account statements
- tax_return: IRS Form 1040 or state tax returns
- w2: W-2 Wage and Tax Statements
- 1099: 1099 forms (1099-MISC, 1099-INT, etc.)
- credit_card_statement: Credit card billing statements
- ira_statement: IRA account statements
- 401k_statement: 401(k) retirement plan statements
- payroll_export: Payroll system CSV/data exports
- other: Financial document that doesn't fit other categories
- unclassified: Cannot determine document type

Respond with ONLY a JSON object (no markdown, no explanation):
{"docClass": "<type>", "confidence": <0.0-1.0>, "reasoning": "<brief explanation>"}`;

const responseSchema = z.object({
  docClass: z.enum(DOC_CLASS_VALUES),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().optional(),
});

/**
 * AI-based document classification using Claude.
 * Used as a fallback when rule-based classification confidence is < 0.85.
 */
export async function classifyWithAI(textContent: string): Promise<ClassificationResult> {
  const client = getClient();
  const contentSlice = textContent.slice(0, 3000);

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 256,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Classify this document:\n\n${contentSlice}`,
      },
    ],
  });

  const responseText = message.content[0].type === 'text' ? message.content[0].text : '';

  // Try to parse as JSON (may be wrapped in markdown code blocks)
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { docClass: 'unclassified', confidence: 0, method: 'ai', reasoning: 'Failed to parse AI response' };
  }

  const parsed = responseSchema.safeParse(JSON.parse(jsonMatch[0]));
  if (!parsed.success) {
    return { docClass: 'unclassified', confidence: 0, method: 'ai', reasoning: 'Invalid AI response structure' };
  }

  return {
    docClass: parsed.data.docClass,
    confidence: parsed.data.confidence,
    method: 'ai',
    reasoning: parsed.data.reasoning,
  };
}
