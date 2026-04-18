/**
 * Human-readable labels for the doc_class values emitted by the extractor.
 * Keys must stay in sync with extractor/schemas.py::DOC_CLASSES.
 *
 * Any unknown / null / undefined / 'unclassified' / 'other' value resolves to
 * "Other" — the UI surfaces that as an unrecognised document type.
 */
const LABELS: Record<string, string> = {
  'payStub.us': 'Paystub',
  'bankStatement.us.checking': 'Bank Statement (Checking)',
  'bankStatement.us.savings': 'Bank Statement (Savings)',
  'tax.us.1040': 'Tax Return (1040)',
  'tax.us.w2': 'W-2',
  'tax.us.1099': '1099',
  creditCard: 'Credit Card Statement',
  ira_statement: 'IRA Statement',
  '401k_statement': '401(k) Statement',
  retirement_account: 'Retirement Account',
  brokerage_statement: 'Brokerage Statement',
  'mortgage.us': 'Mortgage Statement',
  mortgage_payment: 'Mortgage Payment',
  vehicle_loan_statement: 'Vehicle Loan Statement',
  vehicle_title: 'Title',
  idDocument: 'ID Document',
  social_security_card: 'Social Security Card',
  social_security_letter: 'Social Security Letter',
  collection_letter: 'Collection Letter',
  legal_document: 'Legal Document',
  profit_loss_statement: 'Profit & Loss Statement',
  payroll_export: 'Payroll Export',
};

export function docClassLabel(docClass: string | null | undefined): string {
  if (!docClass) return 'Other';
  return LABELS[docClass] ?? 'Other';
}
