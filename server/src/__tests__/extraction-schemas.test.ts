import { describe, it, expect } from 'vitest';
import { paystubSchema, bankStatementSchema, w2Schema, getExtractionPromptTemplate } from '../services/extraction/schemas';

describe('Extraction Schemas', () => {
  describe('paystubSchema', () => {
    it('validates correct paystub data', () => {
      const result = paystubSchema.safeParse({
        employer_name: 'Acme Corp',
        gross_pay: 3000,
        net_pay: 2400,
        federal_tax: 350,
      });
      expect(result.success).toBe(true);
    });

    it('fails when employer_name is missing', () => {
      const result = paystubSchema.safeParse({
        gross_pay: 3000,
        net_pay: 2400,
      });
      expect(result.success).toBe(false);
    });

    it('fails when gross_pay is missing', () => {
      const result = paystubSchema.safeParse({
        employer_name: 'Acme',
        net_pay: 2400,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('bankStatementSchema', () => {
    it('validates correct bank statement data', () => {
      const result = bankStatementSchema.safeParse({
        institution_name: 'Chase',
        beginning_balance: 5000,
        ending_balance: 4200,
        transactions: [
          { date: '2026-01-15', description: 'Deposit', amount: 1000, type: 'credit' },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('fails without institution_name', () => {
      const result = bankStatementSchema.safeParse({
        beginning_balance: 5000,
        ending_balance: 4200,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('w2Schema', () => {
    it('validates correct W-2 data', () => {
      const result = w2Schema.safeParse({
        employer_name: 'Acme Corp',
        wages: 65000,
        federal_tax_withheld: 9750,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('getExtractionPromptTemplate', () => {
    it('returns non-empty template for known doc classes', () => {
      expect(getExtractionPromptTemplate('paystub').length).toBeGreaterThan(10);
      expect(getExtractionPromptTemplate('bank_statement_checking').length).toBeGreaterThan(10);
      expect(getExtractionPromptTemplate('w2').length).toBeGreaterThan(10);
      expect(getExtractionPromptTemplate('tax_return').length).toBeGreaterThan(10);
      expect(getExtractionPromptTemplate('credit_card_statement').length).toBeGreaterThan(10);
      expect(getExtractionPromptTemplate('bank_statement_savings').length).toBeGreaterThan(10);
    });

    it('returns empty object for unknown doc class', () => {
      expect(getExtractionPromptTemplate('other')).toBe('{}');
    });
  });
});
