import { describe, it, expect } from 'vitest';
import { classifyByRules } from '../services/classification/ruleClassifier';

describe('Rule Classifier', () => {
  it('classifies paystub by content', () => {
    const result = classifyByRules('document.pdf', 'Employee Pay Statement\nPay Period: 01/01/2026 - 01/15/2026\nGross Pay: $2,500.00');
    expect(result.docClass).toBe('paystub');
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
    expect(result.method).toBe('rule_engine');
  });

  it('classifies paystub by filename', () => {
    const result = classifyByRules('paystub-jan-2026.pdf', 'some generic content');
    expect(result.docClass).toBe('paystub');
    expect(result.confidence).toBeGreaterThanOrEqual(0.60);
  });

  it('classifies W-2 by content', () => {
    const result = classifyByRules('tax-doc.pdf', 'Wage and Tax Statement Form W-2 2025');
    expect(result.docClass).toBe('w2');
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it('classifies W-2 by filename', () => {
    const result = classifyByRules('w2-2025.pdf', '');
    expect(result.docClass).toBe('w2');
    expect(result.confidence).toBeGreaterThanOrEqual(0.60);
  });

  it('classifies 1099 by content', () => {
    const result = classifyByRules('misc.pdf', 'Form 1099-MISC Miscellaneous Income');
    expect(result.docClass).toBe('1099');
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it('classifies tax return by content', () => {
    const result = classifyByRules('return.pdf', 'Form 1040 U.S. Individual Income Tax Return');
    expect(result.docClass).toBe('tax_return');
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it('classifies bank statement (checking) by content', () => {
    const result = classifyByRules('statement.pdf', 'Statement Period 01/01 - 01/31 Checking Account Statement\nBeginning Balance: $5,000\nEnding Balance: $4,200');
    expect(result.docClass).toBe('bank_statement_checking');
    expect(result.confidence).toBeGreaterThanOrEqual(0.80);
  });

  it('classifies credit card statement by content', () => {
    const result = classifyByRules('cc.pdf', 'Credit Card Statement\nPrevious Balance: $1,200\nNew Charges: $350');
    expect(result.docClass).toBe('credit_card_statement');
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it('classifies 401k statement by content', () => {
    const result = classifyByRules('retirement.pdf', '401(k) Statement\nRetirement Plan Statement');
    expect(result.docClass).toBe('401k_statement');
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it('returns unclassified for unknown content', () => {
    const result = classifyByRules('random-scan.pdf', 'This is just a random document with no financial keywords');
    expect(result.docClass).toBe('unclassified');
    expect(result.confidence).toBe(0);
  });

  it('content patterns boost confidence above filename alone', () => {
    const filenameOnly = classifyByRules('paystub.pdf', '');
    const withContent = classifyByRules('paystub.pdf', 'Pay Statement\nGross Pay: $3,000');
    expect(withContent.confidence).toBeGreaterThan(filenameOnly.confidence);
  });
});
