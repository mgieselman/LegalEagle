# Design Decisions

## Priority: Make It Work First
Focus on end-to-end functionality before UI polish. The product should be able to take questionnaire input and produce a bankruptcy petition.

## Target Workflow
1. Client logs in, sees their case dashboard
2. Client fills out digital questionnaire (27 sections, maps to the paper BK questionnaire)
3. Client uploads supporting documents (paystubs, tax returns, bank statements)
4. System classifies and extracts data from documents (rule engine → AI → human review)
5. System runs means test calculation automatically (Form 122A for Ch 7, Form 122C for Ch 13)
6. System generates petition forms (Schedule I, Form 122A, etc.)
7. Attorney reviews AI fraud/inconsistency analysis
8. Attorney signs off and files petition

## Business Context
- Multi-tenant SaaS for law firms handling consumer bankruptcy
- Supports both Chapter 7 and Chapter 13
- Priority customer service (direct attorney access) is a potential upsell tier
- Key differentiator: automated paystub parsing → means test → Schedule I

## Auth Strategy
- Interface-driven (`IAuthProvider`) — hardcoded dev stub initially, real provider later
- Clients and staff authenticate separately (different tables, different flows)
- Clients: magic link or simple password, scoped to their case(s)
- Staff: email + password, scoped to their law firm
- All routes protected by auth middleware that attaches `req.user`

> Current implementation details (role table, middleware, route access control): see [architecture.md](architecture.md#roles--auth).

## Data Model Evolution
The prototype had a single `forms` table with no users. The new model:
- `forms` table → `questionnaires` table, linked to a `case_id`
- Questionnaire data structure (27 sections, 150+ fields) is preserved — it maps directly to the paper BK questionnaire PDF
- Each case has one questionnaire, many documents, many extraction results
- The existing questionnaire components survive mostly unchanged — they just live inside a case context now instead of being standalone

> Current schema (canonical): [server/src/db/schema.ts](../../server/src/db/schema.ts). Data model diagram: see [architecture.md](architecture.md#multi-tenant-data-model).

## Storage
- Two stores: Blob (original files + generated PDFs) + PostgreSQL with JSONB (everything else)
- No JSON sidecar files — extracted data lives in `extraction_results.extracted_data` JSONB column
- Drizzle ORM is the single source of truth for schema
- Wipe and reseed on deploy until real data exists

## Pre-Pilot Checklist

Quality gates to add before any real users touch the system:

- [ ] **Accessibility (WCAG 2.1 AA)** — Legal apps serve a broad population. Bankruptcy clients may have disabilities. Some courts require accessible digital forms. Audit all forms, buttons, navigation for keyboard access, screen readers, color contrast.
- [ ] **Dependency vulnerability scanning** — Enable `npm audit` in CI and/or Dependabot on the GitHub repo. Financial data is a high-value target — catch known CVEs in dependencies before they ship.
- [ ] **React error boundaries** — A crash in one form section (e.g., vehicles) should not white-screen the entire questionnaire. Add error boundaries around each major UI region to contain failures gracefully.
- [ ] **Integration tests against PostgreSQL** — Once off SQLite, run the test suite against a real PostgreSQL instance in CI to catch dialect differences.
- [ ] **RBAC permission tests** — Once auth is real (not stubbed), add tests that verify role boundaries: client can't see other clients, paralegal can't access admin routes, etc.
- [ ] **Load testing** — Before multi-firm deployment, verify concurrent document processing doesn't degrade under realistic load.

## Interface-Driven Architecture
All external dependencies accessed through interfaces so implementations can be swapped:
- `IBlobStorage` — Azure Blob / S3 / local FS
- `IAuthProvider` — dev stub / Clerk / Auth0 / Azure AD B2C
- `IAIProvider` — Claude / OpenAI / Gemini
- `IOCRProvider` — Claude vision / Azure Doc Intelligence / Textract
- `IDocumentSplitter` — AI-based / heuristic
- `IJobQueue` — BullMQ / SQS / in-memory
- `INotificationService` — in-app polling / email
- `IVirusScanner` — ClamAV / cloud scanning
- `IKeyVault` — Azure Key Vault / AWS KMS / HashiCorp Vault

> Interface list is also summarized in [architecture.md](architecture.md#key-patterns) under Key Patterns.
