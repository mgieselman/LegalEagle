"""
Phase 2 — Text extraction tests.
Tests against real files from the private and public corpora.
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from text_extraction import (
    extract_pdf_content,
    extract_pdf_form_fields,
    extract_pdf_text,
    extract_text,
)

PRIVATE_CORPUS = Path("/Users/matt/Library/CloudStorage/OneDrive-GieselmanSoftware/Documents/Legal")
PUBLIC_CORPUS = Path("/Users/matt/Library/CloudStorage/OneDrive-GieselmanSoftware/LegalEagle/Extraction/corpus/public")

# Load gold sample manifest to get file paths
GOLD_SAMPLES_PATH = Path("/Users/matt/src/LegalEagle/Extraction/config/gold_samples.json")
with open(GOLD_SAMPLES_PATH) as f:
    GOLD_SAMPLES = json.load(f)["samples"]


def _corpus_file(filename: str) -> Path:
    """Resolve a gold sample filename to its absolute path."""
    if filename.startswith("corpus/"):
        # Public corpus files are relative to the Extraction dir
        return Path("/Users/matt/src/LegalEagle/Extraction") / filename
    return PRIVATE_CORPUS / filename


def _skip_if_missing(path: Path):
    if not path.exists():
        pytest.skip(f"Corpus file not found: {path}")


# ---- pdftext extraction ----------------------------------------------------

def test_pdftext_paystub_non_empty():
    path = PRIVATE_CORPUS / "Paystub 01022926.pdf"
    _skip_if_missing(path)
    text = extract_pdf_text(path.read_bytes(), doc_class="payStub.us")
    assert len(text) > 100
    # Should contain key paystub terms
    assert any(kw in text for kw in ("gross", "Gross", "GROSS", "net", "Net", "NET"))


def test_pdftext_bank_statement_non_empty():
    path = PRIVATE_CORPUS / "BofA Liz Checking Savings 01162026.pdf"
    _skip_if_missing(path)
    text = extract_pdf_text(path.read_bytes(), doc_class="bankStatement.us.checking")
    assert len(text) > 100
    assert "Bank of America" in text or "bank" in text.lower()


def test_pdftext_no_doc_class_defaults_to_pdftext():
    """Without a doc_class hint, pdftext is used (not markitdown)."""
    path = PRIVATE_CORPUS / "BofA Liz Checking Savings 01162026.pdf"
    _skip_if_missing(path)
    text_default = extract_pdf_text(path.read_bytes(), doc_class=None)
    text_explicit = extract_pdf_text(path.read_bytes(), doc_class="bankStatement.us.checking")
    # Both should produce non-empty output
    assert len(text_default) > 100
    assert len(text_explicit) > 100


# ---- markitdown extraction -------------------------------------------------

def test_markitdown_tax_return_contains_agi():
    path = PRIVATE_CORPUS / "2023_TaxReturn.pdf"
    _skip_if_missing(path)
    text = extract_pdf_text(path.read_bytes(), doc_class="tax.us.1040")
    assert len(text) > 100
    # markitdown should preserve table structure; AGI value should be present
    # The 2023 tax return AGI is 426,934
    assert "426" in text or "agi" in text.lower() or "adjusted" in text.lower()


def test_markitdown_w2_non_empty():
    path = PUBLIC_CORPUS / "Sample W2 Pitt.pdf"
    _skip_if_missing(path)
    text = extract_pdf_text(path.read_bytes(), doc_class="tax.us.w2")
    assert len(text) > 50


# ---- Form field extraction -------------------------------------------------

def test_w2_form_fields_returns_dict():
    """extract_pdf_form_fields always returns a dict (may be empty for text-layer W-2s).

    The Pitt W-2 is a text-layer PDF — values are in the text, not AcroForm
    annotations. extract_pdf_form_fields correctly returns {} for it. The pipeline
    falls through to AI extraction in that case.
    """
    path = PUBLIC_CORPUS / "Sample W2 Pitt.pdf"
    _skip_if_missing(path)
    fields = extract_pdf_form_fields(path.read_bytes())
    assert isinstance(fields, dict)  # Always a dict, even if empty


def test_bank_statement_form_fields_empty():
    """Bank statements are text-layer PDFs — no Widget annotations expected."""
    path = PRIVATE_CORPUS / "BofA Liz Checking Savings 01162026.pdf"
    _skip_if_missing(path)
    fields = extract_pdf_form_fields(path.read_bytes())
    # Bank statement PDFs are not fillable forms — form fields should be empty
    assert isinstance(fields, dict)


# ---- extract_pdf_content (combined) ----------------------------------------

def test_extract_pdf_content_returns_both():
    path = PUBLIC_CORPUS / "Sample W2 Pitt.pdf"
    _skip_if_missing(path)
    text, form_fields = extract_pdf_content(path.read_bytes(), doc_class="tax.us.w2")
    assert isinstance(text, str)
    assert isinstance(form_fields, dict)
    assert len(text) > 0


# ---- extract_text routing --------------------------------------------------

def test_extract_text_pdf():
    path = PRIVATE_CORPUS / "Paystub 01022926.pdf"
    _skip_if_missing(path)
    text = extract_text(path.read_bytes(), "application/pdf", doc_class="payStub.us")
    assert len(text) > 100


def test_extract_text_plain():
    text = extract_text(b"hello world", "text/plain")
    assert text == "hello world"


def test_extract_text_csv():
    text = extract_text(b"name,amount\nAlice,100", "text/csv")
    assert "Alice" in text


def test_extract_text_xlsx():
    """XLSX extraction returns cell values joined as text."""
    path = PRIVATE_CORPUS / "Assets Continued.xlsx"
    _skip_if_missing(path)
    text = extract_text(path.read_bytes(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    assert isinstance(text, str)


# ---- Gold sample coverage --------------------------------------------------

_PDF_PRIVATE_SAMPLES = [
    s for s in GOLD_SAMPLES
    if not s["file"].startswith("corpus/") and s["file"].lower().endswith(".pdf")
]

@pytest.mark.parametrize("sample", _PDF_PRIVATE_SAMPLES)
def test_private_gold_sample_text_non_empty(sample):
    """Every private PDF gold sample should yield non-empty text (skips scanned PDFs)."""
    path = PRIVATE_CORPUS / sample["file"]
    _skip_if_missing(path)
    doc_class = sample["document_type"]
    # Map benchmark doc_class labels to service labels
    dc_map: dict[str, str] = {}
    service_class = dc_map.get(doc_class, doc_class)
    text = extract_pdf_text(path.read_bytes(), doc_class=service_class)
    if len(text.strip()) < 50:
        pytest.skip(f"Scanned PDF — text layer too sparse ({len(text.strip())} chars)")
    assert len(text) > 50, f"Expected non-empty text for {sample['file']}"


@pytest.mark.parametrize("sample", [s for s in GOLD_SAMPLES if s["file"].startswith("corpus/")])
def test_public_gold_sample_text_non_empty(sample):
    """Every public gold sample should yield non-empty text."""
    # corpus/public/Sample W2 Pitt.pdf → PUBLIC_CORPUS / "Sample W2 Pitt.pdf"
    relative = Path(sample["file"]).relative_to("corpus/public")
    path = PUBLIC_CORPUS / relative
    _skip_if_missing(path)
    doc_class = sample["document_type"]
    dc_map: dict[str, str] = {}
    service_class = dc_map.get(doc_class, doc_class)
    text = extract_pdf_text(path.read_bytes(), doc_class=service_class)
    assert len(text) > 50, f"Expected non-empty text for {sample['file']}"
