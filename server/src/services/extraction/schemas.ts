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
  filing_status: z.string().optional(),
  adjusted_gross_income: z.number(),
  taxable_income: z.number().optional(),
  total_tax: z.number().optional(),
  refund_or_owed: z.number().optional(),
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
});

// ---- Generic (for other/unclassified) ----
export const genericSchema = z.record(z.string(), z.unknown());

// ---- Schema lookup by doc class ----
const schemaMap: Partial<Record<DocClass, z.ZodType>> = {
  paystub: paystubSchema,
  bank_statement_checking: bankStatementSchema,
  bank_statement_savings: bankStatementSchema,
  tax_return: taxReturnSchema,
  w2: w2Schema,
  credit_card_statement: creditCardStatementSchema,
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
    paystub: JSON.stringify({
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

    bank_statement_checking: JSON.stringify({
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

    w2: JSON.stringify({
      employer_name: 'string',
      employer_ein: 'string',
      employee_name: 'string',
      employee_ssn_last4: 'string',
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

    tax_return: JSON.stringify({
      tax_year: 'YYYY',
      filing_status: 'string',
      adjusted_gross_income: 0,
      taxable_income: 0,
      total_tax: 0,
      refund_or_owed: 0,
    }, null, 2),

    credit_card_statement: JSON.stringify({
      issuer: 'string',
      account_number_last4: 'string',
      statement_period_start: 'YYYY-MM-DD',
      statement_period_end: 'YYYY-MM-DD',
      previous_balance: 0,
      payments: 0,
      new_charges: 0,
      ending_balance: 0,
      minimum_payment_due: 0,
    }, null, 2),
  };

  // bank_statement_savings uses the same template as checking
  if (docClass === 'bank_statement_savings') {
    return templates.bank_statement_checking ?? '{}';
  }

  return templates[docClass] ?? '{}';
}
