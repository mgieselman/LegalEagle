# Questionnaire Section Guide

> **Owner:** Richard (legal domain) + Matt (implementation)  
> **Status:** Stub — each section needs Richard's input before validation rules can be written.  
> **How to contribute:** See [richard-howto.md](richard-howto.md) for editing instructions.  
> **Why this matters:** Answers here directly drive help text, validation rules, and AI fraud review logic in the app.

For each section, document:
- **What is being asked and why** — what the trustee/court needs this for
- **Required vs. nice-to-have** — legally required fields vs. helpful but optional
- **Common client confusion** — what clients typically misunderstand
- **Edge cases** — joint ownership, recent transfers, self-employment, etc.

---

## Section 1 — Name & Residence

**Status:** ⬜ Needs Richard's input

- What address details are required (street, city, state, zip)?
- How long at current address matters for trustees?
- What triggers the "prior addresses" sub-section (moved in last 3 years)?
- Lease vs. own: what additional details are required for each?

---

## Section 2 — Prior Bankruptcy

**Status:** ⬜ Needs Richard's input

- What years of lookback are relevant (8 years Ch7→Ch7, 6 years Ch13→Ch7)?
- What information is needed: case number, court, chapter, date filed, date discharged?
- How does a pending or dismissed case affect the current filing?

---

## Section 3 — Occupation & Income

**Status:** ⬜ Needs Richard's input

- What income sources must be listed?
- How is self-employment income handled vs. W-2 income?
- What is the lookback period for income reporting?
- What if income changed significantly recently?

---

## Section 4 — Business & Employment

**Status:** ⬜ Needs Richard's input

- What triggers the business section (sole proprietor, LLC member, officer)?
- What business records are required?
- How far back does the employment history need to go?

---

## Section 5 — Financial Questions

**Status:** ⬜ Needs Richard's input

- Which financial transactions in the lookback window must be disclosed?
- What is the lookback period for large financial transactions?
- What dollar thresholds trigger required disclosure?

---

## Section 6 — Taxes

**Status:** ⬜ Needs Richard's input

- How many years of tax returns are required?
- What if the debtor hasn't filed taxes?
- What tax debts must be separately listed?

---

## Section 7 — Debts Repaid

**Status:** ⬜ Needs Richard's input

- What is the 90-day lookback for "preference payments"?
- What is the 1-year lookback for insider payments?
- What dollar thresholds apply (≥$600 aggregate)?
- What counts as an "insider" (relative, business partner)?

---

## Section 8 — Suits

**Status:** ⬜ Needs Richard's input

- What types of lawsuits must be listed (as plaintiff, defendant, both)?
- What is the lookback period?
- How should pending claims where debtor could receive money be handled?

---

## Section 9 — Garnishment & Sheriff's Sale

**Status:** ⬜ Needs Richard's input

- What is the lookback period?
- What types of levies, garnishments, and repossessions must be listed?

---

## Section 10 — Repossessions & Returns

**Status:** ⬜ Needs Richard's input

- What is the lookback period?
- What counts as a "return to secured creditor"?

---

## Section 11 — Property Held by Others

**Status:** ⬜ Needs Richard's input

- What types of property qualify (in storage, at family member's home)?
- Does this include property held in trust?

---

## Section 12 — Gifts & Transfers

**Status:** ⬜ Needs Richard's input

- What is the lookback period for gifts (2 years for general, 10 years for insiders)?
- What dollar threshold triggers required disclosure?
- How are below-market sales handled?

---

## Section 13 — Losses

**Status:** ⬜ Needs Richard's input

- What types of losses must be listed (fire, theft, gambling, casualty)?
- What is the lookback period?
- Must insurance proceeds be disclosed if received?

---

## Section 14 — Attorneys & Consultants

**Status:** ⬜ Needs Richard's input

- What payments to attorneys within the past year must be listed?
- Does this include the current bankruptcy attorney?

---

## Section 15 — Closed Bank Accounts

**Status:** ⬜ Needs Richard's input

- What is the lookback period (1 year)?
- What information is required (bank name, account type, last 4)?
- Does this include joint accounts?

---

## Section 16 — Safe Deposit Boxes

**Status:** ⬜ Needs Richard's input

- Must contents be inventoried?
- What if the box was closed in the lookback period?

---

## Section 17 — Property Held for Others

**Status:** ⬜ Needs Richard's input

- What types of property held in trust for someone else?
- How is this different from Section 11?

---

## Section 18 — Leases & Cooperatives

**Status:** ⬜ Needs Richard's input

- What leases must be listed (auto, equipment, real property)?
- What information is needed: creditor name/address, terms, monthly payment?
- How are expired leases handled?

---

## Section 19 — Alimony, Child Support & Property Settlements

**Status:** ⬜ Needs Richard's input

- What lookback period applies to former marriages?
- Scope: last 8 years?
- Required fields: former spouse name, address, state of residence during marriage?
- Should this capture multiple prior marriages (array vs. single entry)?

---

## Section 20 — Accidents & Driver's License

**Status:** ⬜ Needs Richard's input

- What types of accidents must be disclosed?
- Does this include accidents where debtor was not at fault?
- Should open claims/lawsuits where debtor could be sued OR receive money be captured here?

---

## Section 21 — Cosigners & Debts for Others

**Status:** ⬜ Needs Richard's input

- Who must be listed: people who cosigned for the debtor, or people the debtor cosigned for?
- What information is needed for each?

---

## Section 22 — Credit Cards & Finance Company Debts

**Status:** ⬜ Needs Richard's input

- Should luxury purchases in the 90 days before filing be flagged separately?
- What is the presumption-of-fraud threshold for luxury goods / cash advances?
- Is the 90-day "incurred debts" question credit-card-specific or does it apply to all unsecured debts?

---

## Section 23 — Evictions

**Status:** ⬜ Needs Richard's input

- Must pending eviction proceedings be disclosed?
- What about past evictions?

---

## Section 24 — Secured Debts

**Status:** ⬜ Needs Richard's input

- Scope: "outside of mortgages" — is this the right framing?
- What information is required for each secured debt?

---

## Section 25 — Unsecured Debts

**Status:** ⬜ Needs Richard's input

- Help text direction: "list debts that don't show up on your credit report — we import the rest."
- What types of debts are typically missed (medical, personal loans from family)?

---

## Section 26 — Asset Listing

**Status:** ⬜ Needs Richard's input

- Active bank accounts: should account type and last 4 digits be required?
- What categories of assets must be listed?
- What valuation standard applies (FMV, replacement, liquidation)?

---

## Section 27 — Vehicles

**Status:** ⬜ Needs Richard's input

- What information is required for each vehicle (year, make, model, VIN, value, lender)?
- How should financed vehicles be handled vs. owned outright?
- What about vehicles registered in a spouse's name?
