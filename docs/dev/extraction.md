# Document Extraction

How LegalEagle classifies uploaded documents and extracts structured fields from them.
For the broader document lifecycle (upload → validate → review → form mapping) see [document-pipeline.md](document-pipeline.md).

---

## Architecture

Extraction runs in a **standalone Python FastAPI service** (`extractor/`) that is called by the Node.js server via HTTP. Keeping it separate lets us use Python's superior PDF and ML ecosystem without polluting the TypeScript codebase.

```
Node.js server                     Python extractor service
──────────────                     ────────────────────────
documents route  ──POST /extract──> main.py
pipeline.ts      <──ExtractionResult── classify → rule-extract → AI-extract
```

The Node.js side (`server/src/services/pythonExtractor.ts`) is a thin HTTP client that forwards the raw file bytes and receives a typed `ExtractionResult`. All classification and field extraction logic lives in Python.

---

## Pipeline

Each document goes through up to five steps. Steps 2 and 5 are conditional — most documents never trigger OCR.

```
                        ┌──────────────────┐
                        │  POST /extract   │
                        │  (file, mime,    │
                        │   doc_class?)    │
                        └────────┬─────────┘
                                 │
               ┌─────────────────┼─────────────────┐
               │                 │                  │
          PDF? │          Image? │           Other? │
               ▼                 ▼                  ▼
   ┌───────────────────┐ ┌─────────────┐  ┌──────────────────┐
   │ STEP 1: TEXT EXTR │ │ Tesseract   │  │ UTF-8 / openpyxl │
   │                   │ │ multi-region│  │ decode           │
   │ w2/tax_return?    │ │ OCR         │  └────────┬─────────┘
   │  Y→ markitdown    │ └──────┬──────┘           │
   │  N→ pdftext       │        │                  │
   │                   │        │                  │
   │ w2? also pypdf    │        │                  │
   │ form fields       │        │                  │
   └────────┬──────────┘        │                  │
            │                   │                  │
            ▼                   │                  │
   ┌──────────────────┐         │                  │
   │ text < 50 chars? │         │                  │
   │ (is_scanned)     │         │                  │
   └──┬───────────┬───┘         │                  │
      │Y          │N            │                  │
      ▼           │             │                  │
┌───────────────┐ │             │                  │
│ STEP 2:       │ │             │                  │
│ TIER 1 OCR    │ │             │                  │
│               │ │             │                  │
│ Marker avail? │ │             │                  │
│  Y→ Marker    │ │             │                  │
│  N→ Tesseract │ │             │                  │
│    (lazy page │ │             │                  │
│    generator, │ │             │                  │
│    stops when │ │             │                  │
│    rules≥0.85)│ │             │                  │
│               │ │             │                  │
│ Result ≥ 50   │ │             │                  │
│  chars?       │ │             │                  │
│  Y→ use it    │ │             │                  │
│  N→ keep orig │ │             │                  │
└───────┬───────┘ │             │                  │
        │         │             │                  │
        └────┬────┘             │                  │
             │◄─────────────────┘──────────────────┘
             │
             │  text (+ form_fields if W-2)
             ▼
    ┌──────────────────────────────────────────────────┐
    │ STEP 3: CLASSIFY                                 │
    │                                                  │
    │ doc_class provided by caller?                    │
    │  Y→ conf=1.0, done ─────────────────────────┐    │
    │  N→ run classification chain:                │    │
    │                                              │    │
    │  3a. Rule engine (patterns vs text)          │    │
    │      title window (first 2000 chars)         │    │
    │      + content window (full text)            │    │
    │      highest match → conf 0.80–0.95          │    │
    │           │                                  │    │
    │      conf ≥ 0.85? ──Y→ DONE ────────────┐   │    │
    │           │N                             │   │    │
    │           ▼                              │   │    │
    │  3b. Filename boost                      │   │    │
    │      conf > 0 AND filename matches       │   │    │
    │      same doc class? → +0.10 (cap 0.85)  │   │    │
    │           │                              │   │    │
    │      conf ≥ 0.85? ──Y→ DONE ────────┐   │   │    │
    │           │N                         │   │   │    │
    │           ▼                          │   │   │    │
    │  3c. Claude AI (first 2000 chars)    │   │   │    │
    │      Claude conf ≥ 0.70?             │   │   │    │
    │       Y→ use Claude result ──────┐   │   │   │    │
    │       N→ "unclassified" ─────┐   │   │   │   │    │
    │                              │   │   │   │   │    │
    └──────────────────────────────┼───┼───┼───┼───┼────┘
                                   │   │   │   │   │
             ┌─────────────────────┘   │   │   │   │
             ▼                         ▼   ▼   ▼   ▼
    ┌────────────────┐        ┌──────────────────────┐
    │ "unclassified" │        │ classified doc_class  │
    │  conf=0.0 →    │        │                      │
    │  RETURN (no    │        │ "other" → RETURN     │
    │  extraction)   │        │ (no extraction)      │
    └────────────────┘        └──────────┬───────────┘
                                         │
                                         ▼
    ┌──────────────────────────────────────────────────┐
    │ STEP 4: EXTRACT                                  │
    │                                                  │
    │ 4a. Rule extractor for this doc class?           │
    │     Y→ run rule extractor                        │
    │        conf ≥ 0.85? ──Y→ DONE ───────────────┐   │
    │                        N→ fall through        │   │
    │     N→ fall through                           │   │
    │           │                                   │   │
    │           ▼                                   │   │
    │ 4b. Azure DI prebuilt model for this class?  │   │
    │     (+ env vars configured)                   │   │
    │     Y→ run Azure DI prebuilt extraction       │   │
    │        conf ≥ 0.85? ──Y→ DONE ───────────┐   │   │
    │                        N→ fall through    │   │   │
    │     N→ fall through                       │   │   │
    │           │                               │   │   │
    │           ▼                               │   │   │
    │ 4c. Claude AI extraction                  │   │   │
    │     (full text + JSON schema template)    │   │   │
    │     Validate vs Pydantic schema           │   │   │
    │     → ExtractionResult ──────────────┐    │   │   │
    │                                      │    │   │   │
    └──────────────────────────────────────┼────┼───┼───┘
                                                │   │
                                                ▼   ▼
                                      ┌──────────────────┐
                                      │ ExtractionResult  │
                                      │ (conf, data, etc) │
                                      └────────┬─────────┘
                                               │
                                               ▼
    ┌──────────────────────────────────────────────────┐
    │ STEP 5: AZURE DI FALLBACK — needs_azure_fallback │
    │                                                  │
    │ ALL of these must be true:                       │
    │  • extraction conf < 0.65                        │
    │  • doc_class ≠ "other"                           │
    │  • NOT (unclassified AND class_conf == 0.0)      │
    │  • Azure env vars configured (get_tier2)         │
    │                                                  │
    │        N→ skip, return result as-is ─────────┐    │
    │        Y↓                                    │    │
    │                                              │    │
    │  Azure DI prebuilt-layout OCR on raw file    │    │
    │  → azure_text                                │    │
    │                                              │    │
    │  azure_text ≥ 50 chars?                      │    │
    │   N→ skip, return original ──────────────┐   │    │
    │   Y→ re-run Steps 3–4 on azure_text      │   │    │
    │      → azure_result                      │   │    │
    │                                          │   │    │
    │  _better_result(original, azure_result)  │   │    │
    │  (higher conf + more fields wins)        │   │    │
    │                                          │   │    │
    └──────────────────────────────────────────┼───┼────┘
                                               │   │
                                               ▼   ▼
                                      ┌──────────────────┐
                                      │ RETURN result     │
                                      │ (annotate OCR     │
                                      │  provider if used)│
                                      └──────────────────┘
```

### Threshold reference

All thresholds are centralized in `extractor/config.py`:

| Constant | Value | Controls |
|---|---|---|
| `SCANNED_THRESHOLD_CHARS` | 50 | PDF text < this → Tier 1 OCR |
| `RULE_CONFIDENCE_THRESHOLD` | 0.85 | Classification rule confidence to skip AI |
| `AI_CONFIDENCE_THRESHOLD` | 0.70 | Claude classification confidence to accept |
| `OPT_OUT_CONFIDENCE` | 0.60 | (Reserved — classification opt-out floor) |
| `EXTRACTION_CHAIN_THRESHOLD` | 0.85 | Rule extraction confidence to skip Claude |
| `AZURE_FALLBACK_CONFIDENCE_THRESHOLD` | 0.65 | Extraction confidence below this → Azure DI |

### Cost tiers

The pipeline is ordered to minimize cost. Each tier is only invoked when the cheaper tiers fail:

| Tier | Cost | When it runs |
|---|---|---|
| Text extraction (pdftext/markitdown) | Free, ~10 ms | Always |
| Rule classification + extraction | Free, ~1 ms | Always |
| Filename boost | Free, ~0 ms | Rule conf > 0 but < 0.85 |
| Tier 1 OCR (Marker/Tesseract) | Free, ~0.5–3 s | Scanned PDFs (< 50 chars extracted) |
| Claude AI classification | ~$0.003/doc | Rule + filename < 0.85 |
| Azure DI prebuilt extraction | ~$0.01/page | Rule conf < 0.85, prebuilt model exists for doc class |
| Claude AI extraction | ~$0.01–0.03/doc | No rule extractor or Azure DI model, or both < 0.85 |
| Azure DI Tier 2 OCR (layout) | ~$0.01/page | Extraction conf < 0.65 — last resort |

### Extraction cost problems

Sorted by total AI cost (from eval run 2026-04-12, 149 files, $1.21 Claude extraction spend). The run used the old chain (rule → Claude) without Azure DI extraction enabled.

**All five prioritized fixes below are now implemented.** The default chain is Rule → Azure DI → Claude, with rule extractors covering paystubs, W-2s, bank statements, 1040 tax returns, investment statements (IRA/brokerage/401k/pension), and mortgages. Azure DI fills in for doc classes with prebuilt models but no rule extractor (creditCard, idDocument, social_security_card).

| # | Doc class | Files | Claude cost | Has Azure DI model? | Impact of enabling Azure DI |
|---|---|---|---|---|---|
| 1 | `bankStatement.us.checking` | 8 of 50 | $0.36 | Yes (`prebuilt-bankStatement.us`) | 8 files → Azure DI at ~$0.01/pg instead of Claude at ~$0.04/doc. Also add E\*Trade patterns to rule extractor to eliminate Azure DI calls too. |
| 2 | `tax.us.1040` | 2 of 2 | $0.20 | Yes (`prebuilt-tax.us.1040`) | Azure DI ~$0.30/doc (30 pgs) vs Claude ~$0.10/doc — **Azure DI is more expensive here.** Add rule extractor instead for $0. |
| 3 | `bankStatement.us.savings` | 15 of 40 | $0.13 | Yes (`prebuilt-bankStatement.us`) | 15 files → Azure DI at ~$0.01/pg. Also add E\*Trade patterns to rule extractor. |
| 4 | `ira_statement` | 6 of 6 | $0.13 | No (orphan) | No Azure DI model. Add rule extractor. |
| 5 | `brokerage_statement` | 6 of 6 | $0.12 | No (orphan) | No Azure DI model. Add rule extractor. |
| 6 | `mortgage.us` | 6 of 6 | $0.08 | No (no statement model) | Azure DI has mortgage *application* models (1003/1008) but no monthly statement model. Add rule extractor. |
| 7 | `idDocument` | 4 of 4 | $0.05 | Yes (`prebuilt-idDocument`) | 4 files → Azure DI at ~$0.01/doc. Eliminates Claude entirely for DLs. |
| 8 | `legal_document` | 3 of 3 | $0.04 | No (orphan) | No Azure DI model. Low priority — low volume, heterogeneous formats. |
| 9 | `vehicle_title` | 2 of 2 | $0.02 | No (orphan) | No Azure DI model. Low priority — low volume. |
| 10 | `401k_statement` | 2 of 2 | $0.02 | No (orphan) | No Azure DI model. Add rule extractor (could share with IRA/pension). |

**Fix priority (all implemented):**

1. ~~**Wire Azure DI into default config**~~ ✅ — `_build_current_config()` now uses Rule → Azure DI → Claude for all chains.
2. ~~**E\*Trade bank statement patterns**~~ ✅ (#1 + #3) — $0.48 → $0.00. Added E\*Trade patterns (dash dates, credits/debits labels, sidebar account numbers) to `bank_statement.py`.
3. ~~**1040 tax return rule extractor**~~ ✅ (#2) — $0.20 → $0.00. New `tax_return.py` using IRS line number patterns.
4. ~~**Investment statement rule extractors**~~ ✅ (#4 + #5 + #10) — $0.27 → $0.00. New `investment.py` for E\*Trade, Fidelity, and Fidelity NetBenefits formats.
5. ~~**Mortgage rule extractor**~~ ✅ (#6) — $0.08 → $0.00. New `mortgage.py` for Cenlar HELOC and Freedom Mortgage statements.

---

## Step 1: Text Extraction

`extractor/text_extraction.py`

### PDFs

Two backends are used depending on document class:

| Backend | Used for | Why |
|---|---|---|
| **pdftext** (`mineru_txt`) | Paystubs, bank statements, most PDFs | Fast (8–162 ms), 1.000 accuracy on tabular layouts |
| **markitdown** | W-2s, tax returns | Preserves IRS table layout and PDF form field positions |

The `doc_class` hint (if provided by the caller) routes markitdown for `w2` and `tax_return`; everything else uses pdftext.

W-2s also get a second pass with **pypdf** to extract PDF Widget annotation form fields (Box 1 wages, Box 2 federal tax, etc.), which live in the form field layer rather than the text layer. The rule extractor receives both the text and the form field dict.

### Images (JPEG, PNG, TIFF, WEBP)

Images have no text layer. They go straight to **Tesseract OCR** with a multi-region strategy:

1. **Full image** — best for driver's licenses and clean cards.
2. **Middle horizontal band (35–65% height)** — catches SSN card text that the decorative security background obscures in full-image scans.

Both regions are run independently; results are combined and passed to the classifier. The combined output gives the classifier more pattern coverage without over-weighting noise from either region alone.

### Other formats

| MIME type | Extraction |
|---|---|
| `text/csv`, `text/plain` | Decoded as UTF-8 |
| `.xlsx` | openpyxl — all cell values joined per row |
| Everything else | UTF-8 decode best-effort |

---

## Step 2: Tier 1 OCR (scanned PDFs)

`extractor/ocr.py`

If text extraction returns fewer than 50 characters, the PDF is treated as a scanned image with no text layer. Tier 1 OCR is attempted:

**MarkerOcrProvider** (required)
- Uses surya deep-learning models (~2 GB, downloaded to `~/.cache/huggingface` on first use)
- High accuracy on complex layouts
- Install: `pip install "legaleagle-extractor[ocr-local]"`

**TesseractOcrProvider** (fallback)
- Always available — no model download
- Extracts embedded XObject images from each PDF page, then applies the same multi-region OCR strategy used for image uploads
- Pages are yielded lazily via a generator; `extract_text_until()` stops OCR after the first page that produces a confident classification — avoids processing all pages of a multi-page scanned PDF
- Sufficient for clean card/form scans; lower accuracy on dense multi-column layouts

`get_tier1()` returns Marker if available, otherwise Tesseract, otherwise `None`.

---

## Step 3: Classification

`extractor/classifier.py`

### Tier 1 — Rule engine

Pattern matching against extracted text. Two scan windows:

| Window | Size | Purpose |
|---|---|---|
| **Title window** | First 2,000 chars | Patterns that appear in document headers but also appear deep in boilerplate of other doc types (e.g., `Form 1099`, `Rollover IRA`, `Investment Report`, savings account type labels) |
| **Content window** | Full document text | Patterns safe to match anywhere in the document |

Each pattern carries a confidence score (0.80–0.95). The highest-scoring class wins. If that score is ≥ 0.85, classification is done; otherwise the filename boost and AI tiers run.

Patterns are in two lists: `_TITLE_PATTERNS` (title window only) and `_CONTENT_PATTERNS` (full text). Keeping boilerplate-prone patterns in the title window prevents checking account disclosures (which mention "savings account" in fee-waiver text) from misfiring as `bankStatement.us.savings`.

### Tier 1.5 — Filename boost

If rule confidence is > 0 but < 0.85, the document's filename is checked against `_FILENAME_PATTERNS`. If a filename keyword (e.g., "Securities", "Title", "Pension") matches the same doc class that the content rules found, confidence is boosted by 0.10 (capped at 0.85). This avoids an AI call when the content and filename agree.

The filename never overrides the content-based doc class and never classifies on its own — it only confirms what the content rules already found.

### Tier 2 — Claude classification

If confidence is still < 0.85 after the filename boost, the first 2,000 characters are sent to **Claude** (`claude-sonnet-4-20250514` via the Anthropic API) with a prompt asking for one of the known doc classes and a confidence score. If Claude returns confidence ≥ 0.70, that result is used. Below that threshold, the document is marked `unclassified`.

This is a direct Anthropic API call — not Azure Document Intelligence. Azure DI is only used in Step 5 for OCR re-processing, never for classification.

### Doc class naming convention

Doc class names mirror the Azure Document Intelligence prebuilt model name with the `prebuilt-` prefix removed. This makes the mapping to Azure DI unambiguous and avoids maintaining a separate translation table.

Example: Azure's `prebuilt-payStub.us` → our class `payStub.us`.

For `bankStatement.us` Azure uses a single model for both account types. We append `.checking` or `.savings` as a sub-type suffix, which the Azure DI provider strips before calling the model.

### Supported doc classes

| Class | Azure DI model | Document |
|---|---|---|
| `payStub.us` | `prebuilt-payStub.us` | Pay stub / earnings statement |
| `tax.us.w2` | `prebuilt-tax.us.w2` | IRS Form W-2 |
| `tax.us.1040` | `prebuilt-tax.us.1040` | Federal income tax return (Form 1040) |
| `tax.us.1099` | `prebuilt-tax.us.1099*` | IRS Form 1099 (any variant) |
| `bankStatement.us.checking` | `prebuilt-bankStatement.us` | Checking account statement |
| `bankStatement.us.savings` | `prebuilt-bankStatement.us` | Savings account statement |
| `creditCard` | `prebuilt-creditCard` | Credit card statement |
| `mortgage.us` | `prebuilt-mortgage.us.*` | Mortgage / HELOC statement |
| `idDocument` | `prebuilt-idDocument` | Driver's license or state ID card (image/scan) |
| `ira_statement` | — (orphan) | IRA statement (Roth, Traditional, Rollover, SEP) |
| `401k_statement` | — (orphan) | 401(k) or 403(b) retirement plan statement |
| `retirement_account` | — (orphan) | Pension or other retirement account (e.g., BofA pension via Fidelity) |
| `social_security_letter` | — (orphan) | SSA award letter or COLA notice |
| `legal_document` | — (orphan) | Summons, complaint, judgment, garnishment, foreclosure |
| `social_security_card` | — (orphan) | Social Security card (image/scan) |
| `brokerage_statement` | — (orphan) | Non-retirement brokerage / securities account statement |
| `vehicle_title` | — (orphan) | Vehicle certificate of title (OCR/scanned PDFs) |
| `unclassified` | — | Could not be classified |

Orphans have no corresponding Azure DI prebuilt model; they always use the rule engine or AI extractor.

---

## Step 4: Extraction

Extraction runs a three-tier chain: **Rule engine → Azure DI → Claude**. Each tier is tried in order; the first to return confidence ≥ 0.85 wins.

### Tier 1 — Rule extraction

`extractor/rule_extractors/`

Fast regex/heuristic extractors for the three highest-volume doc types:

| Extractor | Doc class | Approach |
|---|---|---|
| `paystub.py` | `payStub.us` | Regex patterns for labeled pay fields; handles multiple pay stub formats |
| `w2.py` | `tax.us.w2` | Reads PDF form field dict first (boxes 1–17); falls back to text patterns |
| `bank_statement.py` | `bankStatement.us.checking`, `bankStatement.us.savings` | Patterns for balance lines, period headers, institution names; handles Chase, Wells Fargo, E\*Trade/Morgan Stanley formats |
| `tax_return.py` | `tax.us.1040` | IRS line number patterns (lines 11, 15, 24, 33, 34, 37) for AGI, taxable income, total tax, refund |
| `investment.py` | `ira_statement`, `brokerage_statement`, `401k_statement`, `retirement_account` | Format-specific extraction for E\*Trade, Fidelity, and Fidelity NetBenefits statements |
| `mortgage.py` | `mortgage.us` | Statement patterns for Cenlar HELOC and Freedom Mortgage; extracts balance, loan type, interest rate, escrow |

If rule extraction returns confidence ≥ 0.85, the result is returned immediately. Azure DI and Claude are skipped.

### Tier 2 — Azure DI prebuilt extraction

`extractor/azure_extractor.py`

Used when no rule extractor covers the doc class or rule confidence < 0.85, **and** an Azure DI prebuilt model exists for the doc class. Calls the Azure DI API with raw document bytes and maps the structured response fields to our Pydantic schemas.

Supported doc classes (from `_PREBUILT_MODELS`):

| Doc class | Azure DI model |
|---|---|
| `payStub.us` | `prebuilt-payStub.us` |
| `tax.us.w2` | `prebuilt-tax.us.w2` |
| `tax.us.1040` | `prebuilt-tax.us.1040` |
| `tax.us.1099` | `prebuilt-tax.us.1099Combo` |
| `bankStatement.us.checking` / `.savings` | `prebuilt-bankStatement.us` |
| `idDocument` | `prebuilt-idDocument` |
| `social_security_card` | `prebuilt-idDocument` |

If Azure DI returns confidence ≥ 0.85, the result is returned. Claude is skipped.

If Azure DI env vars are not configured, Tier 2 is silently skipped and the chain falls through to Claude.

### Tier 3 — Claude extraction

`extractor/ai_extractor.py`

Last resort — used when neither rule extraction nor Azure DI produced confidence ≥ 0.85. Uses **Claude** (`claude-sonnet-4-20250514` via the Anthropic API).

Sends a structured prompt to Claude containing:
- The extracted document text (full, not truncated)
- The doc class
- A JSON template showing every field to extract with empty values
- Explicit instructions: ISO 8601 dates, numeric amounts without symbols, omit rather than fabricate

The response is parsed as JSON and validated against the Pydantic schema for the doc class. Validation failures reduce the confidence score but do not discard partial data.

### Extraction schemas

`extractor/schemas.py`

Every doc class has a Pydantic model. The `ExtractionResult` envelope is the same for all:

```python
class ExtractionResult(BaseModel):
    doc_class: str
    classification_confidence: float
    classification_method: str          # "rule_engine" | "ai"
    extraction_method: str              # "rule_engine" | "ai_parse" | "unclassified"
    confidence: float                   # overall, 0.0–1.0
    data: dict[str, Any]               # fields — shape varies by doc_class
    field_confidences: dict[str, float] # per-field scores
    warnings: list[str]
```

**Output rules (enforced across all extractors):**
- Numeric fields: plain `number`, no currency symbols or commas
- Date fields: ISO 8601 `YYYY-MM-DD`; month-only → first of month
- Omit unknown fields entirely — never emit `null`, `0`, or `""` for missing data
- Never fabricate values not present in the document
- Never store full SSNs or full account numbers — last 4 digits only

### Confidence scoring

| Range | Meaning |
|---|---|
| 0.95–1.0 | Field read directly from a clearly labeled position |
| 0.80–0.94 | Pattern match with minor ambiguity |
| 0.70–0.79 | Value inferred from context |
| 0.50–0.69 | Present but ambiguous; multiple candidates |
| < 0.50 | Guess — likely wrong |

---

## Step 5: Tier 2 OCR (Azure Document Intelligence)

`extractor/ocr.py` — `AzureDocumentIntelligenceProvider`

Triggered when `result.confidence < 0.65` and the document isn't genuinely unclassifiable (i.e., the classifier returned some signal). Azure DI is used **only for OCR** (converting scanned images to text) — it does not classify or extract fields. The better text is fed back into Steps 3–4 (rule engine + Claude).

Uses the `prebuilt-layout` model, which returns layout-aware OCR text rather than pre-mapped field extractions. This feeds directly back into the classify → extract pipeline without any schema mapping step.

The result with the higher score (original vs. Azure-re-processed) is returned. If Azure produces the better result, `ocr_provider: azure_document_intelligence` is prepended to the warnings list.

**Configuration:**
```
AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT=https://<region>.api.cognitive.microsoft.com/
AZURE_DOCUMENT_INTELLIGENCE_KEY=<key>
```

**Install:** `pip install "legaleagle-extractor[ocr-azure]"`

If neither env var is set, the provider is not instantiated and Tier 2 is silently skipped.

---

## Service API

`extractor/main.py`

```
POST /extract
  file:      multipart file (PDF, JPEG, PNG, XLSX, CSV, TXT)
  doc_class: optional string — skips AI classification when provided

GET  /health
  Returns: { status, ocr_tier1_available, ocr_tier2_available }
```

`POST /extract` returns an `ExtractionResult` JSON object. The Node.js client (`server/src/services/pythonExtractor.ts`) calls this endpoint and maps the response into the TypeScript `ExtractionResult` type before writing to the database.

---

## Running the service

```bash
cd extractor
pip install -e .                              # core deps
pip install -e ".[ocr-local]"                # + Marker (optional)
pip install -e ".[ocr-azure]"                # + Azure DI (optional)

uvicorn main:app --port 8001
```

Tests:
```bash
cd extractor
pytest
python scripts/test_extract.py <file_or_dir> --rules-only
```

---

## Evaluation script

`extractor/scripts/eval.py`

Runs the extraction pipeline on files and produces a detailed markdown performance report with per-component timing, confidence scores, Claude token usage / cost, and ADI cost breakdowns. All artifacts are written to an output directory organized like Azure Blob Storage.

### Usage

```bash
cd extractor
python scripts/eval.py <input> [options]
```

**Arguments:**

| Argument | Description |
|---|---|
| `input` | File path, directory, or glob pattern (e.g. `"docs/*.pdf"`) |
| `--runtype TYPE` | `classifier` or `classifier+extraction` (default: `classifier+extraction`) |
| `--parallel N` | Max concurrent files (default: 1) |
| `--output DIR` | Output directory (default: `eval_<timestamp>/`) |
| `--limit N` | Max files to process |

### Run types

| Run type | What it does |
|---|---|
| `classifier` | Text extraction + classification only. No field extraction. Shows which classification tier fired (rules, rules+filename boost, rules+Claude AI). |
| `classifier+extraction` | Full pipeline: text extraction → Tier 1 OCR (if scanned) → classify → extract. Reports on both classification and extraction providers. |

### Examples

All commands assume you're in the `extractor/` directory and using the local venv:

```bash
cd extractor
LEGAL=~/Library/CloudStorage/OneDrive-GieselmanSoftware/Documents/Legal

# Classify a single file (no extraction, no AI extraction cost)
.venv/bin/python scripts/eval.py "$LEGAL/Paystub 01092026.pdf" --runtype classifier

# Full pipeline on the whole Legal directory, 10 files at a time
.venv/bin/python scripts/eval.py "$LEGAL" --runtype classifier+extraction --parallel 10

# Glob pattern — all paystubs
.venv/bin/python scripts/eval.py "$LEGAL/Paystub*.pdf" --runtype classifier+extraction --parallel 5

# All BofA statements, custom output directory
.venv/bin/python scripts/eval.py "$LEGAL/BofA*.pdf" --parallel 5 --output eval_bofa/

# Quick classification test on 3 files
.venv/bin/python scripts/eval.py "$LEGAL" --runtype classifier --limit 3

# Everything, limit to 20 files
.venv/bin/python scripts/eval.py "$LEGAL" --runtype classifier+extraction --parallel 10 --limit 20
```

### Output structure

The `--output` directory is self-contained and portable. The `report.md` uses relative links to artifact files.

```
eval_20260411_201532/
  report.md                                    # full markdown report
  documents/
    001_Chase_Checking_Jan2025/
      extracted_text.txt                       # full text from text extraction step
      classification.json                      # doc_class, confidence, method, path
      extraction.json                          # data, field_confidences, warnings
    002_ADP_Paystub_2025-03-15/
      extracted_text.txt
      classification.json
      extraction.json
    ...
```

### Report contents

The markdown report includes:

- **Summary** — overall stats, latency percentiles (p50/p95/p99), classification breakdown (rules / rules+filename / rules+Claude / unclassified), extraction breakdown by provider, cost summary (Claude tokens + USD, ADI pages + USD), doc class distribution
- **Per-file details** — step-by-step timing table with tokens/cost columns, classification path narrative, abbreviated input text with link to full text, extracted fields with per-field confidence
