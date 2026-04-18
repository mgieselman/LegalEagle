"""
Phase 7a — Gold sample correctness tests.
Runs the full extraction pipeline against labeled documents.
Asserts each expected field is within tolerance.

Tolerance:
  - Numeric fields: ±5% relative
  - String fields: exact match (case-sensitive)
  - Date fields: normalized to YYYY-MM-DD before comparison

Run: pytest tests/test_gold_samples.py -v
     pytest tests/test_gold_samples.py -v --azure-compare   (A/B vs Azure DI)

AI-dependent samples (W-2, 1040, mortgage, idDocument) are skipped unless ANTHROPIC_API_KEY is set.
"""
from __future__ import annotations

import json
import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from main import app
from rule_extractors.utils import normalize_date

# Shared-secret middleware requires the header; conftest.py sets the env var.
client = TestClient(app, headers={"X-Extractor-Secret": "test-shared-secret"})



# ---- Corpus paths -----------------------------------------------------------

PRIVATE_CORPUS = Path(
    "/Users/matt/Library/CloudStorage/OneDrive-GieselmanSoftware/Documents/Legal"
)
PUBLIC_CORPUS = Path(
    "/Users/matt/Library/CloudStorage/OneDrive-GieselmanSoftware"
    "/LegalEagle/Extraction/corpus/public"
)
EXTRACTION_DIR = Path("/Users/matt/src/LegalEagle/Extraction")


def _resolve_path(filename: str) -> Path:
    """Resolve a gold sample filename to its absolute path.

    Gold samples with 'corpus/public/' prefix live on OneDrive in the public
    corpus directory. All others are in the private corpus (also OneDrive).
    """
    if filename.startswith("corpus/public/"):
        return PUBLIC_CORPUS / filename[len("corpus/public/"):]
    if filename.startswith("corpus/"):
        return EXTRACTION_DIR / filename
    return PRIVATE_CORPUS / filename

GOLD_SAMPLES_PATH = EXTRACTION_DIR / "config" / "gold_samples.json"

HAS_API_KEY = bool(os.environ.get("ANTHROPIC_API_KEY"))

# ---- Load gold samples -------------------------------------------------------

with open(GOLD_SAMPLES_PATH) as _f:
    _ALL_SAMPLES = json.load(_f)["samples"]


# Classes that require AI (rule extractor returns low confidence or None)
_AI_REQUIRED_TYPES = {"tax.us.w2", "tax.us.1040", "mortgage.us", "idDocument", "social_security_card"}

# Samples where the doc type has a rule extractor but the specific document needs
# AI fallback for classification or complete extraction (edge case formatting, etc.)
_AI_FALLBACK_FILES = {
    "corpus/public/Paystub CA DIR Piece-Rate.pdf",
    "corpus/public/Bank Statement Carson Bank.pdf",
    "corpus/public/Bank Statement RBC.pdf",
}


def _needs_ai(sample: dict) -> bool:
    return sample["document_type"] in _AI_REQUIRED_TYPES or sample["file"] in _AI_FALLBACK_FILES

# ---- Date comparison helper -------------------------------------------------

# Date field names across all doc types
_DATE_FIELDS = {
    "pay_date", "pay_period_start", "pay_period_end",
    "statement_period_start", "statement_period_end",
    "effective_date", "letter_date", "filing_date",
}

# Name fields compared case-insensitively (W-2s store names in all caps)
_CASE_INSENSITIVE_FIELDS = {
    "employee_name", "employer_name", "account_holder_name",
    "plaintiff_name", "defendant_name", "recipient_name",
}


def _normalize_expected(field: str, value: object) -> object:
    """Normalize expected value so it can be compared to extractor output."""
    if field in _DATE_FIELDS and isinstance(value, str):
        return normalize_date(value) or value
    return value


# ---- Per-sample test logic --------------------------------------------------

def _run_sample(sample: dict) -> None:
    """Run extraction for one gold sample and assert expected fields."""
    file_path = _resolve_path(sample["file"])
    doc_type = sample["document_type"]
    expected = sample["expected"]

    if not file_path.exists():
        pytest.skip(f"Corpus file not found: {file_path}")

    # Determine MIME type
    _MIME_MAP = {
        ".pdf": "application/pdf",
        ".jpeg": "image/jpeg",
        ".jpg": "image/jpeg",
        ".png": "image/png",
        ".tiff": "image/tiff",
        ".tif": "image/tiff",
        ".webp": "image/webp",
    }
    mime = _MIME_MAP.get(file_path.suffix.lower(), "text/plain")

    with open(file_path, "rb") as f:
        response = client.post(
            "/extract",
            files={"file": (file_path.name, f, mime)},
        )

    assert response.status_code == 200, f"HTTP {response.status_code}: {response.text}"
    body = response.json()
    data = body["data"]

    # Verify classification
    assert body["doc_class"] != "unclassified", (
        f"Expected doc_class '{doc_type}', got 'unclassified'"
    )

    # Verify each expected field
    failures: list[str] = []
    for field, raw_expected in expected.items():
        norm_expected = _normalize_expected(field, raw_expected)
        actual = data.get(field)

        if actual is None:
            failures.append(f"  MISSING: {field!r} (expected {norm_expected!r})")
            continue

        if isinstance(norm_expected, float | int) and not isinstance(norm_expected, bool):
            # Numeric: ±5% relative tolerance
            if abs(float(actual) - float(norm_expected)) > abs(float(norm_expected)) * 0.05:
                failures.append(
                    f"  NUMERIC MISMATCH: {field!r}: expected {norm_expected}, got {actual} "
                    f"(delta {abs(float(actual) - float(norm_expected)):.2f})"
                )
        elif field in _CASE_INSENSITIVE_FIELDS:
            # Name fields: case-insensitive (W-2s store names in all caps)
            if str(actual).lower() != str(norm_expected).lower():
                failures.append(
                    f"  NAME MISMATCH: {field!r}: expected {norm_expected!r}, got {actual!r}"
                )
        else:
            # Other strings / dates / bools: exact match
            if str(actual) != str(norm_expected):
                failures.append(
                    f"  STRING MISMATCH: {field!r}: expected {norm_expected!r}, got {actual!r}"
                )

    if failures:
        details = "\n".join(failures)
        pytest.fail(
            f"Gold sample '{sample['file']}' field mismatches:\n{details}\n"
            f"Full extracted data: {json.dumps(data, indent=2)}"
        )


# ---- Parametrized tests per sample ------------------------------------------

def _sample_id(sample: dict) -> str:
    return Path(sample["file"]).name.replace(" ", "_").replace(".pdf", "")


# Rule-engine samples (no API key required)
_RULE_SAMPLES = [s for s in _ALL_SAMPLES if not _needs_ai(s)]
# AI-dependent samples
_AI_SAMPLES = [s for s in _ALL_SAMPLES if _needs_ai(s)]


@pytest.mark.parametrize("sample", _RULE_SAMPLES, ids=[_sample_id(s) for s in _RULE_SAMPLES])
def test_gold_sample_rule(sample: dict) -> None:
    """Gold sample extracted by rule engine — no API key needed."""
    _run_sample(sample)


@pytest.mark.skipif(not HAS_API_KEY, reason="ANTHROPIC_API_KEY not set — skipping AI-dependent gold samples")
@pytest.mark.parametrize("sample", _AI_SAMPLES, ids=[_sample_id(s) for s in _AI_SAMPLES])
def test_gold_sample_ai(sample: dict) -> None:
    """Gold sample requiring AI extraction (W-2 text-layer, tax return, mortgage, idDocument)."""
    _run_sample(sample)


# ---- Azure DI A/B comparison (opt-in via --azure-compare) -------------------

def _run_azure_compare(sample: dict) -> None:
    """Run both CURRENT_CONFIG and AZURE_EVAL_CONFIG on a gold sample,
    report which is closer to ground truth."""
    import asyncio
    from classifier import classify_by_rules, RULE_CONFIDENCE_THRESHOLD
    from ocr import TesseractOcrProvider, get_tier1, is_scanned
    from providers import (
        CURRENT_CONFIG,
        run_classification_chain,
        run_extraction_chain,
    )
    from text_extraction import extract_pdf_content, extract_text as extract_text_fn

    try:
        from providers import _build_azure_eval_config
        azure_config = _build_azure_eval_config()
    except ImportError:
        pytest.skip("Azure DI SDK not installed")

    file_path = _resolve_path(sample["file"])
    if not file_path.exists():
        pytest.skip(f"Corpus file not found: {file_path}")

    expected = sample["expected"]
    content = file_path.read_bytes()
    mime = "application/pdf" if file_path.suffix.lower() == ".pdf" else "application/octet-stream"

    # Text extraction
    if mime == "application/pdf":
        text, form_fields = extract_pdf_content(content, doc_class=None)
        if is_scanned(text):
            tier1 = get_tier1()
            if tier1 is not None:
                if isinstance(tier1, TesseractOcrProvider):
                    ocr_text = tier1.extract_text_until(
                        content,
                        lambda c: classify_by_rules(c).confidence >= RULE_CONFIDENCE_THRESHOLD,
                    )
                else:
                    ocr_text = tier1.extract_text(content)
                if not is_scanned(ocr_text):
                    text = ocr_text
    else:
        from text_extraction import extract_image_text, IMAGE_MIME_TYPES
        ext = file_path.suffix.lower()
        mime_map = {".jpeg": "image/jpeg", ".jpg": "image/jpeg", ".png": "image/png"}
        actual_mime = mime_map.get(ext, mime)
        if actual_mime in IMAGE_MIME_TYPES:
            from text_extraction import extract_image_text
            text = extract_image_text(content)
        else:
            text = extract_text_fn(content, actual_mime, None)
        form_fields: dict[str, str] = {}

    # Classification (shared) — run_classification_chain is async
    async def _run_all():
        classification = await run_classification_chain(
            CURRENT_CONFIG.classifiers, text, filename=file_path.name,
        )
        if classification.doc_class == "unclassified":
            return None, None, None, None, classification

        current_chain = CURRENT_CONFIG.chain_for(classification.doc_class)
        current_result, current_provider = await run_extraction_chain(
            current_chain, classification.doc_class, text, content, form_fields,
        )
        azure_chain = azure_config.chain_for(classification.doc_class)
        azure_result, azure_provider = await run_extraction_chain(
            azure_chain, classification.doc_class, text, content, form_fields,
        )
        return current_result, current_provider, azure_result, azure_provider, classification

    current_result, current_provider, azure_result, azure_provider, classification = asyncio.run(_run_all())
    if classification.doc_class == "unclassified":
        pytest.skip("Document could not be classified")

    current_data = current_result.data if current_result else {}
    azure_data = azure_result.data if azure_result else {}

    # Score: count expected fields matched by each
    current_hits = 0
    azure_hits = 0
    for field, raw_expected in expected.items():
        norm_expected = _normalize_expected(field, raw_expected)
        for label, data, hits_ref in [
            ("current", current_data, "current"),
            ("azure", azure_data, "azure"),
        ]:
            actual = data.get(field)
            if actual is None:
                continue
            matched = False
            if isinstance(norm_expected, (float, int)) and not isinstance(norm_expected, bool):
                matched = abs(float(actual) - float(norm_expected)) <= abs(float(norm_expected)) * 0.05
            elif field in _CASE_INSENSITIVE_FIELDS:
                matched = str(actual).lower() == str(norm_expected).lower()
            else:
                matched = str(actual) == str(norm_expected)
            if matched:
                if label == "current":
                    current_hits += 1
                else:
                    azure_hits += 1

    total = len(expected)
    print(
        f"\n  {sample['file']}: "
        f"current={current_provider} ({current_hits}/{total}), "
        f"azure={azure_provider} ({azure_hits}/{total})"
    )


@pytest.mark.parametrize("sample", _ALL_SAMPLES, ids=[_sample_id(s) for s in _ALL_SAMPLES])
def test_gold_sample_azure_compare(sample: dict, request: pytest.FixtureRequest) -> None:
    """A/B comparison: current config vs Azure DI config per gold sample."""
    if not request.config.getoption("--azure-compare"):
        pytest.skip("--azure-compare not passed")
    if sample["document_type"] in _AI_REQUIRED_TYPES and not HAS_API_KEY:
        pytest.skip("ANTHROPIC_API_KEY not set")
    _run_azure_compare(sample)
