# Richard's Guide to Contributing Docs

## Overview

This `domain/` folder is yours. It contains the legal knowledge that drives what the product does — what fields to collect, what documents are required, how the means test works, and how the firm workflow should flow. Matt implements the software; you define what it needs to do.

You do not need to install anything. Everything can be done through GitHub's website.

---

## How to Edit Files on GitHub

1. Open the repo at **github.com/[repo-link]**
2. Navigate to any file in `docs/domain/`
3. Click the **pencil icon** (top right of the file) to edit
4. Make your changes — just use plain text with simple formatting (see below)
5. Scroll down, write a brief note about what you changed (e.g., "Added Section 3 edge cases"), and click **Commit changes**

To create a new file:
1. Navigate to `docs/domain/`
2. Click **Add file → Create new file**
3. Give it a name ending in `.md` (e.g., `filing-rules.md`)
4. Write your content and commit

> **Tip:** Press `.` on any page in the GitHub repo to open a browser-based editor (github.dev) — easier for longer edits.

---

## Simple Formatting Reference

You only need a handful of Markdown conventions:

```
# Big heading
## Section heading
### Sub-heading

Regular paragraph text.

- Bullet point
- Another bullet

| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Value    | Value    | Value    |

**Bold text**
```

No need to learn anything else.

---

## What to Work On (Priority Order)

### 1. `questionnaire-guide.md` — Start here (most valuable)

This is the highest priority. The app has 27 questionnaire sections. For each one, write:

- **What is being asked and why** — What does the trustee / court need this information for?
- **Which fields are truly required** — What's legally necessary vs. nice-to-have?
- **Common client confusion** — What do clients typically get wrong or misunderstand?
- **Edge cases** — Joint ownership, self-employment, recent transfers, etc.

This directly drives the validation rules and AI review logic in the app. The 27 sections are:

1. Name & Residence
2. Prior Bankruptcy
3. Occupation & Income
4. Business & Employment
5. Financial Questions
6. Taxes
7. Debts Repaid
8. Suits
9. Garnishment & Sheriff's Sale
10. Repossessions & Returns
11. Property Held by Others
12. Gifts & Transfers
13. Losses
14. Attorneys & Consultants
15. Closed Bank Accounts
16. Safe Deposit Boxes
17. Property Held for Others
18. Leases & Cooperatives
19. Alimony, Child Support & Property Settlements
20. Accidents & Driver's License
21. Cosigners & Debts for Others
22. Credit Cards & Finance Company Debts
23. Evictions
24. Secured Debts
25. Unsecured Debts
26. Asset Listing
27. Vehicles

You don't have to do all 27 at once — start with the sections that have the most client confusion or legal risk.

### 2. `document-checklist.md` — What documents are required and why

The app already has a basic document list, but needs your input on:

- What exactly makes a document "acceptable" (e.g., what's a valid pay stub?)
- How much coverage is needed (e.g., 6 months of pay stubs — calendar months or rolling?)
- What substitutes are acceptable (e.g., if no SSN card, what else works?)
- District-specific rules (e.g., does your district require anything extra?)

### 3. `roles-and-workflow.md` — How your firm actually works

Describe the real workflow from first client contact through filing:

- Who does what (you, paralegals, client)
- At what point does the attorney review vs. the paralegal?
- What are the handoff points and approval gates?
- What does "ready to file" mean in practice?

### 4. `filing-rules.md` — Chapter 7 vs. 13 and district rules

- Key differences between Chapter 7 and Chapter 13 intake
- Any district-specific local rules or forms
- Common reasons a filing gets rejected or delayed

---

## Files Already in This Folder

| File | Contents |
|------|----------|
| `means-test.md` | Chapter 7 means test — Forms 122A, Schedule I reference |
| `richard-howto.md` | This file |

---

## Questions or Disagreements

If something in the app doesn't match how bankruptcy law actually works, write a note in the relevant doc file (or create a new file called `open-questions.md`) and Matt will address it. The domain docs are the source of truth for what the product should do.
