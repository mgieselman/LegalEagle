# Document Checklist — Requirements & Acceptance Criteria

> **Owner:** Richard (legal domain) + Matt (implementation)  
> **Status:** Stub — Richard needs to review and fill in acceptability rules and district-specific requirements.  
> **How to contribute:** See [richard-howto.md](richard-howto.md) for editing instructions.  
> **Why this matters:** These rules drive the document upload checklist UI, completeness validation, and means test coverage checks.

For each document type, document:
- **What makes it acceptable** — format, age, completeness requirements
- **Coverage required** — how many, over what period
- **Acceptable substitutes** — what to use when the standard document isn't available
- **District-specific rules** — anything your district requires beyond the federal standard

---

## Pay Stubs / Earnings Statements

**Status:** ⬜ Needs Richard's input

- **Coverage required:** The app currently validates for 6 complete calendar months before the filing date. Is this correct for your district? Is it calendar months (Jan 1 – Jun 30) or rolling 6 months?
- **What makes a stub acceptable?** Employer name, pay period, gross pay, net pay must be visible.
- **Self-employed / no paystubs:** What substitutes are acceptable (P&L statement, bank deposits, signed income declaration)?
- **Multiple jobs:** Each employer needs separate stubs?
- **Irregular income (seasonal, gig):** What is the standard approach?

---

## W-2 Forms

**Status:** ⬜ Needs Richard's input

- **Coverage required:** Most recent tax year. Prior year as well?
- **Multiple employers:** W-2 from each employer in the year.
- **Substitute if missing:** Final paystub showing YTD totals? Transcript from IRS?

---

## Federal Income Tax Returns (Form 1040)

**Status:** ⬜ Needs Richard's input

- **Coverage required:** Most recent filed return. How many years back?
- **What pages are required?** All pages including schedules, or just the main form?
- **Unfiled returns:** What is the procedure if the debtor hasn't filed? How many years of unfiled is a problem?
- **Amended returns (1040-X):** Does the amended version replace or supplement the original?

---

## Bank Statements

**Status:** ⬜ Needs Richard's input

- **Coverage required:** The app validates for the 6-month lookback period. Is this correct?
- **All accounts or just active?** Must closed accounts from the past year also be submitted?
- **What makes a statement acceptable?** Must show account number (last 4), institution name, statement period, opening/closing balance, transaction list.
- **Online-only banks:** Screenshots acceptable or must be PDFs?
- **Substitute if account was closed:** Final statement sufficient?

---

## Social Security Card

**Status:** ⬜ Needs Richard's input

- Required for identity verification.
- **Acceptable substitutes if lost:** SSA replacement notice? Benefit award letter?

---

## Driver's License / State ID

**Status:** ⬜ Needs Richard's input

- Required for identity verification.
- **Expired license acceptable?**
- **No license:** What substitutes are accepted (passport, state ID)?

---

## Mortgage Statements

**Status:** ⬜ Needs Richard's input

- **When required:** Only for active mortgages? Or also for recently paid-off mortgages?
- **What information must be visible?** Lender name, loan number, balance, payment amount, interest rate, escrow breakdown.
- **HELOC statements:** Same requirements as primary mortgage?

---

## Auto Loan / Lease Statements

**Status:** ⬜ Needs Richard's input

- **When required:** For each financed or leased vehicle.
- **What information must be visible?** Lender name, account number, balance, monthly payment.

---

## Investment & Retirement Account Statements

**Status:** ⬜ Needs Richard's input

- **When required:** For all IRA, 401(k), brokerage accounts?
- **How current must the statement be?** Within 30 days? 60 days?
- **Exempt accounts:** Are retirement accounts exempt from the bankruptcy estate? Do they still need to be disclosed?

---

## Social Security Award Letter / Benefit Notice

**Status:** ⬜ Needs Richard's input

- **When required:** When SSA income is a CMI component.
- **How current?** Must it be within the past year?

---

## District-Specific Requirements

**Status:** ⬜ Needs Richard's input

List any requirements specific to your district that differ from the above federal standards:

| Document | District requirement | Notes |
|---|---|---|
| *(add your district's rules here)* | | |

---

## Document Coverage Summary

The app tracks the following coverage gaps automatically. Confirm the validation rules are correct:

| Document type | Required coverage | Validated by app | Correct? |
|---|---|---|---|
| Pay stubs | 6 calendar months pre-filing | ✅ Yes | ⬜ Confirm |
| Bank statements | 6 calendar months pre-filing | ✅ Yes | ⬜ Confirm |
| Tax returns (most recent) | 1–2 years | ⬜ Not yet | — |
| W-2s | Most recent tax year | ⬜ Not yet | — |
