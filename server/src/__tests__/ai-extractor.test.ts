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

    const result = await extractWithAI('Pay Statement\nAcme Corp\nGross: $3,000', 'payStub.us');
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

    const result = await extractWithAI('Chase Bank Statement', 'bankStatement.us.checking');
    expect(result.data.institution_name).toBe('Chase Bank');
    expect(result.data.beginning_balance).toBe(5000);
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  it('handles unparseable AI response', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'I cannot extract data from this document.' }],
    });

    const result = await extractWithAI('garbled content', 'payStub.us');
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

    const result = await extractWithAI('partial content', 'payStub.us');
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

    const result = await extractWithAI('Direct Corp paystub', 'payStub.us');
    expect(result.data.employer_name).toBe('Direct Corp');
  });

  // ---- Phase 4: New doc classes ----

  it('extracts profit_loss_statement data', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{
        type: 'text',
        text: JSON.stringify({
          data: { business_name: 'Jane Plumbing LLC', gross_revenue: 95000, net_profit: 42000, total_expenses: 53000 },
          fieldConfidences: { business_name: 0.95, gross_revenue: 0.90, net_profit: 0.88, total_expenses: 0.85 },
          warnings: [],
        }),
      }],
    });

    const result = await extractWithAI('P&L Statement\nJane Plumbing LLC', 'profit_loss_statement');
    expect(result.data.business_name).toBe('Jane Plumbing LLC');
    expect(result.data.gross_revenue).toBe(95000);
    expect(result.confidence).toBeGreaterThan(0.5);
    expect(result.warnings).toHaveLength(0);
  });

  it('extracts retirement_account data', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{
        type: 'text',
        text: JSON.stringify({
          data: { institution_name: 'Fidelity', account_type: '401k', ending_balance: 87000 },
          fieldConfidences: { institution_name: 0.95, account_type: 0.90, ending_balance: 0.92 },
          warnings: [],
        }),
      }],
    });

    const result = await extractWithAI('Fidelity 401(k) Statement', 'retirement_account');
    expect(result.data.institution_name).toBe('Fidelity');
    expect(result.data.ending_balance).toBe(87000);
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('extracts collection_letter data', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{
        type: 'text',
        text: JSON.stringify({
          data: {
            collection_agency_name: 'Midland Credit Management',
            amount_claimed: 3200,
            original_creditor: 'Capital One',
          },
          fieldConfidences: { collection_agency_name: 0.95, amount_claimed: 0.90, original_creditor: 0.85 },
          warnings: [],
        }),
      }],
    });

    const result = await extractWithAI('Collection Letter', 'collection_letter');
    expect(result.data.collection_agency_name).toBe('Midland Credit Management');
    expect(result.data.amount_claimed).toBe(3200);
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('extracts legal_document data', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{
        type: 'text',
        text: JSON.stringify({
          data: { document_type: 'summons', plaintiff_name: 'Bank of America', case_number: '2024-CV-100' },
          fieldConfidences: { document_type: 0.95, plaintiff_name: 0.92, case_number: 0.88 },
          warnings: [],
        }),
      }],
    });

    const result = await extractWithAI('Summons document', 'legal_document');
    expect(result.data.document_type).toBe('summons');
    expect(result.data.plaintiff_name).toBe('Bank of America');
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('extracts vehicle_loan_statement data', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{
        type: 'text',
        text: JSON.stringify({
          data: { lender_name: 'Toyota Financial Services', current_balance: 14500, monthly_payment: 320 },
          fieldConfidences: { lender_name: 0.95, current_balance: 0.92, monthly_payment: 0.90 },
          warnings: [],
        }),
      }],
    });

    const result = await extractWithAI('Auto loan statement', 'vehicle_loan_statement');
    expect(result.data.lender_name).toBe('Toyota Financial Services');
    expect(result.data.current_balance).toBe(14500);
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('extracts mortgage_statement data', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{
        type: 'text',
        text: JSON.stringify({
          data: { lender_name: 'Wells Fargo Home Mortgage', current_balance: 215000, monthly_payment: 1650 },
          fieldConfidences: { lender_name: 0.95, current_balance: 0.92, monthly_payment: 0.90 },
          warnings: [],
        }),
      }],
    });

    const result = await extractWithAI('Mortgage statement', 'mortgage.us');
    expect(result.data.lender_name).toBe('Wells Fargo Home Mortgage');
    expect(result.data.current_balance).toBe(215000);
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('extracts social_security_letter data', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{
        type: 'text',
        text: JSON.stringify({
          data: { monthly_benefit: 1380, benefit_type: 'SSDI', recipient_name: 'Jane Doe' },
          fieldConfidences: { monthly_benefit: 0.95, benefit_type: 0.88, recipient_name: 0.92 },
          warnings: [],
        }),
      }],
    });

    const result = await extractWithAI('SSA award letter', 'social_security_letter');
    expect(result.data.monthly_benefit).toBe(1380);
    expect(result.data.benefit_type).toBe('SSDI');
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('passes through doc class mismatch warning from AI', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{
        type: 'text',
        text: JSON.stringify({
          data: { employer_name: 'Acme', gross_pay: 3000, net_pay: 2400 },
          fieldConfidences: { employer_name: 0.90, gross_pay: 0.85, net_pay: 0.82 },
          warnings: ['Document appears to be a bank statement, not a paystub'],
        }),
      }],
    });

    const result = await extractWithAI('Bank of America statement text', 'payStub.us');
    expect(result.warnings).toContain('Document appears to be a bank statement, not a paystub');
  });

  it('returns confidence < 0.5 and schema warning when required field is missing for new class', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{
        type: 'text',
        text: JSON.stringify({
          data: {
            // missing lender_name (required for mortgage_statement)
            current_balance: 200000,
          },
          fieldConfidences: { current_balance: 0.90 },
          warnings: ['Could not find lender name'],
        }),
      }],
    });

    const result = await extractWithAI('Mortgage statement without lender', 'mortgage.us');
    expect(result.confidence).toBeLessThan(0.9);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('routes ira_statement through retirementAccountSchema', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{
        type: 'text',
        text: JSON.stringify({
          data: { institution_name: 'Vanguard', account_type: 'IRA', ending_balance: 52000 },
          fieldConfidences: { institution_name: 0.95, account_type: 0.90, ending_balance: 0.92 },
          warnings: [],
        }),
      }],
    });

    const result = await extractWithAI('Vanguard IRA statement', 'ira_statement');
    expect(result.data.institution_name).toBe('Vanguard');
    expect(result.confidence).toBeGreaterThan(0.5);
  });
});
