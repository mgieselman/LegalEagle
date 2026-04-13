"""
Phase 5 — AI extractor tests.
Mocks the Anthropic client so no real API call is made.
Mirrors server/src/__tests__/ai-extractor.test.ts.
"""
from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

import ai_extractor
from ai_extractor import extract_with_ai, get_extraction_notes, get_extraction_template


# ---- Helper ----------------------------------------------------------------

def _mock_message(payload: dict) -> MagicMock:
    """Build a fake anthropic Message with a single text content block."""
    content_block = MagicMock()
    content_block.type = "text"
    content_block.text = json.dumps(payload)
    msg = MagicMock()
    msg.content = [content_block]
    return msg


def _mock_tool_use_message(payload: dict) -> MagicMock:
    """Build a fake anthropic Message with a single tool_use content block."""
    content_block = MagicMock()
    content_block.type = "tool_use"
    content_block.id = "toolu_test"
    content_block.name = "extract_fields"
    content_block.input = payload
    msg = MagicMock()
    msg.content = [content_block]
    return msg


def _make_client_mock(payload: dict) -> MagicMock:
    """Return a mock AsyncAnthropic client whose messages.create returns payload as text."""
    client = MagicMock()
    client.messages.create = AsyncMock(return_value=_mock_message(payload))
    return client


def _make_tool_client_mock(payload: dict) -> MagicMock:
    """Return a mock AsyncAnthropic client whose messages.create returns payload as tool_use."""
    client = MagicMock()
    client.messages.create = AsyncMock(return_value=_mock_tool_use_message(payload))
    return client


# ---- Template / Notes helpers (no network) ---------------------------------

def test_get_template_paystub_contains_gross_pay():
    t = get_extraction_template("payStub.us")
    obj = json.loads(t)
    assert "gross_pay" in obj
    assert "net_pay" in obj
    assert "employer_name" in obj


def test_get_template_bank_savings_same_as_checking():
    assert get_extraction_template("bankStatement.us.savings") == get_extraction_template("bankStatement.us.checking")


def test_get_template_ira_same_as_retirement():
    assert get_extraction_template("ira_statement") == get_extraction_template("retirement_account")


def test_get_template_401k_same_as_retirement():
    assert get_extraction_template("401k_statement") == get_extraction_template("retirement_account")


def test_get_template_unknown_returns_empty_object():
    assert get_extraction_template("unclassified") == "{}"


def test_get_notes_paystub():
    notes = get_extraction_notes("payStub.us")
    assert "gross_pay" in notes
    assert "YTD" in notes


def test_get_notes_w2():
    notes = get_extraction_notes("tax.us.w2")
    assert "SSN" in notes
    assert "EIN" in notes


def test_get_notes_empty_for_unknown():
    assert get_extraction_notes("unclassified") == ""


# ---- extract_with_ai -------------------------------------------------------

@pytest.mark.asyncio
async def test_extracts_paystub_data():
    payload = {
        "data": {
            "employer_name": "Acme Corp",
            "gross_pay": 3000,
            "net_pay": 2400,
            "federal_tax": 350,
            "state_tax": 150,
            "social_security": 186,
        },
        "fieldConfidences": {
            "employer_name": 0.95,
            "gross_pay": 0.92,
            "net_pay": 0.90,
            "federal_tax": 0.88,
            "state_tax": 0.85,
            "social_security": 0.87,
        },
        "warnings": [],
    }
    with patch.object(ai_extractor, "_client", _make_tool_client_mock(payload)):
        r = await extract_with_ai("Pay Statement\nAcme Corp\nGross: $3,000", "payStub.us")

    assert r.data["employer_name"] == "Acme Corp"
    assert r.data["gross_pay"] == 3000
    assert r.data["net_pay"] == 2400
    assert r.confidence > 0.8
    assert r.warnings == []


@pytest.mark.asyncio
async def test_extracts_bank_statement_data():
    payload = {
        "data": {
            "institution_name": "Chase Bank",
            "beginning_balance": 5000,
            "ending_balance": 4200,
            "total_deposits": 3000,
            "total_withdrawals": 3800,
        },
        "fieldConfidences": {
            "institution_name": 0.95,
            "beginning_balance": 0.92,
            "ending_balance": 0.90,
            "total_deposits": 0.88,
            "total_withdrawals": 0.85,
        },
        "warnings": [],
    }
    with patch.object(ai_extractor, "_client", _make_tool_client_mock(payload)):
        r = await extract_with_ai("Chase Bank Statement", "bankStatement.us.checking")

    assert r.data["institution_name"] == "Chase Bank"
    assert r.data["beginning_balance"] == 5000
    assert r.confidence > 0.8


@pytest.mark.asyncio
async def test_handles_unparseable_response_tool_use():
    """Tool use path: AI returns a text block instead of tool_use for a schema-backed doc class."""
    content_block = MagicMock()
    content_block.type = "text"
    content_block.text = "I cannot extract data from this document."
    msg = MagicMock()
    msg.content = [content_block]

    client = MagicMock()
    client.messages.create = AsyncMock(return_value=msg)

    with patch.object(ai_extractor, "_client", client):
        r = await extract_with_ai("garbled content", "payStub.us")

    assert r.confidence == 0.0
    assert "AI did not return tool use block" in r.warnings


@pytest.mark.asyncio
async def test_handles_unparseable_response_text_fallback():
    """Text fallback path: AI returns non-JSON for a doc class without a schema."""
    content_block = MagicMock()
    content_block.type = "text"
    content_block.text = "I cannot extract data from this document."
    msg = MagicMock()
    msg.content = [content_block]

    client = MagicMock()
    client.messages.create = AsyncMock(return_value=msg)

    with patch.object(ai_extractor, "_client", client):
        r = await extract_with_ai("garbled content", "unclassified")

    assert r.confidence == 0.0
    assert "Failed to parse AI extraction response" in r.warnings


@pytest.mark.asyncio
async def test_handles_partial_extraction_schema_failure():
    payload = {
        "data": {
            "employer_name": "Acme",
            # missing gross_pay and net_pay (required)
        },
        "fieldConfidences": {"employer_name": 0.90},
        "warnings": ["Could not find pay amounts"],
    }
    with patch.object(ai_extractor, "_client", _make_tool_client_mock(payload)):
        r = await extract_with_ai("partial content", "payStub.us")

    assert r.data.get("employer_name") == "Acme"
    assert r.confidence < 0.9
    assert len(r.warnings) > 0


@pytest.mark.asyncio
async def test_handles_response_without_wrapper():
    """Text fallback path: AI returns just the data dict without data/fieldConfidences/warnings wrapper."""
    content_block = MagicMock()
    content_block.type = "text"
    content_block.text = json.dumps({
        "employer_name": "Direct Corp",
        "gross_pay": 4000,
        "net_pay": 3200,
    })
    msg = MagicMock()
    msg.content = [content_block]
    client = MagicMock()
    client.messages.create = AsyncMock(return_value=msg)

    with patch.object(ai_extractor, "_client", client):
        # Use a doc class without a Pydantic schema to test the text fallback path
        r = await extract_with_ai("Direct Corp paystub", "unclassified")

    assert r.data["employer_name"] == "Direct Corp"


@pytest.mark.asyncio
async def test_extracts_profit_loss_statement():
    payload = {
        "data": {"business_name": "Jane Plumbing LLC", "gross_revenue": 95000, "net_profit": 42000, "total_expenses": 53000},
        "fieldConfidences": {"business_name": 0.95, "gross_revenue": 0.90, "net_profit": 0.88, "total_expenses": 0.85},
        "warnings": [],
    }
    with patch.object(ai_extractor, "_client", _make_tool_client_mock(payload)):
        r = await extract_with_ai("P&L Statement\nJane Plumbing LLC", "profit_loss_statement")

    assert r.data["business_name"] == "Jane Plumbing LLC"
    assert r.data["gross_revenue"] == 95000
    assert r.confidence > 0.5


@pytest.mark.asyncio
async def test_extracts_retirement_account():
    payload = {
        "data": {"institution_name": "Fidelity", "account_type": "401k", "ending_balance": 87000},
        "fieldConfidences": {"institution_name": 0.95, "account_type": 0.90, "ending_balance": 0.92},
        "warnings": [],
    }
    with patch.object(ai_extractor, "_client", _make_tool_client_mock(payload)):
        r = await extract_with_ai("Fidelity 401(k) Statement", "retirement_account")

    assert r.data["institution_name"] == "Fidelity"
    assert r.data["ending_balance"] == 87000
    assert r.confidence > 0.5


@pytest.mark.asyncio
async def test_extracts_collection_letter():
    payload = {
        "data": {
            "collection_agency_name": "Midland Credit Management",
            "amount_claimed": 3200,
            "original_creditor": "Capital One",
        },
        "fieldConfidences": {"collection_agency_name": 0.95, "amount_claimed": 0.90, "original_creditor": 0.85},
        "warnings": [],
    }
    with patch.object(ai_extractor, "_client", _make_tool_client_mock(payload)):
        r = await extract_with_ai("Collection Letter", "collection_letter")

    assert r.data["collection_agency_name"] == "Midland Credit Management"
    assert r.data["amount_claimed"] == 3200
    assert r.confidence > 0.5


@pytest.mark.asyncio
async def test_extracts_legal_document():
    payload = {
        "data": {"document_type": "summons", "plaintiff_name": "Bank of America", "case_number": "2024-CV-100"},
        "fieldConfidences": {"document_type": 0.95, "plaintiff_name": 0.92, "case_number": 0.88},
        "warnings": [],
    }
    with patch.object(ai_extractor, "_client", _make_tool_client_mock(payload)):
        r = await extract_with_ai("Summons document", "legal_document")

    assert r.data["document_type"] == "summons"
    assert r.data["plaintiff_name"] == "Bank of America"
    assert r.confidence > 0.5


@pytest.mark.asyncio
async def test_extracts_vehicle_loan_statement():
    payload = {
        "data": {"lender_name": "Toyota Financial Services", "current_balance": 14500, "monthly_payment": 320},
        "fieldConfidences": {"lender_name": 0.95, "current_balance": 0.92, "monthly_payment": 0.90},
        "warnings": [],
    }
    with patch.object(ai_extractor, "_client", _make_tool_client_mock(payload)):
        r = await extract_with_ai("Auto loan statement", "vehicle_loan_statement")

    assert r.data["lender_name"] == "Toyota Financial Services"
    assert r.data["current_balance"] == 14500
    assert r.confidence > 0.5


@pytest.mark.asyncio
async def test_extracts_mortgage_statement():
    payload = {
        "data": {"lender_name": "Wells Fargo Home Mortgage", "current_balance": 215000, "monthly_payment": 1650},
        "fieldConfidences": {"lender_name": 0.95, "current_balance": 0.92, "monthly_payment": 0.90},
        "warnings": [],
    }
    with patch.object(ai_extractor, "_client", _make_tool_client_mock(payload)):
        r = await extract_with_ai("Mortgage statement", "mortgage.us")

    assert r.data["lender_name"] == "Wells Fargo Home Mortgage"
    assert r.data["current_balance"] == 215000
    assert r.confidence > 0.5


@pytest.mark.asyncio
async def test_extracts_social_security_letter():
    payload = {
        "data": {"monthly_benefit": 1380, "benefit_type": "SSDI", "recipient_name": "Jane Doe"},
        "fieldConfidences": {"monthly_benefit": 0.95, "benefit_type": 0.88, "recipient_name": 0.92},
        "warnings": [],
    }
    with patch.object(ai_extractor, "_client", _make_tool_client_mock(payload)):
        r = await extract_with_ai("SSA award letter", "social_security_letter")

    assert r.data["monthly_benefit"] == 1380
    assert r.data["benefit_type"] == "SSDI"
    assert r.confidence > 0.5


@pytest.mark.asyncio
async def test_passes_through_doc_class_mismatch_warning():
    payload = {
        "data": {"employer_name": "Acme", "gross_pay": 3000, "net_pay": 2400},
        "fieldConfidences": {"employer_name": 0.90, "gross_pay": 0.85, "net_pay": 0.82},
        "warnings": ["Document appears to be a bank statement, not a paystub"],
    }
    with patch.object(ai_extractor, "_client", _make_tool_client_mock(payload)):
        r = await extract_with_ai("Bank of America statement text", "payStub.us")

    assert "Document appears to be a bank statement, not a paystub" in r.warnings


@pytest.mark.asyncio
async def test_schema_warning_when_required_field_missing():
    payload = {
        "data": {
            # missing lender_name (required for mortgage_statement)
            "current_balance": 200000,
        },
        "fieldConfidences": {"current_balance": 0.90},
        "warnings": ["Could not find lender name"],
    }
    with patch.object(ai_extractor, "_client", _make_tool_client_mock(payload)):
        r = await extract_with_ai("Mortgage statement without lender", "mortgage.us")

    assert r.confidence < 0.9
    assert len(r.warnings) > 0


@pytest.mark.asyncio
async def test_routes_ira_statement_through_retirement_schema():
    payload = {
        "data": {"institution_name": "Vanguard", "account_type": "IRA", "ending_balance": 52000},
        "fieldConfidences": {"institution_name": 0.95, "account_type": 0.90, "ending_balance": 0.92},
        "warnings": [],
    }
    with patch.object(ai_extractor, "_client", _make_tool_client_mock(payload)):
        r = await extract_with_ai("Vanguard IRA statement", "ira_statement")

    assert r.data["institution_name"] == "Vanguard"
    assert r.confidence > 0.5
