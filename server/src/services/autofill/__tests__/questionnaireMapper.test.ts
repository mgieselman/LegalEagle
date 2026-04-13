/**
 * Unit tests for buildAutofillPatch — Phase 4 new doc class mappings.
 *
 * Covers all 15 newly-added doc classes:
 * idDocument, social_security_card, tax.us.1040, tax.us.1099,
 * creditCard, mortgage.us, vehicle_loan_statement, vehicle_title,
 * collection_letter, legal_document, retirement_account, ira_statement,
 * 401k_statement, social_security_letter, profit_loss_statement,
 * brokerage_statement
 */
import { describe, it, expect } from 'vitest';
import {
  buildAutofillPatch,
  type ExtractionInput,
} from '../questionnaireMapper';
import type { IncomeEntry } from '../../../types/questionnaire';

// ---- Helpers ----------------------------------------------------------------

function makeInput(overrides: Partial<ExtractionInput> & Pick<ExtractionInput, 'docClass' | 'data' | 'fieldConfidences'>): ExtractionInput {
  return {
    documentId: 'doc-test',
    belongsTo: 'debtor',
    ...overrides,
  };
}

/** Access patch.fields as a plain object for dynamic property access without TS errors. */
function asMap(fields: unknown): Record<string, unknown> {
  return fields as Record<string, unknown>;
}

function incomeEntry(fields: unknown, key: 'incomeThisYear' | 'incomeLastYear'): IncomeEntry | undefined {
  return (fields as Record<string, IncomeEntry | undefined>)[key];
}

const HIGH = 0.95;
const LOW = 0.5; // below MIN_CONFIDENCE

// ---- idDocument -------------------------------------------------------------

describe('idDocument mapping', () => {
  it('maps full_name to fullName for debtor', () => {
    const input = makeInput({
      docClass: 'idDocument',
      data: { full_name: 'Alice Walker', date_of_birth: '1985-03-15', address: '123 Main St' },
      fieldConfidences: { full_name: HIGH, date_of_birth: HIGH, address: HIGH },
      belongsTo: 'debtor',
    });
    const patch = buildAutofillPatch([input]);
    expect(patch.fields.fullName).toBe('Alice Walker');
    expect(patch.fields.dob).toBe('1985-03-15');
    expect(asMap(patch.fields.currentAddress)['street']).toBe('123 Main St');
    expect(patch.sources['fullName']?.docClass).toBe('idDocument');
  });

  it('maps full_name to spouseFullName for spouse', () => {
    const input = makeInput({
      docClass: 'idDocument',
      data: { full_name: 'Bob Walker', date_of_birth: '1983-07-22' },
      fieldConfidences: { full_name: HIGH, date_of_birth: HIGH },
      belongsTo: 'spouse',
    });
    const patch = buildAutofillPatch([input]);
    expect(patch.fields.spouseFullName).toBe('Bob Walker');
    expect(patch.fields.spouseDob).toBe('1983-07-22');
    expect(patch.fields.fullName).toBeUndefined();
  });

  it('does not map spouse address to currentAddress', () => {
    const input = makeInput({
      docClass: 'idDocument',
      data: { full_name: 'Bob Walker', address: '456 Elm St' },
      fieldConfidences: { full_name: HIGH, address: HIGH },
      belongsTo: 'spouse',
    });
    const patch = buildAutofillPatch([input]);
    expect(patch.fields.currentAddress).toBeUndefined();
  });

  it('skips fields below confidence threshold', () => {
    const input = makeInput({
      docClass: 'idDocument',
      data: { full_name: 'Alice Walker', date_of_birth: '1985-03-15' },
      fieldConfidences: { full_name: LOW, date_of_birth: LOW },
    });
    const patch = buildAutofillPatch([input]);
    expect(patch.fields.fullName).toBeUndefined();
    expect(patch.fields.dob).toBeUndefined();
  });
});

// ---- social_security_card ---------------------------------------------------

describe('social_security_card mapping', () => {
  it('maps full_name to fullName for debtor', () => {
    const input = makeInput({
      docClass: 'social_security_card',
      data: { full_name: 'Jane Smith' },
      fieldConfidences: { full_name: HIGH },
      belongsTo: 'debtor',
    });
    const patch = buildAutofillPatch([input]);
    expect(patch.fields.fullName).toBe('Jane Smith');
  });

  it('maps full_name to spouseFullName for spouse', () => {
    const input = makeInput({
      docClass: 'social_security_card',
      data: { full_name: 'John Smith' },
      fieldConfidences: { full_name: HIGH },
      belongsTo: 'spouse',
    });
    const patch = buildAutofillPatch([input]);
    expect(patch.fields.spouseFullName).toBe('John Smith');
  });

  it('skips low-confidence name', () => {
    const input = makeInput({
      docClass: 'social_security_card',
      data: { full_name: 'Jane Smith' },
      fieldConfidences: { full_name: LOW },
    });
    const patch = buildAutofillPatch([input]);
    expect(patch.fields.fullName).toBeUndefined();
  });
});

// ---- tax.us.1040 ------------------------------------------------------------

describe('tax.us.1040 mapping', () => {
  it('maps filing_status and federal refund', () => {
    const input = makeInput({
      docClass: 'tax.us.1040',
      data: {
        tax_year: '2024',
        filing_status: 'married_jointly',
        adjusted_gross_income: 75000,
        refund_amount: 1200,
        return_type: 'federal',
      },
      fieldConfidences: {
        filing_status: HIGH,
        adjusted_gross_income: HIGH,
        refund_amount: HIGH,
      },
    });
    const patch = buildAutofillPatch([input]);
    // filingStatus is stored as a dynamic field via applyDotPath
    expect(asMap(patch.fields)['filingStatus']).toBe('married_jointly');
    expect(patch.fields.refundFederal).toBe('1200');
    expect(incomeEntry(patch.fields, 'incomeThisYear')?.youAmount).toBe('75000');
  });

  it('maps state refund when return_type is state', () => {
    const input = makeInput({
      docClass: 'tax.us.1040',
      data: {
        tax_year: '2024',
        adjusted_gross_income: 75000,
        refund_amount: 300,
        return_type: 'state',
      },
      fieldConfidences: {
        adjusted_gross_income: HIGH,
        refund_amount: HIGH,
      },
    });
    const patch = buildAutofillPatch([input]);
    expect(patch.fields.refundState).toBe('300');
    expect(patch.fields.refundFederal).toBeUndefined();
  });

  it('sets owesFederalTaxes when amount_owed > 0', () => {
    const input = makeInput({
      docClass: 'tax.us.1040',
      data: {
        tax_year: '2024',
        adjusted_gross_income: 50000,
        amount_owed: 800,
        return_type: 'federal',
      },
      fieldConfidences: {
        adjusted_gross_income: HIGH,
        amount_owed: HIGH,
      },
    });
    const patch = buildAutofillPatch([input]);
    expect(patch.fields.owesFederalTaxes).toBe('yes');
  });

  it('routes older tax year to incomeLastYear', () => {
    const input = makeInput({
      docClass: 'tax.us.1040',
      data: {
        tax_year: '2020',
        adjusted_gross_income: 60000,
      },
      fieldConfidences: { adjusted_gross_income: HIGH },
    });
    const patch = buildAutofillPatch([input]);
    expect(incomeEntry(patch.fields, 'incomeLastYear')?.youAmount).toBe('60000');
    expect(incomeEntry(patch.fields, 'incomeThisYear')?.youAmount).toBeUndefined();
  });

  it('maps spouse income when belongsTo is spouse', () => {
    const input = makeInput({
      docClass: 'tax.us.1040',
      data: { tax_year: '2024', adjusted_gross_income: 45000 },
      fieldConfidences: { adjusted_gross_income: HIGH },
      belongsTo: 'spouse',
    });
    const patch = buildAutofillPatch([input]);
    expect(incomeEntry(patch.fields, 'incomeThisYear')?.spouseAmount).toBe('45000');
    expect(incomeEntry(patch.fields, 'incomeThisYear')?.youAmount).toBeUndefined();
  });
});

// ---- tax.us.1099 ------------------------------------------------------------

describe('tax.us.1099 mapping', () => {
  it('maps 1099-NEC income to incomeThisYear', () => {
    const input = makeInput({
      docClass: 'tax.us.1099',
      data: {
        form_variant: '1099-NEC',
        payer_name: 'Client Corp',
        total_amount: 12000,
        tax_year: '2024',
      },
      fieldConfidences: { total_amount: HIGH },
    });
    const patch = buildAutofillPatch([input]);
    expect(incomeEntry(patch.fields, 'incomeThisYear')?.youAmount).toBe('12000');
  });

  it('maps 1099-MISC income for spouse', () => {
    const input = makeInput({
      docClass: 'tax.us.1099',
      data: {
        form_variant: '1099-MISC',
        payer_name: 'Another Corp',
        total_amount: 5000,
      },
      fieldConfidences: { total_amount: HIGH },
      belongsTo: 'spouse',
    });
    const patch = buildAutofillPatch([input]);
    expect(incomeEntry(patch.fields, 'incomeThisYear')?.spouseAmount).toBe('5000');
  });

  it('skips when total_amount confidence is low', () => {
    const input = makeInput({
      docClass: 'tax.us.1099',
      data: { form_variant: '1099-INT', payer_name: 'Bank', total_amount: 50 },
      fieldConfidences: { total_amount: LOW },
    });
    const patch = buildAutofillPatch([input]);
    expect(incomeEntry(patch.fields, 'incomeThisYear')?.youAmount).toBeUndefined();
  });
});

// ---- creditCard -------------------------------------------------------------

describe('creditCard mapping', () => {
  it('appends unsecured debt entry', () => {
    const input = makeInput({
      docClass: 'creditCard',
      data: {
        issuer: 'Chase Bank',
        account_number_last4: '4321',
        ending_balance: 3500,
        previous_balance: 3200,
      },
      fieldConfidences: { issuer: HIGH, ending_balance: HIGH },
    });
    const patch = buildAutofillPatch([input]);
    expect(patch.fields.unsecuredDebts).toHaveLength(1);
    expect(patch.fields.unsecuredDebts?.[0].creditorName).toBe('Chase Bank');
    expect(patch.fields.unsecuredDebts?.[0].accountNo).toBe('****4321');
    expect(patch.fields.unsecuredDebts?.[0].amountOwed).toBe('3500');
  });

  it('appends multiple credit card debts', () => {
    const card1 = makeInput({
      documentId: 'card-1',
      docClass: 'creditCard',
      data: { issuer: 'Chase', account_number_last4: '1111', ending_balance: 1000, previous_balance: 900 },
      fieldConfidences: { issuer: HIGH, ending_balance: HIGH },
    });
    const card2 = makeInput({
      documentId: 'card-2',
      docClass: 'creditCard',
      data: { issuer: 'Citi', account_number_last4: '2222', ending_balance: 2000, previous_balance: 1800 },
      fieldConfidences: { issuer: HIGH, ending_balance: HIGH },
    });
    const patch = buildAutofillPatch([card1, card2]);
    expect(patch.fields.unsecuredDebts).toHaveLength(2);
    expect(patch.fields.unsecuredDebts?.[0].creditorName).toBe('Chase');
    expect(patch.fields.unsecuredDebts?.[1].creditorName).toBe('Citi');
  });

  it('skips when both issuer and balance are low confidence', () => {
    const input = makeInput({
      docClass: 'creditCard',
      data: { issuer: 'Chase', ending_balance: 100, previous_balance: 0 },
      fieldConfidences: { issuer: LOW, ending_balance: LOW },
    });
    const patch = buildAutofillPatch([input]);
    expect(patch.fields.unsecuredDebts).toBeUndefined();
  });
});

// ---- mortgage.us ------------------------------------------------------------

describe('mortgage.us mapping', () => {
  it('appends secured debt entry', () => {
    const input = makeInput({
      docClass: 'mortgage.us',
      data: {
        lender_name: 'Wells Fargo',
        current_balance: 185000,
        loan_number: 'WF-99887766',
        property_address: '789 Oak Ave',
        lender_address: '420 Main St, SF, CA',
      },
      fieldConfidences: { lender_name: HIGH, current_balance: HIGH, property_address: HIGH },
    });
    const patch = buildAutofillPatch([input]);
    expect(patch.fields.securedDebts).toHaveLength(1);
    expect(patch.fields.securedDebts?.[0].lenderName).toBe('Wells Fargo');
    expect(patch.fields.securedDebts?.[0].currentBalance).toBe('185000');
    expect(patch.fields.securedDebts?.[0].accountNumber).toBe('WF-99887766');
  });

  it('maps property_address to currentAddress.street', () => {
    const input = makeInput({
      docClass: 'mortgage.us',
      data: { lender_name: 'Bank', current_balance: 200000, property_address: '123 Property Ln' },
      fieldConfidences: { lender_name: HIGH, current_balance: HIGH, property_address: HIGH },
    });
    const patch = buildAutofillPatch([input]);
    expect(asMap(patch.fields.currentAddress)['street']).toBe('123 Property Ln');
  });

  it('does not map property_address when confidence is low', () => {
    const input = makeInput({
      docClass: 'mortgage.us',
      data: { lender_name: 'Bank', current_balance: 200000, property_address: '123 Property Ln' },
      fieldConfidences: { lender_name: HIGH, current_balance: HIGH, property_address: LOW },
    });
    const patch = buildAutofillPatch([input]);
    expect(patch.fields.currentAddress).toBeUndefined();
  });
});

// ---- vehicle_loan_statement -------------------------------------------------

describe('vehicle_loan_statement mapping', () => {
  it('appends to vehicles and securedDebts', () => {
    const input = makeInput({
      docClass: 'vehicle_loan_statement',
      data: {
        lender_name: 'Toyota Financial',
        current_balance: 18000,
        account_number_last4: '5678',
        interest_rate: 0.0399,
        monthly_payment: 380,
        vehicle_description: '2022 Toyota Camry',
        lender_address: '100 Toyota Way',
      },
      fieldConfidences: { lender_name: HIGH, current_balance: HIGH },
    });
    const patch = buildAutofillPatch([input]);
    expect(patch.fields.vehicles).toHaveLength(1);
    expect(patch.fields.vehicles?.[0].makeYearModel).toBe('2022 Toyota Camry');
    expect(patch.fields.vehicles?.[0].lenderName).toBe('Toyota Financial');
    expect(patch.fields.securedDebts).toHaveLength(1);
    expect(patch.fields.securedDebts?.[0].currentBalance).toBe('18000');
    expect(patch.fields.securedDebts?.[0].accountNumber).toBe('****5678');
  });
});

// ---- vehicle_title ----------------------------------------------------------

describe('vehicle_title mapping', () => {
  it('appends vehicle entry with year/make/model and VIN', () => {
    const input = makeInput({
      docClass: 'vehicle_title',
      data: {
        year: '2019',
        make: 'Honda',
        model: 'Civic',
        vin: '1HGCV1F30KA123456',
        odometer_miles: 62000,
      },
      fieldConfidences: { year: HIGH, make: HIGH, model: HIGH },
    });
    const patch = buildAutofillPatch([input]);
    expect(patch.fields.vehicles).toHaveLength(1);
    expect(patch.fields.vehicles?.[0].makeYearModel).toBe('2019 Honda Civic');
    expect(patch.fields.vehicles?.[0].loanNumber).toBe('1HGCV1F30KA123456');
    expect(patch.fields.vehicles?.[0].mileage).toBe('62000');
  });

  it('skips when all vehicle field confidences are low', () => {
    const input = makeInput({
      docClass: 'vehicle_title',
      data: { year: '2019', make: 'Honda', model: 'Civic' },
      fieldConfidences: { year: LOW, make: LOW, model: LOW },
    });
    const patch = buildAutofillPatch([input]);
    expect(patch.fields.vehicles).toBeUndefined();
  });

  it('vehicle_loan and vehicle_title stack into vehicles array', () => {
    const title = makeInput({
      documentId: 'title-1',
      docClass: 'vehicle_title',
      data: { year: '2019', make: 'Honda', model: 'Civic', vin: 'VIN1' },
      fieldConfidences: { year: HIGH, make: HIGH, model: HIGH },
    });
    const loan = makeInput({
      documentId: 'loan-1',
      docClass: 'vehicle_loan_statement',
      data: { lender_name: 'Auto Lender', current_balance: 8000, vehicle_description: '2019 Honda Civic' },
      fieldConfidences: { lender_name: HIGH, current_balance: HIGH },
    });
    const patch = buildAutofillPatch([title, loan]);
    expect(patch.fields.vehicles).toHaveLength(2);
  });
});

// ---- collection_letter ------------------------------------------------------

describe('collection_letter mapping', () => {
  it('appends unsecured debt from collection letter', () => {
    const input = makeInput({
      docClass: 'collection_letter',
      data: {
        collection_agency_name: 'Debt Collectors Inc',
        amount_claimed: 4200,
        collection_agency_address: '100 Debt Ave',
        account_number_last4: '9999',
      },
      fieldConfidences: { collection_agency_name: HIGH, amount_claimed: HIGH },
    });
    const patch = buildAutofillPatch([input]);
    expect(patch.fields.unsecuredDebts).toHaveLength(1);
    expect(patch.fields.unsecuredDebts?.[0].creditorName).toBe('Debt Collectors Inc');
    expect(patch.fields.unsecuredDebts?.[0].amountOwed).toBe('4200');
    expect(patch.fields.unsecuredDebts?.[0].creditorAddress).toBe('100 Debt Ave');
  });

  it('sets beenSued when references_lawsuit is true', () => {
    const input = makeInput({
      docClass: 'collection_letter',
      data: {
        collection_agency_name: 'Debt Collectors Inc',
        amount_claimed: 4200,
        references_lawsuit: true,
      },
      fieldConfidences: {
        collection_agency_name: HIGH,
        amount_claimed: HIGH,
        references_lawsuit: HIGH,
      },
    });
    const patch = buildAutofillPatch([input]);
    expect(patch.fields.beenSued).toBe('yes');
  });

  it('does not set beenSued when references_lawsuit is false', () => {
    const input = makeInput({
      docClass: 'collection_letter',
      data: {
        collection_agency_name: 'Agency',
        amount_claimed: 100,
        references_lawsuit: false,
      },
      fieldConfidences: {
        collection_agency_name: HIGH,
        amount_claimed: HIGH,
        references_lawsuit: HIGH,
      },
    });
    const patch = buildAutofillPatch([input]);
    expect(patch.fields.beenSued).toBeUndefined();
  });
});

// ---- legal_document ---------------------------------------------------------

describe('legal_document mapping', () => {
  it('summons → sets beenSued and appends to lawsuits', () => {
    const input = makeInput({
      docClass: 'legal_document',
      data: {
        document_type: 'summons',
        plaintiff_name: 'Capital One',
        case_number: 'CV-2024-001',
        court_name: 'District Court',
        case_type: 'debt collection',
        amount_claimed: 5000,
      },
      fieldConfidences: { document_type: HIGH, plaintiff_name: HIGH },
    });
    const patch = buildAutofillPatch([input]);
    expect(patch.fields.beenSued).toBe('yes');
    expect(patch.fields.lawsuits).toHaveLength(1);
    expect(patch.fields.lawsuits?.[0].caseName).toBe('Capital One');
    expect(patch.fields.lawsuits?.[0].caseNo).toBe('CV-2024-001');
    expect(patch.fields.lawsuits?.[0].amount).toBe('5000');
  });

  it('complaint → sets beenSued and appends to lawsuits', () => {
    const input = makeInput({
      docClass: 'legal_document',
      data: {
        document_type: 'complaint',
        plaintiff_name: 'Creditor LLC',
        case_number: 'CV-2024-002',
        court_name: 'Superior Court',
        amount_claimed: 2000,
      },
      fieldConfidences: { document_type: HIGH, plaintiff_name: HIGH },
    });
    const patch = buildAutofillPatch([input]);
    expect(patch.fields.beenSued).toBe('yes');
    expect(patch.fields.lawsuits).toHaveLength(1);
  });

  it('judgment → sets beenSued with judgment result note', () => {
    const input = makeInput({
      docClass: 'legal_document',
      data: {
        document_type: 'judgment',
        plaintiff_name: 'Creditor Inc',
        judgment_amount: 7500,
      },
      fieldConfidences: { document_type: HIGH, plaintiff_name: HIGH },
    });
    const patch = buildAutofillPatch([input]);
    expect(patch.fields.beenSued).toBe('yes');
    expect(patch.fields.lawsuits?.[0].result).toContain('7500');
  });

  it('garnishment_order → sets garnished and appends to garnishments', () => {
    const input = makeInput({
      docClass: 'legal_document',
      data: {
        document_type: 'garnishment_order',
        plaintiff_name: 'IRS',
        garnishment_amount: 500,
        filing_date: '2024-01-15',
        court_address: '200 Court St',
      },
      fieldConfidences: { document_type: HIGH, plaintiff_name: HIGH },
    });
    const patch = buildAutofillPatch([input]);
    expect(patch.fields.garnished).toBe('yes');
    expect(patch.fields.garnishments).toHaveLength(1);
    expect(patch.fields.garnishments?.[0].creditorName).toBe('IRS');
    expect(patch.fields.garnishments?.[0].amountTaken).toBe('500');
    expect(patch.fields.beenSued).toBeUndefined();
  });

  it('foreclosure_notice → sets foreclosureOrSale and appends to foreclosures', () => {
    const input = makeInput({
      docClass: 'legal_document',
      data: {
        document_type: 'foreclosure_notice',
        plaintiff_name: 'Bank of America',
        property_address: '123 Home St',
        filing_date: '2024-02-01',
      },
      fieldConfidences: { document_type: HIGH, plaintiff_name: HIGH },
    });
    const patch = buildAutofillPatch([input]);
    expect(patch.fields.foreclosureOrSale).toBe('yes');
    expect(patch.fields.foreclosures).toHaveLength(1);
    expect(patch.fields.foreclosures?.[0].property).toBe('123 Home St');
    expect(patch.fields.foreclosures?.[0].creditorNameAddress).toBe('Bank of America');
  });

  it('skips when confidence is below threshold', () => {
    const input = makeInput({
      docClass: 'legal_document',
      data: {
        document_type: 'summons',
        plaintiff_name: 'Creditor',
      },
      fieldConfidences: { document_type: LOW, plaintiff_name: LOW },
    });
    const patch = buildAutofillPatch([input]);
    expect(patch.fields.beenSued).toBeUndefined();
    expect(patch.fields.lawsuits).toBeUndefined();
  });
});

// ---- retirement_account / ira_statement / 401k_statement --------------------

describe('retirement account mapping', () => {
  it('retirement_account → sets hasIRA and iraDetails', () => {
    const input = makeInput({
      docClass: 'retirement_account',
      data: {
        institution_name: 'Fidelity',
        account_type: 'IRA',
        ending_balance: 42000,
        account_number_last4: '7890',
      },
      fieldConfidences: { institution_name: HIGH, ending_balance: HIGH },
    });
    const patch = buildAutofillPatch([input]);
    expect(patch.fields.hasIRA).toBe('yes');
    expect(typeof patch.fields.iraDetails).toBe('string');
    expect(patch.fields.iraDetails).toContain('Fidelity');
    expect(patch.fields.iraDetails).toContain('42000');
  });

  it('ira_statement routes through same logic', () => {
    const input = makeInput({
      docClass: 'ira_statement',
      data: {
        institution_name: 'Vanguard',
        account_type: 'IRA',
        ending_balance: 55000,
      },
      fieldConfidences: { institution_name: HIGH, ending_balance: HIGH },
    });
    const patch = buildAutofillPatch([input]);
    expect(patch.fields.hasIRA).toBe('yes');
    expect(patch.fields.iraDetails).toContain('Vanguard');
  });

  it('401k_statement routes through same logic', () => {
    const input = makeInput({
      docClass: '401k_statement',
      data: {
        institution_name: 'Schwab',
        account_type: '401k',
        ending_balance: 80000,
      },
      fieldConfidences: { institution_name: HIGH, ending_balance: HIGH },
    });
    const patch = buildAutofillPatch([input]);
    expect(patch.fields.hasIRA).toBe('yes');
    expect(patch.fields.iraDetails).toContain('Schwab');
  });

  it('skips when both institution and balance are low confidence', () => {
    const input = makeInput({
      docClass: 'retirement_account',
      data: { institution_name: 'Fidelity', account_type: 'IRA', ending_balance: 1000 },
      fieldConfidences: { institution_name: LOW, ending_balance: LOW },
    });
    const patch = buildAutofillPatch([input]);
    expect(patch.fields.hasIRA).toBeUndefined();
  });
});

// ---- social_security_letter -------------------------------------------------

describe('social_security_letter mapping', () => {
  it('maps monthly_benefit to incomeThisYear for debtor', () => {
    const input = makeInput({
      docClass: 'social_security_letter',
      data: {
        monthly_benefit: 1450,
        benefit_type: 'SSDI',
        recipient_name: 'Jane Doe',
      },
      fieldConfidences: { monthly_benefit: HIGH },
      belongsTo: 'debtor',
    });
    const patch = buildAutofillPatch([input]);
    expect(incomeEntry(patch.fields, 'incomeThisYear')?.youAmount).toBe('1450');
    expect(incomeEntry(patch.fields, 'incomeThisYear')?.youSource).toBe('Social Security');
  });

  it('maps to spouse income fields when belongsTo is spouse', () => {
    const input = makeInput({
      docClass: 'social_security_letter',
      data: { monthly_benefit: 900, benefit_type: 'retirement' },
      fieldConfidences: { monthly_benefit: HIGH },
      belongsTo: 'spouse',
    });
    const patch = buildAutofillPatch([input]);
    expect(incomeEntry(patch.fields, 'incomeThisYear')?.spouseAmount).toBe('900');
    expect(incomeEntry(patch.fields, 'incomeThisYear')?.spouseSource).toBe('Social Security');
  });

  it('skips when monthly_benefit confidence is low', () => {
    const input = makeInput({
      docClass: 'social_security_letter',
      data: { monthly_benefit: 1000, benefit_type: 'SSI' },
      fieldConfidences: { monthly_benefit: LOW },
    });
    const patch = buildAutofillPatch([input]);
    expect(incomeEntry(patch.fields, 'incomeThisYear')?.youAmount).toBeUndefined();
  });
});

// ---- profit_loss_statement --------------------------------------------------

describe('profit_loss_statement mapping', () => {
  it('sets inBusiness, businessInfo, and income from net_profit', () => {
    const input = makeInput({
      docClass: 'profit_loss_statement',
      data: {
        business_name: 'Acme Plumbing LLC',
        gross_revenue: 120000,
        net_profit: 45000,
        period_start: '2024-01-01',
        period_end: '2024-12-31',
      },
      fieldConfidences: {
        business_name: HIGH,
        gross_revenue: HIGH,
        net_profit: HIGH,
      },
    });
    const patch = buildAutofillPatch([input]);
    expect(patch.fields.inBusiness).toBe('yes');
    expect(patch.fields.businessInfo).toHaveLength(1);
    expect(patch.fields.businessInfo?.[0].name).toBe('Acme Plumbing LLC');
    expect(incomeEntry(patch.fields, 'incomeThisYear')?.youAmount).toBe('45000');
  });

  it('maps spouse business income when belongsTo is spouse', () => {
    const input = makeInput({
      docClass: 'profit_loss_statement',
      data: { business_name: 'Spouse Co', gross_revenue: 50000, net_profit: 20000 },
      fieldConfidences: { business_name: HIGH, gross_revenue: HIGH, net_profit: HIGH },
      belongsTo: 'spouse',
    });
    const patch = buildAutofillPatch([input]);
    expect(incomeEntry(patch.fields, 'incomeThisYear')?.spouseAmount).toBe('20000');
  });

  it('skips when business_name and gross_revenue both have low confidence', () => {
    const input = makeInput({
      docClass: 'profit_loss_statement',
      data: { business_name: 'Test', gross_revenue: 10000, net_profit: 5000 },
      fieldConfidences: { business_name: LOW, gross_revenue: LOW, net_profit: HIGH },
    });
    const patch = buildAutofillPatch([input]);
    expect(patch.fields.inBusiness).toBeUndefined();
  });
});

// ---- brokerage_statement ----------------------------------------------------

describe('brokerage_statement mapping', () => {
  it('maps brokerage account to bankDeposits', () => {
    const input = makeInput({
      docClass: 'brokerage_statement',
      data: {
        institution_name: 'E*TRADE',
        ending_value: 25000,
        account_number_last4: '3344',
        statement_period_end: '2024-12-31',
      },
      fieldConfidences: { institution_name: HIGH, ending_value: HIGH },
    });
    const patch = buildAutofillPatch([input]);
    expect(patch.fields.bankDeposits).toBeDefined();
    const etrade = patch.fields.bankDeposits?.find(d => d.bankNameAddress.includes('E*TRADE'));
    expect(etrade).toBeDefined();
    expect(etrade?.amount).toBe('25000');
  });

  it('deduplicates brokerage accounts by institution and last4', () => {
    const old = makeInput({
      documentId: 'brok-1',
      docClass: 'brokerage_statement',
      data: { institution_name: 'Fidelity', ending_value: 10000, account_number_last4: '0001', statement_period_end: '2024-06-30' },
      fieldConfidences: { institution_name: HIGH, ending_value: HIGH },
    });
    const newer = makeInput({
      documentId: 'brok-2',
      docClass: 'brokerage_statement',
      data: { institution_name: 'Fidelity', ending_value: 15000, account_number_last4: '0001', statement_period_end: '2024-12-31' },
      fieldConfidences: { institution_name: HIGH, ending_value: HIGH },
    });
    const patch = buildAutofillPatch([old, newer]);
    const fidelity = patch.fields.bankDeposits?.filter(d => d.bankNameAddress.includes('Fidelity'));
    expect(fidelity).toHaveLength(1);
    expect(fidelity?.[0].amount).toBe('15000'); // newer wins
  });

  it('skips when both institution and ending_value are low confidence', () => {
    const input = makeInput({
      docClass: 'brokerage_statement',
      data: { institution_name: 'Schwab', ending_value: 5000 },
      fieldConfidences: { institution_name: LOW, ending_value: LOW },
    });
    const patch = buildAutofillPatch([input]);
    expect(patch.fields.bankDeposits).toBeUndefined();
  });
});

// ---- Cross-doc interactions -------------------------------------------------

describe('cross-document interactions', () => {
  it('collection_letter and creditCard both append to unsecuredDebts', () => {
    const card = makeInput({
      documentId: 'd1',
      docClass: 'creditCard',
      data: { issuer: 'Chase', ending_balance: 2000, previous_balance: 1800 },
      fieldConfidences: { issuer: HIGH, ending_balance: HIGH },
    });
    const letter = makeInput({
      documentId: 'd2',
      docClass: 'collection_letter',
      data: { collection_agency_name: 'Collector', amount_claimed: 500 },
      fieldConfidences: { collection_agency_name: HIGH, amount_claimed: HIGH },
    });
    const patch = buildAutofillPatch([card, letter]);
    expect(patch.fields.unsecuredDebts).toHaveLength(2);
  });

  it('mortgage and vehicle_loan both append to securedDebts', () => {
    const mortgage = makeInput({
      documentId: 'm1',
      docClass: 'mortgage.us',
      data: { lender_name: 'Lender A', current_balance: 200000 },
      fieldConfidences: { lender_name: HIGH, current_balance: HIGH },
    });
    const car = makeInput({
      documentId: 'c1',
      docClass: 'vehicle_loan_statement',
      data: { lender_name: 'Auto Lender', current_balance: 15000 },
      fieldConfidences: { lender_name: HIGH, current_balance: HIGH },
    });
    const patch = buildAutofillPatch([mortgage, car]);
    expect(patch.fields.securedDebts).toHaveLength(2);
  });

  it('legal summons and collection letter both set beenSued from different sources', () => {
    const summons = makeInput({
      documentId: 's1',
      docClass: 'legal_document',
      data: { document_type: 'summons', plaintiff_name: 'Creditor A' },
      fieldConfidences: { document_type: HIGH, plaintiff_name: HIGH },
    });
    const letter = makeInput({
      documentId: 'l1',
      docClass: 'collection_letter',
      data: { collection_agency_name: 'Agency', amount_claimed: 100, references_lawsuit: true },
      fieldConfidences: { collection_agency_name: HIGH, amount_claimed: HIGH, references_lawsuit: HIGH },
    });
    const patch = buildAutofillPatch([summons, letter]);
    expect(patch.fields.beenSued).toBe('yes');
  });

  it('idDocument and social_security_card both contribute fullName, highest confidence wins', () => {
    const idDoc = makeInput({
      documentId: 'id-1',
      docClass: 'idDocument',
      data: { full_name: 'Alice From ID' },
      fieldConfidences: { full_name: 0.75 },
      belongsTo: 'debtor',
    });
    const ssCard = makeInput({
      documentId: 'ss-1',
      docClass: 'social_security_card',
      data: { full_name: 'Alice From SSCard' },
      fieldConfidences: { full_name: 0.90 },
      belongsTo: 'debtor',
    });
    const patch = buildAutofillPatch([idDoc, ssCard]);
    expect(patch.fields.fullName).toBe('Alice From SSCard');
  });
});
