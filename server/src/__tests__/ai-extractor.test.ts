import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCreate = vi.fn();

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: mockCreate };
  },
}));

process.env.ANTHROPIC_API_KEY = 'test-key';

import { extractWithAI } from '../services/extraction/aiExtractor';

describe('AI Extractor', () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it('extracts paystub data successfully', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{
        type: 'text',
        text: JSON.stringify({
          data: {
            employer_name: 'Acme Corp',
            gross_pay: 3000,
            net_pay: 2400,
            federal_tax: 350,
            state_tax: 150,
            social_security: 186,
          },
          fieldConfidences: {
            employer_name: 0.95,
            gross_pay: 0.92,
            net_pay: 0.90,
            federal_tax: 0.88,
            state_tax: 0.85,
            social_security: 0.87,
          },
          warnings: [],
        }),
      }],
    });

    const result = await extractWithAI('Pay Statement\nAcme Corp\nGross: $3,000', 'paystub');
    expect(result.data.employer_name).toBe('Acme Corp');
    expect(result.data.gross_pay).toBe(3000);
    expect(result.data.net_pay).toBe(2400);
    expect(result.confidence).toBeGreaterThan(0.8);
    expect(result.warnings).toHaveLength(0);
  });

  it('extracts bank statement data', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{
        type: 'text',
        text: JSON.stringify({
          data: {
            institution_name: 'Chase Bank',
            beginning_balance: 5000,
            ending_balance: 4200,
            total_deposits: 3000,
            total_withdrawals: 3800,
          },
          fieldConfidences: {
            institution_name: 0.95,
            beginning_balance: 0.92,
            ending_balance: 0.90,
            total_deposits: 0.88,
            total_withdrawals: 0.85,
          },
          warnings: [],
        }),
      }],
    });

    const result = await extractWithAI('Chase Bank Statement', 'bank_statement_checking');
    expect(result.data.institution_name).toBe('Chase Bank');
    expect(result.data.beginning_balance).toBe(5000);
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  it('handles unparseable AI response', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'I cannot extract data from this document.' }],
    });

    const result = await extractWithAI('garbled content', 'paystub');
    expect(result.confidence).toBe(0);
    expect(result.warnings).toContain('Failed to parse AI extraction response');
  });

  it('handles partial extraction with schema validation failure', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{
        type: 'text',
        text: JSON.stringify({
          data: {
            employer_name: 'Acme',
            // missing gross_pay and net_pay (required)
          },
          fieldConfidences: { employer_name: 0.90 },
          warnings: ['Could not find pay amounts'],
        }),
      }],
    });

    const result = await extractWithAI('partial content', 'paystub');
    // Should still return data but with lower confidence
    expect(result.data.employer_name).toBe('Acme');
    expect(result.confidence).toBeLessThan(0.9);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('handles response without wrapper object', async () => {
    // AI returns just the data without data/fieldConfidences/warnings wrapper
    mockCreate.mockResolvedValueOnce({
      content: [{
        type: 'text',
        text: JSON.stringify({
          employer_name: 'Direct Corp',
          gross_pay: 4000,
          net_pay: 3200,
        }),
      }],
    });

    const result = await extractWithAI('Direct Corp paystub', 'paystub');
    expect(result.data.employer_name).toBe('Direct Corp');
  });
});
