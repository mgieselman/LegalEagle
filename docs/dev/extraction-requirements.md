# Extraction Component Requirements

> **Source of truth** for per-document-class field schemas and extraction behavioral rules. For pipeline architecture and confidence thresholds see [extraction.md](extraction.md).
>
> **Phase-2 split planned:** This document may be split into per-document-class schema files when the number of supported classes grows beyond ~15. Until then, all schemas stay here.

## Purpose

The extraction component receives a document (as pre-extracted text) and a document class, and returns structured JSON of the fields present in that document. It is deterministic, stateless, and has no DB or network dependencies — it takes text in and returns data out.

This document specifies the input contract, output contract, per-document-class output schemas, and behavioral rules.

---

## Input

```typescript
extractDocument(textContent: string, docClass: DocClass): Promise<ExtractionOutput>
```

| Parameter | Type | Description |
|---|---|---|
| `textContent` | `string` | Full text of the document, already extracted by an upstream text layer (pdfjs, pdftext, markitdown, etc.) |
| `docClass` | `DocClass` | Classification of the document — one of the values listed in the Document Classes section |

The component does not receive binary files for rule-based or AI text extraction — text extraction is handled upstream. For Azure DI prebuilt models, raw file bytes are also provided to the extractor alongside the text.

---

## Output

All document classes return the same envelope:

```json
{
  "data": { ... },
  "fieldConfidences": {
    "field_name": 0.95,
    "other_field": 0.82
  },
  "confidence": 0.91,
  "warnings": [
    "Could not determine pay frequency — defaulted to monthly"
  ]
}
```

| Field | Type | Description |
|---|---|---|
| `data` | `object` | Extracted fields. Shape is defined per `docClass` below. |
| `fieldConfidences` | `Record<string, number>` | Per-field confidence score, 0.0–1.0. Only include fields the extractor attempted. |
| `confidence` | `number` | Overall document confidence, 0.0–1.0. Computed as the average of `fieldConfidences`, penalized if schema validation fails. |
| `warnings` | `string[]` | Notes on ambiguities, missing required fields, inferred values, or anything that reduced confidence. |

### Output Rules

- **Numeric fields** (amounts, rates, hours): always `number`. No currency symbols, no commas.
- **Date fields**: ISO 8601 — `"YYYY-MM-DD"`. If only month/year is available, use the first of the month: `"2025-01-01"`.
- **Omit, don't null**: If a field cannot be determined, omit it entirely. Do not emit `null`, `0`, or `""` for unknown fields.
- **Don't fabricate**: If a value is not in the document, omit it. Do not guess or interpolate.
- **Required fields**: If a required field cannot be extracted, add it to `warnings`, set `confidence` below 0.5, and return whatever other fields were found.
- **Low confidence, don't omit**: If a value is present but uncertain, assign a low confidence score rather than omitting the field. Downstream systems decide what to do with low-confidence values.

---

## Document Classes and Schemas

### `paystub`

Pay stub or earnings statement from an employer.

```typescript
interface PaystubData {
  // Required
  employer_name: string;
  gross_pay: number;           // Pay for this period only — not YTD
  net_pay: number;             // Take-home pay for this period

  // Strongly desired
  employee_name?: string;
  pay_date?: string;           // YYYY-MM-DD
  pay_period_start?: string;   // YYYY-MM-DD
  pay_period_end?: string;     // YYYY-MM-DD
  pay_frequency?: 'weekly' | 'biweekly' | 'semimonthly' | 'monthly';

  // Deductions (omit any not present in the document)
  federal_tax?: number;
  state_tax?: number;
  social_security?: number;
  medicare?: number;
  health_insurance?: number;
  retirement_401k?: number;
  other_deductions?: Array<{ name: string; amount: number }>;

  // Year-to-date (omit if not shown)
  ytd_gross?: number;
  ytd_net?: number;

  // Hours (omit for salaried employees)
  hours_worked?: number;
  hourly_rate?: number;
}
```

**Extraction notes:**
- `gross_pay` is the period amount, not YTD. If only YTD is shown, omit `gross_pay` and warn.
- `pay_frequency` can often be inferred from the pay period start and end dates.
- `other_deductions` captures labeled deductions that don't fit the named fields (e.g., union dues, HSA, garnishments).
- Employer address is not required — name alone is sufficient.

---

### `profit_loss_statement`

Profit and loss statement for a self-employed individual or small business. May be accountant-prepared or self-prepared. IRS Schedule C is also accepted under this class.

```typescript
interface ProfitLossData {
  // Required
  business_name: string;
  gross_revenue: number;       // Total income before expenses
  net_profit: number;          // Bottom-line result — negative if a loss

  // Strongly desired
  period_start?: string;       // YYYY-MM-DD
  period_end?: string;         // YYYY-MM-DD
  total_expenses?: number;

  // Optional
  owner_name?: string;
  cost_of_goods_sold?: number;
  payroll_expenses?: number;
  rent_expense?: number;
  utilities?: number;
  other_expenses?: Array<{ name: string; amount: number }>;
}
```

**Extraction notes:**
- `net_profit` may be negative. Use a negative number — do not omit or zero it out.
- Extract only what is explicitly labeled in the document. Do not compute unlabeled line items.
- If the document is a Schedule C: `gross_revenue` = Part I Line 7, `total_expenses` = Part II Line 28, `net_profit` = Part II Line 31.

---

### `w2`

IRS Form W-2 Wage and Tax Statement.

```typescript
interface W2Data {
  // Required
  employer_name: string;
  wages: number;                   // Box 1: Wages, tips, other compensation
  federal_tax_withheld: number;    // Box 2: Federal income tax withheld

  // Strongly desired
  employee_name?: string;
  tax_year?: string;               // Four-digit year

  // Additional boxes (omit if not present)
  employer_ein?: string;           // Box b: Full EIN (e.g., "25-0965591")
  employee_ssn_last4?: string;     // Box a: Last 4 digits only — never full SSN
  social_security_wages?: number;  // Box 3
  social_security_tax?: number;    // Box 4
  medicare_wages?: number;         // Box 5
  medicare_tax?: number;           // Box 6
  state?: string;                  // Box 15: State abbreviation
  state_wages?: number;            // Box 16
  state_tax?: number;              // Box 17
}
```

**Extraction notes:**
- W-2 values are stored in PDF form fields that text-layer extractors cannot read. If fields appear empty or zero, warn that form-field extraction may have failed.
- `employer_ein` is the full EIN — do not truncate.
- Never extract the full SSN. Last 4 digits only.
- If multiple states appear, extract the first and warn that additional states are present.

---

### `tax_return`

Federal or state income tax return.

```typescript
interface TaxReturnData {
  // Required
  tax_year: string;                // Four-digit year
  adjusted_gross_income: number;   // Form 1040 Line 11; state equivalent line for state returns

  // Strongly desired
  return_type?: 'federal' | 'state';
  filing_status?: 'single' | 'married_jointly' | 'married_separately' | 'head_of_household' | 'qualifying_surviving_spouse';
  taxable_income?: number;         // Form 1040 Line 15
  total_tax?: number;              // Form 1040 Line 24
  total_payments?: number;         // Form 1040 Line 33

  // Refund or balance due — mutually exclusive
  refund_amount?: number;          // Form 1040 Line 35a (positive number)
  amount_owed?: number;            // Form 1040 Line 37 (positive number)
}
```

**Extraction notes:**
- IRS Form 1040 prints dollar amounts below their labels, not beside them. Text-layer extractors often fail to associate the value with the correct line. Layout-aware extraction (e.g., markitdown) or an AI pass produces better results.
- `filing_status` typically appears as a checked box. Normalize to the enum values above regardless of how it appears.
- Do not use a signed number to represent refund vs. owed — use the separate `refund_amount` / `amount_owed` fields.
- If the document is a state return, set `return_type: "state"` and extract `adjusted_gross_income` from the state equivalent line.

---

### `bank_statement_checking` and `bank_statement_savings`

Checking or savings account statement from a financial institution.

```typescript
interface BankStatementData {
  // Required
  institution_name: string;
  beginning_balance: number;
  ending_balance: number;

  // Strongly desired
  account_type?: 'checking' | 'savings' | 'investment';
  account_number_last4?: string;    // Last 4 digits only
  statement_period_start?: string;  // YYYY-MM-DD
  statement_period_end?: string;    // YYYY-MM-DD

  // Summary totals
  total_deposits?: number;
  total_withdrawals?: number;

  // Individual transactions (optional)
  transactions?: Array<{
    date: string;          // YYYY-MM-DD
    description: string;
    amount: number;        // Always positive
    type: 'credit' | 'debit';
  }>;
}
```

**Extraction notes:**
- Never extract full account numbers — last 4 digits only.
- Extract `total_deposits` / `total_withdrawals` from printed summary lines. Do not sum individual transactions to derive them.
- Transaction extraction is optional. If the statement contains more than 50 transactions, skip them and warn.
- If a statement covers multiple accounts (e.g., checking and savings on one document), extract the primary account shown first and warn that additional accounts are present.
- Use the institution's legal name as printed (e.g., "Bank of America, N.A." not "BofA").

---

### `credit_card_statement`

Credit card or charge card statement.

```typescript
interface CreditCardData {
  // Required
  issuer: string;               // Financial institution (e.g., "Chase", "Citibank") — not the card network
  ending_balance: number;
  previous_balance: number;

  // Strongly desired
  account_number_last4?: string;
  statement_period_start?: string;
  statement_period_end?: string;
  minimum_payment_due?: number;
  payment_due_date?: string;

  // Activity summary
  payments?: number;
  new_charges?: number;
  cash_advances?: number;
  credit_limit?: number;
  available_credit?: number;
}
```

**Extraction notes:**
- `issuer` is the financial institution, not the card network. For store cards, include the store name (e.g., "Amazon / Synchrony").
- Extract `cash_advances` explicitly, even if the amount is zero.

---

### `retirement_account`

IRA, 401(k), 403(b), pension, or other retirement account statement.

```typescript
interface RetirementAccountData {
  // Required
  institution_name: string;
  account_type: 'IRA' | '401k' | '403b' | 'pension' | 'other_retirement';
  ending_balance: number;

  // Strongly desired
  account_number_last4?: string;
  statement_period_end?: string;  // Date as of which the balance is stated

  // Optional
  account_holder_name?: string;
  employer_name?: string;         // For 401k/403b — the sponsoring employer
}
```

---

### `vehicle_loan_statement`

Monthly statement from an auto lender.

```typescript
interface VehicleLoanData {
  // Required
  lender_name: string;
  current_balance: number;

  // Strongly desired
  account_number_last4?: string;
  interest_rate?: number;          // Annual rate as decimal (e.g., 0.0699 for 6.99%)
  monthly_payment?: number;
  vehicle_description?: string;    // e.g., "2021 Toyota Camry"

  // Optional
  loan_origination_date?: string;
  payoff_amount?: number;
  lender_address?: string;
}
```

---

### `mortgage_statement`

Monthly mortgage or HELOC statement.

```typescript
interface MortgageData {
  // Required
  lender_name: string;
  current_balance: number;         // Outstanding principal balance

  // Strongly desired
  loan_number?: string;
  property_address?: string;
  interest_rate?: number;          // Annual rate as decimal
  monthly_payment?: number;
  statement_period_end?: string;

  // Optional
  loan_type?: 'first_mortgage' | 'second_mortgage' | 'heloc' | 'other';
  escrow_balance?: number;
  payoff_amount?: number;
  lender_address?: string;
}
```

---

### `social_security_letter`

SSA award letter or annual cost-of-living adjustment notice.

```typescript
interface SocialSecurityData {
  // Required
  monthly_benefit: number;         // Gross monthly benefit amount

  // Strongly desired
  benefit_type?: 'SSDI' | 'SSI' | 'retirement' | 'survivor' | 'other';
  effective_date?: string;         // YYYY-MM-DD — when this benefit amount took effect
  recipient_name?: string;

  // Optional
  net_monthly_benefit?: number;    // After Medicare premium deduction, if shown
  medicare_premium?: number;
  annual_benefit?: number;
}
```

---

### `collection_letter`

Debt collection letter or debt assignment notice.

```typescript
interface CollectionLetterData {
  // Required
  collection_agency_name: string;
  amount_claimed: number;

  // Strongly desired
  original_creditor?: string;       // The lender before the debt was sold
  account_number_last4?: string;
  letter_date?: string;             // YYYY-MM-DD
  debt_type?: string;               // e.g., "credit card", "medical", "auto loan"

  // Legal references — extract if present in the letter
  references_lawsuit?: boolean;
  references_judgment?: boolean;
  judgment_amount?: number;
  court_name?: string;

  // Contact
  collection_agency_address?: string;
  phone?: string;
}
```

**Extraction notes:**
- Extract both `collection_agency_name` and `original_creditor` when both appear — they are distinct entities.
- `amount_claimed` is whatever total the letter demands, including any interest or fees the collector has added.
- If the letter is a debt validation notice (references a 30-day dispute window), note it in `warnings`.

---

### `legal_document`

Court summons, civil complaint, judgment, garnishment order, or foreclosure notice.

```typescript
interface LegalDocumentData {
  // Required
  document_type: 'summons' | 'complaint' | 'judgment' | 'garnishment_order' | 'foreclosure_notice' | 'other';
  plaintiff_name: string;

  // Strongly desired
  defendant_name?: string;
  case_number?: string;
  court_name?: string;
  court_address?: string;
  filing_date?: string;     // YYYY-MM-DD
  case_type?: string;       // e.g., "debt collection", "mortgage foreclosure"

  // Financial amounts
  amount_claimed?: number;
  judgment_amount?: number;
  garnishment_amount?: number;  // Per-period amount on garnishment orders

  // Property
  property_address?: string;    // For foreclosure notices
}
```

**Extraction notes:**
- Legal documents are frequently photocopies or scans. Assign lower confidence scores for values that are hard to read — do not fabricate.
- `plaintiff_name` is the party initiating the action. If the debtor appears to be the plaintiff rather than the defendant, note this in `warnings`.
- If a single upload contains multiple document types (e.g., a summons stapled to a complaint), extract from the primary document and note the attachment in `warnings`.

---

### `vehicle_title`

Vehicle certificate of title (physical title document, typically scanned or photographed).

```typescript
interface VehicleTitleData {
  // Required
  vin: string;                 // 17-character Vehicle Identification Number
  year: string;                // 4-digit model year
  make: string;                // Manufacturer (may be abbreviated, e.g. SUBA, AMGN)
  model: string;               // Model name
}
```

**Extraction notes:**
- Titles are physical documents — OCR errors are common, especially on older or photocopied titles.
- `vin` is the 17-character VIN. If OCR produces fewer than 17 characters, extract what is readable and assign low confidence.
- `make` may appear abbreviated on the title (e.g. SUBA for Subaru, AMGN for AM General). Return exactly what the title shows.
- Only extract these four fields. Ignore all other information on the title (owner names, lienholders, odometer, etc.).

---

## Document Class Reference

| `docClass` | Document |
|---|---|
| `paystub` | Pay stub / earnings statement |
| `profit_loss_statement` | Profit and loss statement / Schedule C |
| `w2` | IRS Form W-2 |
| `tax_return` | Federal or state income tax return |
| `bank_statement_checking` | Checking account statement |
| `bank_statement_savings` | Savings account statement |
| `retirement_account` | IRA / 401k / 403b / pension statement |
| `credit_card_statement` | Credit card statement |
| `collection_letter` | Collection letter / debt assignment notice |
| `legal_document` | Summons, complaint, judgment, garnishment order, foreclosure notice |
| `vehicle_title` | Vehicle certificate of title |
| `vehicle_loan_statement` | Auto loan statement |
| `mortgage_statement` | Mortgage / HELOC statement |
| `social_security_letter` | SSA award / COLA letter |

---

## Behavioral Rules

### Mismatched document class

If the `docClass` provided appears inconsistent with the document content, include a warning and attempt extraction using the provided class anyway. Reclassification is out of scope.

### Schema validation

After extraction, validate `data` against the schema for the given `docClass`. On failure:

1. Return whatever fields were successfully extracted
2. Set `confidence` ≤ 0.5
3. Add a warning describing the mismatch

Partial data is better than no data — do not reject the extraction on validation failure.

---

## Confidence Scoring

| Range | Meaning |
|---|---|
| 0.95–1.0 | Value read directly from a clearly labeled field with no ambiguity |
| 0.80–0.94 | Value found via pattern matching with minor ambiguity |
| 0.70–0.79 | Value inferred or reconstructed from surrounding context |
| 0.50–0.69 | Value present but poorly labeled or one of multiple candidates |
| < 0.50 | Value is a guess; likely to be wrong |

---

## Sensitive Data Rules

- **SSN**: Extract last 4 digits only. If the full SSN is visible, extract only the last 4 and warn that the full number was present.
- **Bank and loan account numbers**: Last 4 digits only. Exception: mortgage loan numbers may be extracted in full.
- **EINs**: May be extracted in full.

---

## Scope

This component only extracts. It does not:

- Classify documents
- Read binary files (text extraction is upstream)
- Store results
- Make network calls
- Decide which form fields to populate (that is the mapper's responsibility)
- Enforce business rules about document completeness, date windows, or required document sets
