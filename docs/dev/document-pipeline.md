# Document Processing Pipeline

> For extraction architecture detail see [extraction.md](extraction.md). For per-doc-class field schemas see [extraction-requirements.md](extraction-requirements.md).

## Quick Reference

- **Purpose:** Full document lifecycle — upload, classify, extract, validate, review, map to forms
- **Implementation status:** See table below (partial — async queue, form mapping, and fraud analysis not yet built)
- **Extraction chain:** Rule extractor → Azure DI prebuilt → Claude AI (cost-ascending fallback)
- **Confidence threshold for stopping chain:** 0.85
- **Key server files:** [server/src/routes/documents.ts](../../server/src/routes/documents.ts), [server/src/services/validation.ts](../../server/src/services/validation.ts)
- **Key extractor files:** `extractor/classifier.py`, `extractor/rule_extractors/`, `extractor/ai_extractor.py`

> **Phase-2 split planned:** This document covers architecture, lifecycle, data model, and API contract in one file. Candidate for splitting into `document-pipeline-architecture.md`, `document-pipeline-lifecycle.md`, and `document-pipeline-api.md` when it grows further.

---

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

## Data Model, Storage & Infrastructure

Database schema, blob storage architecture, security (encryption, access control, audit trail), IRS reference data versioning, backup & DR, joint filing, household size rules, and database strategy are documented in the companion reference:

→ **[document-pipeline-reference.md](document-pipeline-reference.md)**

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

Once all documents are extracted and validated, aggregate the data into bankruptcy form fields. This is covered in detail in `/docs/domain/means-test.md`.

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

> **Security** (encryption, access control, audit trail): see [document-pipeline-reference.md](document-pipeline-reference.md#security).

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

> **IRS reference data, document replacement flow, joint filing, household size, backup & DR, and database strategy**: see [document-pipeline-reference.md](document-pipeline-reference.md).

## Remaining Open Questions

1. **Document retention policy:** How long do we keep originals after the case is discharged/closed? (Legal retention requirements may vary by state.)
2. **Chapter 13 specifics:** Form 122C and the repayment plan builder need a separate design doc once Chapter 7 is solid.
3. **Client self-service portal:** How much of the review/correction flow should be exposed to clients vs. kept internal to the firm?
