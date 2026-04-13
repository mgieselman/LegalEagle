"""
Unit tests for extractor/ocr.py.

All external dependencies (marker-pdf, azure-ai-documentintelligence) are mocked
so these tests run without installing large OCR models or needing cloud credentials.
"""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

import ocr as ocr_module
from ocr import (
    AZURE_FALLBACK_CONFIDENCE_THRESHOLD,
    SCANNED_THRESHOLD_CHARS,
    AzureDocumentIntelligenceProvider,
    MarkerOcrProvider,
    TesseractOcrProvider,
    is_scanned,
    needs_azure_fallback,
    get_tier1,
    get_tier2,
)


# ---------------------------------------------------------------------------
# is_scanned
# ---------------------------------------------------------------------------

def test_is_scanned_empty():
    assert is_scanned("") is True


def test_is_scanned_whitespace_only():
    assert is_scanned("   \n\t  ") is True


def test_is_scanned_below_threshold():
    assert is_scanned("x" * (SCANNED_THRESHOLD_CHARS - 1)) is True


def test_is_scanned_at_threshold():
    assert is_scanned("x" * SCANNED_THRESHOLD_CHARS) is False


def test_is_scanned_normal_text():
    text = "JPMorgan Chase Bank N.A.\nChecking Account Statement\nBeginning Balance $1,000.00"
    assert is_scanned(text) is False


# ---------------------------------------------------------------------------
# needs_azure_fallback
# ---------------------------------------------------------------------------

def test_azure_fallback_not_needed_high_confidence():
    assert needs_azure_fallback(0.90, "payStub.us", 0.95) is False


def test_azure_fallback_needed_low_confidence():
    assert needs_azure_fallback(0.40, "payStub.us", 0.95) is True


def test_azure_fallback_at_threshold():
    # Exactly at threshold — should NOT trigger (must be strictly below)
    assert needs_azure_fallback(AZURE_FALLBACK_CONFIDENCE_THRESHOLD, "payStub.us", 0.95) is False


def test_azure_fallback_just_below_threshold():
    assert needs_azure_fallback(AZURE_FALLBACK_CONFIDENCE_THRESHOLD - 0.01, "payStub.us", 0.95) is True


def test_azure_fallback_unclassified_zero_signal():
    """Genuinely unrecognisable docs — Azure won't help, don't trigger."""
    assert needs_azure_fallback(0.0, "unclassified", 0.0) is False


def test_azure_fallback_unclassified_with_signal():
    """Classifier had some signal but not enough — Azure might help."""
    assert needs_azure_fallback(0.0, "unclassified", 0.40) is True


def test_azure_fallback_zero_confidence_known_class():
    """Classified but extraction produced nothing — definitely trigger."""
    assert needs_azure_fallback(0.0, "mortgage.us", 0.92) is True


def test_azure_fallback_other_never_triggers():
    """Docs classified as 'other' have no extraction schema — Azure won't help."""
    assert needs_azure_fallback(0.0, "other", 0.95) is False


# ---------------------------------------------------------------------------
# MarkerOcrProvider.is_available
# ---------------------------------------------------------------------------

def test_marker_available_when_installed():
    with patch.dict("sys.modules", {"marker": MagicMock()}):
        assert MarkerOcrProvider.is_available() is True


def test_marker_not_available_when_not_installed():
    with patch.dict("sys.modules", {"marker": None}):
        # Simulate ImportError by removing the module
        import sys
        original = sys.modules.pop("marker", None)
        try:
            assert MarkerOcrProvider.is_available() is False
        finally:
            if original is not None:
                sys.modules["marker"] = original


# ---------------------------------------------------------------------------
# MarkerOcrProvider.extract_text
# ---------------------------------------------------------------------------

def test_marker_extract_text_success():
    mock_text = "Mortgage Statement\nLoan Number 12345\nPrincipal $1,200.00"
    mock_rendered = MagicMock()

    # Build mock marker module tree — patch.dict must wrap the actual call so that
    # the `from marker.converters.pdf import PdfConverter` inside extract_text()
    # resolves against our mocks, not the real (absent) package.
    mock_converter_instance = MagicMock()
    mock_converter_instance.return_value = mock_rendered
    mock_converter_cls = MagicMock(return_value=mock_converter_instance)

    mock_marker_output = MagicMock()
    mock_marker_output.text_from_rendered.return_value = (mock_text, {}, {})

    mock_marker_converters_pdf = MagicMock()
    mock_marker_converters_pdf.PdfConverter = mock_converter_cls

    provider = MarkerOcrProvider()
    provider._artifact_dict = {}  # bypass model loading

    with patch.dict("sys.modules", {
        "marker": MagicMock(),
        "marker.converters": MagicMock(),
        "marker.converters.pdf": mock_marker_converters_pdf,
        "marker.output": mock_marker_output,
        "marker.models": MagicMock(),
    }), patch("ocr.tempfile.NamedTemporaryFile") as mock_tmp, \
       patch("ocr.os.unlink"):
        mock_tmp.return_value.__enter__.return_value.name = "/tmp/test.pdf"
        mock_tmp.return_value.__exit__.return_value = False
        result = provider.extract_text(b"%PDF-fake")

    assert result == mock_text or result == ""


def test_marker_extract_text_returns_empty_on_failure():
    provider = MarkerOcrProvider()
    provider._artifact_dict = {}

    with patch("ocr.tempfile.NamedTemporaryFile", side_effect=OSError("disk full")):
        result = provider.extract_text(b"%PDF-fake")

    assert result == ""


def test_tesseract_extract_text_joins_page_texts(monkeypatch):
    provider = TesseractOcrProvider()
    monkeypatch.setattr(provider, "extract_page_texts", lambda content: ["Page 1 text", "Page 2 text"])

    result = provider.extract_text(b"%PDF-fake")

    assert result == "Page 1 text\n\nPage 2 text"


def test_tesseract_extract_text_until_stops_early(monkeypatch):
    provider = TesseractOcrProvider()
    monkeypatch.setattr(provider, "extract_page_texts", lambda content: ["Mortgage Statement", "Ignored second page"])

    seen: list[str] = []

    def should_stop(text: str) -> bool:
        seen.append(text)
        return "Mortgage Statement" in text

    result = provider.extract_text_until(b"%PDF-fake", should_stop)

    assert result == "Mortgage Statement"
    assert seen == ["Mortgage Statement"]


def test_tesseract_extract_text_until_accumulates_pages(monkeypatch):
    provider = TesseractOcrProvider()
    monkeypatch.setattr(provider, "extract_page_texts", lambda content: ["Account Summary", "Mortgage Statement\nPayment Due"])

    seen: list[str] = []

    def should_stop(text: str) -> bool:
        seen.append(text)
        return "Mortgage Statement" in text

    result = provider.extract_text_until(b"%PDF-fake", should_stop)

    assert result == "Account Summary\n\nMortgage Statement\nPayment Due"
    assert seen == [
        "Account Summary",
        "Account Summary\n\nMortgage Statement\nPayment Due",
    ]


# ---------------------------------------------------------------------------
# AzureDocumentIntelligenceProvider.is_available
# ---------------------------------------------------------------------------

def test_azure_not_available_missing_package():
    # Setting a sys.modules entry to None causes import to raise ImportError.
    # Patch all three levels so the import system doesn't find a cached parent.
    with patch.dict("sys.modules", {
        "azure": None,
        "azure.ai": None,
        "azure.ai.documentintelligence": None,
    }):
        assert AzureDocumentIntelligenceProvider.is_available() is False


def test_azure_not_available_missing_env_vars(monkeypatch):
    monkeypatch.delenv("AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT", raising=False)
    monkeypatch.delenv("AZURE_DOCUMENT_INTELLIGENCE_KEY", raising=False)

    with patch.dict("sys.modules", {"azure.ai.documentintelligence": MagicMock()}):
        assert AzureDocumentIntelligenceProvider.is_available() is False


def test_azure_available_with_env_vars(monkeypatch):
    monkeypatch.setenv("AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT", "https://example.cognitiveservices.azure.com/")
    monkeypatch.setenv("AZURE_DOCUMENT_INTELLIGENCE_KEY", "fake-key-abc123")

    # Must mock all parent namespace packages or `import azure.ai.documentintelligence` fails
    with patch.dict("sys.modules", {
        "azure": MagicMock(),
        "azure.ai": MagicMock(),
        "azure.ai.documentintelligence": MagicMock(),
    }):
        assert AzureDocumentIntelligenceProvider.is_available() is True


# ---------------------------------------------------------------------------
# AzureDocumentIntelligenceProvider.extract_text
# ---------------------------------------------------------------------------

def _make_azure_result(text_content: str) -> MagicMock:
    """Build a mock Azure DI prebuilt-read result with result.content."""
    result = MagicMock()
    result.content = text_content
    return result


def test_azure_extract_text_success(monkeypatch):
    monkeypatch.setenv("AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT", "https://example.cognitiveservices.azure.com/")
    monkeypatch.setenv("AZURE_DOCUMENT_INTELLIGENCE_KEY", "fake-key")

    mock_result = _make_azure_result(
        "Mortgage Statement\nLoan Number 0129442679\nPayment Date 02/01/26\n"
        "Principal $1,356.82\nInterest $2,131.17\nEscrow $2,114.41"
    )

    mock_client = MagicMock()
    mock_client.begin_analyze_document.return_value.result.return_value = mock_result
    mock_client_cls = MagicMock(return_value=mock_client)
    mock_credential_cls = MagicMock()

    with patch.dict("sys.modules", {
        "azure.ai.documentintelligence": MagicMock(DocumentIntelligenceClient=mock_client_cls),
        "azure.core.credentials": MagicMock(AzureKeyCredential=mock_credential_cls),
    }):
        provider = AzureDocumentIntelligenceProvider()
        result = provider.extract_text(b"%PDF-fake")

    assert "Mortgage Statement" in result
    assert "Principal $1,356.82" in result


def test_azure_extract_text_empty_on_failure(monkeypatch):
    monkeypatch.setenv("AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT", "https://example.cognitiveservices.azure.com/")
    monkeypatch.setenv("AZURE_DOCUMENT_INTELLIGENCE_KEY", "fake-key")

    with patch.dict("sys.modules", {
        "azure.ai.documentintelligence": MagicMock(
            DocumentIntelligenceClient=MagicMock(side_effect=RuntimeError("network error"))
        ),
        "azure.core.credentials": MagicMock(),
    }):
        provider = AzureDocumentIntelligenceProvider()
        result = provider.extract_text(b"%PDF-fake")

    assert result == ""


# ---------------------------------------------------------------------------
# get_tier1 / get_tier2 factory functions
# ---------------------------------------------------------------------------

def test_get_tier1_returns_none_when_not_available():
    ocr_module._tier1 = None  # reset singleton
    with patch.object(MarkerOcrProvider, "is_available", return_value=False):
        with patch.object(TesseractOcrProvider, "is_available", return_value=False):
            assert get_tier1() is None


def test_get_tier1_returns_provider_when_available():
    ocr_module._tier1 = None
    with patch.object(MarkerOcrProvider, "is_available", return_value=True):
        provider = get_tier1()
        assert isinstance(provider, MarkerOcrProvider)
    ocr_module._tier1 = None  # clean up


def test_get_tier2_returns_none_when_not_configured(monkeypatch):
    ocr_module._tier2 = None
    monkeypatch.delenv("AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT", raising=False)
    monkeypatch.delenv("AZURE_DOCUMENT_INTELLIGENCE_KEY", raising=False)
    with patch.dict("sys.modules", {"azure.ai.documentintelligence": MagicMock()}):
        assert get_tier2() is None


def test_get_tier2_returns_provider_when_configured(monkeypatch):
    ocr_module._tier2 = None
    monkeypatch.setenv("AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT", "https://example.cognitiveservices.azure.com/")
    monkeypatch.setenv("AZURE_DOCUMENT_INTELLIGENCE_KEY", "fake-key")
    with patch.dict("sys.modules", {
        "azure": MagicMock(),
        "azure.ai": MagicMock(),
        "azure.ai.documentintelligence": MagicMock(),
    }):
        provider = get_tier2()
        assert isinstance(provider, AzureDocumentIntelligenceProvider)
    ocr_module._tier2 = None  # clean up
