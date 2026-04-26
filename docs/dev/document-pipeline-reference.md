# Document Pipeline — Data Model & Infrastructure Reference

> This file contains the detailed data model, storage architecture, security, and disaster recovery specs for the document processing pipeline.  
> For the pipeline stages, flow, UX, and interfaces see [document-pipeline.md](document-pipeline.md).  
> For extraction architecture see [extraction.md](extraction.md).

## Quick Reference

- **Database:** Drizzle ORM, SQLite (dev) / PostgreSQL (prod) — schema is source of truth
- **Blob layout:** `/{law_firm_id}/{client_id}/{case_id}/originals/{doc_id}.{ext}`
- **Extracted data storage:** PostgreSQL JSONB in `extraction_results.extracted_data` — not sidecar files
- **Encryption:** AES-256 per-tenant keys in Azure Key Vault; field-level for SSN, account numbers
- **Soft delete:** All entities use `deleted_at` — no hard deletes ever
- **Key schema file:** [server/src/db/schema.ts](../../server/src/db/schema.ts)

---

## Multi-Tenant Data Model

```
┌──────────────┐     ┌──────────────┐     ┌──────────────────┐
│  law_firms   │     │    users     │     │     clients      │
├──────────────┤     ├──────────────┤     ├──────────────────┤
│ id (PK)      │──┐  │ id (PK)      │     │ id (PK)          │
│ name         │  │  │ law_firm_id  │──┐  │ law_firm_id (FK) │
│ address      │  │  │ email        │  │  │ first_name       │
│ phone        │  │  │ name         │  │  │ last_name        │
│ email        │  │  │ role (enum)  │  │  │ ssn_encrypted    │
│ created_at   │  │  │ created_at   │  │  │ dob              │
└──────────────┘  │  └──────────────┘  │  │ address          │
                  │    roles:          │  │ phone            │
                  │    - paralegal     │  │ email            │
                  │    - attorney      │  │ spouse_first_name│
                  │    - admin         │  │ spouse_last_name │
                  │                    │  │ spouse_ssn_enc   │
                  └────────────────────┘  │ spouse_dob       │
                                          │ created_at       │
                                          └──────────────────┘
                                                   │
                          ┌────────────────────────┘
                          v
                  ┌──────────────────┐
                  │     cases        │
                  ├──────────────────┤
                  │ id (PK)          │
                  │ client_id (FK)   │
                  │ law_firm_id (FK) │  ← denormalized for fast tenant queries
                  │ chapter (7|13)   │
                  │ filing_date      │
                  │ filing_district  │
                  │ status (enum)    │
                  │ is_joint_filing  │
                  │ household_size   │
                  │ means_test_exempt│
                  │ exemption_reason │
                  │ deleted_at (null)│  ← soft delete, never hard-delete
                  │ created_at       │
                  └──────────────────┘
                    status:            │
                    - intake           │
                    - documents        │
                    - review           │
                    - ready_to_file    │
                    - filed            │
                    - discharged       │
                    - dismissed        │
                    - closed           │
                          ┌────────────┘
                          v
┌──────────────────────────────┐     ┌─────────────────────────────┐
│        documents             │     │     extraction_results      │
├──────────────────────────────┤     ├─────────────────────────────┤
│ id (PK)                      │──┐  │ id (PK)                     │
│ case_id (FK)                 │  │  │ document_id (FK)            │
│ law_firm_id (FK)             │  │  │ extraction_method (enum)    │ ← denormalized
│ parent_document_id (FK, null)│  │  │ confidence_score (0-1)      │
│ replaces_document_id (FK,nul)│  │  │ confidence_threshold_used   │
│ uploaded_by (FK -> users)    │  │  │ extracted_data (JSONB)      │ ← varies by doc type
│ original_filename            │  │  │ status (enum)               │
│ blob_path                    │  │  │ version (int)               │ ← optimistic locking
│ doc_class (enum, nullable)   │  │  │ reviewed_by (FK -> users)   │
│ belongs_to (debtor|spouse)   │  │  │ reviewed_at                 │
│ date_range_start             │  │  │ review_notes                │
│ date_range_end               │  │  │ created_at                  │
│ processing_status (enum)     │  │  └─────────────────────────────┘
│ page_count                   │     extraction_method:
│ page_range_start (for splits)│       - rule_engine
│ page_range_end   (for splits)│       - ai_parse
│ upload_batch_id              │       - human_entry
│ retry_count (default 0)      │
│ last_error                   │     status:
│ file_hash (SHA-256)          │       - pending
│ deleted_at (nullable)        │       - auto_accepted
│ created_at                   │       - ai_accepted
└──────────────────────────────┘       - needs_review
  processing_status:                   - reviewed_accepted
    - uploaded                         - reviewed_corrected
    - classifying
    - splitting
    - extracting              ┌─────────────────────────────────┐
    - extracted               │     validation_results          │
    - needs_review            ├─────────────────────────────────┤
    - reviewed                │ id (PK)                         │
    - failed                  │ case_id (FK)                    │
    - replaced                │ document_id (FK, nullable)      │
                              │ validation_type (enum)          │
  doc_class:                  │ severity (error|warning|info)   │
    - paystub                 │ message                         │
    - bank_statement_checking │ details_json                    │
    - bank_statement_savings  │ is_dismissed                    │
    - tax_return              │ dismissed_by (FK -> users)      │
    - ira_statement           │ dismissed_at                    │
    - 401k_statement          │ created_at                      │
    - credit_card_statement   └─────────────────────────────────┘
    - mortgage_statement        validation_type:
    - social_security_letter      - internal_consistency
    - legal_document              - cross_document
    - w2                          - temporal_gap
    - 1099                        - duplicate_detected
    - drivers_license             - questionnaire_mismatch
    - social_security_card
    - unclassified

┌─────────────────────────────────┐  ┌──────────────────────────────┐
│     audit_log                   │  │  notifications               │
├─────────────────────────────────┤  ├──────────────────────────────┤
│ id (PK)                         │  │ id (PK)                      │
│ law_firm_id (FK)                │  │ user_id (FK)                 │
│ user_id (FK)                    │  │ case_id (FK, nullable)       │
│ action (enum)                   │  │ type (enum)                  │
│ entity_type (string)            │  │ title                        │
│ entity_id (string)              │  │ message                      │
│ details_json                    │  │ is_read                      │
│ ip_address                      │  │ created_at                   │
│ created_at                      │  └──────────────────────────────┘
└─────────────────────────────────┘    notification types:
  actions:                               - documents_need_review
    - document_uploaded                  - extraction_complete
    - document_reviewed                  - validation_warning
    - extraction_accepted                - documents_missing
    - extraction_corrected               - case_ready_to_file
    - field_edited
    - document_replaced
    - case_status_changed
    - client_created
    - user_login

┌─────────────────────────────────┐
│  reference_data                 │
├─────────────────────────────────┤  Stores raw imported reference data.
│ id (PK)                         │  For queryable lookups, use the
│ type (enum)                     │  normalized tables below.
│ jurisdiction (state/district)   │
│ effective_date                  │
│ expiration_date (nullable)      │
│ data_json                       │
│ source_url                      │
│ created_at                      │
└─────────────────────────────────┘
  type:
    - median_income
    - irs_national_standards
    - irs_local_standards_housing
    - irs_local_standards_transport
    - irs_health_care_allowance

Normalized reference tables (extracted from data_json for fast lookups):

┌─────────────────────────────────┐  ┌──────────────────────────────────┐
│  median_income_thresholds       │  │  irs_expense_allowances          │
├─────────────────────────────────┤  ├──────────────────────────────────┤
│ id (PK)                         │  │ id (PK)                          │
│ reference_data_id (FK)          │  │ reference_data_id (FK)           │
│ state                           │  │ category (enum)                  │
│ household_size                  │  │ subcategory (nullable)           │
│ annual_median                   │  │ jurisdiction (state/county/MSA)  │
│ monthly_median                  │  │ household_size (nullable)        │
│ effective_date                  │  │ allowance_amount                 │
│ expiration_date                 │  │ effective_date                   │
└─────────────────────────────────┘  │ expiration_date                  │
                                     └──────────────────────────────────┘
                                       category:
                                         - national_food_clothing_other
                                         - national_health_care
                                         - local_housing
                                         - local_transport_ownership
                                         - local_transport_operating
                                         - local_transport_public
```

### Key Indexes

```sql
-- Review queue (highest-traffic query — must be fast)
CREATE INDEX idx_documents_review_queue
  ON documents(law_firm_id, processing_status, doc_class);

-- Temporal coverage gap detection
CREATE INDEX idx_documents_date_coverage
  ON documents(case_id, doc_class, date_range_start, date_range_end);

-- Extraction review queue
CREATE INDEX idx_extraction_results_review
  ON extraction_results(document_id, status);

-- Active validation warnings per case
CREATE INDEX idx_validation_results_active
  ON validation_results(case_id, severity, is_dismissed);

-- Audit log compliance queries (partition candidate)
CREATE INDEX idx_audit_log_tenant_time
  ON audit_log(law_firm_id, created_at);

-- Means test lookups
CREATE INDEX idx_median_income_lookup
  ON median_income_thresholds(state, household_size, effective_date);

CREATE INDEX idx_irs_allowance_lookup
  ON irs_expense_allowances(category, jurisdiction, household_size, effective_date);

-- Reference data by type and date
CREATE INDEX idx_reference_data_lookup
  ON reference_data(type, jurisdiction, effective_date);

-- Notifications unread
CREATE INDEX idx_notifications_unread
  ON notifications(user_id, is_read, created_at);

-- Soft delete filtering (partial indexes in PostgreSQL)
-- CREATE INDEX idx_documents_active ON documents(id) WHERE deleted_at IS NULL;
-- CREATE INDEX idx_cases_active ON cases(id) WHERE deleted_at IS NULL;
```

---

## Storage Architecture

### Two-Store Approach: Blob + SQL (with JSONB)

- **Blob storage** (Azure Blob / S3 via `IBlobStorage` interface): original uploaded files and generated PDFs.
- **PostgreSQL JSONB** (Drizzle ORM): all metadata, relationships, processing state, and extracted data. No JSON sidecar files.

**Per-case blob layout:**
```
/{law_firm_id}/{client_id}/{case_id}/
  originals/
    {document_id}.pdf
  generated/
    form-122a-1.pdf
    schedule-i.pdf
```

**Why JSONB instead of sidecar files:** Single transaction boundary — no split-brain between SQL and blob. Natively queryable. Full audit history via immutable rows.

**Why not NoSQL:** PostgreSQL JSONB gives document-store flexibility inside the relational DB already required for tenancy, roles, and queues. Adding a third store is unjustified.

### Drizzle ORM (source of truth)

All DB access through Drizzle. Schema files define every table. `drizzle-kit push` syncs on deploy. Wipe + reseed until real production data exists.

```typescript
// Example: extraction_results with JSONB
export const extractionResults = pgTable('extraction_results', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentId: uuid('document_id').references(() => documents.id).notNull(),
  extractionMethod: text('extraction_method').notNull(),
  confidenceScore: real('confidence_score'),
  extractedData: jsonb('extracted_data'),
  status: text('status').notNull().default('pending'),
  version: integer('version').notNull().default(1),
  reviewedBy: uuid('reviewed_by').references(() => users.id),
  reviewedAt: timestamp('reviewed_at'),
  reviewNotes: text('review_notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

### Storage Interface

```typescript
interface IBlobStorage {
  upload(path: string, data: Buffer, contentType: string): Promise<string>;
  download(path: string): Promise<Buffer>;
  delete(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  listFiles(prefix: string, cursor: string | null, limit: number): Promise<{files: string[], nextCursor: string | null}>;
  /** Max 15 minutes for financial docs */
  getSignedUrl(path: string, expiresInSeconds: number): Promise<string>;
}
```

**Signed URL policy:** All document access goes through server-side signed URLs. Max 15 minutes for financial documents. Never expose blob paths directly.

---

## Security

### Encryption at Rest
- **Field-level encryption:** SSN, account numbers — AES-256, per-tenant keys in Azure Key Vault. Non-sensitive metadata stored in plain text for queryability.
- **JSONB extraction data:** Masked values only (last 4 digits) — never embed full SSNs or account numbers in JSONB.
- **Blob storage:** Azure SSE + customer-managed keys (CMK) per tenant.
- **Key management:** Azure Key Vault only. Keys never in config or env vars. Key rotation supported (background re-encryption job).

### Access Control
- All SQL queries must include `law_firm_id` in WHERE clauses — middleware enforced.
- `client` — own case(s) only; authenticates against separate `clients` table.
- `paralegal` — assigned clients; can review extractions.
- `attorney` — all firm clients; signs off on petitions.
- `admin` — full firm access.

### Audit Trail
All access and modifications logged to `audit_log` (append-only, never modifiable by any role).

---

## IRS / Census Reference Data

### Data Sources

| Data | Source | Update Frequency |
|---|---|---|
| State median income | US Trustee Program | ~2x/year (Apr, Nov) |
| IRS National Standards | IRS | Annual (March) |
| IRS Local Standards (housing) | IRS | Annual, by county |
| IRS Local Standards (transport) | IRS | Annual, by MSA/region |
| Health care allowances | IRS | Annual |

### Versioning
Stored with `effective_date` and `expiration_date`. Multiple versions coexist — system uses the version effective on the debtor's filing date, not today's date.

---

## Backup & Disaster Recovery

### SQL Database
- Daily automated backups + point-in-time recovery via WAL archiving to a separate storage account.
- **Retention:** 30-day rolling for active data; 7-year archive for closed cases.
- Monthly backup restore test to staging.

### Blob Storage
- Soft delete: 14-day retention.
- Versioning: every overwrite creates a new version.
- Geo-replication: RA-GRS.

### Audit Logs
Backed up to immutable Azure Blob Storage (time-based retention). Cannot be modified or deleted even by admins.

### Recovery Targets
- **RPO:** < 1 hour
- **RTO:** < 4 hours

---

## Document Replacement Flow

1. Client or paralegal selects "Replace" on an existing document.
2. New file linked via `replaces_document_id`; old document's `processing_status` set to `replaced`.
3. Old extraction results preserved for audit trail.
4. New document goes through the full pipeline.
5. Validation re-runs for the entire case.

---

## Joint Filing / Spouse Support

- Each document tagged with `belongs_to` (debtor or spouse).
- Form 122A-1 Column B requires non-filing spouse income even in non-joint filings for married debtors.
- CMI aggregates both debtor and spouse income per means test rules.

---

## Household Size & Jurisdiction

Stored as integer on `cases.household_size`. Three competing legal tests exist (IRS dependent test, Census definition, economic unit test). System stores the attorney's chosen value; the UI shows district-specific guidance but allows attorney override.
