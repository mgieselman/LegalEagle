"""
Rule-based extractor for vehicle/equipment loan payment history reports.

These are typically dealer or lender portal exports showing a transaction
ledger: origination, monthly payments, running principal balance.

Key fields extracted:
- account_number_last4 (from "Account: XXXXXXXX")
- current_balance (last principal balance in the ledger)
- monthly_payment (most common payment amount)
- loan_origination_date (first LOAN RECEIVABLES entry)
"""
from __future__ import annotations

import re
from collections import Counter

from schemas import RuleExtractionResult

# ---- Patterns ---------------------------------------------------------------

# "Account: 85009066"
_RE_ACCOUNT = re.compile(r"Account:\s*(\d+)", re.I)

# "LOAN RECEIVABLES 9/30/2020 C $27,819.00 $27,819.00"
_RE_ORIGINATION = re.compile(
    r"LOAN\s+RECEIVABLES\s+(\d{1,2}/\d{1,2}/\d{4})\s+C\s+\$?([\d,]+\.?\d*)",
    re.I,
)

# "PAYMENT 12/25/2025 C ($331.18) $6,954.66"
# Captures: date, payment amount (in parens = debit), principal balance after
_RE_PAYMENT_ROW = re.compile(
    r"PAYMENT\s+(\d{1,2}/\d{1,2}/\d{4})\s+C\s+\(\$?([\d,]+\.?\d*)\)\s+\$?([\d,]+\.?\d*)",
)

# "Generation Date: 02/04/2026"
_RE_GEN_DATE = re.compile(r"Generation\s+Date:\s*(\d{1,2}/\d{1,2}/\d{4})", re.I)


def _parse_date(raw: str) -> str:
    """Convert M/D/YYYY to YYYY-MM-DD."""
    parts = raw.split("/")
    if len(parts) != 3:
        return raw
    month, day, year = parts
    return f"{year}-{month.zfill(2)}-{day.zfill(2)}"


def _parse_amount(raw: str) -> float:
    return float(raw.replace(",", ""))


def extract_vehicle_loan_by_rules(text: str) -> RuleExtractionResult:
    """Extract fields from a vehicle/equipment loan payment history report."""
    data: dict[str, str | float] = {}
    confidences: dict[str, float] = {}
    warnings: list[str] = []

    # Account number (last 4)
    m = _RE_ACCOUNT.search(text)
    if m:
        full_acct = m.group(1)
        data["account_number_last4"] = full_acct[-4:]
        confidences["account_number_last4"] = 0.95

    # Origination
    m = _RE_ORIGINATION.search(text)
    if m:
        data["loan_origination_date"] = _parse_date(m.group(1))
        confidences["loan_origination_date"] = 0.92

    # Parse all payment rows
    payments = _RE_PAYMENT_ROW.findall(text)
    if payments:
        # Current balance = last payment row's principal balance
        last_row = payments[-1]
        try:
            data["current_balance"] = _parse_amount(last_row[2])
            confidences["current_balance"] = 0.95
        except ValueError:
            warnings.append(f"Could not parse final balance: {last_row[2]}")

        # Monthly payment = most common payment amount
        amounts = []
        for _, amt_str, _ in payments:
            try:
                amounts.append(_parse_amount(amt_str))
            except ValueError:
                pass

        if amounts:
            # Use the most frequent amount (handles occasional voids or adjustments)
            counter = Counter(amounts)
            most_common_amt, _ = counter.most_common(1)[0]
            data["monthly_payment"] = most_common_amt
            confidences["monthly_payment"] = 0.95
    else:
        warnings.append("No payment rows found in document")

    # Overall confidence
    conf_values = list(confidences.values())
    overall = sum(conf_values) / len(conf_values) if conf_values else 0.0

    # Must have at least balance to be useful
    if "current_balance" not in data:
        overall *= 0.5
        warnings.append("Could not determine current balance")

    return RuleExtractionResult(
        data=data,
        field_confidences=confidences,
        warnings=warnings,
        confidence=round(overall, 2),
    )
