# Questionnaire Requirements Review — 2026-04-18

Review of Richard's feedback on the questionnaire. Each item is classified as **NEW**, **EXISTING (modify)**, or **EXISTING (remove)**, with file references and a description of the gap.

---

## 1. Bank accounts: type + last 4 — NEW

Current: [Section15ClosedBankAccounts.tsx](../../client/src/components/form-sections/Section15ClosedBankAccounts.tsx) only covers *closed* accounts (already has `typeOfAccount` + `acctNo`). Active bank accounts only appear in Section 26 Assets as "Bank Deposits" (bank name + amount only).

**Work**: add account type and last 4 of account number to active bank accounts in Section 26.

## 2. Financed items like vehicles — EXISTING (modify)

[Section26Assets.tsx:88-98](../../client/src/components/form-sections/Section26Assets.tsx#L88-L98) — `financedItems[]` only has `item` and `companyNameAddress`.

**Work**: expand to mirror Section 27 vehicle fields — payment amount, `lenderName`, `lenderAddress`, `loanNumber`, `percentageRate`, `currentBalance`, terms.

## 3. House/mortgage, household expenses, members of household — NEW

None of these sections exist. Only residential *lease* in Section 1.

**Work**: build new section(s). See open question on scope.

## 4. Unsecured debts help text — EXISTING (modify)

[Section25UnsecuredDebts.tsx:10-12](../../client/src/components/form-sections/Section25UnsecuredDebts.tsx#L10-L12).

**Work**: update prompt to clarify "list debts that don't show up on your credit report — we import the rest."

## 5. Remove "creditor can take property" + dispute questions — EXISTING (remove)

[Section24SecuredDebts.tsx:12,33-35](../../client/src/components/form-sections/Section24SecuredDebts.tsx#L12) — has `agreedCreditorCanTake`, `disputeSecuredDebts`, `disputedSecuredDetails`.

**Work**: remove these (implied by being secured). Reword section header to scope "outside of mortgages."

## 6. Credit cards: 90-day question + remove finance-collateral — MIXED

[Section22CreditCards.tsx](../../client/src/components/form-sections/Section22CreditCards.tsx).

- `financeCollateral` exists at line 19 → **remove** (CCs aren't secured).
- 90-day pre-filing debts question → **add (NEW)**.

## 7. Accidents — open claims/lawsuits — EXISTING (modify)

[Section20Accidents.tsx](../../client/src/components/form-sections/Section20Accidents.tsx) covers vehicle accidents only. Section 8 has `possibleLawsuit` (lawsuits *they* could file).

**Work**: add a question for open claims or lawsuits where they could be sued OR receive money. See open question on placement.

## 8. Former marriages — EXISTING (modify)

[Section19AlimonySupport.tsx:9-11](../../client/src/components/form-sections/Section19AlimonySupport.tsx#L9) — has `previousMarriages` + `formerSpouseName` only.

**Work**: scope to last 8 years, add state of residence during marriage, add former spouse address. See open question on multiplicity.

## 9. Lease details: name/address/terms — EXISTING (modify)

Residential lease in [Section1NameResidence.tsx:32-41](../../client/src/components/form-sections/Section1NameResidence.tsx#L32-L41) already has these. Auto leases in [Section18Leases.tsx](../../client/src/components/form-sections/Section18Leases.tsx) only have a yes/no + free-text blob.

**Work**: convert auto leases to structured array with creditor name, address, terms (mirror residential).

---

## Richard Needs to Answer

- [ ] **(3) Housing/expenses/household scope** — Three separate sections, or one combined "Household & Housing"? Should the expenses section follow Schedule J line items?
- [ ] **(6) 90-day question scope** — Is the "incurred debts in 90 days prior to filing" question credit-card-specific, or does it belong on all unsecured debts? (Presumption-of-fraud lookback is broader than CCs.)
- [ ] **(7) Open claims placement** — Add to Section 20 (Accidents) or consolidate with Section 8 (Lawsuits)?
- [ ] **(8) Former marriages multiplicity** — Should this become a repeating array to capture multiple prior marriages, or stay single-spouse?
