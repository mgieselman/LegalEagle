# Document Processing Pipeline

## Implementation Status

This document describes the full designed pipeline. The table below shows what is currently built vs. planned.

| Stage | Status | Notes |
|---|---|---|
| Upload (multer, SHA-256 dedup, blob storage) | ✅ Built | `server/src/routes/documents.ts` |
| Text extraction (pdftext / markitdown / Tesseract) | ✅ Built | `extractor/text_extraction.py` |
| Two-tier classification (rules → Claude) | ✅ Built | `extractor/classifier.py` |
| Rule-engine extraction (paystubs, W-2s, bank stmts, 1040s, investments, mortgages) | ✅ Built | `extractor/rule_extractors/` |
| AI extraction (Claude, Pydantic schemas) | ✅ Built | `extractor/ai_extractor.py` |
| Two-tier OCR (Marker + Azure DI fallback) | ✅ Built | `extractor/ocr.py` |
| ID document classification (DL, SSN card via Tesseract) | ✅ Built | `extractor/classifier.py` — `drivers_license`, `social_security_card` |
| Internal validation (math consistency) | ✅ Built | `server/src/services/validation.ts` |
| Cross-document validation (10% variance) | ✅ Built | `server/src/services/validation.ts` |
| Temporal validation (6-month coverage) | ✅ Built | `server/src/services/validation.ts` |
| Human review UI (accept / correct) | ✅ Built | `client/src/components/DocumentReviewPanel.tsx` |
| Multi-doc PDF splitting (Stage 3) | ⬜ Not built | Each upload treated as one document |
| Async job queue | ⬜ Not built | Pipeline runs synchronously on upload |
| Field-level encryption (SSN, account#) | ⬜ Not built | Stored plain in SQLite/Postgres |
| Audit log | ⬜ Not built | Schema designed, not wired |
| Form mapping (petition generation) | ⬜ Not built | Questionnaire mapper built; PDF gen pending |
| Fraud & inconsistency analysis (Stage 9) | ⬜ Not built | Planned for later phase |

**Extraction architecture:** Classification and extraction run in a standalone Python FastAPI service (`extractor/`) called by the Node.js server via HTTP. The default extraction chain is **Rule → Azure DI → Claude** — rule extractors handle the highest-volume doc classes at zero cost, Azure DI prebuilt models cover doc classes without rule extractors, and Claude is the last resort. The Python service uses pdftext and markitdown for text extraction, Tesseract and Marker for scanned PDFs, and Azure Document Intelligence layout OCR as a low-confidence fallback. See [extraction.md](extraction.md) for the full extraction design.

---

## Overview

The document pipeline handles the full lifecycle of client-uploaded documents: upload, classification, data extraction, validation, human review, and mapping to bankruptcy form fields. It supports multi-tenant operation (multiple law firms) with isolated storage per client.

## System Context

```
┌─────────────────────────────────────────────────────────────────────┐
│                         LegalEagle Platform                        │
│                                                                     │
│  ┌──────────┐    ┌──────────────┐    ┌───────────┐    ┌──────────┐ │
│  │  Upload   │───>│  Processing  │───>│  Review   │───>│  Form    │ │
│  │  Service  │    │  Pipeline    │    │  Queue    │    │  Builder │ │
│  └──────────┘    └──────────────┘    └───────────┘    └──────────┘ │
│       │                │                   │               │       │
│       v                v                   v               v       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Storage Layer                             │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌───────────────────┐  │   │
│  │  │ Blob Storage│  │  SQL Database │  │  JSON Sidecars    │  │   │
│  │  │ (originals) │  │  (metadata,  │  │  (extracted data) │  │   │
│  │  │             │  │   index)     │  │                   │  │   │
│  │  └─────────────┘  └──────────────┘  └───────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

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

## Storage Architecture

### Two-Store Approach: Blob + SQL (with JSONB)

**Why this combination:**
- **Blob storage** (Azure Blob / S3 via interface): Stores original uploaded files and generated PDFs. Cheap, scalable, handles large files well.
- **PostgreSQL with JSONB** (Drizzle ORM): Stores everything else — metadata, relationships, processing state, AND extracted data. JSONB columns handle the varying extraction schemas per document type natively, with full indexing and querying support. No consistency gaps, no extra network calls, one transaction boundary.

**Per-case blob layout:**
```
/{law_firm_id}/{client_id}/{case_id}/
  originals/
    {document_id}.pdf
    {document_id}.csv
  generated/
    form-122a-1.pdf             # generated petition forms
    schedule-i.pdf
```

**Note on blob paths:** Paths are immutable once written. If a client is transferred between firms (rare but happens in legal practice), a path migration utility must copy blobs to new paths and update `documents.blob_path` in SQL. Never rely on parsing blob paths to determine hierarchy — use SQL for that.

**Why JSONB in PostgreSQL instead of JSON sidecar files?**
- **No consistency gap.** Extraction data and metadata live in the same transaction — no split-brain state between SQL and blob storage.
- **Queryable.** You can index and query into JSONB natively: `WHERE extracted_data->>'employer_name' = 'Acme Corp'` or `SUM((extracted_data->>'gross_pay')::numeric)`.
- **Simpler architecture.** Two stores (blob + SQL) instead of three (blob + SQL + sidecar files). Less to operate, less to break.
- **Versioning built in.** Each `extraction_results` row is immutable — corrections create a new row with `extraction_method = 'human_entry'`. Full audit trail without file versioning complexity.

**Why not put original files in the DB too?**
- PDFs and scanned images are large (1-50MB). PostgreSQL can store them as `bytea` but it bloats the DB, slows backups, and isn't what relational DBs are optimized for. Blob storage is purpose-built for this.

**Why not NoSQL (MongoDB/CosmosDB) instead?**
- Would add a third data store for the extraction JSON while still needing SQL for relational data (cases, users, tenants, review queues). More infrastructure complexity for no real benefit — PostgreSQL JSONB gives us the flexible-schema capability of a document store inside the relational DB we already need.

### ORM: Drizzle

All database access goes through **Drizzle ORM**. Drizzle is TypeScript-native, SQL-first, and supports both SQLite (local dev) and PostgreSQL (production) with the same schema definitions.

**Schema is the source of truth.** The Drizzle schema files define every table. `drizzle-kit push` syncs the DB on each deploy. Since there is no production data yet, we can wipe and reseed on deploy — no migration scripts needed until we have real users.

```typescript
// Example: extraction_results with JSONB
export const extractionResults = pgTable('extraction_results', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentId: uuid('document_id').references(() => documents.id).notNull(),
  extractionMethod: text('extraction_method').notNull(), // 'rule_engine' | 'ai_parse' | 'human_entry'
  confidenceScore: real('confidence_score'),
  extractedData: jsonb('extracted_data'),                // full extraction — varies by doc type
  status: text('status').notNull().default('pending'),
  version: integer('version').notNull().default(1),      // optimistic locking
  reviewedBy: uuid('reviewed_by').references(() => users.id),
  reviewedAt: timestamp('reviewed_at'),
  reviewNotes: text('review_notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

### Storage Interface

All storage access goes through an interface so the blob provider can be swapped:

```typescript
interface IBlobStorage {
  /** Upload a file, returns the stored path */
  upload(path: string, data: Buffer, contentType: string): Promise<string>;
  download(path: string): Promise<Buffer>;
  delete(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  /** Paginated file listing — cursor is opaque, null for first page */
  listFiles(prefix: string, cursor: string | null, limit: number): Promise<{files: string[], nextCursor: string | null}>;
  /** Generate a short-lived signed URL (max 15 min for financial docs) */
  getSignedUrl(path: string, expiresInSeconds: number): Promise<string>;
}

// Implementations:
// - AzureBlobStorage (default)
// - S3BlobStorage
// - LocalFileStorage (dev/testing)
```

**Signed URL policy:** Financial documents must use short-lived URLs — 15 minutes max. The UI fetches a fresh signed URL when the user opens a document viewer.

## Processing Pipeline

### Pipeline Flow Diagram

```
                    ┌─────────────┐
                    │   Client    │
                    │  Uploads    │
                    │  Files      │
                    └──────┬──────┘
                           │
                           v
              ┌────────────────────────┐
              │   1. INTAKE            │
              │   - Validate file type │
              │   - Generate doc ID    │
              │   - Store original     │
              │   - Create DB record   │
              │   - Assign to batch    │
              └────────────┬───────────┘
                           │
                           v
              ┌────────────────────────┐
              │   3. SPLIT (if needed) │  ← not yet built; each upload
              │   - Multi-doc PDFs     │    treated as one document
              └────────────┬───────────┘
                           │
                           v  POST /extract
              ┌────────────────────────────────────────────────────┐
              │  Python Extractor Service  (extractor/)             │
              │                                                      │
              │  Text extraction  ──► Tier 1 OCR (if scanned)      │
              │       │                                              │
              │       ▼                                              │
              │  2. CLASSIFY  rule engine → AI fallback             │
              │       │                                              │
              │       ▼                                              │
              │  4. EXTRACT   rule engine → AI fallback             │
              │       │                                              │
              │       ▼  (if confidence < 0.65)                     │
              │  Tier 2 OCR  Azure Document Intelligence            │
              │  Re-run classify + extract on better text           │
              │                                                      │
              │  Returns ExtractionResult JSON                       │
              └────────────────────────┬───────────────────────────┘
                           │
                  ┌────────┴────────┐
                  │  Confidence     │
                  │  >= 0.85?       │
                  ├── YES ──┐       ├── NO ──────────┐
                  │         v       │                 v
                  │  Auto-accept    │      ┌──────────────────┐
                  │  Write JSONB    │      │  7. HUMAN REVIEW │
                  │  to DB          │      │  - Show extracted│
                  │                 │      │    data + source │
                  └────────┬────────┘      │  - Edit fields   │
                           │               │  - Re-upload     │
                           │               │  - Accept/reject │
                           │               └────────┬─────────┘
                           │                        │
                           └──────────┬─────────────┘
                                      │
                                      v
                         ┌─────────────────────┐
                         │  6. VALIDATE        │
                         │  - Cross-doc checks │
                         │  - Date coverage    │
                         │  - Internal         │
                         │    consistency      │
                         │  - Duplicate detect │
                         └─────────┬───────────┘
                                   │
                                   v
                        ┌──────────────────────┐
                        │  8. FORM MAPPING     │
                        │  - Aggregate data    │
                        │  - Calculate CMI     │
                        │  - Run means test    │
                        │  - Populate forms    │
                        │    (122A, Sched I)   │
                        └──────────────────────┘
```

### Stage Details

#### Stage 1: Intake

Handles file upload via drag-and-drop or file picker (single or multiple files). Creates a batch ID so the client can track progress of a multi-file upload.

**Validations:**
- File type whitelist: `.pdf`, `.csv`, `.xlsx`, `.txt` (payroll exports)
- Max file size: 50MB per file
- Max batch size: 100 files
- Virus/malware scan (via interface — ClamAV or cloud-based)

**Actions:**
- Generate unique document ID (UUID)
- Compute file hash (SHA-256) for duplicate detection
- Check for exact duplicate (same hash within the case) — reject if found
- Store original to blob storage: `/{firm_id}/{client_id}/{case_id}/originals/{doc_id}.{ext}`
- Create `documents` row with `processing_status = 'uploaded'`
- Enqueue for classification

#### Stage 2: Classify

Identifies what type of document was uploaded. Handled by the Python extractor service. See [extraction.md — Classification](extraction.md#step-3-classification) for full pattern lists and threshold details.

**Tier 1 — Rule engine** (confidence ≥ 0.85 → done immediately):
- Pattern matching against extracted text with two scan windows: title (first 2,000 chars) and content (first 20,000 chars)
- Covers all doc classes including image-based ID documents (driver's license, SSN card) via Tesseract OCR output

**Tier 2 — AI classification** (if rule confidence < 0.85):
- First 2,000 characters sent to Claude with a list of known doc classes
- If AI confidence ≥ 0.70 → use AI result
- Both tiers below threshold → `unclassified`, flagged for human review

#### Stage 3: Split

Many clients will upload a single PDF containing multiple documents (e.g., 6 months of paystubs in one file). Uses the `IDocumentSplitter` interface.

**Detection approach:**
- Look for repeating header patterns (same employer header every N pages)
- Date discontinuities (pay period end date jumps)
- Page layout changes
- For low-confidence splits, AI (Claude vision) analyzes page boundaries

**Output:** Creates child document records with `parent_document_id` pointing to the original upload. Each child has `page_range_start` and `page_range_end` indicating which pages of the parent it came from. Children are processed independently from Stage 4 onward.

**If splitting fails or is uncertain:** Process the entire document as a single unit and flag for human review. Better to extract imperfectly than to split incorrectly.

#### Stage 4: Extract

Handled by the Python extractor service. See [extraction.md — Step 4: Extraction](extraction.md#step-4-extraction) for schemas, confidence scoring, and behavioral rules.

**Rule engine first** — fast regex/heuristic extractors for paystubs, W-2s, and bank statements. If confidence ≥ 0.85, result is returned immediately.

**AI extraction fallback** — Claude (`claude-sonnet-4-20250514`) with a per-doc-class JSON template and explicit instructions (ISO dates, no fabrication, omit rather than null). Used when no rule extractor covers the doc class, or rule confidence is below threshold.

**Output envelope** (same for all doc classes):
```json
{
  "doc_class": "paystub",
  "classification_confidence": 0.92,
  "classification_method": "rule_engine",
  "extraction_method": "rule_engine",
  "confidence": 0.88,
  "data": { "employer_name": "Acme Corp", "gross_pay": 4500.00, ... },
  "field_confidences": { "employer_name": 0.95, "gross_pay": 0.90 },
  "warnings": []
}
```

#### Stage 5: AI Extraction

Folded into Stage 4 — the Python extractor runs rule extraction then AI extraction in the same pipeline step. There is no separate stage.

See [extraction.md](extraction.md) for the full extraction design including OCR tiers, classification patterns, rule extractors, AI prompting strategy, and all supported document schemas.

#### Stage 6: Validate

Cross-document and internal consistency checks run after extraction:

**Internal checks:**
- Gross pay - deductions = net pay (within rounding tolerance)
- YTD totals are cumulative and increasing over time
- Pay frequency matches gap between pay dates
- Bank statement beginning balance = prior statement ending balance

**Cross-document checks:**
- Sum of paystub net pay deposits ≈ bank statement deposits (flag if > 10% variance)
- W-2 gross ≈ sum of paystub gross for that year
- Income reported in questionnaire ≈ actual income from documents
- All creditors in questionnaire appear in financial statements

**Temporal coverage:**
- For means test: do we have 6 complete months of paystub coverage?
- For bank statements: do we have the required statement periods?
- Flag gaps with specific missing date ranges

**Duplicate detection:**
- Same employer + same pay period = duplicate
- Same bank + same statement period = duplicate
- Same file hash = exact duplicate

#### Stage 7: Human Review

**Review interface shows:**
- Original document (rendered PDF/image) side by side with extracted data
- Fields flagged low-confidence highlighted
- Validation warnings displayed
- Ability to:
  - Edit any extracted field
  - Accept extraction as-is
  - Reject and request client re-upload
  - Manually enter data if extraction failed entirely
  - Add notes

**Review tracking:**
- Who reviewed, when, what they changed
- Audit trail for compliance

#### Stage 8: Form Mapping

Once all documents are extracted and validated, aggregate the data into bankruptcy form fields. This is covered in detail in `/docs/bk-knowledge/means-test.md`.

**Key calculations:**
- **CMI (Current Monthly Income):** Average gross income over the 6 calendar months before filing
- **Means test (Form 122A-1):** CMI vs. state median income (using `reference_data` for the filing date)
- **Means test exemption (Form 122A-1Supp):** Check if debtor qualifies for exemption (non-consumer debts, qualifying veteran)
- **Detailed means test (Form 122A-2):** If above median, calculate allowable deductions using IRS standards from `reference_data`
- **Schedule I:** Current income at time of filing
- **Form 122C (Chapter 13):** Different calculation for Chapter 13 disposable income

#### Stage 9: Fraud & Inconsistency Analysis

After form mapping, run AI-powered fraud and inconsistency review using `IAIProvider.analyzeForFraud()`. This is the existing LegalEagle feature, now enhanced with extracted document data:

- Compare questionnaire answers against extracted financial data
- Flag lifestyle inconsistencies (high expenses vs. low reported income)
- Detect potential preferential transfers or hidden assets
- Generate a summary report for the attorney to review before filing

## Upload UX

### Client View

```
┌─────────────────────────────────────────────────────────────┐
│  Upload Documents                                            │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                                                         │ │
│  │          Drag and drop files here                       │ │
│  │              or click to browse                         │ │
│  │                                                         │ │
│  │     Accepted: PDF, CSV, payroll exports                 │ │
│  │                                                         │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  What we still need:                                         │
│  [!] 2 more months of paystubs (need Jan-Feb 2026)          │
│  [!] Bank statements for Chase account (...4521)             │
│  [✓] Tax returns — received                                 │
│  [✓] W-2s — received                                        │
│                                                              │
│  Recent uploads:                                             │
│  ┌──────────┬───────────────┬──────────────┬───────────┐    │
│  │ Type     │ Date Range    │ Filename     │ Status    │    │
│  ├──────────┼───────────────┼──────────────┼───────────┤    │
│  │ Paystub  │ Mar 1-15 2026 │ march_pay.pdf│ ✓ Done   │    │
│  │ Paystub  │ Feb 15-28     │ feb_pay2.pdf │ ✓ Done   │    │
│  │ Bank Stmt│ Mar 2026      │ chase_mar.pdf│ ⏳ 30s   │    │
│  │ Unknown  │ —             │ scan007.pdf  │ ⚠ Review │    │
│  └──────────┴───────────────┴──────────────┴───────────┘    │
│                                                              │
│  Processing: 2 of 5 complete │ 1 needs review               │
└─────────────────────────────────────────────────────────────┘
```

### Attorney/Paralegal Review View

```
┌─────────────────────────────────────────────────────────────┐
│  Client: John Doe │ Chapter 7 │ Filing: 2026-05-01          │
│                                                              │
│  Documents (12 uploaded, 10 processed, 2 need review)       │
│                                                              │
│  Filter: [All] [Needs Review] [Paystubs] [Bank Stmts]      │
│                                                              │
│  ┌──────────┬───────────────┬───────────────┬────────────┐  │
│  │ Type     │ Date Range    │ Confidence    │ Status     │  │
│  ├──────────┼───────────────┼───────────────┼────────────┤  │
│  │ Paystub  │ Mar 1-15 2026 │ 0.97          │ ✓ Auto    │  │
│  │ Paystub  │ Feb 15-28     │ 0.72          │ ⚠ Review  │  │
│  │ Bank Stmt│ Mar 2026      │ 0.95          │ ✓ AI      │  │
│  └──────────┴───────────────┴───────────────┴────────────┘  │
│                                                              │
│  Means Test Readiness:                                       │
│  Income coverage: 4 of 6 months ██████████░░░░░ 67%         │
│  Missing: Jan 2026, Feb 1-14 2026                            │
│                                                              │
│  Validation Warnings:                                        │
│  ⚠ Feb paystub net pay ($2,100) doesn't match bank          │
│    deposit ($2,250) — $150 difference                        │
│  ⚠ Questionnaire lists income as $55k but paystubs          │
│    show ~$62k annualized                                     │
└─────────────────────────────────────────────────────────────┘
```

## Key Interfaces

All external dependencies accessed through interfaces:

```typescript
// Storage
interface IBlobStorage { /* see above */ }

// AI Provider
interface IAIProvider {
  classify(content: Buffer, contentType: string): Promise<ClassificationResult>;
  extract(content: Buffer, docClass: string, schema: object): Promise<ExtractionResult>;
  analyzeForFraud(caseData: CaseData): Promise<FraudAnalysis>;
}

// OCR — primary path for PDFs, not a fallback
interface IOCRProvider {
  extractText(content: Buffer, contentType: string): Promise<OCRResult>;
  extractTextWithLayout(content: Buffer): Promise<LayoutOCRResult>;
}

// Document Parser (one per format)
interface IDocumentParser {
  canParse(doc: DocumentRecord, content: Buffer): boolean;
  parse(doc: DocumentRecord, content: Buffer): Promise<ExtractionResult>;
}

// Document Splitter (Stage 3)
interface IDocumentSplitter {
  needsSplit(doc: DocumentRecord, content: Buffer): Promise<boolean>;
  split(doc: DocumentRecord, content: Buffer): Promise<SplitResult>;
}

interface SplitResult {
  segments: Array<{
    pageRangeStart: number;
    pageRangeEnd: number;
    suggestedClass: DocumentClass | null;
    confidence: number;
  }>;
}

// Virus Scanner
interface IVirusScanner {
  scan(content: Buffer, filename: string): Promise<ScanResult>;
}

// Queue (for async processing)
interface IJobQueue {
  enqueue(job: Job): Promise<string>;
  getJobStatus(jobId: string): Promise<JobStatus>;
  retryJob(jobId: string): Promise<void>;
  cancelJob(jobId: string): Promise<void>;
  process(handler: (job: Job) => Promise<void>): void;
}

// Notifications
interface INotificationService {
  notify(userId: string, notification: Notification): Promise<void>;
  getUnread(userId: string): Promise<Notification[]>;
  markRead(notificationId: string): Promise<void>;
}
```

## Async Processing & Progress

Documents are processed asynchronously via a job queue. The client sees real-time progress:

**Polling endpoint:** `GET /api/clients/{id}/documents/status`
```json
{
  "batch_id": "abc-123",
  "total": 5,
  "completed": 2,
  "processing": 1,
  "needs_review": 1,
  "failed": 0,
  "queued": 1,
  "documents": [
    {
      "id": "doc-1",
      "original_filename": "march_pay.pdf",
      "doc_class": "paystub",
      "date_range": {"start": "2026-03-01", "end": "2026-03-15"},
      "processing_status": "extracted",
      "confidence": 0.97
    }
  ]
}
```

Optionally upgrade to WebSocket/SSE for real-time updates later. Polling is fine for v1.

## Technology Choices

| Concern | v1 Choice | Interface | Swap Options |
|---------|-----------|-----------|-------------|
| Blob storage | Azure Blob Storage | `IBlobStorage` | S3, GCS, local FS |
| Database | SQLite (dev) / PostgreSQL (prod) via **Drizzle ORM** | Drizzle schema | Any SQL DB Drizzle supports |
| Extracted data | PostgreSQL JSONB (in `extraction_results`) | Drizzle `jsonb()` column | — |
| AI provider | Claude (Anthropic) | `IAIProvider` | OpenAI, Gemini |
| OCR | Claude vision (primary), pdf.js text layer (fast path for text-native PDFs) | `IOCRProvider` | Azure Doc Intelligence, AWS Textract, Tesseract |
| Doc splitting | Claude vision for boundary detection | `IDocumentSplitter` | Custom heuristic engine |
| Job queue | BullMQ + Redis | `IJobQueue` | SQS, Azure Queue, in-memory |
| Virus scan | ClamAV | `IVirusScanner` | Azure/AWS scanning |
| Notifications | In-app polling (v1), email (v2) | `INotificationService` | SendGrid, Azure Comm Services |
| Key management | Azure Key Vault | `IKeyVault` | AWS KMS, HashiCorp Vault |

**OCR strategy note:** Most paystubs are employer-generated PDFs with inconsistent or missing text layers. Claude vision is the primary OCR path. pdf.js text extraction is only used as a fast path when the PDF has a reliable text layer (detected by checking if extracted text is coherent and complete). Do not rely on pdf.js as the default.

## Security

### Encryption at Rest
- **SQL database:** Field-level encryption for SSN, account numbers, and other PII. Use AES-256 with per-tenant keys managed in **Azure Key Vault**. Each tenant gets a key reference stored in `law_firms.encryption_key_id`. Non-sensitive metadata (filenames, timestamps, statuses) stored in plain text for queryability.
- **Blob storage:** Azure Storage Service Encryption (SSE) enabled at the storage account level, plus **customer-managed keys (CMK)** per tenant via Azure Key Vault for defense-in-depth.
- **JSONB extraction data:** Stored in PostgreSQL, protected by database-level encryption and field-level encryption for PII. Do not embed raw SSNs or full account numbers in JSONB — use masked values (last 4 digits) with a reference to the encrypted SQL field for full values.
- **Key management:** Azure Key Vault is the single source of truth for encryption keys. Keys are never stored in application config or environment variables. Key rotation is supported — re-encryption runs as a background job when keys are rotated.

### Access Control
- **Tenant isolation:** All SQL queries must include `law_firm_id` in WHERE clauses. Middleware enforces this — no query can cross tenant boundaries.
- **Role-based access:**
  - `client` — can only see/upload for their own case(s). Cannot see review notes, confidence scores, or fraud analysis. Authenticates against `clients` table (separate from staff).
  - `paralegal` — can see clients assigned to them. Can process documents, review extractions, request re-uploads.
  - `attorney` — can see all clients in the firm. Can sign off on petitions, set means test parameters, review fraud analysis.
  - `admin` — full firm access including user management, settings, and reference data.
- **Blob access:** Never expose blob paths directly. All document access goes through signed URLs generated server-side after permission check. Signed URLs expire in 15 minutes max.
- **Upload authentication:** All uploads gated behind authenticated sessions. Client uploads require a valid client session tied to a specific case. Staff uploads require a valid staff session with access to the case.

### Audit Trail
All data access and modifications are logged to the `audit_log` table. This includes document uploads, extraction reviews, field edits, case status changes, and user logins. Audit logs are append-only and cannot be modified or deleted by any user role.

## Error Handling & Recovery

### Retry Policy
- **Automatic retries:** Failed pipeline stages retry up to 3 times with exponential backoff (5s, 30s, 5min).
- **Retry tracking:** `documents.retry_count` and `documents.last_error` track failure state.
- **Manual re-trigger:** Attorneys/admins can manually re-trigger processing for any failed document via the review UI.
- **Batch re-processing:** If extraction logic improves, admins can re-run the pipeline on all documents for a case (creates new extraction_results, preserves old ones for comparison).

### Failure Modes
| Stage | Failure | Recovery |
|-------|---------|----------|
| Intake | Virus detected | Reject upload, notify user with explanation |
| Intake | File too large | Reject with size limit message |
| Classify | AI provider timeout | Retry with backoff, fall back to "unclassified" |
| Split | Can't detect boundaries | Process as single document, flag for review |
| Extract | OCR fails | Retry, then flag for human data entry |
| Extract | AI provider rate limit | Queue with delay, retry |
| Validate | Cross-doc mismatch | Not a failure — create validation_result warning |
| Any stage | Unknown error | Log full error, set status=failed, alert admin |

### Partial Batch Failure
If some documents in a batch fail while others succeed, the UI shows per-document status with actionable messages:
- "This file couldn't be read — try re-scanning at higher resolution"
- "Processing is taking longer than usual — we'll notify you when it's done"
- "We need a human to review this document — your attorney has been notified"

## Notification System

Notifications are triggered at key pipeline events:

| Event | Who Gets Notified | Channel |
|-------|-------------------|---------|
| Documents need review | Attorney + paralegals on case | In-app (v1), email (v2) |
| All documents processed | Uploading user | In-app |
| Validation warnings found | Attorney on case | In-app |
| Document coverage gap identified | Client (if uploading) + paralegal | In-app |
| Case ready to file (all docs extracted + validated) | Attorney | In-app + email |
| Extraction failed after retries | Admin | In-app |

## IRS / Census Reference Data

The means test depends on external reference data that updates periodically:

### Data Sources
| Data | Source | Update Frequency | Format |
|------|--------|-----------------|--------|
| State median income | US Trustee Program | ~2x/year (Apr, Nov) | Published tables |
| IRS National Standards | IRS | Annual (March) | PDF tables |
| IRS Local Standards (housing) | IRS | Annual, by county | CSV/PDF |
| IRS Local Standards (transport) | IRS | Annual, by MSA/region | CSV/PDF |
| Health care allowances | IRS | Annual | PDF tables |

### Storage & Versioning
Reference data is stored in the `reference_data` table with `effective_date` and `expiration_date` columns. Multiple versions coexist — the system uses the version effective on the debtor's filing date, not the current date. This ensures historical cases remain accurate even after data updates.

### Update Process
1. Admin receives notification that new reference data is available (manual check for v1, automated scraping for v2)
2. Admin uploads new reference data via admin UI
3. System validates format and stores with new effective date
4. Previous version gets `expiration_date` set
5. All active cases recalculate means test results with appropriate version

## Document Replacement Flow

When a client re-uploads a better version of a document:

1. Client or paralegal selects "Replace" on an existing document
2. New file is uploaded and linked via `replaces_document_id` (nullable FK on `documents`)
3. Old document's `processing_status` set to `replaced`
4. Old extraction results preserved for audit trail
5. New document goes through the full pipeline
6. Validation re-runs for the entire case to catch any changes

## Joint Filing / Spouse Support

For joint filings (`cases.is_joint_filing = true`):

- Each document is tagged with `belongs_to` (debtor or spouse)
- The means test Form 122A-1 Column B requires non-filing spouse income even in non-joint filings if the debtor is married
- The upload checklist prompts for spouse documents when applicable
- Extraction schemas include spouse-specific fields where needed
- CMI calculation aggregates both debtor and spouse income per means test rules

## Household Size & Jurisdiction

The means test median income comparison depends on household size, which is interpreted differently across judicial districts:

- **IRS dependent test:** Count based on who you could claim as dependents
- **Census Bureau definition:** People living in the same housing unit
- **Economic unit test:** People who share income and expenses

The `cases` table stores `household_size` as an integer. The attorney sets this based on their district's interpretation. The system should display the relevant district's approach as guidance but let the attorney override.

## Backup & Disaster Recovery

### SQL Database
- **PostgreSQL (prod):** Daily automated backups with point-in-time recovery via WAL archiving to a separate storage account.
- **Retention:** 30-day rolling backups for active data. 7-year archive for closed cases (legal retention requirements).
- **Testing:** Monthly backup restore test to a staging environment to verify recoverability.

### Blob Storage
- **Soft delete:** Enabled with 14-day retention — protects against accidental deletion.
- **Versioning:** Azure Blob versioning enabled — every overwrite creates a new version.
- **Geo-replication:** RA-GRS (Read-Access Geo-Redundant Storage) for cross-region replication.

### Audit Logs
- Backed up separately to **immutable storage** (Azure Immutable Blob Storage with time-based retention). Once written, audit logs cannot be modified or deleted even by admins.

### Recovery Targets
- **RPO (Recovery Point Objective):** < 1 hour — maximum acceptable data loss.
- **RTO (Recovery Time Objective):** < 4 hours — maximum acceptable downtime.
- These targets reflect that this is a legal application handling active cases where data loss could affect court filings.

## Database Strategy

### Drizzle ORM (source of truth)
All database access goes through Drizzle ORM. The Drizzle schema files are the single source of truth for the database structure. No raw SQL queries, no `better-sqlite3` calls.

### Dev vs Prod
- **Local dev:** SQLite via Drizzle. Fast, no setup. Limited to single-user testing.
- **Production:** PostgreSQL via Drizzle. Required for concurrent access, JSONB indexing, and partial indexes.

### Schema Sync
Since there is no production data yet, **wipe and reseed on every deploy** using `drizzle-kit push`. No migration scripts needed until we have real users. Seed data includes:
- Reference data (IRS standards, median income thresholds)
- Test law firm, users, and sample client for demo purposes

### Key SQLite ↔ PostgreSQL Differences (Drizzle handles most of these)
- `jsonb()` → TEXT in SQLite, native JSONB in PostgreSQL
- `uuid()` → TEXT in SQLite, native UUID in PostgreSQL
- `timestamp()` → TEXT in SQLite, TIMESTAMPTZ in PostgreSQL
- Partial indexes (`WHERE deleted_at IS NULL`) → PostgreSQL only, skipped in SQLite

### When to Stop Wiping
Once any real client data exists, switch to `drizzle-kit generate` + `drizzle-kit migrate` for proper migration files. This should happen before any pilot/beta deployment.

## Remaining Open Questions

1. **Document retention policy:** How long do we keep originals after the case is discharged/closed? (Legal retention requirements may vary by state.)
2. **Chapter 13 specifics:** Form 122C and the repayment plan builder need a separate design doc once Chapter 7 is solid.
3. **Client self-service portal:** How much of the review/correction flow should be exposed to clients vs. kept internal to the firm?
