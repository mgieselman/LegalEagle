"""
Rule-based 1040 tax return extractor.
Extracts structured fields from IRS Form 1040 text using line number patterns.
"""
from __future__ import annotations

import re

from .utils import parse_dollar
from schemas import RuleExtractionResult

# ---- Pre-compiled regex constants ------------------------------------------

# Tax year: "For the year Jan. 1–Dec. 31, 2023" or "Form 1040 ... 2023"
RE_TAX_YEAR_HEADER = re.compile(
    r"(?:For the year.*?|Form\s+1040.*?)\b(20\d{2})\b",
    re.I,
)

# Filing status — look for the standard IRS labels
RE_FILING_STATUS = re.compile(
    r"(Married filing jointly|Married filing separately|"
    r"Head of household|Qualifying surviving spouse|"
    r"Single)\b",
    re.I,
)

# Map extracted text → schema literals
_FILING_STATUS_MAP: dict[str, str] = {
    "single": "single",
    "married filing jointly": "married_jointly",
    "married filing separately": "married_separately",
    "head of household": "head_of_household",
    "qualifying surviving spouse": "qualifying_surviving_spouse",
}

# Line 11: adjusted gross income
# Matches "11 ... adjusted gross income ... 426,934"
RE_AGI = re.compile(
    r"(?:^|\n)\s*11\b.*?adjusted gross income\s*[\.\s]*\$?([\d,]+(?:\.\d{2})?)",
    re.I | re.S,
)

# Line 15: taxable income
RE_TAXABLE_INCOME = re.compile(
    r"(?:^|\n)\s*15\b.*?taxable income\s*[\.\s]*\$?([\d,]+(?:\.\d{2})?)",
    re.I | re.S,
)

# Line 24: total tax
RE_TOTAL_TAX = re.compile(
    r"(?:^|\n)\s*24\b.*?(?:total tax|your total tax)\s*[\.\s]*\$?([\d,]+(?:\.\d{2})?)",
    re.I | re.S,
)

# Line 33: total payments
RE_TOTAL_PAYMENTS = re.compile(
    r"(?:^|\n)\s*33\b.*?total payments\s*[\.\s]*\$?([\d,]+(?:\.\d{2})?)",
    re.I | re.S,
)

# Line 34: refund (overpaid)
RE_REFUND = re.compile(
    r"(?:^|\n)\s*34\b.*?(?:overpaid|refund)\s*[\.\s]*\$?([\d,]+(?:\.\d{2})?)",
    re.I | re.S,
)

# Line 37: amount owed
RE_AMOUNT_OWED = re.compile(
    r"(?:^|\n)\s*37\b.*?(?:amount you owe|amount owed)\s*[\.\s]*\$?([\d,]+(?:\.\d{2})?)",
    re.I | re.S,
)


def extract_tax_return_by_rules(text: str) -> RuleExtractionResult:
    """Extract fields from a 1040 tax return using IRS line number patterns."""
    data: dict = {}
    field_confidences: dict[str, float] = {}
    warnings: list[str] = []

    # --- Tax Year ---
    m = RE_TAX_YEAR_HEADER.search(text[:500])
    if m:
        data["tax_year"] = m.group(1)
        field_confidences["tax_year"] = 0.95
    else:
        warnings.append("Could not extract tax year")

    # --- Return Type (always federal for Form 1040) ---
    if re.search(r"Form\s+1040\b", text[:500], re.I):
        data["return_type"] = "federal"
        field_confidences["return_type"] = 0.95

    # --- Filing Status ---
    # Look in the filing status section (first ~2000 chars)
    filing_section = text[:2000]
    m = RE_FILING_STATUS.search(filing_section)
    if m:
        status_text = m.group(1).lower()
        mapped = _FILING_STATUS_MAP.get(status_text)
        if mapped:
            data["filing_status"] = mapped
            field_confidences["filing_status"] = 0.85

    # --- AGI (Line 11) ---
    m = RE_AGI.search(text)
    if m:
        val = parse_dollar(m.group(1))
        if val is not None:
            data["adjusted_gross_income"] = val
            field_confidences["adjusted_gross_income"] = 0.90

    # --- Taxable Income (Line 15) ---
    m = RE_TAXABLE_INCOME.search(text)
    if m:
        val = parse_dollar(m.group(1))
        if val is not None:
            data["taxable_income"] = val
            field_confidences["taxable_income"] = 0.90

    # --- Total Tax (Line 24) ---
    m = RE_TOTAL_TAX.search(text)
    if m:
        val = parse_dollar(m.group(1))
        if val is not None:
            data["total_tax"] = val
            field_confidences["total_tax"] = 0.90

    # --- Total Payments (Line 33) ---
    m = RE_TOTAL_PAYMENTS.search(text)
    if m:
        val = parse_dollar(m.group(1))
        if val is not None:
            data["total_payments"] = val
            field_confidences["total_payments"] = 0.90

    # --- Refund (Line 34) ---
    m = RE_REFUND.search(text)
    if m:
        val = parse_dollar(m.group(1))
        if val is not None:
            data["refund_amount"] = val
            field_confidences["refund_amount"] = 0.90

    # --- Amount Owed (Line 37) ---
    m = RE_AMOUNT_OWED.search(text)
    if m:
        val = parse_dollar(m.group(1))
        if val is not None:
            data["amount_owed"] = val
            field_confidences["amount_owed"] = 0.90

    # --- Confidence scoring ---
    required_fields = ["adjusted_gross_income"]
    has_required = all(f in data for f in required_fields)

    if not has_required:
        warnings.append("Missing required field: adjusted_gross_income")
        confidence = 0.0
    elif "tax_year" not in data:
        confidence = 0.70
    else:
        # Weight by number of fields found
        total_possible = 8  # all non-required fields + required ones
        found = len(field_confidences)
        confidence = min(0.95, 0.75 + (found / total_possible) * 0.20)

    return RuleExtractionResult(
        data=data,
        field_confidences=field_confidences,
        warnings=warnings,
        confidence=confidence,
    )