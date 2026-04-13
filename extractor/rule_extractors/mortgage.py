"""
Rule-based mortgage statement extractor.
Handles monthly mortgage and HELOC statements.
"""
from __future__ import annotations

import re

from .utils import parse_dollar, normalize_date
from schemas import RuleExtractionResult

# ---- Pre-compiled regex constants ------------------------------------------

# Loan number: "Loan Number: 0141595306" or "Loan Number 0129442679"
RE_LOAN_NUMBER = re.compile(r"Loan\s+Number[:\s]+(\d{6,})", re.I)

# Statement date: "Statement Closing Date: 01/09/26" or "Statement Date 01/01/26"
RE_STMT_DATE = re.compile(
    r"Statement\s+(?:Closing\s+)?Date[:\s]+(\d{1,2}/\d{1,2}/\d{2,4})",
    re.I,
)

# Principal balance: "Principal Balance: $361,149.00" or "Outstanding Principal $659,975.72"
RE_PRINCIPAL = re.compile(
    r"(?:Principal Balance|Outstanding Principal)[:\s]*\$?([\d,]+\.\d{2})",
    re.I,
)

# Interest rate: "Interest Rate 3.875%" or "Interest Rate: 3.875%"
RE_INTEREST_RATE = re.compile(
    r"(?:^|\n).*?Interest Rate[:\s]+([\d.]+)\s*%",
    re.I,
)

# Payment amount: "Payment Amount: $4,077.79" or "Regular Monthly Payment $5,602.40"
RE_PAYMENT = re.compile(
    r"(?:Payment Amount|Regular Monthly Payment)[:\s]*\$?([\d,]+\.\d{2})",
    re.I,
)

# Escrow: "Escrow Balance: $0.00" or "Escrow Balance ($2,825.00)" or "Escrow Bal $0.00"
RE_ESCROW = re.compile(
    r"Escrow\s+(?:Balance|Bal)[:\s]*\(?\$?([\d,]+\.\d{2})\)?",
    re.I,
)

# Property address: "Property Address: 8707 W SNOQUALMIE..."  (multi-line)
RE_PROPERTY_ADDR = re.compile(
    r"Property\s+Address[:\s]+(.+?)(?:\n\s*([A-Z][A-Z\s]+,?\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?))?",
    re.I,
)

# Lender name from "Mail Payments To:" line
RE_MAIL_TO = re.compile(
    r"Mail\s+Payments?\s+To[:\s]+([A-Za-z][A-Za-z\s&.,']+?)(?:\n|$)",
    re.I,
)

# Loan type detection
RE_HELOC = re.compile(r"Home\s+Equity\s+Line|Credit\s+Limit|HELOC", re.I)
RE_MORTGAGE = re.compile(r"Mortgage\s+Statement", re.I)

# Credit limit (HELOC-specific)
RE_CREDIT_LIMIT = re.compile(r"Credit\s+Limit[:\s]*\$?([\d,]+\.\d{2})", re.I)

# Payoff
RE_PAYOFF = re.compile(r"Payoff\s+(?:Amount|Balance)[:\s]*\$?([\d,]+\.\d{2})", re.I)

# Known lenders
KNOWN_LENDERS = [
    "Central Loan Administration & Reporting",
    "Freedom Mortgage Corporation",
    "Freedom Mortgage",
    "Wells Fargo Home Mortgage",
    "Cenlar",
    "US Bank Home Mortgage",
    "Chase Home Lending",
    "Bank of America",
    "Nationstar Mortgage",
    "Mr. Cooper",
    "PennyMac",
    "Quicken Loans",
    "Rocket Mortgage",
    "loanDepot",
    "NewRez",
    "Caliber Home Loans",
    "Guild Mortgage",
]


def extract_mortgage_by_rules(text: str) -> RuleExtractionResult:
    """Extract fields from a mortgage or HELOC statement."""
    data: dict = {}
    field_confidences: dict[str, float] = {}
    warnings: list[str] = []

    # --- Lender Name ---
    lender = None
    for name in KNOWN_LENDERS:
        if name.lower() in text.lower():
            lender = name
            break
    if lender is None:
        m = RE_MAIL_TO.search(text)
        if m:
            lender = m.group(1).strip()
    if lender:
        data["lender_name"] = lender
        field_confidences["lender_name"] = 0.90

    # --- Loan Number ---
    m = RE_LOAN_NUMBER.search(text)
    if m:
        data["loan_number"] = m.group(1)
        field_confidences["loan_number"] = 0.95

    # --- Statement Date ---
    m = RE_STMT_DATE.search(text)
    if m:
        d = normalize_date(m.group(1))
        if d:
            data["statement_period_end"] = d
            field_confidences["statement_period_end"] = 0.90

    # --- Current Balance (Principal) ---
    m = RE_PRINCIPAL.search(text)
    if m:
        val = parse_dollar(m.group(1))
        if val is not None:
            data["current_balance"] = val
            field_confidences["current_balance"] = 0.90

    # --- Interest Rate ---
    m = RE_INTEREST_RATE.search(text)
    if m:
        try:
            rate = float(m.group(1))
            # Store as decimal (3.875% → 0.03875)
            if rate > 1:
                rate = rate / 100.0
            data["interest_rate"] = rate
            field_confidences["interest_rate"] = 0.90
        except ValueError:
            pass

    # --- Monthly Payment ---
    m = RE_PAYMENT.search(text)
    if m:
        val = parse_dollar(m.group(1))
        if val is not None:
            data["monthly_payment"] = val
            field_confidences["monthly_payment"] = 0.90

    # --- Escrow Balance ---
    m = RE_ESCROW.search(text)
    if m:
        val = parse_dollar(m.group(1))
        if val is not None:
            # Check for parenthetical negative
            full_match = m.group(0)
            if "(" in full_match and ")" in full_match:
                val = -abs(val)
            data["escrow_balance"] = val
            field_confidences["escrow_balance"] = 0.85

    # --- Property Address ---
    m = RE_PROPERTY_ADDR.search(text)
    if m:
        addr_parts = [m.group(1).strip()]
        if m.group(2):
            addr_parts.append(m.group(2).strip())
        addr = ", ".join(p for p in addr_parts if p)
        if addr:
            data["property_address"] = addr
            field_confidences["property_address"] = 0.85

    # --- Loan Type ---
    if RE_HELOC.search(text):
        data["loan_type"] = "heloc"
        field_confidences["loan_type"] = 0.90
    elif RE_MORTGAGE.search(text):
        data["loan_type"] = "first_mortgage"
        field_confidences["loan_type"] = 0.80

    # --- Payoff Amount ---
    m = RE_PAYOFF.search(text)
    if m:
        val = parse_dollar(m.group(1))
        if val is not None:
            data["payoff_amount"] = val
            field_confidences["payoff_amount"] = 0.90

    # --- Confidence scoring ---
    has_lender = "lender_name" in data
    has_balance = "current_balance" in data

    if not has_lender and not has_balance:
        confidence = 0.0
    elif not has_lender or not has_balance:
        confidence = 0.50
        if not has_lender:
            warnings.append("Could not extract lender name")
        if not has_balance:
            warnings.append("Could not extract current balance")
    else:
        bonus_fields = sum(1 for f in [
            "loan_number", "interest_rate", "monthly_payment",
            "statement_period_end", "property_address", "escrow_balance",
        ] if f in data)
        confidence = min(0.95, 0.80 + bonus_fields * 0.025)

    return RuleExtractionResult(
        data=data,
        field_confidences=field_confidences,
        warnings=warnings,
        confidence=confidence,
    )