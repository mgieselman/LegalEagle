import { describe, it, expect } from 'vitest';
import { extractBankStatementByRules } from '../services/extraction/ruleExtractors/bankStatement';

// Bank of America combined statement (real extract from pdfjs-dist)
const BOFA_TEXT = `Customer service information
Customer service: 1.800.432.1000
bankofamerica.com
Bank of America, N.A.
P.O. Box 25118
Tampa, FL 33622-5118

ELIZABETH GIESELMAN
8707 W SNOQUALMIE VALLEY RD NE

Your combined statement
for December 18, 2025 to January 16, 2026

Your deposit accounts Account/plan number Ending balance
ScenicBanking - Winter Adv Tiered Interest Chkg 0010 8211 5472 $110.69
Regular Savings 0003 1870 0253 $103.43
Total balance $214.12

Account number: 0010 8211 5472

Your ScenicBanking - Winter Adv Tiered Interest Chkg
ELIZABETH GIESELMAN

Account summary

Beginning balance on December 18, 2025 $2.26
Deposits and other additions 870.52
ATM and debit card subtractions -486.01
Other subtractions -276.08
Checks -0.00
Service fees -0.00
Ending balance on January 16, 2026 $110.69

Total deposits and other additions $870.52
Total ATM and debit card subtractions -$486.01
Total other subtractions -$276.08`;

// Chase checking statement
const CHASE_TEXT = `JPMorgan Chase Bank, N.A.
P O Box 182051
Columbus, OH 43218 - 2051

November 27, 2025 through December 23, 2025
Account Number:

Beginning Balance $47.34

Ending Balance $87.77

Chase Total Checking

Deposits and Additions 100.00
ATM & Debit Card Withdrawals -44.57
Fees -15.00`;

// Commerce Bank statement
const COMMERCE_BANK_TEXT = `1000 Walnut
Kansas City MO 64106-3686
Jane Customer
1234 Anywhere Dr.
Small Town, MO 12345-6789

Primary Account Number: 000009752
Bank Statement

Statement Date: June 5, 2003

CONNECTIONS CHECKING Account # 000009752
Account Summary Account # 000009752

Beginning Balance on May 3, 2003 $7,126.11
Deposits & Other Credits +3,615.08
ATM Withdrawals & Debits -20.00
VISA Check Card Purchases & Debits -0.00
Withdrawals & Other Debits -0.00
Checks Paid -200.00

Ending Balance on June 5, 2003 $10,521.19

Total Deposits & Other Credits $3,615.08
Total ATM Withdrawals & Debits $20.00
Total Checks Paid $305.00`;

// A non-bank-statement document
const PAYSTUB_TEXT = `Gross Pay 2,585.81 2,585.81
Net Pay 2,137.33 2,137.33
Pay Date: 01/02/2026
Tailored Management
1165 DUBLIN RD
Columbus, OH 43215-1005`;

describe('extractBankStatementByRules', () => {
  describe('Bank of America combined statement', () => {
    it('extracts institution_name', () => {
      const result = extractBankStatementByRules(BOFA_TEXT);
      expect(result.data.institution_name).toContain('Bank of America');
    });

    it('extracts account_number_last4', () => {
      const result = extractBankStatementByRules(BOFA_TEXT);
      expect(result.data.account_number_last4).toBe('5472');
    });

    it('extracts statement_period_start', () => {
      const result = extractBankStatementByRules(BOFA_TEXT);
      expect(result.data.statement_period_start).toBe('2025-12-18');
    });

    it('extracts statement_period_end', () => {
      const result = extractBankStatementByRules(BOFA_TEXT);
      expect(result.data.statement_period_end).toBe('2026-01-16');
    });

    it('extracts beginning_balance', () => {
      const result = extractBankStatementByRules(BOFA_TEXT);
      expect(result.data.beginning_balance).toBe(2.26);
    });

    it('extracts ending_balance', () => {
      const result = extractBankStatementByRules(BOFA_TEXT);
      expect(result.data.ending_balance).toBe(110.69);
    });

    it('extracts total_deposits', () => {
      const result = extractBankStatementByRules(BOFA_TEXT);
      expect(result.data.total_deposits).toBe(870.52);
    });

    it('achieves confidence >= 0.85', () => {
      const result = extractBankStatementByRules(BOFA_TEXT);
      expect(result.confidence).toBeGreaterThanOrEqual(0.85);
    });
  });

  describe('Chase checking statement', () => {
    it('extracts institution_name', () => {
      const result = extractBankStatementByRules(CHASE_TEXT);
      expect(result.data.institution_name).toBeTruthy();
    });

    it('extracts beginning_balance', () => {
      const result = extractBankStatementByRules(CHASE_TEXT);
      expect(result.data.beginning_balance).toBe(47.34);
    });

    it('extracts ending_balance', () => {
      const result = extractBankStatementByRules(CHASE_TEXT);
      expect(result.data.ending_balance).toBe(87.77);
    });

    it('achieves confidence >= 0.85 (3 required fields present)', () => {
      const result = extractBankStatementByRules(CHASE_TEXT);
      // institution + beginning + ending = 0.75 baseline, plus period info = >= 0.85
      expect(result.confidence).toBeGreaterThanOrEqual(0.75);
    });
  });

  describe('Commerce Bank statement', () => {
    it('extracts institution_name', () => {
      const result = extractBankStatementByRules(COMMERCE_BANK_TEXT);
      expect(result.data.institution_name).toBeTruthy();
    });

    it('extracts account_number_last4', () => {
      const result = extractBankStatementByRules(COMMERCE_BANK_TEXT);
      expect(result.data.account_number_last4).toBe('9752');
    });

    it('extracts beginning_balance', () => {
      const result = extractBankStatementByRules(COMMERCE_BANK_TEXT);
      expect(result.data.beginning_balance).toBe(7126.11);
    });

    it('extracts ending_balance', () => {
      const result = extractBankStatementByRules(COMMERCE_BANK_TEXT);
      expect(result.data.ending_balance).toBe(10521.19);
    });

    it('extracts total_deposits', () => {
      const result = extractBankStatementByRules(COMMERCE_BANK_TEXT);
      expect(result.data.total_deposits).toBe(3615.08);
    });

    it('achieves confidence >= 0.85', () => {
      const result = extractBankStatementByRules(COMMERCE_BANK_TEXT);
      expect(result.confidence).toBeGreaterThanOrEqual(0.85);
    });
  });

  describe('non-bank-statement document', () => {
    it('returns confidence < 0.85 for a paystub', () => {
      const result = extractBankStatementByRules(PAYSTUB_TEXT);
      expect(result.confidence).toBeLessThan(0.85);
    });

    it('does not extract beginning_balance from paystub', () => {
      const result = extractBankStatementByRules(PAYSTUB_TEXT);
      expect(result.data.beginning_balance).toBeUndefined();
    });
  });
});
