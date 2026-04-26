# E-Filing & Court Intelligence — Implementation Plan

**Feature area:** PACER/CM/ECF e-filing, docket monitoring, court notices, calendar integration  
**Status:** Planning — not yet started  
**Priority:** P1 — Required for end-to-end workflow (both competitors have it)  
**Owner:** Engineering  
**Last reviewed:** 2026-04-25  
**Related:** [architecture.md](architecture.md), [competitive-matrix.md](competitive-matrix.md) (e-filing comparison)

---

## Strategic Angle

Rather than racing to match competitors feature-for-feature on CM/ECF, LegalEagle's angle is **zero-surprise filing**. AI validates every reason a clerk could reject a petition *before* the attorney clicks "file." Filing readiness is visible throughout intake (not just at the final step), and court notices are transformed into action items rather than PDFs to dig through. This makes LegalEagle *faster and safer* than Jubilee or Glade even though they got there first.

---

## Phase A — Filing Package & Readiness Intelligence

*No external APIs. Ships fast. Immediate attorney value.*

### 1. Court Reference Data

Add a `court_districts` reference table:
- `id` (text, PK) — structured district code e.g. `bankr.c.d.cal`
- `name` (text) — "Central District of California"
- `division` (text) — "Los Angeles"
- `address` (text)
- `trustee_office_address` (text)
- `chapter7_fee` (integer, cents)
- `chapter13_fee` (integer, cents)
- `local_rules_url` (text)

Seed with all 94 US bankruptcy districts. Replace the free-text `filingDistrict` field on `cases` with a FK to `court_districts.id`.

### 2. Attorney PACER Credentials

Extend `users` table:
- `pacer_username` (text)
- `pacer_password_enc` (text) — AES-256-GCM encrypted, key in Azure Key Vault (follows per-client DEK pattern from the security issue)
- `bar_number` (text)
- `bar_state` (text)

These are required before a filing can be initiated. Only `attorney` role users can store credentials and initiate filings.

### 3. Filing Packages Table

New `filing_packages` table:
- `id`, `case_id`, `law_firm_id`
- `status` — `draft | validating | ready | submitted | accepted | rejected`
- `package_pdf_path` — blob storage path for the assembled PDF bundle
- `manifest_json` — list of included schedules and exhibits
- `filing_fees` (integer, cents)
- `ecf_confirmation_number` (text)
- `ecf_receipt_path` (text)
- `submitted_by_user_id` (text FK → users)
- `created_at`, `submitted_at`
- `deleted_at` (soft delete)

### 4. AI Pre-Flight Validator

New route: `POST /api/cases/:id/filing/preflight`

Runs a Claude prompt against the complete case data (questionnaire + extraction results + validation results). Checks every documented CM/ECF clerk rejection reason:

- Missing debtor signatures
- Schedule math errors (assets/liabilities totals)
- Missing required exhibits for the district
- SSN format errors (must be last 4 digits on filed version)
- Prior case timing violations (Ch 7→7: 8yr gap, Ch 13→7: 6yr gap)
- Fee waiver eligibility vs. income claimed
- Joint filing consistency (spouse data complete if `isJointFiling`)
- District-specific local rule flags (per `court_districts` record)

Returns a `FilingReadiness` object:
```ts
{
  score: number;           // 0–100
  blockers: Blocker[];     // prevent filing
  warnings: Warning[];     // allow override with attorney attestation
  estimatedFees: number;   // cents
  courtName: string;
}
```

Blockers prevent filing from proceeding. Warnings can be overridden with a mandatory attorney attestation checkbox.

### 5. Persistent Filing Readiness Score

The readiness score is computed incrementally as case data comes in — **not** just at the final step. Displayed on the case detail page alongside the existing status badge:

- 🔴 0–59 — Not ready
- 🟡 60–89 — Needs attention
- 🟢 90–100 — Ready to file

Paralegal sees this score throughout the intake workflow. It updates automatically when questionnaire sections are saved or documents are reviewed. This sets LegalEagle apart from both competitors where readiness is only checked at the final step.

### 6. Filing Step UI (complete the `FilingStep.tsx` placeholder)

Replace the current placeholder with a full workflow:

1. **Court selector** — dropdown from `court_districts`, pre-filled from `cases.filingDistrict`
2. **Pre-flight results panel** — blocker cards (red), warning cards (amber), each expandable with explanation and a link to the relevant section. Uses existing `SeverityCard` component.
3. **Fee summary** — chapter filing fee, fee waiver eligibility callout if household income qualifies
4. **Attorney credentials check** — shows ✓ if PACER credentials stored, prompts for entry if not
5. **"Generate Filing Package"** button (enabled when score ≥ 90 and zero blockers) — produces a PDF/A-compliant bundle: petition + all schedules + means test + statement of affairs

**Acceptance criteria:**
- Pre-flight catches at least 10 documented clerk rejection reasons
- Filing package PDF passes PDF/A validation (`pdfinfo`)
- Only `attorney` role can click "Generate Filing Package"
- All existing server tests pass

---

## Phase B — PACER Docket Monitoring & Smart Court Inbox

*Depends on Phase A. First external integration.*

### 7. PACER/BankruptcyWatch Integration

Implement `IPacerProvider` interface (follows `IBlobStorage` pattern in `server/src/storage/types.ts`):

```ts
interface IPacerProvider {
  subscribeToDocket(caseNumber: string, courtCode: string): Promise<void>;
  getNotices(caseNumber: string, since?: Date): Promise<CourtNotice[]>;
  downloadNotice(noticeId: string): Promise<Buffer>;
  unsubscribe(caseNumber: string): Promise<void>;
}
```

Initial implementation: **BankruptcyWatch API** (documented REST API for docket monitoring + webhooks). Backup option: PacerPro. Provider resolved via factory at runtime — same pattern as blob storage.

### 8. Court Notices Table

New `court_notices` table:
- `id`, `case_id`, `law_firm_id`
- `notice_type` — `341_meeting | confirmation_hearing | discharge | dismissal | order | other`
- `received_at`
- `document_path` — blob storage path for the original PDF
- `raw_text` — extracted text (for AI processing)
- `ai_summary` (text) — 2–3 sentence plain-English description
- `action_items_json` — `[{ text, dueDate, assigneeRole }]`
- `calendar_events_json` — `[{ title, date, location, type }]`
- `client_update` (text) — one sentence suitable to send directly to the client
- `is_read` (boolean)
- `assigned_to_user_id` (FK → users, nullable)
- `received_from_provider` (text) — which provider delivered it
- `deleted_at`

New route `POST /webhooks/court-notices` — HMAC-verified webhook endpoint that receives incoming notices, stores raw PDF to blob storage, triggers async AI processing.

### 9. AI Notice Parser

Async function triggered after each new notice arrives. Calls Claude with the extracted notice text and produces:

- `aiSummary` — plain-English description for staff
- `actionItems[]` — explicit attorney/paralegal tasks with due dates
- `calendarEvents[]` — structured hearing/meeting dates
- `clientUpdate` — one plain-English sentence for the client portal

Results written back to `court_notices` row.

### 10. Court Notice Inbox UI

New staff-facing page at `/firm/court-notices`:

- `DataTable` with columns: case name, notice type, received, AI summary (truncated), action items count, read/unread badge
- Click-through to notice detail: full AI summary, action items checklist (check off as done), download original PDF button
- Filter by: unread, case, notice type, date range
- Unread badge count on sidebar navigation item

### 11. Notification System

Implement the `notifications` table and routes already spec'd in `docs/dev/ui-requirements.md`:
- `GET /api/notifications` — paginated, tenant-scoped
- `PATCH /api/notifications/:id/read`
- Bell icon with unread count in the header

Events that trigger notifications:
- New court notice received
- Filing accepted / rejected
- Pre-flight score drops below 60
- 341 meeting scheduled (extracted from notice)

**Acceptance criteria:**
- Webhook receives a test notice, AI summary generated within 5s, notification fires, badge updates in UI
- Test suite uses mock court notice PDFs (one of each notice_type)

---

## Phase C — Click-to-File CM/ECF Submission

*Depends on Phase A + B. Highest complexity.*

### 12. CM/ECF Browser Automation

Implement `ICMECFProvider` interface:

```ts
interface ICMECFProvider {
  login(credentials: PacerCredentials, courtCode: string): Promise<void>;
  submitFiling(pkg: FilingPackage): Promise<FilingResult>;
  getFilingStatus(confirmationNumber: string): Promise<FilingStatus>;
  logout(): Promise<void>;
}
```

Initial implementation: **Playwright** (headless Chromium) navigating CM/ECF. This is the approach used by Jubilee Pro and most legal SaaS tools. It operates inside the attorney's own PACER account using their stored credentials — no platform-level CM/ECF agreement required.

Each filing attempt:
1. Validates `filing_packages.status === 'ready'`
2. Logs in to CM/ECF with attorney's stored credentials
3. Navigates to correct court / case type / filing event
4. Uploads the filing package PDF and individual schedule PDFs
5. Captures confirmation number + receipt PDF
6. Saves to `filing_packages` (status → `accepted` or `rejected`)
7. Fires notification

All Playwright session logs and screenshots captured to blob storage for debugging. No screenshot or log contains credentials.

### 13. Filing Fee Display

Calculate filing fees from `court_districts` reference data and display in the Filing Step UI before submission. Show:
- Base chapter filing fee
- Fee waiver qualification flag
- Note to attorney that fees are paid directly to the court at submission

(Full payment processing integration is out of scope for this plan.)

### 14. "File Now" Button UX

In `FilingStep`, when pre-flight score ≥ 90 and zero blockers:

- Single **"File Now"** button (attorney role only)
- Inline progress stepper: "Connecting to CM/ECF → Uploading documents → Confirming submission → Done"
- On success: ECF confirmation number displayed prominently, case status advances to `filed`, notification sent to all firm staff on the case
- On rejection: rejection reason shown, `filing_packages.status` set to `rejected`, attorney prompted to fix and retry

**Acceptance criteria:**
- Full end-to-end test against CM/ECF training environment (PACER provides a test instance)
- Confirmation number stored on `filing_packages`
- Case status advances to `filed` only on acceptance
- Paralegal role cannot initiate filing — button hidden / disabled with explanation

---

## Phase D — Calendar Integration & Client Autopilot

*Depends on Phase B. Can run in parallel with Phase C.*

### 15. Calendar Events Table + iCal Export

New `calendar_events` table:
- `id`, `case_id`, `law_firm_id`
- `title`, `event_type` — `341_meeting | confirmation_hearing | discharge | deadline | other`
- `event_date` (text, ISO8601)
- `location` (text, nullable)
- `source_notice_id` (FK → court_notices, nullable)
- `created_by_user_id` (nullable — null = auto-generated from notice)
- `deleted_at`

New route: `GET /api/cases/:id/calendar.ics`  
Returns a valid iCal feed for the case. Attorneys subscribe their Google/Outlook calendar to this URL for live updates.

### 16. Upcoming Events Widget

On the case detail page, add an "Upcoming Events" panel listing the next 3 `calendar_events` for the case:
- Date, event type badge, location
- Click opens the source court notice detail

### 17. Client Autopilot Notifications

When a significant event occurs (filing accepted, 341 meeting scheduled, discharge entered), auto-generate a client-facing update in the client portal using the `clientUpdate` field from the AI notice parser.

Configuration per law firm (in firm settings):
- **Auto-send** — client sees the update immediately
- **Review before send** — attorney/paralegal must approve in a queue before it appears

This is zero-effort for the attorney on auto-send cases — a 341 meeting notice from the court becomes "Your Meeting of Creditors is scheduled for June 15th at 10:00 AM at 411 W 4th St, Santa Ana, CA" in the client portal automatically.

**Acceptance criteria:**
- iCal URL imports correctly into Google Calendar with correct event titles and dates
- Client portal shows event update within 60 seconds of notice receipt on auto-send
- Approval queue works correctly for review-before-send mode

---

## Schema Changes Summary

| Table | Change |
|---|---|
| `court_districts` | New — reference data for all 94 bankruptcy districts |
| `cases.filing_district` | Change from free text to FK → `court_districts.id` |
| `users` | Add `pacer_username`, `pacer_password_enc`, `bar_number`, `bar_state` |
| `filing_packages` | New — durable record of each filing attempt |
| `court_notices` | New — court-delivered notices with AI summaries |
| `calendar_events` | New — structured hearing/deadline dates |
| `notifications` | New — in-app notification bell (already spec'd in ui-requirements.md) |

---

## Key Files Affected

| File | Change |
|---|---|
| [server/src/db/schema.ts](server/src/db/schema.ts) | Add 5 new tables, extend `users` and `cases` |
| [client/src/pages/staff/steps/FilingStep.tsx](client/src/pages/staff/steps/FilingStep.tsx) | Replace placeholder with full filing workflow |
| [server/src/routes/cases.ts](server/src/routes/cases.ts) | Add `/preflight` route |
| [server/src/storage/types.ts](server/src/storage/types.ts) | Reference pattern for `IPacerProvider`, `ICMECFProvider` |
| [server/src/services/pdfGenerator.ts](server/src/services/pdfGenerator.ts) | Extend for PDF/A-compliant filing bundles |
| [server/src/env.ts](server/src/env.ts) | Add `PACER_PROVIDER_API_KEY`, `KEY_VAULT_URI` env vars |
| [docs/dev/architecture.md](docs/dev/architecture.md) | Add e-filing and court intelligence subsystems |

---

## Decisions & Scope

| Decision | Rationale |
|---|---|
| Playwright for CM/ECF | No official API exists for federal bankruptcy CM/ECF filing. Playwright matches how Jubilee Pro implements it. |
| BankruptcyWatch for docket monitoring | Has a documented REST API and webhooks; purpose-built for bankruptcy SaaS. |
| Not Tyler Technologies | Their product is for state courts, not federal bankruptcy. |
| Attorney role only for filing | Attorney bears professional/legal responsibility for court filings. |
| Filing fees displayed, not collected | Payment processing is a separate initiative. |
| Federal Ch 7/13 only in this plan | State and local forms, Ch 11/12 are separate. |

---

## Open Questions

1. **CM/ECF training environment access** — PACER provides a test/training CM/ECF system. Playwright automation must be validated there before any live filings. Confirm access before Phase C begins.

2. **Multi-district attorney credentials** — Some firms practice in multiple bankruptcy districts. Should one attorney profile cover all districts, or support per-district credential profiles?

3. **Firm-level vs. attorney-level PACER credentials** — Should the firm store one set of PACER credentials, or should each attorney store their own? (Legally, filings must be under the filing attorney's PACER account.)

4. **BankruptcyWatch API contract** — Evaluate pricing and SLA before committing to Phase B. Identify fallback vendor (PacerPro) if needed.
