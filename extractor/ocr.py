"""
Two-tier OCR for scanned PDFs.

Tier 1 — Marker (local, free, default)
    Triggered when pdftext/markitdown returns sparse text, indicating a scanned PDF
    with no text layer.  Uses surya-based deep learning models (~2 GB, downloaded
    on first use).
    Install: pip install "legaleagle-extractor[ocr-local]"

Tier 2 — Azure Document Intelligence (cloud, paid, fallback)
    Triggered when extraction confidence is below threshold or extraction fails,
    meaning even our AI extractor couldn't produce useful output.  Uses the
    prebuilt-layout model for layout-aware OCR; the result is fed back through the
    normal classify → rule-extract → AI-extract pipeline.
    Install: pip install "legaleagle-extractor[ocr-azure]"
    Env vars: AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT, AZURE_DOCUMENT_INTELLIGENCE_KEY
"""
from __future__ import annotations

import io
import logging
import os
import tempfile
from abc import ABC, abstractmethod
from collections.abc import Callable, Iterator

logger = logging.getLogger(__name__)

from config import AZURE_FALLBACK_CONFIDENCE_THRESHOLD, SCANNED_THRESHOLD_CHARS


def is_scanned(text: str) -> bool:
    """Return True when text extraction produced too little content to be useful."""
    return len(text.strip()) < SCANNED_THRESHOLD_CHARS


def needs_azure_fallback(confidence: float, doc_class: str, classification_confidence: float) -> bool:
    """
    Return True when the extraction result is poor enough to warrant Azure DI
    re-processing.

    Does NOT trigger for docs that are genuinely unclassifiable (zero signal from
    the classifier) — Azure DI can't classify inherently out-of-scope documents
    any better than we can.
    """
    # Blank / completely unrecognised — Azure won't help
    if doc_class == "unclassified" and classification_confidence == 0.0:
        return False
    # "other" docs have no extraction schema — better OCR won't help
    if doc_class == "other":
        return False
    return confidence < AZURE_FALLBACK_CONFIDENCE_THRESHOLD


# ---------------------------------------------------------------------------
# Provider interface
# ---------------------------------------------------------------------------

class OcrProvider(ABC):
    """Accept raw PDF bytes, return extracted text."""

    @abstractmethod
    def extract_text(self, content: bytes) -> str:
        """Extract text from PDF bytes. Returns empty string on failure."""
        ...

    @classmethod
    def is_available(cls) -> bool:
        """Return True if the provider's dependencies are installed/configured."""
        return False


# ---------------------------------------------------------------------------
# Tier 1 — Marker (local, free)
# ---------------------------------------------------------------------------

class MarkerOcrProvider(OcrProvider):
    """
    Local OCR via marker-pdf (surya deep-learning backend).

    Models are ~2 GB and downloaded to ~/.cache/huggingface on first use.
    Subsequent calls reuse the cached models.  Not suitable for environments
    with restricted disk space or no internet access on first run.

    marker-pdf >= 0.3 required.
    """

    # Class-level model cache — loaded once, shared across requests.
    _artifact_dict: dict | None = None

    @classmethod
    def is_available(cls) -> bool:
        try:
            import marker  # noqa: F401
            return True
        except ImportError:
            return False

    @classmethod
    def _load_models(cls) -> dict:
        if cls._artifact_dict is None:
            from marker.models import create_model_dict
            logger.info("Loading Marker models — first use, may take a minute...")
            cls._artifact_dict = create_model_dict()
            logger.info("Marker models ready.")
        return cls._artifact_dict

    def extract_text(self, content: bytes) -> str:
        try:
            from marker.converters.pdf import PdfConverter
            from marker.output import text_from_rendered

            # marker requires a file path, not bytes
            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
                tmp.write(content)
                tmp_path = tmp.name

            try:
                converter = PdfConverter(artifact_dict=self._load_models())
                rendered = converter(tmp_path)
                text, _, _ = text_from_rendered(rendered)
                return text or ""
            finally:
                os.unlink(tmp_path)

        except Exception:
            logger.exception("Marker OCR failed")
            return ""


# ---------------------------------------------------------------------------
# Tier 1b — Tesseract (local, free, lightweight fallback for scanned PDFs)
# ---------------------------------------------------------------------------

class TesseractOcrProvider(OcrProvider):
    """
    Tesseract OCR for scanned PDFs and images.

    Converts each PDF page to a PIL image via pypdf's page-rendering path,
    then runs pytesseract.  Much lighter than Marker (no ML models); accuracy
    is lower on complex layouts but excellent on clean card/form scans.

    Requires: tesseract system binary (brew install tesseract) + pytesseract + Pillow + pypdf
    """

    @classmethod
    def is_available(cls) -> bool:
        try:
            import pytesseract  # noqa: F401
            from PIL import Image  # noqa: F401
            import pypdf  # noqa: F401
            # Verify the tesseract binary is actually present
            pytesseract.get_tesseract_version()
            return True
        except Exception:
            return False

    def extract_text(self, content: bytes) -> str:
        return "\n\n".join(self.extract_page_texts(content))

    def extract_text_until(self, content: bytes, should_stop: Callable[[str], bool]) -> str:
        accumulated: list[str] = []
        for page_text in self.extract_page_texts(content):
            cleaned = page_text.strip()
            if not cleaned:
                continue
            accumulated.append(cleaned)
            combined = "\n\n".join(accumulated)
            if should_stop(combined):
                return combined
        return "\n\n".join(accumulated)

    def extract_page_texts(self, content: bytes) -> Iterator[str]:
        """Yield OCR text for each page. Generator so extract_text_until can stop early."""
        try:
            import pypdf

            reader = pypdf.PdfReader(io.BytesIO(content))

            for page in reader.pages:
                # Try to extract any embedded images from the page
                images = []
                if "/Resources" in page and "/XObject" in page["/Resources"]:  # type: ignore[operator]
                    xobjects = page["/Resources"]["/XObject"].get_object()  # type: ignore[union-attr]
                    for obj in xobjects.values():
                        obj = obj.get_object()
                        if obj.get("/Subtype") == "/Image":
                            try:
                                pil_img = self._xobject_to_pil(obj)
                                if pil_img:
                                    images.append(pil_img)
                            except Exception:
                                pass

                page_parts: list[str] = []
                if images:
                    for img in images:
                        text = self._ocr_regions(img)
                        if text.strip():
                            page_parts.append(text.strip())

                if page_parts:
                    yield "\n".join(page_parts)

        except Exception:
            logger.exception("Tesseract OCR failed")

    @staticmethod
    def _ocr_regions(img) -> str:
        """
        Multi-region OCR strategy for scanned card images.

        SSN cards have an embossed seal and dense security background that confuse
        Tesseract when the whole image is processed at once.  Scanning horizontal
        strips separately improves text isolation and yields better results for
        classification (we need "SOCIAL SECURITY" or "THIS NUMBER HAS BEEN
        ESTABLISHED FOR" — we don't need to read every field perfectly).
        """
        from PIL import ImageEnhance
        import pytesseract

        w, h = img.size
        gray = img.convert("L")

        regions = [
            # Full image — good for DLs and clean cards
            gray,
            # Middle horizontal band — catches "THIS NUMBER HAS BEEN ESTABLISHED FOR"
            gray.crop((int(w * 0.15), int(h * 0.35), int(w * 0.85), int(h * 0.65))),
        ]

        parts: list[str] = []
        for region in regions:
            enhanced = ImageEnhance.Contrast(region).enhance(2.5)
            scaled = enhanced.resize((enhanced.width * 2, enhanced.height * 2))
            text = pytesseract.image_to_string(scaled, lang="eng", config="--psm 6")
            if text.strip():
                parts.append(text.strip())

        return "\n".join(parts)

    @staticmethod
    def _xobject_to_pil(obj):
        """Convert a PDF XObject image to a PIL Image."""
        from PIL import Image
        import pypdf

        width = int(obj["/Width"])
        height = int(obj["/Height"])
        color_space = obj.get("/ColorSpace")

        data = obj.get_data()

        # Determine mode from color space and bits per component
        bpc = int(obj.get("/BitsPerComponent", 8))
        if color_space in ("/DeviceRGB", "/CalRGB"):
            mode = "RGB"
        elif color_space in ("/DeviceGray", "/CalGray"):
            mode = "L"
        elif color_space == "/DeviceCMYK":
            mode = "CMYK"
        else:
            mode = "RGB"

        try:
            img = Image.frombytes(mode, (width, height), data)
            return img.convert("RGB")
        except Exception:
            # Try loading as JPEG directly (common for scanned PDFs)
            try:
                return Image.open(io.BytesIO(data)).convert("RGB")
            except Exception:
                return None


# ---------------------------------------------------------------------------
# Tier 2 — Azure Document Intelligence (cloud, paid)
# ---------------------------------------------------------------------------

class AzureDocumentIntelligenceProvider(OcrProvider):
    """
    Azure Document Intelligence using the prebuilt-read model.

    prebuilt-read is chosen for OCR because it returns plain text via
    result.content at $1.50/1K pages — the cheapest Azure DI option.  The
    extracted text feeds back into our existing classify → rule-extract →
    AI-extract pipeline without requiring schema mapping from Azure's output
    format to ours.

    Pricing: ~$1.50/1K pages (prebuilt-read).  At BK intake volumes
    this is cents per month.

    PII note: document content is sent to Microsoft Azure.  Ensure your Azure
    region and data-residency settings comply with client confidentiality and any
    applicable bar association data rules before enabling.

    azure-ai-documentintelligence >= 1.0 required.
    Env vars: AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT, AZURE_DOCUMENT_INTELLIGENCE_KEY
    """

    def __init__(self) -> None:
        self._client = None

    def _get_client(self):
        if self._client is None:
            from azure.ai.documentintelligence import DocumentIntelligenceClient
            from azure.core.credentials import AzureKeyCredential

            endpoint = os.environ.get("AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT", "")
            key = os.environ.get("AZURE_DOCUMENT_INTELLIGENCE_KEY", "")
            self._client = DocumentIntelligenceClient(endpoint, AzureKeyCredential(key))
        return self._client

    @classmethod
    def is_available(cls) -> bool:
        try:
            import azure.ai.documentintelligence  # noqa: F401
        except ImportError:
            return False
        return bool(
            os.environ.get("AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT")
            and os.environ.get("AZURE_DOCUMENT_INTELLIGENCE_KEY")
        )

    def extract_text(self, content: bytes) -> str:
        try:
            client = self._get_client()
            poller = client.begin_analyze_document(
                "prebuilt-read",
                body=io.BytesIO(content),
                content_type="application/octet-stream",
            )
            result = poller.result()

            # prebuilt-read returns result.content as a single string
            if result.content:
                return result.content.strip()
            return ""

        except Exception:
            logger.exception("Azure Document Intelligence OCR failed")
            return ""


# ---------------------------------------------------------------------------
# Provider singletons — instantiated on first use
# ---------------------------------------------------------------------------

_tier1: OcrProvider | None = None
_tier2: AzureDocumentIntelligenceProvider | None = None


def get_tier1() -> OcrProvider | None:
    """Return the Tier 1 OCR provider.

    Prefers Marker (deep learning, higher accuracy) when installed.
    Falls back to Tesseract (lightweight, no ML models) when Marker is absent.
    Returns None only if neither is available.
    """
    global _tier1
    if _tier1 is None:
        if MarkerOcrProvider.is_available():
            _tier1 = MarkerOcrProvider()
        elif TesseractOcrProvider.is_available():
            _tier1 = TesseractOcrProvider()
    return _tier1


def get_tier2() -> AzureDocumentIntelligenceProvider | None:
    """Return the Tier 2 (Azure DI) provider, or None if env vars are not set."""
    global _tier2
    if _tier2 is None and AzureDocumentIntelligenceProvider.is_available():
        _tier2 = AzureDocumentIntelligenceProvider()
    return _tier2
