"""
Rule-based extractor for mortgage payment confirmation emails.

These are typically lender portal emails (Cenlar, Freedom Mortgage, etc.)
confirming a one-time payment was submitted. They contain minimal data:
lender name, payment amount, payment date, partial loan number, confirmation number.
"""
from __future__ import annotations

import re

from schemas import RuleExtractionResult

# ---- Known lender patterns --------------------------------------------------
_LENDER_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"\bCenlar\b", re.I), "Cenlar"),
    (re.compile(r"\bFreedom\s+Mortgage\b", re.I), "Freedom Mortgage Corporation"),
    (re.compile(r"\bWells\s+Fargo\b", re.I), "Wells Fargo"),
    (re.compile(r"\bChase\b", re.I), "Chase"),
    (re.compile(r"\bNewRez\b", re.I), "NewRez"),
    (re.compile(r"\bPennymac\b", re.I), "Pennymac"),
    (re.compile(r"\bLoancare\b", re.I), "LoanCare"),
    (re.compile(r"\bMr\.?\s*Cooper\b", re.I), "Mr. Cooper"),
]

# ---- Field patterns ---------------------------------------------------------

# "$5,871.29" or "$29167.65"
_RE_AMOUNT = re.compile(
    r"(?:amount\s+(?:of|to\s+transfer)[:\s]*|total\s+amount\s+to\s+transfer[:\s]*)"
    r"\$?([\d,]+\.?\d*)",
    re.I,
)

# "loan ending in *5306" or "Loan Number Ending in 2679"
_RE_LOAN_LAST4 = re.compile(
    r"loan\s+(?:number\s+)?ending\s+in\s+\*?(\d{4})",
    re.I,
)

# "12/24/2025" after "submitted on" or "Payment Date:"
_RE_PAYMENT_DATE = re.compile(
    r"(?:submitted\s+on|payment\s+date)[:\s]*(\d{1,2}/\d{1,2}/\d{2,4})",
    re.I,
)

# "confirmation number is 1766593475532" or "Confirmation Number: 01294426790039"
_RE_CONFIRMATION = re.compile(
    r"confirmation\s+number[:\s]+(?:is\s+)?(\d+)",
    re.I,
)


def _parse_date(raw: str) -> str:
    """Convert MM/DD/YYYY or MM/DD/YY to YYYY-MM-DD."""
    parts = raw.split("/")
    if len(parts) != 3:
        return raw
    month, day, year = parts
    if len(year) == 2:
        year = f"20{year}"
    return f"{year}-{month.zfill(2)}-{day.zfill(2)}"


def extract_mortgage_payment_by_rules(text: str) -> RuleExtractionResult:
    """Extract fields from a mortgage payment confirmation email."""
    data: dict[str, str | float] = {}
    confidences: dict[str, float] = {}
    warnings: list[str] = []

    # Lender name
    for pattern, lender_name in _LENDER_PATTERNS:
        if pattern.search(text):
            data["lender_name"] = lender_name
            confidences["lender_name"] = 0.95
            break
    else:
        warnings.append("Could not identify lender from payment email")

    # Payment amount
    m = _RE_AMOUNT.search(text)
    if m:
        raw_amount = m.group(1).replace(",", "")
        try:
            data["payment_amount"] = float(raw_amount)
            confidences["payment_amount"] = 0.95
        except ValueError:
            warnings.append(f"Could not parse payment amount: {raw_amount}")
    else:
        warnings.append("Payment amount not found")

    # Loan number last 4
    m = _RE_LOAN_LAST4.search(text)
    if m:
        data["loan_number_last4"] = m.group(1)
        confidences["loan_number_last4"] = 0.95

    # Payment date
    m = _RE_PAYMENT_DATE.search(text)
    if m:
        data["payment_date"] = _parse_date(m.group(1))
        confidences["payment_date"] = 0.92

    # Confirmation number
    m = _RE_CONFIRMATION.search(text)
    if m:
        data["confirmation_number"] = m.group(1)
        confidences["confirmation_number"] = 0.95

    # Overall confidence
    conf_values = list(confidences.values())
    overall = sum(conf_values) / len(conf_values) if conf_values else 0.0

    # Must have at least lender + amount to be useful
    if "lender_name" not in data or "payment_amount" not in data:
        overall *= 0.5
        warnings.append("Missing critical fields (lender_name or payment_amount)")

    return RuleExtractionResult(
        data=data,
        field_confidences=confidences,
        warnings=warnings,
        confidence=round(overall, 2),
    )
