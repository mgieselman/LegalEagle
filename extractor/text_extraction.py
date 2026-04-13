"""
Text extraction from document files.

Routing strategy (from Extraction/README.md benchmark findings):
  - pdftext (mineru_txt backend): paystubs, bank statements — 1.000 accuracy, 8-162ms
  - markitdown: W-2s and tax returns — 1.000 accuracy, preserves form fields and IRS table layout

For an unknown doc_class, pdftext is used as the default. The caller can pass
a doc_class hint to route markitdown where it matters.

pypdf is used for PDF form field (Widget annotation) extraction, needed for W-2s
when processed by rule extractors (which expect the form field dict directly).
"""
from __future__ import annotations

import io

import pdftext.extraction as pdftext_lib
import pypdf

# Doc classes that need markitdown's table/form-field rendering
_MARKITDOWN_CLASSES = {"tax.us.w2", "tax.us.1040"}


def extract_pdf_text(content: bytes, doc_class: str | None = None) -> str:
    """Extract plain text from a PDF buffer.

    Uses markitdown for W-2s and tax returns (preserves form fields and IRS
    label+value table layout). Uses pdftext for everything else (faster, 1.000
    accuracy on paystubs and bank statements).
    """
    if doc_class in _MARKITDOWN_CLASSES:
        return _extract_with_markitdown(content)
    return _extract_with_pdftext(content)


def extract_pdf_form_fields(content: bytes) -> dict[str, str]:
    """Extract PDF Widget annotation form fields from a PDF buffer.

    Used by the W-2 rule extractor which expects the box values (Box 1 wages,
    Box 2 federal tax, etc.) stored as form field annotations, not text layer.
    Returns a dict of field_name → value strings (empty values excluded).
    """
    reader = pypdf.PdfReader(io.BytesIO(content))
    fields = reader.get_fields() or {}
    result: dict[str, str] = {}
    for name, field in fields.items():
        value = field.get("/V") if isinstance(field, dict) else getattr(field, "value", None)
        if value is not None and str(value).strip():
            result[name] = str(value).strip()
    return result


def extract_pdf_content(content: bytes, doc_class: str | None = None) -> tuple[str, dict[str, str]]:
    """Extract both text and form fields from a PDF in one call.

    Returns (text, form_fields). Form fields are only populated for W-2 PDFs
    that have Widget annotations; they are skipped for all other doc types to
    avoid unnecessary pypdf parsing.
    """
    text = extract_pdf_text(content, doc_class=doc_class)
    if doc_class == "tax.us.w2" or doc_class is None:
        form_fields = extract_pdf_form_fields(content)
    else:
        form_fields = {}
    return text, form_fields


IMAGE_MIME_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/tiff", "image/webp"}


def extract_image_text(content: bytes) -> str:
    """Extract text from an image (JPEG, PNG, MPO, etc.) using Tesseract OCR.

    Uses a multi-region strategy: runs OCR on both the full image (border-cropped)
    and a middle horizontal band.  Combining results improves classification accuracy
    on card images (DLs, SSN cards) where an embossed seal or decorative border
    makes single-pass OCR unreliable.
    """
    from PIL import Image, ImageEnhance
    import pytesseract

    image = Image.open(io.BytesIO(content))
    # MPO (iPhone multi-picture) and other exotic formats must be normalised first
    image = image.convert("RGB")

    w, h = image.size
    gray = image.convert("L")

    regions = [
        # Full image (border-cropped) — best for DLs and clean cards
        gray.crop((int(w * 0.10), int(h * 0.05), int(w * 0.90), int(h * 0.95))),
        # Middle horizontal band — catches "THIS NUMBER HAS BEEN ESTABLISHED FOR"
        # on SSN cards where an embossed seal obscures the header text
        gray.crop((int(w * 0.15), int(h * 0.35), int(w * 0.85), int(h * 0.65))),
    ]

    # Collect OCR text from each region; return the longest result since more
    # text gives the classifier more signal to work with.  (The classifier uses
    # max-score matching so extra noise from a region doesn't override a strong
    # hit from another region — but garbled noise can reduce per-pattern quality,
    # so we still prefer the cleanest region when possible.)
    region_texts: list[str] = []
    for region in regions:
        enhanced = ImageEnhance.Contrast(region).enhance(2.5)
        scaled = enhanced.resize((enhanced.width * 2, enhanced.height * 2))
        text = pytesseract.image_to_string(scaled, lang="eng", config="--psm 6")
        if text.strip():
            region_texts.append(text.strip())

    if not region_texts:
        return ""

    # Return the combined text — classifier takes max confidence across all
    # patterns so extra noise won't override a strong hit found in any region
    return "\n".join(region_texts)


def extract_text(content: bytes, mime_type: str, doc_class: str | None = None) -> str:
    """Extract plain text from any supported file format."""
    if mime_type == "application/pdf":
        return extract_pdf_text(content, doc_class=doc_class)

    if mime_type in IMAGE_MIME_TYPES:
        return extract_image_text(content)

    if mime_type in ("text/plain", "text/csv"):
        return content.decode("utf-8", errors="replace")

    if mime_type == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
        return _extract_xlsx(content)

    # Fallback: treat as UTF-8 text
    return content.decode("utf-8", errors="replace")


# ---- Internal helpers ------------------------------------------------------

def _extract_with_pdftext(content: bytes) -> str:
    """Fast text extraction via pdftext (pdfplumber's pdftext backend)."""
    result = pdftext_lib.plain_text_output(content, sort=True, hyphens=False)
    return result or ""


def _extract_with_markitdown(content: bytes) -> str:
    """Markdown extraction via markitdown — preserves tables and form fields."""
    from markitdown import MarkItDown
    markitdown = MarkItDown()
    result = markitdown.convert_stream(io.BytesIO(content), mime_type="application/pdf")
    return result.text_content or ""


def _extract_xlsx(content: bytes) -> str:
    """Extract text from an Excel workbook by joining all cell values."""
    import openpyxl
    wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    parts: list[str] = []
    for sheet in wb.worksheets:
        for row in sheet.iter_rows():
            row_parts = [str(cell.value) for cell in row if cell.value is not None]
            if row_parts:
                parts.append(" ".join(row_parts))
    return "\n".join(parts)
