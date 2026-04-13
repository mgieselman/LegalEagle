import { describe, it, expect } from 'vitest';
import { extractPaystubByRules } from '../services/extraction/ruleExtractors/paystub';

// Real text extracted from Tailored Management paystub (Paystub 01022926.pdf via pdfjs-dist)
const TAILORED_MANAGEMENT_TEXT = `Earnings

Rate Hours Current YTD
REG 120.27 21.50 2,585.81 2,585.81
Gross Pay 2,585.81 2,585.81

Taxes Withheld

Taxable Taxable YTD Current YTD
FIT 2,585.81 2,585.81 235.67 235.67
FICA 2,585.81 2,585.81 160.32 160.32
MEDI 2,585.81 2,585.81 37.49 37.49
SDI:WA 2,585.81 2,585.81

Washingt 2,585.81 2,585.81 15.00 15.00
Total 448.48 448.48

Net Pay 2,137.33 2,137.33
Checking (4870) 2,137.33 2,137.33

#65224 - Matthew Gieselman Voucher #(55446) Pay Date: 01/02/2026

Pay Period: 12/22/2025-12/28/2025

Tailored Management
1165 DUBLIN RD
Columbus, OH 43215-1005`;

// CA DIR hourly paystub (public sample)
const CA_DIR_HOURLY_TEXT = `California Labor Commissioner's Office

Pay stub (hourly)

SMITH AND COMPANY, INC.
123 West Street Smalltown, CA 98765

EMPLOYEE
Johnson, Bob

SOCIAL SECURITY NO.
XXX-XX-6789

PAY RATE
18.00 regular
27.00 overtime

PAY PERIOD
1/7/XX to 1/13/XX

EARNINGS
Regular
Overtime

HOURS
40.00
2.00

AMOUNT
720.00
54.00

DEDUCTIONS
Federal W/H
FICA
Medicare
CA State W/H
CA State Dl
401k

AMOUNT

60.45
47.99
11.22
10.04
6.19
77.40

GROSS EARNINGS: 774.00
TOTAL DEDUCTED: 213.29
NET EARNINGS: 560.71`;

// A clearly non-paystub document (bank statement text)
const NON_PAYSTUB_TEXT = `Bank of America, N.A.
Customer service: 1.800.432.1000
Your combined statement for December 18, 2025 to January 16, 2026
Beginning balance on December 18, 2025 $2.26
Ending balance on January 16, 2026 $110.69`;

describe('extractPaystubByRules', () => {
  describe('Tailored Management paystub', () => {
    it('extracts gross_pay', () => {
      const result = extractPaystubByRules(TAILORED_MANAGEMENT_TEXT);
      expect(result.data.gross_pay).toBe(2585.81);
    });

    it('extracts net_pay', () => {
      const result = extractPaystubByRules(TAILORED_MANAGEMENT_TEXT);
      expect(result.data.net_pay).toBe(2137.33);
    });

    it('extracts pay_date', () => {
      const result = extractPaystubByRules(TAILORED_MANAGEMENT_TEXT);
      expect(result.data.pay_date).toBe('2026-01-02');
    });

    it('extracts pay_period_start', () => {
      const result = extractPaystubByRules(TAILORED_MANAGEMENT_TEXT);
      expect(result.data.pay_period_start).toBe('2025-12-22');
    });

    it('extracts pay_period_end', () => {
      const result = extractPaystubByRules(TAILORED_MANAGEMENT_TEXT);
      expect(result.data.pay_period_end).toBe('2025-12-28');
    });

    it('extracts pay_frequency as weekly (7-day period)', () => {
      const result = extractPaystubByRules(TAILORED_MANAGEMENT_TEXT);
      expect(result.data.pay_frequency).toBe('weekly');
    });

    it('extracts federal_tax', () => {
      const result = extractPaystubByRules(TAILORED_MANAGEMENT_TEXT);
      expect(result.data.federal_tax).toBe(235.67);
    });

    it('extracts social_security', () => {
      const result = extractPaystubByRules(TAILORED_MANAGEMENT_TEXT);
      expect(result.data.social_security).toBe(160.32);
    });

    it('extracts medicare', () => {
      const result = extractPaystubByRules(TAILORED_MANAGEMENT_TEXT);
      expect(result.data.medicare).toBe(37.49);
    });

    it('extracts employer_name', () => {
      const result = extractPaystubByRules(TAILORED_MANAGEMENT_TEXT);
      expect(result.data.employer_name).toBeTruthy();
      expect(result.data.employer_name).toContain('Tailored Management');
    });

    it('extracts employee_name', () => {
      const result = extractPaystubByRules(TAILORED_MANAGEMENT_TEXT);
      expect(result.data.employee_name).toContain('Matthew Gieselman');
    });

    it('achieves confidence >= 0.85', () => {
      const result = extractPaystubByRules(TAILORED_MANAGEMENT_TEXT);
      expect(result.confidence).toBeGreaterThanOrEqual(0.85);
    });
  });

  describe('CA DIR hourly paystub', () => {
    it('extracts gross_pay from GROSS EARNINGS label', () => {
      const result = extractPaystubByRules(CA_DIR_HOURLY_TEXT);
      expect(result.data.gross_pay).toBe(774.00);
    });

    it('extracts net_pay from NET EARNINGS label', () => {
      const result = extractPaystubByRules(CA_DIR_HOURLY_TEXT);
      expect(result.data.net_pay).toBe(560.71);
    });

    it('extracts employer_name', () => {
      const result = extractPaystubByRules(CA_DIR_HOURLY_TEXT);
      expect(result.data.employer_name).toBeTruthy();
    });

    it('extracts federal_tax', () => {
      const result = extractPaystubByRules(CA_DIR_HOURLY_TEXT);
      expect(result.data.federal_tax).toBe(60.45);
    });

    it('extracts medicare', () => {
      const result = extractPaystubByRules(CA_DIR_HOURLY_TEXT);
      expect(result.data.medicare).toBe(11.22);
    });

    it('achieves confidence >= 0.85', () => {
      const result = extractPaystubByRules(CA_DIR_HOURLY_TEXT);
      expect(result.confidence).toBeGreaterThanOrEqual(0.85);
    });
  });

  describe('non-paystub document', () => {
    it('returns confidence < 0.85 for a bank statement', () => {
      const result = extractPaystubByRules(NON_PAYSTUB_TEXT);
      expect(result.confidence).toBeLessThan(0.85);
    });

    it('does not extract gross_pay from bank statement', () => {
      const result = extractPaystubByRules(NON_PAYSTUB_TEXT);
      expect(result.data.gross_pay).toBeUndefined();
    });
  });
});
