import Anthropic from '@anthropic-ai/sdk';
import type { QuestionnaireData } from '../types/questionnaire';

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

export interface ReviewFinding {
  severity: 'error' | 'warning' | 'info';
  section: string;
  message: string;
}

const SYSTEM_PROMPT = `You are an expert bankruptcy law reviewer analyzing a bankruptcy questionnaire for potential issues, inconsistencies, and red flags. You have deep knowledge of the U.S. Bankruptcy Code.

Review the provided questionnaire data and check for:

**Asset Valuation Fraud**
- Vehicle undervaluation: Compare make/year/mileage against typical KBB/NADA values. Flag vehicles valued significantly below market.
- Personal property undervaluation: Household goods listed at unreasonably low values (e.g., $0 for recent items).
- Cash on hand: Unusually low cash ($0) when the person has employment income.

**Income & Expense Inconsistencies**
- Dramatic unexplained income decline right before filing.
- High income but claiming inability to pay small debts.
- Employed but no income listed, or income listed but no employer.
- Business ownership indicated but no business income listed.

**Fraudulent Transfers & Preferences (11 U.S.C. § 548)**
- Gifts/transfers to relatives within 2 years of filing.
- Property sold significantly below market value.
- Large payments to a single creditor >$600 in the last 90 days (preferential payment under § 547).
- Payments to insider creditors (relatives/business partners) within 1 year.

**Concealment of Assets (18 U.S.C. § 152)**
- Bank accounts closed shortly before filing.
- Property moved to third parties before filing.
- Safe deposit boxes with suspicious patterns.

**Timing Red Flags**
- Cash advances >$750 in the 70 days before filing (presumed non-dischargeable under § 523(a)(2)).
- Credit card charges >$600 for luxury goods/services in the 90 days before filing.
- Recent balance transfers or consolidation loans.

**Completeness & Consistency Checks**
- Address inconsistencies across sections.
- SSN format validation (should be XXX-XX-XXXX pattern).
- Date logic: future dates, impossible dates, move-out before move-in.
- Prior bankruptcy timing: Ch 7→Ch 7 requires 8 years, Ch 13→Ch 7 requires 6 years between discharge dates.
- Missing required fields based on other answers.
- YES answers without required follow-up details provided.

**Non-dischargeable Debt Flags**
- Student loans: note if debtor hasn't explored hardship discharge.
- Tax debts: check if they might be dischargeable (3-year rule, 2-year rule, 240-day rule).
- Criminal restitution: always non-dischargeable.
- Child support/alimony arrears: priority non-dischargeable debt.

Respond with a JSON array of findings. Each finding must have:
- "severity": "error" (likely fraud/violation), "warning" (suspicious, needs attention), or "info" (informational note)
- "section": the questionnaire section name (e.g., "Vehicles", "Income", "Gifts & Transfers")
- "message": a clear, specific explanation of the issue

If the form is mostly empty, note that as an info finding but still check whatever data is present.
Return ONLY the JSON array, no other text.`;

export async function reviewForm(data: QuestionnaireData): Promise<ReviewFinding[]> {
  const message = await getClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Please review this bankruptcy questionnaire data and return findings as a JSON array:\n\n${JSON.stringify(data, null, 2)}`,
      },
    ],
  });

  const responseText = message.content[0].type === 'text' ? message.content[0].text : '';

  try {
    // Extract JSON array from response (handle potential markdown code blocks)
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as ReviewFinding[];
    }
    return [{ severity: 'info', section: 'General', message: 'No specific issues found.' }];
  } catch {
    console.error('Failed to parse review response:', responseText);
    return [{ severity: 'error', section: 'General', message: 'Failed to parse AI review response.' }];
  }
}
