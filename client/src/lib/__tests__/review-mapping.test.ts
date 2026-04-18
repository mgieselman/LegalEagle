import { describe, it, expect } from 'vitest';
import { findingsForSection, sectionNameToKey, sectionFindingSeverity, findingToSectionKey } from '../review-mapping';
import type { ReviewFinding } from '@/api/client';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function finding(
  fieldHint: string | undefined,
  section: string,
  severity: 'error' | 'warning' | 'info' = 'error',
): ReviewFinding {
  return { severity, section, message: 'test message', fieldHint };
}

// ---------------------------------------------------------------------------
// fieldHint routing — the real-world cases that burned us
// ---------------------------------------------------------------------------

describe('findingsForSection — fieldHint routing', () => {
  /**
   * This is the exact scenario that caused the production bug:
   * Claude labelled paymentsOver600 findings as "Gifts & Transfers" (section 12),
   * but the fieldHint correctly points into paymentsOver600 (section 7).
   * fieldHint must win.
   */
  it('routes paymentsOver600 to section 7 even when section name says "Gifts & Transfers"', () => {
    const findings = [
      finding('paymentsOver600[0].paymentDates', 'Gifts & Transfers'),
      finding('paymentsOver600[1].paymentDates', 'Gifts & Transfers'),
      finding('paymentsOver600[0].amount', 'Gifts & Transfers'),
    ];
    expect(findingsForSection('7', findings)).toHaveLength(3);
    expect(findingsForSection('12', findings)).toHaveLength(0);
  });

  it('routes vehicles[n].* to section 27', () => {
    const findings = [
      finding('vehicles[0].approximateValue', 'Vehicles'),
      finding('vehicles[1].approximateValue', 'Vehicles'),
    ];
    expect(findingsForSection('27', findings)).toHaveLength(2);
  });

  it('routes cashAdvanceDetails to section 22', () => {
    const findings = [finding('cashAdvanceDetails', 'Credit & Cash Advances')];
    expect(findingsForSection('22', findings)).toHaveLength(1);
  });

  it('routes closedAccountEntries[n].* to section 15', () => {
    const findings = [finding('closedAccountEntries[0].finalBalance', 'Bank Accounts')];
    expect(findingsForSection('15', findings)).toHaveLength(1);
  });

  it('routes giftsTransfers to section 12', () => {
    const findings = [finding('giftsTransfers', 'Gifts & Transfers')];
    expect(findingsForSection('12', findings)).toHaveLength(1);
  });

  it('routes incomeThisYear to section 3', () => {
    const findings = [finding('incomeThisYear', 'Income')];
    expect(findingsForSection('3', findings)).toHaveLength(1);
  });

  it('routes studentLoan.* to section 7', () => {
    const findings = [finding('studentLoan.lender', 'Student Loan')];
    expect(findingsForSection('7', findings)).toHaveLength(1);
  });

  it('routes unsecuredDebts to section 25 even when labeled "Medical Debt"', () => {
    const findings = [finding('unsecuredDebts', 'Medical Debt')];
    expect(findingsForSection('25', findings)).toHaveLength(1);
    expect(findingsForSection('7', findings)).toHaveLength(0);
  });

  it('routes paydayLoanDetails to section 22 even when labeled "Payday Loans"', () => {
    const findings = [finding('paydayLoanDetails', 'Payday Loans')];
    expect(findingsForSection('22', findings)).toHaveLength(1);
  });

  // Dot-notation sub-field
  it('routes currentAddress.city to section 1', () => {
    const findings = [finding('currentAddress.city', 'Address')];
    expect(findingsForSection('1', findings)).toHaveLength(1);
  });

  // Exact match (no dot or bracket)
  it('routes cashOnHand (exact) to section 26', () => {
    const findings = [finding('cashOnHand', 'Assets')];
    expect(findingsForSection('26', findings)).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Fallback: section-name keyword routing (no fieldHint)
// ---------------------------------------------------------------------------

describe('findingsForSection — section-name keyword fallback', () => {
  it('routes a finding with no fieldHint by section name keyword', () => {
    const findings = [finding(undefined, 'Vehicles')];
    expect(findingsForSection('27', findings)).toHaveLength(1);
  });

  it('routes "Income" section to section 3 when no fieldHint', () => {
    const findings = [finding(undefined, 'Income')];
    expect(findingsForSection('3', findings)).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// sectionNameToKey
// ---------------------------------------------------------------------------

describe('sectionNameToKey', () => {
  it.each([
    ['Vehicles', '27'],
    ['Vehicle Valuation', '27'],
    ['Income', '3'],
    ['Employment & Income', '3'],
    ['Gifts & Transfers', '12'],
    ['Cash Advance', '22'],
    ['Credit Card Charges', '22'],
    ['Bank Accounts Closed', '15'],
    ['Unsecured Creditors', '25'],
    ['Prior Bankruptcy Filing', '2'],
  ])('maps "%s" → section %s', (name, expected) => {
    expect(sectionNameToKey(name)).toBe(expected);
  });

  it('returns null for completely unrecognised section names', () => {
    expect(sectionNameToKey('Miscellaneous')).toBeNull();
    expect(sectionNameToKey('')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// findingToSectionKey — canonical single-finding routing (used by FormShell
// auto-expand + finding-click handlers; must agree with findingsForSection).
// ---------------------------------------------------------------------------

describe('findingToSectionKey', () => {
  it('fieldHint wins over section-name keywords', () => {
    expect(
      findingToSectionKey(finding('paymentsOver600[0].paymentDates', 'Gifts & Transfers')),
    ).toBe('7');
  });

  it('falls back to section name when fieldHint is absent', () => {
    expect(findingToSectionKey(finding(undefined, 'Vehicles'))).toBe('27');
  });

  it('returns null when neither fieldHint nor section name resolve', () => {
    expect(findingToSectionKey(finding(undefined, 'Miscellaneous'))).toBeNull();
  });

  it('agrees with findingsForSection for every production finding', () => {
    const PRODUCTION: ReviewFinding[] = [
      { severity: 'error', section: 'Gifts & Transfers', message: 'm', fieldHint: 'paymentsOver600[0].paymentDates' },
      { severity: 'error', section: 'Vehicles', message: 'm', fieldHint: 'vehicles[0].approximateValue' },
      { severity: 'warning', section: 'Bank Accounts', message: 'm', fieldHint: 'closedAccountEntries[0].finalBalance' },
      { severity: 'info', section: 'Medical Debt', message: 'm', fieldHint: 'unsecuredDebts' },
    ];
    for (const f of PRODUCTION) {
      const key = findingToSectionKey(f);
      expect(key).not.toBeNull();
      expect(findingsForSection(key!, PRODUCTION)).toContain(f);
    }
  });
});

// ---------------------------------------------------------------------------
// sectionFindingSeverity
// ---------------------------------------------------------------------------

describe('sectionFindingSeverity', () => {
  it('returns null when no findings map to the section', () => {
    expect(sectionFindingSeverity('27', [])).toBeNull();
  });

  it('returns the single severity when only one finding exists', () => {
    const findings = [finding('vehicles[0].approximateValue', 'Vehicles', 'warning')];
    expect(sectionFindingSeverity('27', findings)).toBe('warning');
  });

  it('returns "error" when any finding is an error', () => {
    const findings = [
      finding('vehicles[0].approximateValue', 'Vehicles', 'warning'),
      finding('vehicles[1].approximateValue', 'Vehicles', 'error'),
    ];
    expect(sectionFindingSeverity('27', findings)).toBe('error');
  });

  it('returns "warning" when highest is warning', () => {
    const findings = [
      finding('vehicles[0].approximateValue', 'Vehicles', 'info'),
      finding('vehicles[1].approximateValue', 'Vehicles', 'warning'),
    ];
    expect(sectionFindingSeverity('27', findings)).toBe('warning');
  });

  it('returns "info" when all findings are info', () => {
    const findings = [finding('cashOnHand', 'Assets', 'info')];
    expect(sectionFindingSeverity('26', findings)).toBe('info');
  });

  it('fieldHint routing is used, so paymentsOver600 errors appear in section 7 not 12', () => {
    const findings = [
      finding('paymentsOver600[0].paymentDates', 'Gifts & Transfers', 'error'),
    ];
    expect(sectionFindingSeverity('7', findings)).toBe('error');
    expect(sectionFindingSeverity('12', findings)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Full round-trip: the exact 11 findings from the production AI response
// ---------------------------------------------------------------------------

describe('round-trip: production AI response', () => {
  const PRODUCTION_FINDINGS: ReviewFinding[] = [
    { severity: 'error', section: 'Gifts & Transfers', message: 'Future payment date listed for creditor payment - payment to Maria Martinez shows date of 2026-01-15, which is in the future.', fieldHint: 'paymentsOver600[0].paymentDates' },
    { severity: 'error', section: 'Gifts & Transfers', message: 'Future payment date listed - Hartford Hospital payment date 2025-12-01.', fieldHint: 'paymentsOver600[1].paymentDates' },
    { severity: 'error', section: 'Gifts & Transfers', message: 'Large payment to insider (mother) of $8,500 within 1 year of filing.', fieldHint: 'paymentsOver600[0].amount' },
    { severity: 'error', section: 'Vehicles', message: '2019 Honda CR-V valued at only $800 — severely undervalued.', fieldHint: 'vehicles[0].approximateValue' },
    { severity: 'error', section: 'Credit & Cash Advances', message: 'Cash advance of $1,800 on future date may be non-dischargeable.', fieldHint: 'cashAdvanceDetails' },
    { severity: 'warning', section: 'Bank Accounts', message: 'Webster Bank savings closed with $4,200 balance — suspicious timing.', fieldHint: 'closedAccountEntries[0].finalBalance' },
    { severity: 'warning', section: 'Gifts & Transfers', message: 'Transfer of 2018 Honda Accord to brother in November 2025.', fieldHint: 'giftsTransfers' },
    { severity: 'warning', section: 'Vehicles', message: '2014 Toyota Corolla with 142k miles valued at $4,500 may be undervalued.', fieldHint: 'vehicles[1].approximateValue' },
    { severity: 'info', section: 'Income', message: 'Steady income but filing bankruptcy.', fieldHint: 'incomeThisYear' },
    { severity: 'warning', section: 'Payday Loans', message: 'LoanMax payday loan at 390% APR.', fieldHint: 'paydayLoanDetails' },
    { severity: 'info', section: 'Medical Debt', message: 'Significant medical debt from Hartford Hospital.', fieldHint: 'unsecuredDebts' },
  ];

  it.each([
    ['1',  0], ['2',  0], ['3',  1], ['4',  0], ['5',  0],
    ['6',  0], ['7',  3], ['8',  0], ['9',  0], ['10', 0],
    ['11', 0], ['12', 1], ['13', 0], ['14', 0], ['15', 1],
    ['16', 0], ['17', 0], ['18', 0], ['19', 0], ['20', 0],
    ['21', 0], ['22', 2], ['23', 0], ['24', 0], ['25', 1],
    ['26', 0], ['27', 2],
  ] as [string, number][])('section %s receives %d findings', (section, expectedCount) => {
    expect(findingsForSection(section, PRODUCTION_FINDINGS)).toHaveLength(expectedCount);
  });

  it('total findings distributed equals total findings produced', () => {
    const allSections = Array.from({ length: 27 }, (_, i) => String(i + 1));
    const total = allSections.reduce(
      (sum, key) => sum + findingsForSection(key, PRODUCTION_FINDINGS).length,
      0,
    );
    expect(total).toBe(PRODUCTION_FINDINGS.length);
  });
});
