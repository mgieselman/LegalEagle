"""
LegalEagle Extraction Service
POST /extract — classify and extract structured data from a document file.

Pipeline
--------
1. Text extraction  — pdftext / markitdown for PDFs with a text layer
2. Tier 1 OCR       — Marker (local, free) when text layer is absent/sparse
3. Classify         — content rules → AI fallback
4. Extract          — rule engine → AI fallback
5. Tier 2 OCR/retry — Azure Document Intelligence when confidence is low or
                      extraction fails; re-runs steps 3–4 on the better text
"""
from __future__ import annotations

import asyncio
import logging
import time
import uuid

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from starlette.middleware.base import BaseHTTPMiddleware

from classifier import ClassificationResult, classify_by_rules
from config import MAX_UPLOAD_BYTES, RULE_CONFIDENCE_THRESHOLD
from ocr import (
    MarkerOcrProvider,
    TesseractOcrProvider,
    get_tier1,
    get_tier2,
    is_scanned,
    needs_azure_fallback,
)
from providers import PipelineConfig, get_pipeline_config, run_classification_chain, run_extraction_chain
from schemas import ExtractionResult
from text_extraction import IMAGE_MIME_TYPES, extract_image_text, extract_pdf_content, extract_text

logger = logging.getLogger(__name__)
app = FastAPI(title="LegalEagle Extractor", version="0.1.0")


# ---------------------------------------------------------------------------
# Correlation ID middleware
# ---------------------------------------------------------------------------

class CorrelationIdMiddleware(BaseHTTPMiddleware):
    """Attach a unique request ID and log request duration."""

    async def dispatch(self, request: Request, call_next):  # noqa: ANN001
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        request.state.request_id = request_id
        start = time.perf_counter()
        response = await call_next(request)
        elapsed_ms = (time.perf_counter() - start) * 1000
        response.headers["X-Request-ID"] = request_id
        logger.info(
            "[%s] %s %s — %.0fms (status %d)",
            request_id[:8],
            request.method,
            request.url.path,
            elapsed_ms,
            response.status_code,
        )
        return response


app.add_middleware(CorrelationIdMiddleware)


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "ocr_tier1_available": get_tier1() is not None,
        "ocr_tier2_available": get_tier2() is not None,
    }


# ---------------------------------------------------------------------------
# Core pipeline (reused for both initial and Azure-fallback runs)
# ---------------------------------------------------------------------------

async def _run_pipeline(
    text: str,
    form_fields: dict[str, str],
    doc_class_hint: str | None,
    filename: str | None = None,
    *,
    content: bytes,
    config: PipelineConfig,
) -> ExtractionResult:
    """
    Run classify → extract chain on already-extracted text.
    Called twice when Azure DI fallback is triggered (once on the original text,
    once on the Azure OCR text).
    """
    # --- Classification ---
    if doc_class_hint:
        classification = ClassificationResult(
            doc_class=doc_class_hint,
            confidence=1.0,
            method="rule_engine",
            reasoning="caller-provided",
        )
    else:
        classification = await run_classification_chain(config.classifiers, text, filename=filename)

    if classification.doc_class == "unclassified":
        return ExtractionResult(
            doc_class="unclassified",
            classification_confidence=classification.confidence,
            classification_method=classification.method,
            extraction_method="unclassified",
            confidence=0.0,
            data={},
            field_confidences={},
            warnings=["Document could not be classified"],
        )

    if classification.doc_class == "other":
        return ExtractionResult(
            doc_class="other",
            classification_confidence=classification.confidence,
            classification_method=classification.method,
            extraction_method="skipped",
            confidence=0.0,
            data={},
            field_confidences={},
            warnings=["Document classified as 'other' — no extraction performed"],
        )

    # --- Extraction chain ---
    chain = config.chain_for(classification.doc_class)
    result, provider_name = await run_extraction_chain(
        chain, classification.doc_class, text, content, form_fields,
    )

    # Strip provider sub-type suffix: "rule_engine:paystub" → "rule_engine"
    extraction_method = provider_name.split(":")[0]

    if result is None:
        return ExtractionResult(
            doc_class=classification.doc_class,
            classification_confidence=classification.confidence,
            classification_method=classification.method,
            extraction_method=extraction_method,
            confidence=0.0,
            data={},
            field_confidences={},
            warnings=["No extraction provider returned a result"],
        )

    return ExtractionResult(
        doc_class=classification.doc_class,
        classification_confidence=classification.confidence,
        classification_method=classification.method,
        extraction_method=extraction_method,
        confidence=result.confidence,
        data=result.data,
        field_confidences=result.field_confidences,
        warnings=result.warnings,
    )


def _better_result(a: ExtractionResult, b: ExtractionResult) -> ExtractionResult:
    """Return whichever result has higher confidence and more extracted fields."""
    score_a = a.confidence + len(a.data) * 0.001
    score_b = b.confidence + len(b.data) * 0.001
    return b if score_b > score_a else a


# ---------------------------------------------------------------------------
# Extraction endpoint
# ---------------------------------------------------------------------------

@app.post("/extract", response_model=ExtractionResult)
async def extract(
    file: UploadFile = File(...),
    doc_class: str | None = Form(default=None),
) -> ExtractionResult:
    """
    Classify and extract structured data from an uploaded document.

    - file:      the document (PDF, XLSX, CSV, TXT)
    - doc_class: optional classification hint — skips AI classification when provided
    """
    content = await file.read()
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail=f"File exceeds {MAX_UPLOAD_BYTES // (1024 * 1024)}MB limit")
    filename = file.filename or "unknown"
    mime_type = file.content_type or "application/octet-stream"
    config = get_pipeline_config()
    timings: dict[str, float] = {}

    # ------------------------------------------------------------------
    # Step 1: Text extraction
    # ------------------------------------------------------------------
    t0 = time.perf_counter()
    if mime_type == "application/pdf":
        text, form_fields = await asyncio.to_thread(extract_pdf_content, content, doc_class)
    elif mime_type in IMAGE_MIME_TYPES:
        # Images have no embedded text layer — go straight to Tesseract OCR
        text = await asyncio.to_thread(extract_image_text, content)
        form_fields: dict[str, str] = {}
        logger.info("Image file (%s) — extracted %d chars via Tesseract", filename, len(text))
    else:
        text = await asyncio.to_thread(extract_text, content, mime_type, doc_class)
        form_fields = {}
    timings["text_extraction"] = (time.perf_counter() - t0) * 1000

    # ------------------------------------------------------------------
    # Step 2: Tier 1 OCR — scanned PDF with no text layer
    # ------------------------------------------------------------------
    ocr_provider_used: str | None = None

    if mime_type == "application/pdf" and is_scanned(text):
        t0 = time.perf_counter()
        tier1 = get_tier1()
        if tier1:
            provider_name = "marker" if isinstance(tier1, MarkerOcrProvider) else "tesseract"
            if isinstance(tier1, TesseractOcrProvider):
                logger.info(
                    "Scanned PDF detected (%s) — running incremental Tier 1 OCR (%s)",
                    filename,
                    provider_name,
                )
                ocr_text = await asyncio.to_thread(
                    tier1.extract_text_until,
                    content,
                    lambda candidate: classify_by_rules(candidate).confidence >= RULE_CONFIDENCE_THRESHOLD,
                )
            else:
                logger.info("Scanned PDF detected (%s) — running Tier 1 OCR (%s)", filename, provider_name)
                ocr_text = await asyncio.to_thread(tier1.extract_text, content)
            if not is_scanned(ocr_text):
                text = ocr_text
                ocr_provider_used = provider_name
            else:
                logger.warning("Tier 1 OCR (%s) also returned sparse text for %s", provider_name, filename)
        else:
            logger.warning(
                "Scanned PDF (%s): no local OCR provider installed. "
                "Install with: pip install 'legaleagle-extractor[ocr-local]'",
                filename,
            )
        timings["tier1_ocr"] = (time.perf_counter() - t0) * 1000

    # ------------------------------------------------------------------
    # Steps 3–4: Classify + extract
    # ------------------------------------------------------------------
    t0 = time.perf_counter()
    result = await _run_pipeline(text, form_fields, doc_class, filename=filename, content=content, config=config)
    timings["classify_extract"] = (time.perf_counter() - t0) * 1000

    # ------------------------------------------------------------------
    # Step 5: Tier 2 — Azure Document Intelligence fallback
    # ------------------------------------------------------------------
    if needs_azure_fallback(result.confidence, result.doc_class, result.classification_confidence):
        t0 = time.perf_counter()
        tier2 = get_tier2()
        if tier2:
            logger.info(
                "Low confidence result (%.0f%%) for %s — running Tier 2 OCR (Azure DI)",
                result.confidence * 100,
                filename,
            )
            azure_text = await asyncio.to_thread(tier2.extract_text, content)
            if not is_scanned(azure_text):
                azure_result = await _run_pipeline(azure_text, form_fields, doc_class, filename=filename, content=content, config=config)
                result = _better_result(result, azure_result)
                if result is azure_result:
                    ocr_provider_used = "azure_document_intelligence"
                    logger.info(
                        "Azure DI improved result to %.0f%% confidence for %s",
                        result.confidence * 100,
                        filename,
                    )
            else:
                logger.warning("Azure DI also returned sparse text for %s", filename)
        timings["azure_di_fallback"] = (time.perf_counter() - t0) * 1000

    # ------------------------------------------------------------------
    # Annotate which OCR provider was used (if any)
    # ------------------------------------------------------------------
    if ocr_provider_used:
        result.warnings.insert(0, f"ocr_provider: {ocr_provider_used}")

    # Log step timings
    timing_parts = [f"{step}={ms:.0f}ms" for step, ms in timings.items()]
    logger.info("Pipeline timings for %s: %s", filename, ", ".join(timing_parts))

    return result
