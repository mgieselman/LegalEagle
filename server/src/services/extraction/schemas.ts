import { z } from 'zod/v4';
import type { DocClass } from '../classification/types';

// ---- Paystub ----
export const paystubSchema = z.object({
  employer_name: z.string(),
  employee_name: z.string().optional(),
  pay_period_start: z.string().optional(),
  pay_period_end: z.string().optional(),
  pay_date: z.string().optional(),
  pay_frequency: z.enum(['weekly', 'biweekly', 'semimonthly', 'monthly']).optional(),
  gross_pay: z.number(),
  federal_tax: z.number().optional(),
  state_tax: z.number().optional(),
  social_security: z.number().optional(),
  medicare: z.number().optional(),
  health_insurance: z.number().optional(),
  retirement_401k: z.number().optional(),
  other_deductions: z.array(z.object({ name: z.string(), amount: z.number() })).optional(),
  net_pay: z.number(),
  ytd_gross: z.number().optional(),
  ytd_net: z.number().optional(),
  hours_worked: z.number().optional(),
  hourly_rate: z.number().optional(),
});

// ---- Bank Statement ----
export const bankStatementSchema = z.object({
  institution_name: z.string(),
  account_type: z.enum(['checking', 'savings', 'investment']).optional(),
  account_number_last4: z.string().optional(),
  statement_period_start: z.string().optional(),
  statement_period_end: z.string().optional(),
  beginning_balance: z.number(),
  ending_balance: z.number(),
  total_deposits: z.number().optional(),
  total_withdrawals: z.number().optional(),
  transactions: z.array(z.object({
    date: z.string(),
    description: z.string(),
    amount: z.number(),
    type: z.enum(['credit', 'debit']),
  })).optional(),
});

// ---- W-2 ----
export const w2Schema = z.object({
  employer_name: z.string(),
  employer_ein: z.string().optional(),
  employee_name: z.string().optional(),
  employee_ssn_last4: z.string().optional(),
  tax_year: z.string().optional(),
  wages: z.number(),
  federal_tax_withheld: z.number(),
  social_security_wages: z.number().optional(),
  social_security_tax: z.number().optional(),
  medicare_wages: z.number().optional(),
  medicare_tax: z.number().optional(),
  state: z.string().optional(),
  state_wages: z.number().optional(),
  state_tax: z.number().optional(),
});

// ---- Tax Return ----
export const taxReturnSchema = z.object({
  tax_year: z.string(),
  return_type: z.enum(['federal', 'state']).optional(),
  filing_status: z.enum(['single', 'married_jointly', 'married_separately', 'head_of_household', 'qualifying_surviving_spouse']).optional(),
  adjusted_gross_income: z.number(),
  taxable_income: z.number().optional(),
  total_tax: z.number().optional(),
  total_payments: z.number().optional(),
  refund_amount: z.number().optional(),
  amount_owed: z.number().optional(),
});

// ---- Credit Card Statement ----
export const creditCardStatementSchema = z.object({
  issuer: z.string(),
  account_number_last4: z.string().optional(),
  statement_period_start: z.string().optional(),
  statement_period_end: z.string().optional(),
  previous_balance: z.number(),
  payments: z.number().optional(),
  new_charges: z.number().optional(),
  ending_balance: z.number(),
  minimum_payment_due: z.number().optional(),
  payment_due_date: z.string().optional(),
  credit_limit: z.number().optional(),
  available_credit: z.number().optional(),
  cash_advances: z.number().optional(),
});

// ---- Profit & Loss Statement ----
export const profitLossSchema = z.object({
  business_name: z.string(),
  gross_revenue: z.number(),
  net_profit: z.number(),
  period_start: z.string().optional(),
  period_end: z.string().optional(),
  total_expenses: z.number().optional(),
  owner_name: z.string().optional(),
  cost_of_goods_sold: z.number().optional(),
  payroll_expenses: z.number().optional(),
  rent_expense: z.number().optional(),
  utilities: z.number().optional(),
  other_expenses: z.array(z.object({ name: z.string(), amount: z.number() })).optional(),
});

// ---- Retirement Account ----
export const retirementAccountSchema = z.object({
  institution_name: z.string(),
  account_type: z.enum(['IRA', '401k', '403b', 'pension', 'other_retirement']),
  ending_balance: z.number(),
  account_number_last4: z.string().optional(),
  statement_period_end: z.string().optional(),
  account_holder_name: z.string().optional(),
  employer_name: z.string().optional(),
});

// ---- Collection Letter ----
export const collectionLetterSchema = z.object({
  collection_agency_name: z.string(),
  amount_claimed: z.number(),
  original_creditor: z.string().optional(),
  account_number_last4: z.string().optional(),
  letter_date: z.string().optional(),
  debt_type: z.string().optional(),
  references_lawsuit: z.boolean().optional(),
  references_judgment: z.boolean().optional(),
  judgment_amount: z.number().optional(),
  court_name: z.string().optional(),
  collection_agency_address: z.string().optional(),
  phone: z.string().optional(),
});

// ---- Legal Document ----
export const legalDocumentSchema = z.object({
  document_type: z.enum(['summons', 'complaint', 'judgment', 'garnishment_order', 'foreclosure_notice', 'other']),
  plaintiff_name: z.string(),
  defendant_name: z.string().optional(),
  case_number: z.string().optional(),
  court_name: z.string().optional(),
  court_address: z.string().optional(),
  filing_date: z.string().optional(),
  case_type: z.string().optional(),
  amount_claimed: z.number().optional(),
  judgment_amount: z.number().optional(),
  garnishment_amount: z.number().optional(),
  property_address: z.string().optional(),
});

// ---- Vehicle Loan Statement ----
export const vehicleLoanSchema = z.object({
  lender_name: z.string(),
  current_balance: z.number(),
  account_number_last4: z.string().optional(),
  interest_rate: z.number().optional(),
  monthly_payment: z.number().optional(),
  vehicle_description: z.string().optional(),
  loan_origination_date: z.string().optional(),
  payoff_amount: z.number().optional(),
  lender_address: z.string().optional(),
});

// ---- Mortgage Statement ----
export const mortgageSchema = z.object({
  lender_name: z.string(),
  current_balance: z.number(),
  loan_number: z.string().optional(),
  property_address: z.string().optional(),
  interest_rate: z.number().optional(),
  monthly_payment: z.number().optional(),
  statement_period_end: z.string().optional(),
  loan_type: z.enum(['first_mortgage', 'second_mortgage', 'heloc', 'other']).optional(),
  escrow_balance: z.number().optional(),
  payoff_amount: z.number().optional(),
  lender_address: z.string().optional(),
});

// ---- Social Security Letter ----
export const socialSecuritySchema = z.object({
  monthly_benefit: z.number(),
  benefit_type: z.enum(['SSDI', 'SSI', 'retirement', 'survivor', 'other']).optional(),
  effective_date: z.string().optional(),
  recipient_name: z.string().optional(),
  net_monthly_benefit: z.number().optional(),
  medicare_premium: z.number().optional(),
  annual_benefit: z.number().optional(),
});

// ---- ID Document (Driver's License) ----
export const idDocumentSchema = z.object({
  full_name: z.string(),
  date_of_birth: z.string().optional(),
  license_number: z.string().optional(),
  expiration_date: z.string().optional(),
  address: z.string().optional(),
  state: z.string().optional(),
  sex: z.string().optional(),
});

// ---- Social Security Card ----
export const socialSecurityCardSchema = z.object({
  full_name: z.string(),
  ssn_last4: z.string().optional(),
});

// ---- Brokerage Statement ----
export const brokerageStatementSchema = z.object({
  institution_name: z.string(),
  account_holder_name: z.string().optional(),
  account_number_last4: z.string().optional(),
  statement_period_start: z.string().optional(),
  statement_period_end: z.string().optional(),
  beginning_value: z.number(),
  ending_value: z.number(),
});

// ---- Vehicle Title ----
export const vehicleTitleSchema = z.object({
  title_number: z.string().optional(),
  vin: z.string().optional(),
  year: z.string().optional(),
  make: z.string().optional(),
  model: z.string().optional(),
  body_style: z.string().optional(),
  legal_owner_name: z.string().optional(),
  registered_owner_name: z.string().optional(),
  issue_date: z.string().optional(),
  odometer_miles: z.number().optional(),
  legal_owner_address: z.string().optional(),
  prior_title_state: z.string().optional(),
});

// ---- Tax 1099 ----
export const tax1099Schema = z.object({
  form_variant: z.string(),
  payer_name: z.string(),
  recipient_name: z.string().optional(),
  recipient_ssn_last4: z.string().optional(),
  tax_year: z.string().optional(),
  total_amount: z.number(),
  federal_tax_withheld: z.number().optional(),
});

// ---- Generic (for other/unclassified) ----
export const genericSchema = z.record(z.string(), z.unknown());

// ---- Inferred TypeScript types (source of truth: the Zod schemas above) ----
export type PaystubData = z.infer<typeof paystubSchema>;
export type BankStatementData = z.infer<typeof bankStatementSchema>;
export type W2Data = z.infer<typeof w2Schema>;
export type TaxReturnData = z.infer<typeof taxReturnSchema>;
export type CreditCardData = z.infer<typeof creditCardStatementSchema>;
export type ProfitLossData = z.infer<typeof profitLossSchema>;
export type RetirementAccountData = z.infer<typeof retirementAccountSchema>;
export type CollectionLetterData = z.infer<typeof collectionLetterSchema>;
export type LegalDocumentData = z.infer<typeof legalDocumentSchema>;
export type VehicleLoanData = z.infer<typeof vehicleLoanSchema>;
export type MortgageData = z.infer<typeof mortgageSchema>;
export type SocialSecurityData = z.infer<typeof socialSecuritySchema>;
export type IdDocumentData = z.infer<typeof idDocumentSchema>;
export type SocialSecurityCardData = z.infer<typeof socialSecurityCardSchema>;
export type BrokerageStatementData = z.infer<typeof brokerageStatementSchema>;
export type VehicleTitleData = z.infer<typeof vehicleTitleSchema>;
export type Tax1099Data = z.infer<typeof tax1099Schema>;
export type GenericData = z.infer<typeof genericSchema>;

export type ExtractionData =
  | PaystubData
  | BankStatementData
  | W2Data
  | TaxReturnData
  | CreditCardData
  | ProfitLossData
  | RetirementAccountData
  | CollectionLetterData
  | LegalDocumentData
  | VehicleLoanData
  | MortgageData
  | SocialSecurityData
  | IdDocumentData
  | SocialSecurityCardData
  | BrokerageStatementData
  | VehicleTitleData
  | Tax1099Data
  | GenericData;

// ---- Schema lookup by doc class ----
const schemaMap: Partial<Record<DocClass, z.ZodType>> = {
  'payStub.us': paystubSchema,
  'bankStatement.us.checking': bankStatementSchema,
  'bankStatement.us.savings': bankStatementSchema,
  'tax.us.1040': taxReturnSchema,
  'tax.us.w2': w2Schema,
  creditCard: creditCardStatementSchema,
  // Legacy retirement classes route to the unified schema
  ira_statement: retirementAccountSchema,
  '401k_statement': retirementAccountSchema,
  // New classes
  profit_loss_statement: profitLossSchema,
  retirement_account: retirementAccountSchema,
  collection_letter: collectionLetterSchema,
  legal_document: legalDocumentSchema,
  vehicle_loan_statement: vehicleLoanSchema,
  'mortgage.us': mortgageSchema,
  social_security_letter: socialSecuritySchema,
  idDocument: idDocumentSchema,
  social_security_card: socialSecurityCardSchema,
  brokerage_statement: brokerageStatementSchema,
  vehicle_title: vehicleTitleSchema,
  'tax.us.1099': tax1099Schema,
};

export function getSchemaForDocClass(docClass: DocClass): z.ZodType {
  return schemaMap[docClass] ?? genericSchema;
}

/**
 * Returns a JSON template string describing the expected fields for a doc class.
 * Used in AI extraction prompts.
 */
export function getExtractionPromptTemplate(docClass: DocClass): string {
  const templates: Partial<Record<DocClass, string>> = {
    'payStub.us': JSON.stringify({
      employer_name: 'string',
      employee_name: 'string',
      pay_period_start: 'YYYY-MM-DD',
      pay_period_end: 'YYYY-MM-DD',
      pay_date: 'YYYY-MM-DD',
      pay_frequency: 'weekly|biweekly|semimonthly|monthly',
      gross_pay: 0,
      federal_tax: 0,
      state_tax: 0,
      social_security: 0,
      medicare: 0,
      health_insurance: 0,
      retirement_401k: 0,
      other_deductions: [{ name: 'string', amount: 0 }],
      net_pay: 0,
      ytd_gross: 0,
      ytd_net: 0,
      hours_worked: 0,
      hourly_rate: 0,
    }, null, 2),

    'bankStatement.us.checking': JSON.stringify({
      institution_name: 'string',
      account_type: 'checking|savings',
      account_number_last4: 'string',
      statement_period_start: 'YYYY-MM-DD',
      statement_period_end: 'YYYY-MM-DD',
      beginning_balance: 0,
      ending_balance: 0,
      total_deposits: 0,
      total_withdrawals: 0,
      transactions: [{ date: 'YYYY-MM-DD', description: 'string', amount: 0, type: 'credit|debit' }],
    }, null, 2),

    'tax.us.w2': JSON.stringify({
      employer_name: 'string',
      employer_ein: 'string',
      employee_name: 'string',
      employee_ssn_last4: 'string (last 4 digits only)',
      tax_year: 'YYYY',
      wages: 0,
      federal_tax_withheld: 0,
      social_security_wages: 0,
      social_security_tax: 0,
      medicare_wages: 0,
      medicare_tax: 0,
      state: 'string',
      state_wages: 0,
      state_tax: 0,
    }, null, 2),

    'tax.us.1040': JSON.stringify({
      tax_year: 'YYYY',
      return_type: 'federal|state',
      filing_status: 'single|married_jointly|married_separately|head_of_household|qualifying_surviving_spouse',
      adjusted_gross_income: 0,
      taxable_income: 0,
      total_tax: 0,
      total_payments: 0,
      refund_amount: 0,
      amount_owed: 0,
    }, null, 2),

    creditCard: JSON.stringify({
      issuer: 'string (financial institution, not card network)',
      account_number_last4: 'string (last 4 digits only)',
      statement_period_start: 'YYYY-MM-DD',
      statement_period_end: 'YYYY-MM-DD',
      previous_balance: 0,
      payments: 0,
      new_charges: 0,
      ending_balance: 0,
      minimum_payment_due: 0,
      payment_due_date: 'YYYY-MM-DD',
      credit_limit: 0,
      available_credit: 0,
      cash_advances: 0,
    }, null, 2),

    profit_loss_statement: JSON.stringify({
      business_name: 'string',
      gross_revenue: 0,
      net_profit: 0,
      period_start: 'YYYY-MM-DD',
      period_end: 'YYYY-MM-DD',
      total_expenses: 0,
      owner_name: 'string',
      cost_of_goods_sold: 0,
      payroll_expenses: 0,
      rent_expense: 0,
      utilities: 0,
      other_expenses: [{ name: 'string', amount: 0 }],
    }, null, 2),

    retirement_account: JSON.stringify({
      institution_name: 'string',
      account_type: 'IRA|401k|403b|pension|other_retirement',
      ending_balance: 0,
      account_number_last4: 'string (last 4 digits only)',
      statement_period_end: 'YYYY-MM-DD',
      account_holder_name: 'string',
      employer_name: 'string',
    }, null, 2),

    collection_letter: JSON.stringify({
      collection_agency_name: 'string',
      amount_claimed: 0,
      original_creditor: 'string',
      account_number_last4: 'string (last 4 digits only)',
      letter_date: 'YYYY-MM-DD',
      debt_type: 'string (e.g. credit card, medical, auto loan)',
      references_lawsuit: false,
      references_judgment: false,
      judgment_amount: 0,
      court_name: 'string',
      collection_agency_address: 'string',
      phone: 'string',
    }, null, 2),

    legal_document: JSON.stringify({
      document_type: 'summons|complaint|judgment|garnishment_order|foreclosure_notice|other',
      plaintiff_name: 'string',
      defendant_name: 'string',
      case_number: 'string',
      court_name: 'string',
      court_address: 'string',
      filing_date: 'YYYY-MM-DD',
      case_type: 'string (e.g. debt collection, mortgage foreclosure)',
      amount_claimed: 0,
      judgment_amount: 0,
      garnishment_amount: 0,
      property_address: 'string',
    }, null, 2),

    vehicle_loan_statement: JSON.stringify({
      lender_name: 'string',
      current_balance: 0,
      account_number_last4: 'string (last 4 digits only)',
      interest_rate: 0.0699,
      monthly_payment: 0,
      vehicle_description: 'string (e.g. 2021 Toyota Camry)',
      loan_origination_date: 'YYYY-MM-DD',
      payoff_amount: 0,
      lender_address: 'string',
    }, null, 2),

    'mortgage.us': JSON.stringify({
      lender_name: 'string',
      current_balance: 0,
      loan_number: 'string (full loan number)',
      property_address: 'string',
      interest_rate: 0.065,
      monthly_payment: 0,
      statement_period_end: 'YYYY-MM-DD',
      loan_type: 'first_mortgage|second_mortgage|heloc|other',
      escrow_balance: 0,
      payoff_amount: 0,
      lender_address: 'string',
    }, null, 2),

    social_security_letter: JSON.stringify({
      monthly_benefit: 0,
      benefit_type: 'SSDI|SSI|retirement|survivor|other',
      effective_date: 'YYYY-MM-DD',
      recipient_name: 'string',
      net_monthly_benefit: 0,
      medicare_premium: 0,
      annual_benefit: 0,
    }, null, 2),

    idDocument: JSON.stringify({
      full_name: 'string',
      date_of_birth: 'YYYY-MM-DD',
      license_number: 'string',
      expiration_date: 'YYYY-MM-DD',
      address: 'string',
      state: 'string',
      sex: 'string',
    }, null, 2),

    social_security_card: JSON.stringify({
      full_name: 'string',
      ssn_last4: 'string (last 4 digits only)',
    }, null, 2),

    brokerage_statement: JSON.stringify({
      institution_name: 'string',
      account_holder_name: 'string',
      account_number_last4: 'string (last 4 digits only)',
      statement_period_start: 'YYYY-MM-DD',
      statement_period_end: 'YYYY-MM-DD',
      beginning_value: 0,
      ending_value: 0,
    }, null, 2),

    vehicle_title: JSON.stringify({
      title_number: 'string',
      vin: 'string',
      year: 'string',
      make: 'string',
      model: 'string',
      body_style: 'string',
      legal_owner_name: 'string',
      registered_owner_name: 'string',
      issue_date: 'YYYY-MM-DD',
      odometer_miles: 0,
      legal_owner_address: 'string',
      prior_title_state: 'string',
    }, null, 2),

    'tax.us.1099': JSON.stringify({
      form_variant: '1099-MISC|1099-NEC|1099-INT|1099-DIV|1099-R|1099-SSA|1099-G',
      payer_name: 'string',
      recipient_name: 'string',
      recipient_ssn_last4: 'string (last 4 digits only)',
      tax_year: 'YYYY',
      total_amount: 0,
      federal_tax_withheld: 0,
    }, null, 2),
  };

  // bank_statement_savings uses the same template as checking
  if (docClass === 'bankStatement.us.savings') {
    return templates['bankStatement.us.checking'] ?? '{}';
  }

  // Legacy retirement classes reuse the retirement_account template
  if (docClass === 'ira_statement' || docClass === '401k_statement') {
    return templates.retirement_account ?? '{}';
  }

  return templates[docClass] ?? '{}';
}
