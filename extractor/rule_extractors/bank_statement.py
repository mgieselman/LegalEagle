"""
Rule-based bank statement extractor.
Ported from server/src/services/extraction/ruleExtractors/bankStatement.ts.
"""
from __future__ import annotations

import re

from .utils import parse_dollar, normalize_date
from schemas import RuleExtractionResult

# ---- Pre-compiled regex constants ------------------------------------------

RE_PERIOD_MONTH_RANGE = re.compile(
    r"(?:for\s+|statement\s+period[:\s]+)?([A-Za-z]+ \d{1,2},? \d{4})\s+(?:to|through|[-\u2013])\s+([A-Za-z]+ \d{1,2},? \d{4})",
    re.I,
)
RE_PERIOD_SLASH_RANGE = re.compile(
    r"(\d{1,2}/\d{1,2}/\d{4})\s+(?:to|through|[-\u2013])\s+(\d{1,2}/\d{1,2}/\d{4})",
    re.I,
)
# E*Trade/Morgan Stanley date format: MM-DD-YY through MM-DD-YY
RE_PERIOD_DASH_RANGE = re.compile(
    r"(\d{1,2}-\d{1,2}-\d{2,4})\s+(?:to|through|[-\u2013])\s+(\d{1,2}-\d{1,2}-\d{2,4})",
    re.I,
)
RE_BEGIN_DATE = re.compile(r"beginning\s+balance\s+on\s+([A-Za-z]+ \d{1,2},? \d{4})", re.I)
RE_END_DATE   = re.compile(r"ending\s+balance\s+on\s+([A-Za-z]+ \d{1,2},? \d{4})", re.I)
RE_STMT_DATE  = re.compile(r"statement\s+date[:\s]+([A-Za-z]+ \d{1,2},? \d{4})", re.I)

RE_BEGIN_BALANCE = re.compile(r"beginning\s+balance(?:\s+on\s+[A-Za-z]+ \d{1,2},? \d{4})?\s*\$?([\d,]+\.\d{2})", re.I)
RE_END_BALANCE   = re.compile(r"ending\s+balance(?:\s+on\s+[A-Za-z]+ \d{1,2},? \d{4})?\s*\$?([\d,]+\.\d{2})", re.I)

RE_DEPOSITS = re.compile(
    r"(?:total\s+deposits?\s+(?:and\s+other\s+)?(?:additions?|credits?)|deposits?\s+(?:&|and)\s+(?:other\s+)?(?:credits?|additions?))\s*[+]?\$?([\d,]+\.\d{2})",
    re.I,
)
RE_WITHDRAWALS_TOTAL = re.compile(
    r"(?:total\s+(?:withdrawals?|subtractions?|debits?))[:\s]*[-]?\$?([\d,]+\.\d{2})",
    re.I,
)
RE_WITHDRAWALS_COMPONENT = re.compile(
    r"(?:atm\s+(?:withdrawals?|&)|visa\s+check|debit\s+card|checks?\s+paid|other\s+(?:subtractions?|debits?)|withdrawals?\s+&)\s*[-]?\$?([\d,]+\.\d{2})",
    re.I,
)

# E*Trade credits/debits labels (may have "info_outline" suffix from web render)
RE_CREDITS_LABEL = re.compile(
    r"Credits(?:info_outline)?\s*\$?([\d,]+\.\d{2})",
    re.I,
)
RE_DEBITS_LABEL = re.compile(
    r"Debits(?:info_outline)?\s*\$?([\d,]+\.\d{2})",
    re.I,
)

RE_ACCT_NUMBER = re.compile(r"account\s*(?:#|number|no\.?)[:\s]+([X\d\s\-]{4,30})", re.I)
RE_ACCT_MASKED = re.compile(r"[xX*]{2,}(\d{4})\b")
RE_ACCT_LONG   = re.compile(r"account\S*\s+\d{3,4}\s+\d{4}\s+(\d{4})", re.I)

# E*Trade account number in sidebar: "Checking - 2007814870"
RE_ACCT_SIDEBAR = re.compile(
    r"(?:Checking|(?:Premium\s+)?Savings)\s*-\s*\n?\s*(\d{6,})",
    re.I,
)

RE_BANK_GENERIC = re.compile(
    r"([A-Z][A-Za-z\s&.,']+(?:Bank|Credit Union|Savings|Financial|N\.A\.|FSB)(?:,\s*N\.A\.)?)",
    re.I,
)
RE_ADDR_LINE = re.compile(r"\d+\s+\w+\s+(?:St|Ave|Blvd|Dr|Rd|Way|Ln)", re.I)
RE_CHECKING  = re.compile(r"checking", re.I)
RE_SAVINGS   = re.compile(r"savings", re.I)

# Sorted longest-first so most-specific name wins
KNOWN_BANKS: list[str] = [
    "Bank of America, N.A.",
    "Morgan Stanley Private Bank",
    "JPMorgan Chase Bank, N.A.",
    "JPMorgan Chase Bank",
    "Wells Fargo Bank",
    "Bank of America",
    "Royal Bank of Canada",
    "Huntington Bank",
    "Fifth Third Bank",
    "Citizens Bank",
    "Commerce Bank",
    "Carson Bank",
    "Regions Bank",
    "Morgan Stanley",
    "Capital One",
    "Wells Fargo",
    "Citibank",
    "U.S. Bank",
    "SunTrust",
    "RBC Bank",
    "Truist",
    "TD Bank",
    "PNC Bank",
    "KeyBank",
    "BB&T",
    "Chase",
]


def _extract_statement_period(text: str) -> tuple[str | None, str | None]:
    m = RE_PERIOD_MONTH_RANGE.search(text)
    if m:
        return normalize_date(m.group(1)), normalize_date(m.group(2))

    m = RE_PERIOD_SLASH_RANGE.search(text)
    if m:
        return normalize_date(m.group(1)), normalize_date(m.group(2))

    m = RE_PERIOD_DASH_RANGE.search(text)
    if m:
        return normalize_date(m.group(1)), normalize_date(m.group(2))

    begin_m = RE_BEGIN_DATE.search(text)
    end_m   = RE_END_DATE.search(text)
    if begin_m or end_m:
        return (
            normalize_date(begin_m.group(1)) if begin_m else None,
            normalize_date(end_m.group(1)) if end_m else None,
        )

    m = RE_STMT_DATE.search(text)
    if m:
        return None, normalize_date(m.group(1))

    return None, None


def _extract_institution_name(text: str) -> str | None:
    for name in KNOWN_BANKS:
        if name in text:
            return name

    m = RE_BANK_GENERIC.search(text[:500])
    if m:
        return m.group(1).strip()

    for line in text.split("\n")[:10]:
        l = line.strip()
        if re.match(r"^[A-Z][a-z]", l) and 4 < len(l) < 80 and not RE_ADDR_LINE.search(l):
            return l

    return None


def _extract_account_last4(text: str) -> str | None:
    m = RE_ACCT_NUMBER.search(text)
    if m:
        digits = re.sub(r"\D", "", m.group(1))
        if len(digits) >= 4:
            return digits[-4:]

    m = RE_ACCT_MASKED.search(text)
    if m:
        return m.group(1)

    m = RE_ACCT_LONG.search(text)
    if m:
        return m.group(1)

    m = RE_ACCT_SIDEBAR.search(text)
    if m:
        digits = m.group(1)
        return digits[-4:]

    return None


def extract_bank_statement_by_rules(text: str) -> RuleExtractionResult:
    data: dict = {}
    field_confidences: dict[str, float] = {}
    warnings: list[str] = []

    # --- Institution Name ---
    institution = _extract_institution_name(text)
    if institution:
        data["institution_name"] = institution
        field_confidences["institution_name"] = 0.85

    # --- Account Number Last 4 ---
    last4 = _extract_account_last4(text)
    if last4:
        data["account_number_last4"] = last4
        field_confidences["account_number_last4"] = 0.9

    # --- Statement Period ---
    start, end = _extract_statement_period(text)
    if start:
        data["statement_period_start"] = start
        field_confidences["statement_period_start"] = 0.9
    if end:
        data["statement_period_end"] = end
        field_confidences["statement_period_end"] = 0.9

    # --- Beginning Balance ---
    m = RE_BEGIN_BALANCE.search(text)
    if m:
        val = parse_dollar(m.group(1))
        if val is not None:
            data["beginning_balance"] = val
            field_confidences["beginning_balance"] = 0.9

    # --- Ending Balance ---
    m = RE_END_BALANCE.search(text)
    if m:
        val = parse_dollar(m.group(1))
        if val is not None:
            data["ending_balance"] = val
            field_confidences["ending_balance"] = 0.9

    # --- Total Deposits ---
    m = RE_DEPOSITS.search(text)
    if m:
        val = parse_dollar(m.group(1))
        if val is not None:
            data["total_deposits"] = val
            field_confidences["total_deposits"] = 0.9
    else:
        # Fallback: try E*Trade credits label
        m = RE_CREDITS_LABEL.search(text)
        if m:
            val = parse_dollar(m.group(1))
            if val is not None:
                data["total_deposits"] = val
                field_confidences["total_deposits"] = 0.85

    # --- Total Withdrawals ---
    m = RE_WITHDRAWALS_TOTAL.search(text)
    if m:
        val = parse_dollar(m.group(1))
        if val is not None:
            data["total_withdrawals"] = val
            field_confidences["total_withdrawals"] = 0.85
    else:
        # Fallback: sum component withdrawal lines from summary block
        total = 0.0
        found = False
        for wm in RE_WITHDRAWALS_COMPONENT.finditer(text[:2000]):
            val = parse_dollar(wm.group(1))
            if val is not None:
                total += abs(val)
                found = True
        if found and total > 0:
            data["total_withdrawals"] = total
            field_confidences["total_withdrawals"] = 0.75
        else:
            # Final fallback: try E*Trade debits label
            m = RE_DEBITS_LABEL.search(text)
            if m:
                val = parse_dollar(m.group(1))
                if val is not None:
                    data["total_withdrawals"] = val
                    field_confidences["total_withdrawals"] = 0.85

    # --- Account Type ---
    if RE_CHECKING.search(text):
        data["account_type"] = "checking"
        field_confidences["account_type"] = 0.85
    elif RE_SAVINGS.search(text):
        data["account_type"] = "savings"
        field_confidences["account_type"] = 0.85

    # --- Confidence scoring ---
    confidence = 0.0
    if data.get("institution_name"):               confidence += 0.25
    if data.get("beginning_balance") is not None:  confidence += 0.25
    if data.get("ending_balance") is not None:     confidence += 0.25
    if data.get("account_number_last4"):           confidence += 0.05
    if data.get("statement_period_start"):         confidence += 0.05
    if data.get("statement_period_end"):           confidence += 0.05
    if data.get("total_deposits") is not None:     confidence += 0.05
    if data.get("total_withdrawals") is not None:  confidence += 0.05
    confidence = min(confidence, 1.0)

    if not data.get("institution_name"):              warnings.append("institution_name not found")
    if data.get("beginning_balance") is None:         warnings.append("beginning_balance not found")
    if data.get("ending_balance") is None:            warnings.append("ending_balance not found")

    return RuleExtractionResult(data=data, field_confidences=field_confidences, warnings=warnings, confidence=confidence)
