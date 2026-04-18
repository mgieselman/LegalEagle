import { describe, it, expect } from 'vitest';
import { docClassLabel } from '../docClass';

describe('docClassLabel', () => {
  it.each([
    ['payStub.us', 'Paystub'],
    ['tax.us.w2', 'W-2'],
    ['tax.us.1040', 'Tax Return (1040)'],
    ['tax.us.1099', '1099'],
    ['bankStatement.us.checking', 'Bank Statement (Checking)'],
    ['bankStatement.us.savings', 'Bank Statement (Savings)'],
    ['creditCard', 'Credit Card Statement'],
    ['ira_statement', 'IRA Statement'],
    ['401k_statement', '401(k) Statement'],
    ['mortgage.us', 'Mortgage Statement'],
    ['vehicle_title', 'Title'],
    ['idDocument', 'ID Document'],
    ['social_security_card', 'Social Security Card'],
  ])('returns "%s" label "%s"', (docClass, expected) => {
    expect(docClassLabel(docClass)).toBe(expected);
  });

  it('returns "Other" for null, undefined, empty, unclassified, and unknown strings', () => {
    expect(docClassLabel(null)).toBe('Other');
    expect(docClassLabel(undefined)).toBe('Other');
    expect(docClassLabel('')).toBe('Other');
    expect(docClassLabel('unclassified')).toBe('Other');
    expect(docClassLabel('other')).toBe('Other');
    expect(docClassLabel('something.not.in.the.map')).toBe('Other');
  });
});
