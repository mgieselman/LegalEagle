"""
Phase 6 — Endpoint integration tests.
Uses FastAPI TestClient (httpx-backed, no network).
Real PDFs from the test corpus are used to exercise the full pipeline.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

import ai_extractor
from main import app

client = TestClient(app)

HAS_API_KEY = bool(os.environ.get("ANTHROPIC_API_KEY"))

PUBLIC_CORPUS = Path(
    "/Users/matt/Library/CloudStorage/OneDrive-GieselmanSoftware"
    "/LegalEagle/Extraction/corpus/public"
)


# ---- /health ----------------------------------------------------------------

def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


# ---- /extract basic shapes --------------------------------------------------

def test_extract_requires_file():
    r = client.post("/extract")
    assert r.status_code == 422  # FastAPI validation error


def test_extract_plain_text_paystub():
    """Paystub text → rule extractor → gross_pay present."""
    text = b"""TAILORED MANAGEMENT INC
Employee: Matthew Gieselman
Pay Date: 01/02/2026
Pay Period: 12/22/2025 - 12/28/2025
Gross Pay    2,585.81    28,444.00
Net Pay      2,137.33    23,510.00
FIT    0.00    0.00    235.67
FICA   0.00    0.00    160.32
MEDI   0.00    0.00     37.49
Regular    120.27    21.5
"""
    r = client.post(
        "/extract",
        files={"file": ("paystub.txt", text, "text/plain")},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["doc_class"] == "payStub.us"
    assert body["extraction_method"] == "rule_engine"
    assert body["data"]["gross_pay"] == pytest.approx(2585.81)
    assert body["data"]["net_pay"] == pytest.approx(2137.33)
    assert body["confidence"] >= 0.85


def test_extract_plain_text_bank_statement():
    """Bank statement text → rule extractor → balances present."""
    text = b"""Bank of America, N.A.
Your combined statement for December 18, 2025 to January 16, 2026
Account # 0010 8211 5472
Beginning balance on December 18, 2025   2.26
Deposits and other additions             870.52
Ending balance on January 16, 2026       110.69
"""
    r = client.post(
        "/extract",
        files={"file": ("bofa.txt", text, "text/plain")},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["doc_class"] == "bankStatement.us.checking"
    assert body["extraction_method"] == "rule_engine"
    assert body["data"]["institution_name"] == "Bank of America, N.A."
    assert body["data"]["beginning_balance"] == pytest.approx(2.26)
    assert body["data"]["ending_balance"] == pytest.approx(110.69)


def test_extract_unclassified_returns_low_confidence():
    """Random text with no financial keywords → 'other' → skipped extraction."""
    text = b"lorem ipsum dolor sit amet consectetur adipiscing elit"
    r = client.post(
        "/extract",
        files={"file": ("random.txt", text, "text/plain")},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["doc_class"] == "other"
    assert body["confidence"] == 0.0
    assert body["extraction_method"] == "skipped"


def test_extract_other_skips_extraction():
    """Documents classified as 'other' should skip extraction entirely."""
    text = b"Some random document that does not match any known type"
    r = client.post(
        "/extract",
        files={"file": ("random.txt", text, "text/plain")},
        data={"doc_class": "other"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["doc_class"] == "other"
    assert body["confidence"] == 0.0
    assert body["extraction_method"] == "skipped"
    assert body["data"] == {}
    assert any("no extraction performed" in w for w in body["warnings"])


def test_extract_doc_class_hint_bypasses_classification():
    """When doc_class is provided, classification is skipped."""
    text = b"""TAILORED MANAGEMENT INC
Gross Pay    2,585.81
Net Pay      2,137.33
"""
    r = client.post(
        "/extract",
        files={"file": ("doc.txt", text, "text/plain")},
        data={"doc_class": "payStub.us"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["doc_class"] == "payStub.us"
    assert body["classification_confidence"] == 1.0


def test_extract_doc_class_hint_in_result():
    """classification_method is rule_engine when doc_class hint is given."""
    text = b"Gross Pay 1000.00 Net Pay 800.00"
    r = client.post(
        "/extract",
        files={"file": ("stub.txt", text, "text/plain")},
        data={"doc_class": "payStub.us"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["classification_method"] == "rule_engine"


# ---- /extract with real PDF corpus -----------------------------------------

_PAYSTUB_PDF = PUBLIC_CORPUS / "Paystub CA DIR Hourly.pdf"
_BANK_PDF = PUBLIC_CORPUS / "Bank Statement Carson Bank.pdf"


@pytest.mark.skipif(not _PAYSTUB_PDF.exists(), reason="Public corpus not available")
def test_extract_real_paystub_pdf():
    """Real paystub PDF → rule engine → gross_pay populated."""
    with open(_PAYSTUB_PDF, "rb") as f:
        r = client.post(
            "/extract",
            files={"file": (_PAYSTUB_PDF.name, f, "application/pdf")},
        )
    assert r.status_code == 200
    body = r.json()
    assert body["doc_class"] == "payStub.us"
    assert body["data"].get("gross_pay") is not None
    assert body["data"]["gross_pay"] > 0
    assert body["confidence"] >= 0.85


@pytest.mark.skipif(not _BANK_PDF.exists(), reason="Public corpus not available")
@pytest.mark.skipif(not HAS_API_KEY, reason="ANTHROPIC_API_KEY not set — AI fallback needed for this PDF")
def test_extract_real_bank_statement_pdf():
    """Real bank statement PDF → rule engine → balances populated."""
    with open(_BANK_PDF, "rb") as f:
        r = client.post(
            "/extract",
            files={"file": (_BANK_PDF.name, f, "application/pdf")},
        )
    assert r.status_code == 200
    body = r.json()
    assert body["doc_class"] == "bankStatement.us.checking"
    assert body["data"].get("institution_name") is not None
    assert body["confidence"] >= 0.85


# ---- AI fallback path (mocked) ---------------------------------------------

@pytest.mark.asyncio
async def test_extract_falls_through_to_ai_when_rule_confidence_low():
    """When rule extraction confidence < threshold, AI is called."""
    # Use a text that looks like a mortgage statement (no rule extractor)
    text = b"Wells Fargo Home Mortgage\nCurrent balance: $215,000\nMonthly payment: $1,650"

    mock_payload = {
        "data": {
            "lender_name": "Wells Fargo Home Mortgage",
            "current_balance": 215000,
            "monthly_payment": 1650,
        },
        "fieldConfidences": {
            "lender_name": 0.95,
            "current_balance": 0.92,
            "monthly_payment": 0.90,
        },
        "warnings": [],
    }

    # Phase 2E switched to tool use — mock must return a tool_use block
    content_block = MagicMock()
    content_block.type = "tool_use"
    content_block.input = mock_payload
    msg = MagicMock()
    msg.content = [content_block]
    mock_client = MagicMock()
    mock_client.messages.create = AsyncMock(return_value=msg)

    with patch.object(ai_extractor, "_client", mock_client):
        r = client.post(
            "/extract",
            files={"file": ("mortgage.txt", text, "text/plain")},
            data={"doc_class": "mortgage.us"},
        )

    assert r.status_code == 200
    body = r.json()
    assert body["doc_class"] == "mortgage.us"
    assert body["extraction_method"] == "ai_parse"
    assert body["data"]["lender_name"] == "Wells Fargo Home Mortgage"
