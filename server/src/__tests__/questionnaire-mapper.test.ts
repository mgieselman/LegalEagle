import { describe, it, expect } from 'vitest';
import { buildAutofillPatch, type ExtractionInput } from '../services/autofill/questionnaireMapper';

function paystubInput(overrides: Partial<ExtractionInput> = {}): ExtractionInput {
  return {
    documentId: 'doc-1',
    docClass: 'payStub.us',
    data: {
      employer_name: 'Acme Corp',
      employee_name: 'Jane Doe',
      gross_pay: 5000,
      net_pay: 3800,
    },
    fieldConfidences: {
      employer_name: 0.95,
      employee_name: 0.92,
      gross_pay: 0.98,
      net_pay: 0.97,
    },
    belongsTo: 'debtor',
    ...overrides,
  };
}

function bankInput(overrides: Partial<ExtractionInput> = {}): ExtractionInput {
  return {
    documentId: 'doc-2',
    docClass: 'bankStatement.us.checking',
    data: {
      institution_name: 'First National Bank',
      account_number_last4: '1234',
      ending_balance: 4250.00,
    },
    fieldConfidences: {
      institution_name: 0.99,
      account_number_last4: 0.95,
      ending_balance: 0.98,
    },
    belongsTo: null,
    ...overrides,
  };
}

describe('buildAutofillPatch', () => {
  it('returns empty patch for no extractions', () => {
    const patch = buildAutofillPatch([]);
    expect(patch.fields).toEqual({});
    expect(patch.sources).toEqual({});
  });

  it('maps paystub debtor fields', () => {
    const patch = buildAutofillPatch([paystubInput()]);
    expect(patch.fields.fullName).toBe('Jane Doe');
    expect(patch.fields.employerNameAddress).toBe('Acme Corp');
    expect((patch.fields.incomeThisYear as Record<string, string>)?.youAmount).toBe('5000');
    expect(patch.sources['fullName']?.documentId).toBe('doc-1');
    expect(patch.sources['employerNameAddress']?.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('maps paystub spouse fields when belongsTo is spouse', () => {
    const patch = buildAutofillPatch([paystubInput({ belongsTo: 'spouse' })]);
    expect(patch.fields.spouseFullName).toBe('Jane Doe');
    expect(patch.fields.spouseEmployerNameAddress).toBe('Acme Corp');
    expect((patch.fields.incomeThisYear as Record<string, string>)?.spouseAmount).toBe('5000');
    expect(patch.fields.fullName).toBeUndefined();
  });

  it('maps w2 fields correctly', () => {
    const input: ExtractionInput = {
      documentId: 'doc-w2',
      docClass: 'tax.us.w2',
      data: {
        employer_name: 'Big Corp',
        employee_name: 'John Smith',
        wages: 80000,
        federal_tax_withheld: 15000,
      },
      fieldConfidences: {
        employer_name: 0.9,
        employee_name: 0.85,
        wages: 0.95,
        federal_tax_withheld: 0.9,
      },
      belongsTo: 'debtor',
    };
    const patch = buildAutofillPatch([input]);
    expect(patch.fields.fullName).toBe('John Smith');
    expect(patch.fields.employerNameAddress).toBe('Big Corp');
    expect((patch.fields.incomeThisYear as Record<string, string>)?.youAmount).toBe('80000');
  });

  it('maps bank statement to bankDeposits array', () => {
    const patch = buildAutofillPatch([bankInput()]);
    expect(patch.fields.bankDeposits).toHaveLength(1);
    expect(patch.fields.bankDeposits?.[0].bankNameAddress).toBe('First National Bank (****1234)');
    expect(patch.fields.bankDeposits?.[0].amount).toBe('4250');
  });

  it('skips fields below confidence threshold', () => {
    const input = paystubInput({
      fieldConfidences: { employer_name: 0.5, employee_name: 0.3, gross_pay: 0.6 },
    });
    const patch = buildAutofillPatch([input]);
    expect(patch.fields.fullName).toBeUndefined();
    expect(patch.fields.employerNameAddress).toBeUndefined();
    expect((patch.fields.incomeThisYear as Record<string, string>)?.youAmount).toBeUndefined();
  });

  it('highest confidence wins on debtor name conflict between paystub and w2', () => {
    const paystub = paystubInput({
      data: { employer_name: 'Employer A', employee_name: 'Jane Paystub', gross_pay: 3000, net_pay: 2400 },
      fieldConfidences: { employee_name: 0.80, employer_name: 0.80, gross_pay: 0.80 },
    });
    const w2: ExtractionInput = {
      documentId: 'doc-w2',
      docClass: 'tax.us.w2',
      data: { employer_name: 'Employer B', employee_name: 'Jane W2', wages: 60000, federal_tax_withheld: 10000 },
      fieldConfidences: { employee_name: 0.95, employer_name: 0.95, wages: 0.95 },
      belongsTo: 'debtor',
    };
    const patch = buildAutofillPatch([paystub, w2]);
    // w2 has higher confidence so its values win
    expect(patch.fields.fullName).toBe('Jane W2');
    expect(patch.fields.employerNameAddress).toBe('Employer B');
  });

  it('appends multiple bank deposit entries', () => {
    const bank1 = bankInput({ documentId: 'bank-1', data: { institution_name: 'Bank A', ending_balance: 1000 }, fieldConfidences: { institution_name: 0.9, ending_balance: 0.9 } });
    const bank2 = bankInput({ documentId: 'bank-2', data: { institution_name: 'Bank B', ending_balance: 2000 }, fieldConfidences: { institution_name: 0.9, ending_balance: 0.9 } });
    const patch = buildAutofillPatch([bank1, bank2]);
    expect(patch.fields.bankDeposits).toHaveLength(2);
    expect(patch.fields.bankDeposits?.[0].bankNameAddress).toBe('Bank A');
    expect(patch.fields.bankDeposits?.[1].bankNameAddress).toBe('Bank B');
  });

  it('ignores documents with null docClass', () => {
    const input: ExtractionInput = {
      documentId: 'doc-unknown',
      docClass: null,
      data: {},
      fieldConfidences: {},
      belongsTo: null,
    };
    const patch = buildAutofillPatch([input]);
    expect(patch.fields).toEqual({});
  });

  it('tracks sources for each mapped field', () => {
    const patch = buildAutofillPatch([paystubInput()]);
    expect(patch.sources['fullName']).toMatchObject({
      documentId: 'doc-1',
      docClass: 'payStub.us',
    });
    expect(patch.sources['fullName'].confidence).toBeGreaterThanOrEqual(0.7);
  });
});
