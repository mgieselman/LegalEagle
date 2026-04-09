import { describe, it, expect } from 'vitest';
import { validatePaystub, validateBankStatement } from '../services/validation/internalChecks';

describe('Internal Validation Checks', () => {
  describe('Paystub', () => {
    it('passes when gross - deductions = net', () => {
      const findings = validatePaystub({
        gross_pay: 3000,
        federal_tax: 350,
        state_tax: 150,
        social_security: 186,
        medicare: 43.50,
        net_pay: 2270.50,
      }, 'doc-1');
      expect(findings).toHaveLength(0);
    });

    it('warns when gross - deductions != net', () => {
      const findings = validatePaystub({
        gross_pay: 3000,
        federal_tax: 350,
        state_tax: 150,
        net_pay: 2000, // should be 2500
      }, 'doc-1');
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('warning');
      expect(findings[0].validationType).toBe('internal_consistency');
    });

    it('warns when YTD gross < current gross', () => {
      const findings = validatePaystub({
        gross_pay: 3000,
        net_pay: 2500,
        ytd_gross: 2000, // less than current gross
      }, 'doc-1');
      expect(findings).toHaveLength(1);
      expect(findings[0].message).toContain('YTD gross');
    });

    it('errors when pay period dates are backwards', () => {
      const findings = validatePaystub({
        gross_pay: 3000,
        net_pay: 3000,
        pay_period_start: '2026-01-31',
        pay_period_end: '2026-01-01',
      }, 'doc-1');
      expect(findings.some((f) => f.severity === 'error')).toBe(true);
    });
  });

  describe('Bank Statement', () => {
    it('passes when beginning + deposits - withdrawals = ending', () => {
      const findings = validateBankStatement({
        beginning_balance: 5000,
        total_deposits: 3000,
        total_withdrawals: 1800,
        ending_balance: 6200,
      }, 'doc-1');
      expect(findings).toHaveLength(0);
    });

    it('warns when math does not add up', () => {
      const findings = validateBankStatement({
        beginning_balance: 5000,
        total_deposits: 3000,
        total_withdrawals: 1800,
        ending_balance: 9999, // wrong
      }, 'doc-1');
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('warning');
    });

    it('warns when transaction date outside statement period', () => {
      const findings = validateBankStatement({
        beginning_balance: 5000,
        ending_balance: 5000,
        statement_period_start: '2026-01-01',
        statement_period_end: '2026-01-31',
        transactions: [
          { date: '2026-02-15', description: 'Late tx', amount: 100, type: 'debit' },
        ],
      }, 'doc-1');
      expect(findings).toHaveLength(1);
      expect(findings[0].message).toContain('outside statement period');
    });
  });
});
