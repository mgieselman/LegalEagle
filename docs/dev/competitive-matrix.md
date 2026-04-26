# Competitive Feature Matrix

> **Source of truth** for feature-by-feature comparisons against Jubilee Pro and Glade.ai. For the LegalEagle feature roadmap (MVP scope + post-MVP backlog) see [legal-eagle-features.md](../domain/legal-eagle-features.md).

**LegalEagle vs. Jubilee Pro vs. Glade.ai**
*Last updated: 2026-04-11*

> **Note on sources:** Jubilee Pro's AI document processing capabilities (classification, quality verification, duplicate removal, extraction-to-petition mapping) are sourced from a sales email dated April 2026 — not from their public website or review sites. These features may be recently launched or in rollout. Entries marked "Yes (per sales email)" reflect this.

---

## Company Overview

| | **LegalEagle** | **Jubilee Pro** | **Glade.ai** |
|---|---|---|---|
| **Company** | — | LegalPRO Systems, Inc. | Glade AI (fka "Noodle") |
| **Founded** | 2025 | 1985 (cloud version 2016) | 2022 (rebranded Jan 2025) |
| **HQ** | — | US | Menlo Park, CA |
| **Team size** | — | Established (30+ yr history) | ~19 employees |
| **Funding** | — | Private, self-funded | Seed ($100K+ disclosed) |
| **Architecture** | Multi-tenant SaaS | Single-tenant SaaS | Unclear (likely single-tenant) |
| **Deployment** | Cloud (Azure) | Cloud | Cloud |
| **Tech stack** | React 19, Express 5, TypeScript, Python, Claude AI | Undisclosed (legacy migration from desktop) | Framer (marketing), undisclosed app stack |

---

## Pricing

| | **LegalEagle** | **Jubilee Pro** | **Glade.ai** |
|---|---|---|---|
| **Model** | TBD | Per-case tiers (annual) | Flat monthly (sales-led) |
| **Entry price** | TBD | $95/case (pay-as-you-go) | Not disclosed |
| **Mid-tier** | TBD | $2,495/yr (150 cases, 3 users) | Not disclosed |
| **High-volume** | TBD | $4,995/yr (500 cases, 5 users) | Not disclosed |
| **User limits** | Unlimited (multi-tenant) | 2–5 depending on tier | Unlimited seats |
| **Filing caps** | None | 36–500/yr depending on tier | None |
| **Free trial** | — | 30-day (no CC) | Demo only |
| **Overage fees** | — | $12.99–$34.99/case | None |

---

## Chapter & Filing Support

| | **LegalEagle** | **Jubilee Pro** | **Glade.ai** |
|---|---|---|---|
| **Chapter 7** | Yes | Yes | Yes |
| **Chapter 13** | Yes | Yes | Yes |
| **Chapter 11** | Planned | Yes | No |
| **Chapter 12** | No | Yes | No |
| **Joint filings** | Yes (debtor + spouse) | Yes | Unknown |
| **District-specific forms** | Planned | Yes (but slow updates) | Yes |

---

## Client Intake & Onboarding

| Feature | **LegalEagle** | **Jubilee Pro** | **Glade.ai** |
|---|---|---|---|
| Client portal | Yes | Yes | Yes |
| Digital questionnaire | Yes (27 sections, 150+ fields) | Yes | Yes (customizable) |
| Questionnaire maps to official forms | Yes | Yes | Yes |
| Section-by-section progress | Yes | Unknown | Unknown |
| Any-order section completion | Yes | Unknown | Unknown |
| Client self-service doc upload | Yes | Yes (incl. mobile) | Yes (mobile + desktop) |
| Photo-to-PDF conversion | No | No | Yes |
| AI chatbot for intake | No | No | Yes (customizable voice) |
| Consultation scheduling | No | No | Yes (calendar widget) |
| Lead qualification | No | No | Yes (AI chatbot) |
| SMS reminders | No | No | Yes |
| Pre-intake questionnaires | No | No | Yes |
| USPS address verification | No | Yes | No |

---

## Document Management

| Feature | **LegalEagle** | **Jubilee Pro** | **Glade.ai** |
|---|---|---|---|
| Document upload | Yes (100MB limit) | Yes (incl. mobile) | Yes |
| Duplicate detection (SHA-256) | Yes | Yes (auto-removed, per sales email) | No |
| Required document checklist | Yes (per-category progress) | Unknown | Yes (customizable templates) |
| Document classification | Yes (rule engine + AI, 20+ types) | Yes (AI, per sales email) | Yes (AI) |
| Classification confidence scoring | Yes (0.0–1.0 scale) | Unknown | Unknown |
| Manual type override | Yes | Unknown | Unknown |
| Processing status tracking | Yes (6-state workflow) | Unknown | Unknown |
| In-browser document preview | No | Unknown | Yes |
| AI file renaming | No | No | Yes |
| AI document quality verification | No | Yes (blurry image rejection + re-upload prompt, per sales email) | Yes (blur, format checks) |
| Wrong document detection | No | Yes (per sales email) | Unknown |
| Missing document detection + follow-up | Planned | Unknown | Yes (automated) |
| Debtor/spouse document routing | Yes | Unknown | Unknown |

---

## OCR & Text Extraction

| Feature | **LegalEagle** | **Jubilee Pro** | **Glade.ai** |
|---|---|---|---|
| PDF text extraction | Yes (pdftext + markitdown) | Likely (implied by extraction pipeline) | Unknown |
| Image OCR | Yes (Tesseract, multi-region) | Likely (phone uploads + quality detection implies image processing) | Likely (undisclosed) |
| Scanned PDF OCR | Yes (MarkerOCR + Tesseract) | Unknown | Likely (undisclosed) |
| Two-tier OCR fallback | Yes (Marker → Azure DI) | Unknown | Unknown |
| PDF form field extraction | Yes (W-2 widget annotations) | Unknown | Unknown |
| Format support | PDF, JPEG, PNG, TIFF, WEBP, CSV, TXT, XLSX | PDF, images (per sales email) | Unknown |

---

## AI-Powered Data Extraction

| Feature | **LegalEagle** | **Jubilee Pro** | **Glade.ai** |
|---|---|---|---|
| AI extraction engine | Yes (rule engine + Claude AI) | Yes (per sales email; implementation details unknown) | Yes (undisclosed AI) |
| Data → petition field mapping | Yes (autofill engine) | Yes ("mapped to petition fields", per sales email) | Yes |
| Paystub extraction | Yes (employer, pay period, gross/net, deductions, YTD) | Unknown | Yes |
| Bank statement extraction | Yes (institution, balances, transactions) | Unknown | Yes |
| W-2 extraction | Yes (wages, withholding, SS/Medicare) | Unknown | Unknown |
| Tax return extraction | Yes (AGI, filing status, taxable income) | Unknown | Yes |
| Credit card statement extraction | Yes | Unknown | Unknown |
| Per-field confidence scoring | Yes (0.0–1.0) | Unknown | Unknown |
| Extraction method tracking | Yes (rule_engine / ai_parse / human_entry) | Unknown | Unknown |
| Auto-accept high-confidence results | Yes (≥0.9 threshold) | Unknown | Unknown |
| Needs-review flagging | Yes (<0.9 threshold) | Unknown | Unknown |

---

## Credit Report Integration

| Feature | **LegalEagle** | **Jubilee Pro** | **Glade.ai** |
|---|---|---|---|
| Credit report ordering | No | Yes (CreditVista — Experian, TransUnion, Equifax) | Yes (tri-bureau) |
| Auto-import to schedules | No | Yes (directly onto schedules) | Yes (Schedules D, E/F, G) |
| Master creditor list generation | No | Partial | Yes (AI-parsed) |
| Prior bankruptcy detection | No | Unknown | Yes (from credit report) |
| Property reports | No | No | Yes |

---

## Validation & Quality Checks

| Feature | **LegalEagle** | **Jubilee Pro** | **Glade.ai** |
|---|---|---|---|
| Internal consistency checks | Yes (math: gross = net + deductions, balance checks) | No | Unknown |
| Cross-document validation | Yes (income consistency across paystubs/W-2s/tax, 10% tolerance) | No | Unknown |
| Temporal coverage validation | Yes (6-month paystub, 2-year tax gaps) | No | Unknown |
| Validation severity levels | Yes (error/warning/info) | No | Unknown |
| Dismissable warnings | Yes (with tracking) | No | Unknown |
| Questionnaire-extraction mismatch | Planned | No | Unknown |

---

## Fraud Detection & Review

| Feature | **LegalEagle** | **Jubilee Pro** | **Glade.ai** |
|---|---|---|---|
| AI fraud review agent | Yes | No | No (mentioned in blog, not in product) |
| Asset valuation analysis | Yes (vehicle undervaluation, property) | No | No |
| Income/expense inconsistencies | Yes | No | No |
| Fraudulent transfer detection (§548) | Yes (insider payments, below-market sales) | No | No |
| Asset concealment flags (§152) | Yes (closed accounts, property moves) | No | No |
| Timing red flags | Yes (cash advances, luxury purchases) | No | No |
| Non-dischargeable debt flags | Yes (student loans, tax debts, restitution) | No | No |
| Prior bankruptcy timing validation | Yes (Ch 7→7: 8yr, Ch 13→7: 6yr) | No | No |

---

## Autofill & Schedule Population

| Feature | **LegalEagle** | **Jubilee Pro** | **Glade.ai** |
|---|---|---|---|
| Document → questionnaire autofill | Yes (confidence ≥0.7, highest wins) | No | Yes |
| Credit report → schedule autofill | No | Yes | Yes |
| Paystub → Schedule I | Planned | No | Yes |
| Debtor/spouse field routing | Yes | Unknown | Unknown |
| Bank deposit deduplication | Yes (by institution + account type) | No | Unknown |
| AI exemptions identification | No | No | Yes (state-specific statutes) |

---

## Means Test

| Feature | **LegalEagle** | **Jubilee Pro** | **Glade.ai** |
|---|---|---|---|
| Means test calculator | Planned (knowledge base documented) | Yes (integrated with case data) | Yes |
| CMI calculation | Planned | Yes | Yes |
| State median income comparison | Planned | Yes | Unknown |
| IRS expense standards | Planned | Yes | Yes (federal + local) |
| Form 122A generation | Planned | Yes | Yes |
| Form 122C generation | Planned | Yes | Yes |
| Exemption calculations | No | Yes | Yes (AI-powered) |

---

## Petition & Form Generation

| Feature | **LegalEagle** | **Jubilee Pro** | **Glade.ai** |
|---|---|---|---|
| Official form generation | Planned | Yes (all required federal forms) | Yes (court-ready PDF) |
| Schedule builder UI | No | Yes | Yes (attorney-facing preview) |
| PDF questionnaire export | Yes | N/A | N/A |
| Court-specific defaults | No | Yes | Unknown |
| Auto-population of repeated fields | Partial (autofill) | Yes | Yes |
| eSignature integration | No | Yes (SignNow) | Yes (built-in) |
| Signature/date auto-insertion | No | No | Yes |

---

## E-Filing

| Feature | **LegalEagle** | **Jubilee Pro** | **Glade.ai** |
|---|---|---|---|
| PACER/CM/ECF e-filing | No | Yes (ECF Wizard, all courts) | Yes (4-step process) |
| Click-to-file submission | No | Yes | Yes |
| Automatic PACER change tracking | No | No | Yes |
| Court notice auto-download | No | Yes (indexed, searchable) | Yes (with automation triggers) |
| Calendar integration (hearing dates) | No | Yes (auto-posted from docket) | Yes |

---

## Human-in-the-Loop Review

| Feature | **LegalEagle** | **Jubilee Pro** | **Glade.ai** |
|---|---|---|---|
| Side-by-side doc + extraction view | Yes | Unknown | Unknown |
| Accept/correct extraction workflow | Yes (5 statuses) | Yes ("verified, parsed data" for attorney review, per sales email) | Yes (reject/comment) |
| AI handles screening, human handles judgment | Yes | Yes (explicit positioning, per sales email) | Yes |
| Reviewer tracking (who, when, notes) | Yes | Unknown | Unknown |
| Version tracking (optimistic locking) | Yes | Unknown | Unknown |
| Rejection feedback trains AI | No | Unknown | Yes |

---

## Payment Processing

| Feature | **LegalEagle** | **Jubilee Pro** | **Glade.ai** |
|---|---|---|---|
| Payment integration | No | Yes (LawPay — IOLTA compliant) | Yes (Stripe + Confido Legal) |
| Credit/debit cards | No | Yes | Yes |
| ACH/eCheck | No | Yes | Yes |
| Apple Pay / Google Pay | No | No | Yes |
| Automated payment plans | No | Yes (scheduled) | Yes (bifurcated pre/post-filing) |
| Payment reminders | No | No | Yes (automated) |
| Trust/operating account routing | No | Yes (IOLTA) | Yes |
| QuickBooks integration | No | No | Yes |
| QR code payments | No | No | Yes |

---

## Communication & Automation

| Feature | **LegalEagle** | **Jubilee Pro** | **Glade.ai** |
|---|---|---|---|
| SMS/text messaging | No | Yes (in-platform) | Yes |
| Email automation | No | No | Yes (AI-driven) |
| AI follow-ups (custom voice) | No | No | Yes |
| In-app notifications | Planned | Yes | Yes |
| Client messaging | No | Yes (via portal) | Yes (chatbot + SMS) |
| 24/7 automated client support | No | No | Yes (AI chatbot) |

---

## Case & Workflow Management

| Feature | **LegalEagle** | **Jubilee Pro** | **Glade.ai** |
|---|---|---|---|
| Case status lifecycle | Yes (6 statuses) | Yes | Yes |
| Task management | No | Yes (workflow templates) | Yes (AI-assigned) |
| Workflow templates | No | Yes | Yes (Ch 7 + Ch 13 prebuilt) |
| Online calendar | No | Yes | Yes |
| Time tracking / billing | No | Yes | No |
| Creditor database | No | Yes (pre-populated addresses) | Yes (from credit reports) |

---

## Practice Management Integrations

| Integration | **LegalEagle** | **Jubilee Pro** | **Glade.ai** |
|---|---|---|---|
| Clio | No | Yes (bidirectional sync) | No |
| PracticePanther | No | Yes | No |
| QuickBooks | No | No | Yes |
| LawPay | No | Yes | No |
| Confido Legal | No | No | Yes |
| SignNow | No | Yes | No |
| Stripe | No | No | Yes |
| PACER | No | Yes | Yes |
| Credit bureaus | No | Yes (CreditVista) | Yes (tri-bureau) |

---

## Roles & Multi-Tenancy

| Feature | **LegalEagle** | **Jubilee Pro** | **Glade.ai** |
|---|---|---|---|
| Multi-tenant (multiple firms) | Yes (law_firm_id isolation) | No (per-firm instance) | No (per-firm) |
| Role-based access | Yes (client, paralegal, attorney, admin) | Yes (user roles) | Unknown |
| Client-scoped access | Yes (own cases only) | Yes | Yes |
| Staff account management | Yes (admin only) | Yes | Unknown |
| User seat limits | Unlimited | 2–5 (by tier) | Unlimited |
| Soft-delete audit trail | Yes (all entities) | Unknown | Unknown |

---

## Security & Compliance

| Feature | **LegalEagle** | **Jubilee Pro** | **Glade.ai** |
|---|---|---|---|
| Tenant data isolation | Yes (row-level) | N/A (single-tenant) | Unknown |
| API input validation (Zod) | Yes | Unknown | Unknown |
| AI output validation | Yes (Zod schemas) | N/A | Unknown |
| Soft delete (no hard deletes) | Yes | Unknown | Unknown |
| Field-level encryption | Planned (SSN, account#) | Unknown | Unknown |
| SOC 2 | Not yet | Unknown | Not disclosed |
| IOLTA compliance | N/A | Yes (via LawPay) | Yes (via Confido) |

---

## Review Ratings (Third-Party)

| | **LegalEagle** | **Jubilee Pro** | **Glade.ai** |
|---|---|---|---|
| **Capterra** | N/A | 4.5/5 (105 reviews) | No reviews |
| **G2** | N/A | N/A | No reviews |
| **Ease of use** | N/A | 4.2/5 | Unknown |
| **Value for money** | N/A | 4.7/5 | Unknown |
| **Customer support** | N/A | 4.8/5 | Unknown |
| **Features** | N/A | 4.2/5 | Unknown |

---

## UI Flow Comparison

### LegalEagle Workflow
```
Client Login → Dashboard → Case View
                              ├── Questionnaire (27 sections, any order)
                              ├── Document Upload → Auto-classify → Auto-extract → Review
                              ├── Validation Warnings → Dismiss/Fix
                              ├── Fraud Detection Review
                              └── [Planned] Means Test → Petition → E-file

Staff Login → Dashboard (all cases) → Case View
                              ├── Same as above + extraction review
                              ├── Accept/Correct extraction
                              ├── Dismiss validations
                              └── Admin → Staff Management
```

### Jubilee Pro Workflow
```
Client Intake (portal/manual)
    → Document Upload (mobile supported)
        → AI classifies each document type
        → Blurry/bad images rejected with re-upload prompt
        → Duplicates auto-removed
        → Wrong documents flagged
        → Data extracted and mapped to petition fields
    → Credit Report Import (CreditVista)
    → Attorney reviews clean, organized, verified data (human-in-the-loop)
    → Means Test Calculator
    → Form Generation & Review
    → ECF Wizard (click-to-file)
    → Post-Filing: Auto court notices → Calendar updates
```
*Note: AI document pipeline details sourced from April 2026 sales email.*

### Glade.ai Workflow
```
AI Chatbot qualifies lead → Consultation booking (calendar widget)
    → Retainer generation + eSignature + down payment
    → Document Checklist (mobile upload, photo-to-PDF)
    → Income Organizer (paystub linking + AI extraction)
    → Credit Report pull + AI parsing → Master Creditor List
    → Client Questionnaire (real-time collaboration + AI summary)
    → Schedules Builder (attorney preview + AI exemptions)
    → E-Filing Agent (4-step PACER submission)
    → Post-Filing: Court calendar sync + notice tracking
```

---

## Strategic Takeaways

### LegalEagle's Competitive Advantages
1. **AI fraud detection** — neither competitor offers this; strongest differentiator
2. **Multi-tenant architecture** — can serve multiple law firms from one deployment (platform play vs. per-firm SaaS)
3. **Extraction transparency** — per-field confidence scoring (0.0–1.0), extraction method tracking, and granular accept/correct workflow; Jubilee and Glade both now do AI extraction but neither exposes this level of detail
4. **Cross-document validation** — automated consistency checks (income across paystubs/W-2s/tax returns, 10% variance tolerance) that neither competitor has
5. **Temporal coverage validation** — auto-detects missing months in paystub/tax coverage
6. **Two-tier OCR pipeline** — most robust document processing (rule engine → Tesseract → MarkerOCR → Azure DI fallback); unclear how deep Jubilee's or Glade's OCR goes
7. **Soft-delete audit trail** — strongest compliance posture for legal data

### LegalEagle's Key Gaps vs. Competitors
1. **No e-filing** — both competitors have PACER/CM/ECF integration (table stakes)
2. **No credit report integration** — both competitors pull and auto-parse credit reports
3. **No means test calculator** — both competitors have this (Jubilee: mature; Glade: AI-powered)
4. **No petition/form generation** — both competitors produce court-ready PDFs
5. **No payment processing** — both competitors handle billing/payments
6. **No communication tools** — no SMS, email automation, or client messaging
7. **No AI chatbot** — Glade's 24/7 intake chatbot is a strong differentiator
8. **No eSignature** — both competitors have this
9. **No calendar/scheduling** — both competitors offer this
10. **No credit report → schedule auto-population** — significant data entry savings lost
11. **No document quality verification** — both Jubilee and Glade now reject blurry/bad uploads automatically; LegalEagle processes everything and relies on downstream review
12. **No wrong-document detection with client feedback** — Jubilee flags wrong docs and prompts re-upload; LegalEagle classifies but doesn't close the loop with the client

### Narrowing AI Gap
Jubilee's April 2026 sales email reveals they have added AI document processing (classification, quality checks, duplicate removal, extraction-to-petition mapping) with a human-in-the-loop model. This **significantly narrows what was LegalEagle's clearest advantage** — AI-powered document processing is no longer a differentiator against Jubilee, it's now table stakes. The remaining differentiation is in *depth and transparency* of the AI (confidence scoring, cross-doc validation, fraud detection) rather than *having* AI at all.

### Market Positioning
- **Jubilee Pro** = mature, affordable, full-featured, 30+ year track record, strongest support, **now with AI document processing** (narrowing tech gap); still weaker UI (4.2/5 ease of use)
- **Glade.ai** = AI-first, modern UX, end-to-end automation, but early-stage, small team, no third-party reviews, opaque pricing
- **LegalEagle** = deepest AI extraction + validation + fraud detection, multi-tenant platform potential, but missing downstream features (filing, payments, communication); **AI extraction alone is no longer a differentiator — all three competitors now have it**

### Priority Recommendations
1. **Means test + petition generation** — closes the biggest functional gap; without this, the product can't produce a filing
2. **E-filing integration (PACER)** — required for end-to-end workflow; both competitors have it
3. **Credit report integration** — high-value data source that feeds schedules D/E/F automatically
4. **Document quality verification + client feedback loop** — reject blurry/wrong docs at upload with re-upload prompts; both competitors now have this and it prevents wasted processing cycles
5. **eSignature** — small effort, expected by all firms
6. **Payment processing** — Stripe/LawPay integration; revenue-adjacent feature firms expect
