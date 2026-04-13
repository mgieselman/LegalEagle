"""
AI extractor using Claude.
Ported from server/src/services/extraction/aiExtractor.ts.
Returns RuleExtractionResult so it's interchangeable with rule extractors.
"""
from __future__ import annotations

import json
import os
import re

import anthropic

from config import EXTRACTION_MODEL
from schemas import RuleExtractionResult

_client: anthropic.AsyncAnthropic | None = None


def _get_client() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        key = os.environ.get("ANTHROPIC_API_KEY")
        if not key:
            raise ValueError("ANTHROPIC_API_KEY not set")
        _client = anthropic.AsyncAnthropic(api_key=key)
    return _client


SYSTEM_PROMPT = """You are a financial document data extractor for a bankruptcy law firm.
Extract structured data from the document text provided.
Return ONLY a JSON object (no markdown, no explanation) with these keys:
- "data": the extracted fields matching the schema provided
- "fieldConfidences": an object mapping each field name to a confidence score (0.0 to 1.0)
- "warnings": an array of strings noting any anomalies, missing data, or concerns

CONFIDENCE SCORING:
- 0.95–1.0: Value read directly from a clearly labeled field with no ambiguity
- 0.80–0.94: Value found via pattern matching with minor ambiguity
- 0.70–0.79: Value inferred or reconstructed from surrounding context
- 0.50–0.69: Value present but poorly labeled or one of multiple candidates
- <0.50: Value is a guess; likely to be wrong

SENSITIVE DATA RULES:
- SSN: Extract last 4 digits only. If the full SSN is visible, extract only the last 4 and add a warning that the full number was present.
- Bank and loan account numbers: Last 4 digits only. Exception: mortgage loan numbers may be extracted in full.
- EINs: May be extracted in full.

BEHAVIORAL RULES:
- Document class mismatch: If the provided doc class appears inconsistent with the document content, add a warning describing the apparent mismatch and attempt extraction using the provided class anyway.
- Required field missing: If a required field cannot be extracted, add a warning naming the missing field. Set all fieldConfidences low so overall confidence falls below 0.5.
- Omit unknown fields: Never emit null, 0, or "" for a field that cannot be determined. Omit the field entirely.
- Do not fabricate: If a value is not present in the document, omit it. Do not guess or interpolate.
- Numeric fields: Always use numbers (not strings). No currency symbols or commas.
- Date fields: ISO 8601 format — YYYY-MM-DD. If only month/year is available, use the first of the month."""

# Prompt templates per doc class (mirrors getExtractionPromptTemplate in schemas.ts)
_TEMPLATES: dict[str, str] = {
    "payStub.us": json.dumps({
        "employer_name": "string",
        "employee_name": "string",
        "pay_period_start": "YYYY-MM-DD",
        "pay_period_end": "YYYY-MM-DD",
        "pay_date": "YYYY-MM-DD",
        "pay_frequency": "weekly|biweekly|semimonthly|monthly",
        "gross_pay": 0,
        "federal_tax": 0,
        "state_tax": 0,
        "social_security": 0,
        "medicare": 0,
        "health_insurance": 0,
        "retirement_401k": 0,
        "other_deductions": [{"name": "string", "amount": 0}],
        "net_pay": 0,
        "ytd_gross": 0,
        "ytd_net": 0,
        "hours_worked": 0,
        "hourly_rate": 0,
    }, indent=2),

    "bankStatement.us.checking": json.dumps({
        "institution_name": "string",
        "account_type": "checking|savings",
        "account_number_last4": "string",
        "statement_period_start": "YYYY-MM-DD",
        "statement_period_end": "YYYY-MM-DD",
        "beginning_balance": 0,
        "ending_balance": 0,
        "total_deposits": 0,
        "total_withdrawals": 0,
        "transactions": [{"date": "YYYY-MM-DD", "description": "string", "amount": 0, "type": "credit|debit"}],
    }, indent=2),

    "tax.us.w2": json.dumps({
        "employer_name": "string",
        "employer_ein": "string",
        "employee_name": "string",
        "employee_ssn_last4": "string (last 4 digits only)",
        "tax_year": "YYYY",
        "wages": 0,
        "federal_tax_withheld": 0,
        "social_security_wages": 0,
        "social_security_tax": 0,
        "medicare_wages": 0,
        "medicare_tax": 0,
        "state": "string",
        "state_wages": 0,
        "state_tax": 0,
    }, indent=2),

    "tax.us.1040": json.dumps({
        "tax_year": "YYYY",
        "return_type": "federal|state",
        "filing_status": "single|married_jointly|married_separately|head_of_household|qualifying_surviving_spouse",
        "adjusted_gross_income": 0,
        "taxable_income": 0,
        "total_tax": 0,
        "total_payments": 0,
        "refund_amount": 0,
        "amount_owed": 0,
    }, indent=2),

    "creditCard": json.dumps({
        "issuer": "string (financial institution, not card network)",
        "account_number_last4": "string (last 4 digits only)",
        "statement_period_start": "YYYY-MM-DD",
        "statement_period_end": "YYYY-MM-DD",
        "previous_balance": 0,
        "payments": 0,
        "new_charges": 0,
        "ending_balance": 0,
        "minimum_payment_due": 0,
        "payment_due_date": "YYYY-MM-DD",
        "credit_limit": 0,
        "available_credit": 0,
        "cash_advances": 0,
    }, indent=2),

    "profit_loss_statement": json.dumps({
        "business_name": "string",
        "gross_revenue": 0,
        "net_profit": 0,
        "period_start": "YYYY-MM-DD",
        "period_end": "YYYY-MM-DD",
        "total_expenses": 0,
        "owner_name": "string",
        "cost_of_goods_sold": 0,
        "payroll_expenses": 0,
        "rent_expense": 0,
        "utilities": 0,
        "other_expenses": [{"name": "string", "amount": 0}],
    }, indent=2),

    "retirement_account": json.dumps({
        "institution_name": "string",
        "account_type": "IRA|401k|403b|pension|other_retirement",
        "ending_balance": 0,
        "account_number_last4": "string (last 4 digits only)",
        "statement_period_end": "YYYY-MM-DD",
        "account_holder_name": "string",
        "employer_name": "string",
    }, indent=2),

    "collection_letter": json.dumps({
        "collection_agency_name": "string",
        "amount_claimed": 0,
        "original_creditor": "string",
        "account_number_last4": "string (last 4 digits only)",
        "letter_date": "YYYY-MM-DD",
        "debt_type": "string (e.g. credit card, medical, auto loan)",
        "references_lawsuit": False,
        "references_judgment": False,
        "judgment_amount": 0,
        "court_name": "string",
        "collection_agency_address": "string",
        "phone": "string",
    }, indent=2),

    "legal_document": json.dumps({
        "document_type": "summons|complaint|judgment|garnishment_order|foreclosure_notice|other",
        "plaintiff_name": "string",
        "defendant_name": "string",
        "case_number": "string",
        "court_name": "string",
        "court_address": "string",
        "filing_date": "YYYY-MM-DD",
        "case_type": "string (e.g. debt collection, mortgage foreclosure)",
        "amount_claimed": 0,
        "judgment_amount": 0,
        "garnishment_amount": 0,
        "property_address": "string",
    }, indent=2),

    "vehicle_loan_statement": json.dumps({
        "lender_name": "string",
        "current_balance": 0,
        "account_number_last4": "string (last 4 digits only)",
        "interest_rate": 0.0699,
        "monthly_payment": 0,
        "vehicle_description": "string (e.g. 2021 Toyota Camry)",
        "loan_origination_date": "YYYY-MM-DD",
        "payoff_amount": 0,
        "lender_address": "string",
    }, indent=2),

    "mortgage.us": json.dumps({
        "lender_name": "string",
        "current_balance": 0,
        "loan_number": "string (full loan number)",
        "property_address": "string",
        "interest_rate": 0.065,
        "monthly_payment": 0,
        "statement_period_end": "YYYY-MM-DD",
        "loan_type": "first_mortgage|second_mortgage|heloc|other",
        "escrow_balance": 0,
        "payoff_amount": 0,
        "lender_address": "string",
    }, indent=2),

    "mortgage_payment": json.dumps({
        "lender_name": "string",
        "payment_amount": 0,
        "payment_date": "YYYY-MM-DD",
        "loan_number_last4": "string (last 4 digits of loan number)",
        "confirmation_number": "string",
    }, indent=2),

    "social_security_letter": json.dumps({
        "monthly_benefit": 0,
        "benefit_type": "SSDI|SSI|retirement|survivor|other",
        "effective_date": "YYYY-MM-DD",
        "recipient_name": "string",
        "net_monthly_benefit": 0,
        "medicare_premium": 0,
        "annual_benefit": 0,
    }, indent=2),

    "idDocument": json.dumps({
        "full_name": "string",
        "date_of_birth": "YYYY-MM-DD",
        "license_number": "string",
        "expiration_date": "YYYY-MM-DD",
        "address": "string",
        "state": "string (2-letter state code)",
        "sex": "M|F|X",
    }, indent=2),

    "social_security_card": json.dumps({
        "full_name": "string",
        "ssn_last4": "string (last 4 digits only — never extract full SSN)",
    }, indent=2),

    "brokerage_statement": json.dumps({
        "institution_name": "string",
        "account_holder_name": "string",
        "account_number_last4": "string (last 4 digits only)",
        "statement_period_start": "YYYY-MM-DD",
        "statement_period_end": "YYYY-MM-DD",
        "beginning_value": 0,
        "ending_value": 0,
    }, indent=2),

    "vehicle_title": json.dumps({
        "vin": "string",
        "year": "string",
        "make": "string",
        "model": "string",
    }, indent=2),

    "tax.us.1099": json.dumps({
        "form_variant": "1099-MISC|1099-NEC|1099-INT|1099-DIV|1099-R|1099-SSA|1099-G|other",
        "payer_name": "string",
        "recipient_name": "string",
        "recipient_ssn_last4": "string (last 4 digits only)",
        "tax_year": "YYYY",
        "total_amount": 0,
        "federal_tax_withheld": 0,
    }, indent=2),
}


def get_extraction_template(doc_class: str) -> str:
    """Return the JSON schema template for the given doc class."""
    if doc_class == "bankStatement.us.savings":
        return _TEMPLATES.get("bankStatement.us.checking", "{}")
    if doc_class in ("ira_statement", "401k_statement"):
        return _TEMPLATES.get("retirement_account", "{}")
    if doc_class == "tax.us.1099":
        return _TEMPLATES.get("tax.us.1099", "{}")
    return _TEMPLATES.get(doc_class, "{}")


def get_extraction_notes(doc_class: str) -> str:
    """Return doc-class-specific extraction guidance for the user prompt."""
    if doc_class == "payStub.us":
        return "\n".join([
            "- gross_pay must be the period amount, NOT year-to-date (YTD). If only YTD gross is shown, omit gross_pay and add a warning.",
            "- pay_frequency can often be inferred from the pay period start and end dates (e.g., 7-day span = weekly, 14-day = biweekly).",
            "- other_deductions captures labeled deductions that do not fit the named fields (union dues, HSA, garnishments, etc.).",
        ])

    if doc_class == "profit_loss_statement":
        return "\n".join([
            "- net_profit may be negative. Use a negative number — do not omit or zero it out.",
            "- Extract only what is explicitly labeled in the document. Do not compute unlabeled line items.",
            "- If this is an IRS Schedule C: gross_revenue = Part I Line 7, total_expenses = Part II Line 28, net_profit = Part II Line 31.",
        ])

    if doc_class == "tax.us.w2":
        return "\n".join([
            "- W-2 values are stored in PDF form fields that text-layer extractors often cannot read. If fields appear empty or all-zero, add a warning that form-field extraction may have failed.",
            "- employer_ein is the full EIN (e.g., \"25-0965591\") — do not truncate.",
            "- Never extract the full SSN. Last 4 digits only for employee_ssn_last4.",
            "- If multiple states appear (Box 15), extract the first state only and add a warning that additional states are present.",
        ])

    if doc_class == "tax.us.1040":
        return "\n".join([
            "- IRS Form 1040 prints dollar amounts below their labels, not beside them. Text-layer extraction often misassociates values with lines. Use surrounding context carefully.",
            "- filing_status is typically a checked box — normalize to one of: single, married_jointly, married_separately, head_of_household, qualifying_surviving_spouse.",
            "- Use separate refund_amount and amount_owed fields (never a signed number). Only one should be present per return.",
            "- If this is a state return, set return_type to \"state\" and extract adjusted_gross_income from the state equivalent line.",
        ])

    if doc_class in ("bankStatement.us.checking", "bankStatement.us.savings"):
        return "\n".join([
            "- Never extract full account numbers — last 4 digits only for account_number_last4.",
            "- Extract total_deposits and total_withdrawals from printed summary lines only. Do not sum individual transactions.",
            "- If the statement contains more than 50 transactions, skip the transactions array and add a warning.",
            "- If a single document covers multiple accounts, extract the primary account shown first and add a warning that additional accounts are present.",
            "- Use the institution's legal name as printed (e.g., \"Bank of America, N.A.\" not \"BofA\").",
        ])

    if doc_class == "creditCard":
        return "\n".join([
            "- issuer is the financial institution, not the card network. For store cards, include the store name (e.g., \"Amazon / Synchrony\").",
            "- Extract cash_advances explicitly, even if the amount is zero.",
        ])

    if doc_class == "collection_letter":
        return "\n".join([
            "- Extract both collection_agency_name and original_creditor when both appear — they are distinct entities.",
            "- amount_claimed is whatever total the letter demands, including any interest or fees the collector has added.",
            "- If the letter references a 30-day dispute window (debt validation notice), add a warning noting this.",
        ])

    if doc_class == "legal_document":
        return "\n".join([
            "- Legal documents are frequently photocopies or scans. Assign lower confidence scores for values that are hard to read.",
            "- plaintiff_name is the party initiating the action. If the debtor appears to be the plaintiff rather than the defendant, add a warning.",
            "- If a single upload contains multiple document types (e.g., a summons stapled to a complaint), extract from the primary document and note the attachment in warnings.",
        ])

    if doc_class == "idDocument":
        return "\n".join([
            "- This is OCR output from a physical driver's license or state ID card. OCR may introduce noise — use context to correct obvious errors.",
            "- license_number is the DL number, not the document number.",
            "- state is the issuing state (2-letter code, e.g. WA, CA, TX).",
            "- full_name: reconstruct 'FIRST LAST' from OCR output (DLs print names in ALL CAPS — normalize to title case).",
            "- Never extract full SSN even if visible on the card.",
        ])

    if doc_class == "social_security_card":
        return "\n".join([
            "- This is OCR output from a physical US Social Security card.",
            "- full_name: normalize ALL CAPS OCR output to title case.",
            "- ssn_last4: extract only the last 4 digits. If the full SSN is visible as NNN-NN-NNNN, take only the last group.",
            "- Never store the full 9-digit SSN under any field name.",
        ])

    if doc_class == "brokerage_statement":
        return "\n".join([
            "- beginning_value and ending_value are the total portfolio values, not individual holdings.",
            "- If the statement covers multiple accounts, extract the primary/combined totals.",
            "- account_number_last4: last 4 digits only.",
        ])

    if doc_class == "vehicle_title":
        return "\n".join([
            "- This is OCR output from a physical vehicle title certificate. OCR errors are common.",
            "- Only extract vin, year, make, and model. Ignore all other fields on the title.",
            "- vin is the 17-character Vehicle Identification Number. Verify length if possible.",
            "- make may be abbreviated (e.g. SUBA for Subaru, AMGN for AM General). Return exactly what the title shows.",
        ])

    if doc_class == "tax.us.1099":
        return "\n".join([
            "- form_variant identifies the specific 1099 type (1099-MISC, 1099-NEC, 1099-INT, 1099-DIV, 1099-R, 1099-SSA, 1099-G).",
            "- total_amount is the primary reportable amount (Box 1 for MISC/NEC, interest/dividends for INT/DIV, gross distribution for R).",
            "- recipient_ssn_last4: last 4 digits only. Never extract the full SSN.",
        ])

    return ""


_TEXT_LIMITS: dict[str, int] = {
    "tax.us.1040": 15000,
    "tax.us.w2": 5000,
    "tax.us.1099": 5000,
    "bankStatement.us.checking": 10000,
    "bankStatement.us.savings": 10000,
    "payStub.us": 5000,
    "creditCard": 5000,
    "idDocument": 3000,
    "social_security_card": 2000,
}
_DEFAULT_TEXT_LIMIT = 20000


def _truncate_text(text: str, doc_class: str) -> str:
    """Truncate document text to the per-doc-class limit to save tokens."""
    limit = _TEXT_LIMITS.get(doc_class, _DEFAULT_TEXT_LIMIT)
    if len(text) <= limit:
        return text
    return text[:limit] + "\n[...truncated]"


async def extract_with_ai(text: str, doc_class: str) -> RuleExtractionResult:
    """Extract structured data from document text using Claude AI."""
    from schemas import DOC_CLASS_SCHEMA

    client = _get_client()
    template = get_extraction_template(doc_class)
    notes = get_extraction_notes(doc_class)
    notes_section = f"\nExtraction notes:\n{notes}\n" if notes else ""

    # Truncate text per doc class (Phase 2G)
    text = _truncate_text(text, doc_class)

    model = EXTRACTION_MODEL

    # Try tool use for doc classes with a Pydantic schema
    schema_cls = DOC_CLASS_SCHEMA.get(doc_class)
    if schema_cls is not None:
        return await _extract_with_tool_use(
            client, model, schema_cls, doc_class, text, template, notes_section,
        )

    # Fallback: free-text JSON for doc classes without a Pydantic schema
    return await _extract_with_text(
        client, model, doc_class, text, template, notes_section,
    )


async def _extract_with_tool_use(
    client: anthropic.AsyncAnthropic,
    model: str,
    schema_cls: type,
    doc_class: str,
    text: str,
    template: str,
    notes_section: str,
) -> RuleExtractionResult:
    """Extract using Claude tool use for structured output."""
    json_schema = schema_cls.model_json_schema()
    # Remove Pydantic metadata that Claude doesn't need
    json_schema.pop("title", None)
    json_schema.pop("$defs", None)

    # Build the tool with an envelope: data + fieldConfidences + warnings
    tool_schema = {
        "type": "object",
        "properties": {
            "data": json_schema,
            "fieldConfidences": {
                "type": "object",
                "description": "Map of each field name to a confidence score (0.0 to 1.0)",
                "additionalProperties": {"type": "number"},
            },
            "warnings": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Any anomalies, missing data, or concerns about the extraction",
            },
        },
        "required": ["data", "fieldConfidences", "warnings"],
    }

    tool = {
        "name": "extract_fields",
        "description": f"Extract structured fields from a {doc_class.replace('_', ' ')} document",
        "input_schema": tool_schema,
    }

    message = await client.messages.create(
        model=model,
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        tools=[tool],
        tool_choice={"type": "tool", "name": "extract_fields"},
        messages=[
            {
                "role": "user",
                "content": (
                    f"Extract data from this {doc_class.replace('_', ' ')} document.\n\n"
                    f"Expected schema:\n{template}\n"
                    f"{notes_section}"
                    f"Document text:\n{text}"
                ),
            }
        ],
    )

    # Find the tool use block
    tool_block = None
    for block in message.content:
        if block.type == "tool_use":
            tool_block = block
            break

    if tool_block is None:
        return RuleExtractionResult(
            data={}, field_confidences={}, warnings=["AI did not return tool use block"], confidence=0.0,
        )

    raw = tool_block.input
    data = raw.get("data", {})
    field_confidences: dict[str, float] = raw.get("fieldConfidences", {})
    warnings: list[str] = raw.get("warnings", [])

    # Validate against Pydantic schema
    schema_valid = False
    try:
        validated = schema_cls.model_validate(data, strict=False)
        data = validated.model_dump(exclude_none=True)
        schema_valid = True
    except Exception:
        warnings = warnings + ["Extraction data did not fully match expected schema"]

    # Compute overall confidence
    confidence_values = list(field_confidences.values())
    if confidence_values:
        avg_confidence = sum(confidence_values) / len(confidence_values)
        if not schema_valid:
            avg_confidence *= 0.7
    else:
        avg_confidence = 0.65  # Phase 2F: lower default when no per-field confidences

    return RuleExtractionResult(
        data=data, field_confidences=field_confidences, warnings=warnings, confidence=avg_confidence,
    )


async def _extract_with_text(
    client: anthropic.AsyncAnthropic,
    model: str,
    doc_class: str,
    text: str,
    template: str,
    notes_section: str,
) -> RuleExtractionResult:
    """Fallback: extract using free-text JSON for doc classes without a schema."""
    message = await client.messages.create(
        model=model,
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": (
                    f"Extract data from this {doc_class.replace('_', ' ')} document.\n\n"
                    f"Expected schema:\n{template}\n"
                    f"{notes_section}"
                    f"Document text:\n{text}"
                ),
            }
        ],
    )

    response_text = message.content[0].text if message.content and message.content[0].type == "text" else ""
    json_match = re.search(r"\{[\s\S]*\}", response_text)
    if not json_match:
        return RuleExtractionResult(
            data={}, field_confidences={}, warnings=["Failed to parse AI extraction response"], confidence=0.0,
        )

    raw = json.loads(json_match.group())
    data = raw.get("data", raw) if isinstance(raw.get("data"), dict) else raw
    field_confidences: dict[str, float] = raw.get("fieldConfidences", {})
    warnings: list[str] = raw.get("warnings", [])

    confidence_values = list(field_confidences.values())
    if confidence_values:
        avg_confidence = sum(confidence_values) / len(confidence_values)
    else:
        avg_confidence = 0.65  # Phase 2F: lower default

    return RuleExtractionResult(
        data=data, field_confidences=field_confidences, warnings=warnings, confidence=avg_confidence,
    )
