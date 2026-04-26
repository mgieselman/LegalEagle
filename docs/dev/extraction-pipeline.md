# Extraction Pipeline — Step-by-Step Reference

> For the extraction service architecture, Quick Reference, and Service API see [extraction.md](extraction.md).  
> For cost tiers, cost history, and the evaluation script see [extraction-config.md](extraction-config.md).  
> For per-doc-class field schemas see [extraction-requirements.md](extraction-requirements.md).

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
