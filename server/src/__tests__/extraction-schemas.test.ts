import { describe, it, expect } from 'vitest';
import {
  paystubSchema, bankStatementSchema, w2Schema, taxReturnSchema, creditCardStatementSchema,
  profitLossSchema, retirementAccountSchema, collectionLetterSchema, legalDocumentSchema,
  vehicleLoanSchema, mortgageSchema, socialSecuritySchema,
  getExtractionPromptTemplate,
} from '../services/extraction/schemas';

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
      expect(getExtractionPromptTemplate('payStub.us').length).toBeGreaterThan(10);
      expect(getExtractionPromptTemplate('bankStatement.us.checking').length).toBeGreaterThan(10);
      expect(getExtractionPromptTemplate('tax.us.w2').length).toBeGreaterThan(10);
      expect(getExtractionPromptTemplate('tax.us.1040').length).toBeGreaterThan(10);
      expect(getExtractionPromptTemplate('creditCard').length).toBeGreaterThan(10);
      expect(getExtractionPromptTemplate('bankStatement.us.savings').length).toBeGreaterThan(10);
    });

    it('returns empty object for unknown doc class', () => {
      expect(getExtractionPromptTemplate('other')).toBe('{}');
    });

    it('tax.us.1040 template contains refund_amount not refund_or_owed', () => {
      const tmpl = getExtractionPromptTemplate('tax.us.1040');
      expect(tmpl).toContain('refund_amount');
      expect(tmpl).not.toContain('refund_or_owed');
    });

    it('w2 template contains tax_year', () => {
      expect(getExtractionPromptTemplate('tax.us.w2')).toContain('tax_year');
    });

    it('creditCard template contains payment_due_date', () => {
      expect(getExtractionPromptTemplate('creditCard')).toContain('payment_due_date');
    });
  });

  describe('taxReturnSchema (Phase 2 fixes)', () => {
    it('validates with refund_amount and amount_owed as separate fields', () => {
      const result = taxReturnSchema.safeParse({
        tax_year: '2024',
        adjusted_gross_income: 60000,
        refund_amount: 1200,
      });
      expect(result.success).toBe(true);
    });

    it('validates amount_owed separately', () => {
      const result = taxReturnSchema.safeParse({
        tax_year: '2024',
        adjusted_gross_income: 60000,
        amount_owed: 500,
      });
      expect(result.success).toBe(true);
    });

    it('validates return_type federal and state', () => {
      expect(taxReturnSchema.safeParse({ tax_year: '2024', adjusted_gross_income: 0, return_type: 'federal' }).success).toBe(true);
      expect(taxReturnSchema.safeParse({ tax_year: '2024', adjusted_gross_income: 0, return_type: 'state' }).success).toBe(true);
    });

    it('rejects invalid return_type', () => {
      const result = taxReturnSchema.safeParse({ tax_year: '2024', adjusted_gross_income: 0, return_type: 'county' });
      expect(result.success).toBe(false);
    });

    it('validates all filing_status enum values', () => {
      const validStatuses = ['single', 'married_jointly', 'married_separately', 'head_of_household', 'qualifying_surviving_spouse'];
      for (const status of validStatuses) {
        const result = taxReturnSchema.safeParse({ tax_year: '2024', adjusted_gross_income: 0, filing_status: status });
        expect(result.success).toBe(true);
      }
    });

    it('rejects invalid filing_status', () => {
      const result = taxReturnSchema.safeParse({ tax_year: '2024', adjusted_gross_income: 0, filing_status: 'married' });
      expect(result.success).toBe(false);
    });

    it('validates total_payments', () => {
      const result = taxReturnSchema.safeParse({ tax_year: '2024', adjusted_gross_income: 60000, total_payments: 8000 });
      expect(result.success).toBe(true);
    });
  });

  describe('w2Schema (Phase 2 fixes)', () => {
    it('validates with tax_year', () => {
      const result = w2Schema.safeParse({
        employer_name: 'Acme Corp',
        wages: 65000,
        federal_tax_withheld: 9750,
        tax_year: '2024',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('creditCardStatementSchema (Phase 2 fixes)', () => {
    it('validates with all 4 new fields', () => {
      const result = creditCardStatementSchema.safeParse({
        issuer: 'Chase',
        previous_balance: 1500,
        ending_balance: 1800,
        payment_due_date: '2025-02-15',
        credit_limit: 5000,
        available_credit: 3200,
        cash_advances: 0,
      });
      expect(result.success).toBe(true);
    });
  });

  // ---- Phase 3: New schemas ----

  describe('profitLossSchema', () => {
    it('validates with required fields only', () => {
      const result = profitLossSchema.safeParse({ business_name: 'ACME LLC', gross_revenue: 80000, net_profit: 30000 });
      expect(result.success).toBe(true);
    });

    it('validates with all fields', () => {
      const result = profitLossSchema.safeParse({
        business_name: 'ACME LLC', gross_revenue: 80000, net_profit: 30000,
        period_start: '2024-01-01', period_end: '2024-12-31', total_expenses: 50000,
        owner_name: 'Jane Doe', cost_of_goods_sold: 10000, payroll_expenses: 20000,
        rent_expense: 5000, utilities: 1200,
        other_expenses: [{ name: 'Office supplies', amount: 500 }],
      });
      expect(result.success).toBe(true);
    });

    it('fails without business_name', () => {
      expect(profitLossSchema.safeParse({ gross_revenue: 80000, net_profit: 30000 }).success).toBe(false);
    });

    it('fails without gross_revenue', () => {
      expect(profitLossSchema.safeParse({ business_name: 'ACME', net_profit: 30000 }).success).toBe(false);
    });

    it('fails without net_profit', () => {
      expect(profitLossSchema.safeParse({ business_name: 'ACME', gross_revenue: 80000 }).success).toBe(false);
    });

    it('allows negative net_profit', () => {
      const result = profitLossSchema.safeParse({ business_name: 'ACME', gross_revenue: 10000, net_profit: -5000 });
      expect(result.success).toBe(true);
    });
  });

  describe('retirementAccountSchema', () => {
    it('validates with required fields only', () => {
      const result = retirementAccountSchema.safeParse({
        institution_name: 'Fidelity', account_type: 'IRA', ending_balance: 45000,
      });
      expect(result.success).toBe(true);
    });

    it('validates with all fields', () => {
      const result = retirementAccountSchema.safeParse({
        institution_name: 'Fidelity', account_type: '401k', ending_balance: 120000,
        account_number_last4: '4321', statement_period_end: '2024-12-31',
        account_holder_name: 'John Doe', employer_name: 'Acme Corp',
      });
      expect(result.success).toBe(true);
    });

    it('accepts all valid account_type enum values', () => {
      for (const type of ['IRA', '401k', '403b', 'pension', 'other_retirement'] as const) {
        expect(retirementAccountSchema.safeParse({ institution_name: 'FI', account_type: type, ending_balance: 0 }).success).toBe(true);
      }
    });

    it('rejects invalid account_type', () => {
      expect(retirementAccountSchema.safeParse({ institution_name: 'FI', account_type: 'roth', ending_balance: 0 }).success).toBe(false);
    });

    it('fails without institution_name', () => {
      expect(retirementAccountSchema.safeParse({ account_type: 'IRA', ending_balance: 0 }).success).toBe(false);
    });

    it('fails without account_type', () => {
      expect(retirementAccountSchema.safeParse({ institution_name: 'FI', ending_balance: 0 }).success).toBe(false);
    });

    it('fails without ending_balance', () => {
      expect(retirementAccountSchema.safeParse({ institution_name: 'FI', account_type: 'IRA' }).success).toBe(false);
    });
  });

  describe('collectionLetterSchema', () => {
    it('validates with required fields only', () => {
      const result = collectionLetterSchema.safeParse({ collection_agency_name: 'Midland Credit', amount_claimed: 2500 });
      expect(result.success).toBe(true);
    });

    it('validates with all fields', () => {
      const result = collectionLetterSchema.safeParse({
        collection_agency_name: 'Midland Credit', amount_claimed: 2500,
        original_creditor: 'Chase Bank', account_number_last4: '5678',
        letter_date: '2025-01-15', debt_type: 'credit card',
        references_lawsuit: true, references_judgment: false,
        judgment_amount: 2800, court_name: 'District Court',
        collection_agency_address: '123 Main St', phone: '800-555-1234',
      });
      expect(result.success).toBe(true);
    });

    it('fails without collection_agency_name', () => {
      expect(collectionLetterSchema.safeParse({ amount_claimed: 2500 }).success).toBe(false);
    });

    it('fails without amount_claimed', () => {
      expect(collectionLetterSchema.safeParse({ collection_agency_name: 'Midland' }).success).toBe(false);
    });

    it('accepts boolean values for references_lawsuit and references_judgment', () => {
      const result = collectionLetterSchema.safeParse({
        collection_agency_name: 'Midland', amount_claimed: 100,
        references_lawsuit: false, references_judgment: true,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('legalDocumentSchema', () => {
    it('validates with required fields only', () => {
      const result = legalDocumentSchema.safeParse({ document_type: 'summons', plaintiff_name: 'Bank of America' });
      expect(result.success).toBe(true);
    });

    it('validates with all fields', () => {
      const result = legalDocumentSchema.safeParse({
        document_type: 'judgment', plaintiff_name: 'Chase Bank', defendant_name: 'John Doe',
        case_number: '2024-CV-001', court_name: 'Superior Court',
        court_address: '100 Court St', filing_date: '2024-06-01',
        case_type: 'debt collection', amount_claimed: 5000, judgment_amount: 5200,
        garnishment_amount: 500, property_address: '456 Oak Ave',
      });
      expect(result.success).toBe(true);
    });

    it('accepts all valid document_type enum values', () => {
      for (const type of ['summons', 'complaint', 'judgment', 'garnishment_order', 'foreclosure_notice', 'other'] as const) {
        expect(legalDocumentSchema.safeParse({ document_type: type, plaintiff_name: 'P' }).success).toBe(true);
      }
    });

    it('rejects invalid document_type', () => {
      expect(legalDocumentSchema.safeParse({ document_type: 'eviction', plaintiff_name: 'P' }).success).toBe(false);
    });

    it('fails without document_type', () => {
      expect(legalDocumentSchema.safeParse({ plaintiff_name: 'Bank' }).success).toBe(false);
    });

    it('fails without plaintiff_name', () => {
      expect(legalDocumentSchema.safeParse({ document_type: 'summons' }).success).toBe(false);
    });
  });

  describe('vehicleLoanSchema', () => {
    it('validates with required fields only', () => {
      const result = vehicleLoanSchema.safeParse({ lender_name: 'Toyota Financial', current_balance: 18000 });
      expect(result.success).toBe(true);
    });

    it('validates with all fields', () => {
      const result = vehicleLoanSchema.safeParse({
        lender_name: 'Toyota Financial', current_balance: 18000,
        account_number_last4: '9012', interest_rate: 0.0499,
        monthly_payment: 350, vehicle_description: '2022 Toyota Camry',
        loan_origination_date: '2022-03-01', payoff_amount: 19500,
        lender_address: '123 Dealer Way',
      });
      expect(result.success).toBe(true);
    });

    it('fails without lender_name', () => {
      expect(vehicleLoanSchema.safeParse({ current_balance: 18000 }).success).toBe(false);
    });

    it('fails without current_balance', () => {
      expect(vehicleLoanSchema.safeParse({ lender_name: 'Toyota Financial' }).success).toBe(false);
    });
  });

  describe('mortgageSchema', () => {
    it('validates with required fields only', () => {
      const result = mortgageSchema.safeParse({ lender_name: 'Wells Fargo', current_balance: 230000 });
      expect(result.success).toBe(true);
    });

    it('validates with all fields', () => {
      const result = mortgageSchema.safeParse({
        lender_name: 'Wells Fargo', current_balance: 230000,
        loan_number: '1234567890', property_address: '789 Elm St',
        interest_rate: 0.065, monthly_payment: 1800,
        statement_period_end: '2025-01-31', loan_type: 'first_mortgage',
        escrow_balance: 2400, payoff_amount: 235000, lender_address: '1 Main St',
      });
      expect(result.success).toBe(true);
    });

    it('accepts all valid loan_type enum values', () => {
      for (const type of ['first_mortgage', 'second_mortgage', 'heloc', 'other'] as const) {
        expect(mortgageSchema.safeParse({ lender_name: 'WF', current_balance: 200000, loan_type: type }).success).toBe(true);
      }
    });

    it('rejects invalid loan_type', () => {
      expect(mortgageSchema.safeParse({ lender_name: 'WF', current_balance: 200000, loan_type: 'commercial' }).success).toBe(false);
    });

    it('fails without lender_name', () => {
      expect(mortgageSchema.safeParse({ current_balance: 230000 }).success).toBe(false);
    });

    it('fails without current_balance', () => {
      expect(mortgageSchema.safeParse({ lender_name: 'Wells Fargo' }).success).toBe(false);
    });
  });

  describe('socialSecuritySchema', () => {
    it('validates with required field only', () => {
      const result = socialSecuritySchema.safeParse({ monthly_benefit: 1450 });
      expect(result.success).toBe(true);
    });

    it('validates with all fields', () => {
      const result = socialSecuritySchema.safeParse({
        monthly_benefit: 1450, benefit_type: 'SSDI',
        effective_date: '2025-01-01', recipient_name: 'Jane Doe',
        net_monthly_benefit: 1310, medicare_premium: 140, annual_benefit: 17400,
      });
      expect(result.success).toBe(true);
    });

    it('accepts all valid benefit_type enum values', () => {
      for (const type of ['SSDI', 'SSI', 'retirement', 'survivor', 'other'] as const) {
        expect(socialSecuritySchema.safeParse({ monthly_benefit: 1000, benefit_type: type }).success).toBe(true);
      }
    });

    it('rejects invalid benefit_type', () => {
      expect(socialSecuritySchema.safeParse({ monthly_benefit: 1000, benefit_type: 'disability' }).success).toBe(false);
    });

    it('fails without monthly_benefit', () => {
      expect(socialSecuritySchema.safeParse({ benefit_type: 'SSDI' }).success).toBe(false);
    });
  });

  describe('getExtractionPromptTemplate (Phase 3 new classes)', () => {
    it('returns non-empty template for all 7 new doc classes', () => {
      const newClasses = [
        'profit_loss_statement', 'retirement_account', 'collection_letter',
        'legal_document', 'vehicle_loan_statement', 'mortgage.us', 'social_security_letter',
      ] as const;
      for (const cls of newClasses) {
        expect(getExtractionPromptTemplate(cls).length).toBeGreaterThan(10);
      }
    });

    it('ira_statement reuses retirement_account template', () => {
      expect(getExtractionPromptTemplate('ira_statement')).toBe(getExtractionPromptTemplate('retirement_account'));
    });

    it('401k_statement reuses retirement_account template', () => {
      expect(getExtractionPromptTemplate('401k_statement')).toBe(getExtractionPromptTemplate('retirement_account'));
    });
  });
});
