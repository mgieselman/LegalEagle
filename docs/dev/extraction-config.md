# Extraction Service — Configuration & Cost Reference

> For the extraction service architecture see [extraction.md](extraction.md).  
> For step-by-step pipeline mechanics see [extraction-pipeline.md](extraction-pipeline.md).  
> Threshold constants: `extractor/config.py`

---

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
