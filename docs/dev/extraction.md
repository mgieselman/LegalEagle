# Document Extraction

> For the broader document lifecycle (upload → validate → review → form mapping) see [document-pipeline.md](document-pipeline.md). For per-doc-class field schemas see [extraction-requirements.md](extraction-requirements.md).

## Quick Reference

- **Purpose:** Classification and field extraction from uploaded documents
- **Service:** Standalone Python FastAPI at `extractor/` — called via HTTP from Node.js server
- **Chain order:** Rule extractor → Azure DI prebuilt → Claude AI (stops when confidence ≥ 0.85)
- **Classification chain:** Rule engine (0.80–0.95 conf) → filename boost (+0.10) → Claude AI
- **Classification threshold to skip AI:** 0.85 (rule or filename-boosted confidence)
- **Claude classification threshold:** 0.70 (below = "unclassified", no extraction runs)
- **OCR path:** pdftext/markitdown for native PDFs; Tesseract (lazy) or Marker for scanned PDFs
- **Key files:** `extractor/main.py`, `extractor/classifier.py`, `extractor/ai_extractor.py`, `extractor/ocr.py`

> **Split complete:** Detailed pipeline steps are in [extraction-pipeline.md](extraction-pipeline.md). Cost tiers, cost history, and evaluation script are in [extraction-config.md](extraction-config.md).

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

> **Cost tiers, extraction cost history, and evaluation script:** see [extraction-config.md](extraction-config.md).



> **Step-by-step pipeline mechanics** (Steps 1–5 with full diagrams, schemas, confidence scoring): see [extraction-pipeline.md](extraction-pipeline.md).
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


> **Evaluation script:** see [extraction-config.md](extraction-config.md#evaluation-script).