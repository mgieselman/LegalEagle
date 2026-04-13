"""
Rule-based investment statement extractor.
Handles IRA, brokerage, 401k, and pension/retirement account statements.
"""
from __future__ import annotations

import re

from .utils import parse_dollar, normalize_date
from schemas import RuleExtractionResult

# ---- Statement period patterns ----

# "For the Period July 1- September 30, 2025" (E*TRADE)
RE_PERIOD_ETRADE = re.compile(
    r"For the Period\s+([A-Za-z]+ \d{1,2})\s*[-\u2013]\s*([A-Za-z]+ \d{1,2},?\s+\d{4})",
    re.I,
)

# "October 1, 2025 - December 31, 2025" (Fidelity Investment Report header)
RE_PERIOD_FIDELITY = re.compile(
    r"([A-Za-z]+ \d{1,2},?\s+\d{4})\s*[-\u2013]\s*([A-Za-z]+ \d{1,2},?\s+\d{4})",
    re.I,
)

# "Statement Period: 09/01/2025 to 09/30/2025" (Fidelity NetBenefits)
RE_PERIOD_NETBENEFITS = re.compile(
    r"Statement Period[:\s]+(\d{1,2}/\d{1,2}/\d{4})\s+to\s+(\d{1,2}/\d{1,2}/\d{4})",
    re.I,
)

# ---- Value patterns ----

# "Beginning Total Value (as of 7/1/25) $53.25" (E*TRADE)
RE_BEGINNING_VALUE_ETRADE = re.compile(
    r"Beginning Total Value\s+\(as of\s+(\d{1,2}/\d{1,2}/\d{2,4})\)\s*\$?([\d,]+\.\d{2})",
    re.I,
)
RE_ENDING_VALUE_ETRADE = re.compile(
    r"Ending Total Value\s+\(as of\s+(\d{1,2}/\d{1,2}/\d{2,4})\)\s*\$?([\d,]+\.\d{2})",
    re.I,
)

# "Beginning Account Value $39.08" or "Beginning Account Value $3.41 $3.32" (Fidelity; first is current period)
RE_BEGINNING_ACCT_VALUE = re.compile(
    r"Beginning Account Value\s*\*?\*?\s*\$?([\d,]+\.\d{2})",
    re.I,
)
RE_ENDING_ACCT_VALUE = re.compile(
    r"Ending Account Value\s*\*?\*?\s*\$?([\d,]+\.\d{2})",
    re.I,
)

# "Beginning Balance $42,012.29" (Fidelity NetBenefits 401k/pension)
RE_BEGINNING_BALANCE = re.compile(
    r"Beginning Balance\s*\$?([\d,]+\.\d{2})",
    re.I,
)
RE_ENDING_BALANCE = re.compile(
    r"Ending Balance\s*\*?\s*\$?([\d,]+\.\d{2})",
    re.I,
)

# "Your Account Value: $3.44" (Fidelity)
RE_ACCOUNT_VALUE = re.compile(
    r"Your Account Value[:\s]+\$?([\d,]+\.\d{2})",
    re.I,
)

# ---- Account number ----
RE_ACCT_NUM = re.compile(r"Account\s*(?:Number|#)[:\s]+([A-Z\d][\w\-]+)", re.I)

# ---- Institution / holder ----
RE_STATEMENT_FOR = re.compile(r"STATEMENT FOR[:\s]*\n\s*([A-Z][A-Z\s.]+)", re.I)
RE_FIDELITY_HOLDER = re.compile(
    r"(?:FIDELITY\s+(?:ROLLOVER\s+)?IRA|FIDELITY\s+ACCOUNT)\s+([A-Z][A-Z\s.]+?)(?:\s*-\s*)", re.I,
)

# ---- Account type detection ----
RE_401K = re.compile(r"401\s*\(?\s*k\s*\)?\s*Plan", re.I)
RE_PENSION = re.compile(r"Total Retirement Program|Pension", re.I)
RE_IRA = re.compile(r"\bIRA\b|Individual Retirement", re.I)

# ---- Employer (NetBenefits statements list employer above plan name) ----
# The employer name appears on the line BEFORE "Savings Plus 401(k)" or "Total Retirement Program"
RE_EMPLOYER = re.compile(
    r"([A-Z][A-Za-z\s&.,]+?)\s*\n\s*(?:Savings Plus|Total Retirement|.*401|.*Retirement Savings)",
    re.MULTILINE,
)

# Known institutions (longest first)
KNOWN_INSTITUTIONS = [
    "Morgan Stanley Smith Barney",
    "Fidelity NetBenefits",
    "Fidelity",
    "Charles Schwab",
    "Vanguard",
    "E*TRADE",
    "Merrill Lynch",
    "TD Ameritrade",
]


def _extract_institution_name(text: str) -> str | None:
    """Extract institution name from known list or header patterns."""
    for name in KNOWN_INSTITUTIONS:
        if name in text:
            return name
    
    # Special case for Fidelity patterns
    if "FIDELITY" in text.upper():
        if "NETBENEFITS" in text.upper():
            return "Fidelity NetBenefits"
        else:
            return "Fidelity"
    
    # Detect NetBenefits format by pattern (Statement Details + employer + Plan statement)
    if ("Statement Details" in text and 
        ("401" in text or "Total Retirement Program" in text) and
        "Retirement Savings Statement" in text):
        return "Fidelity NetBenefits"
    
    # Fallback: look for other financial institution patterns
    for line in text.split("\n")[:15]:
        line = line.strip()
        if "Morgan Stanley" in line:
            return "Morgan Stanley"
        if "E*TRADE" in line or "E*Trade" in line:
            return "E*TRADE"
    
    return None


def _extract_account_holder_name(text: str) -> str | None:
    """Extract account holder name."""
    # E*TRADE pattern
    match = RE_STATEMENT_FOR.search(text)
    if match:
        return match.group(1).strip()
    
    # Fidelity pattern
    match = RE_FIDELITY_HOLDER.search(text)
    if match:
        return match.group(1).strip()
    
    # NetBenefits pattern - name appears after employer and plan name
    lines = text.split("\n")
    for i, line in enumerate(lines[:20]):
        # Look for name after "Statement Details" and employer/plan info
        if "STATEMENT DETAILS" in line.upper() or "Statement Details" in line:
            # Skip next few lines that contain employer and plan names
            for j in range(i + 1, min(i + 6, len(lines))):
                potential_name = lines[j].strip()
                # Check if this looks like a name (all caps, has space)
                if (potential_name and 
                    potential_name.isupper() and 
                    " " in potential_name and
                    not any(keyword in potential_name for keyword in ["Corporation", "PLAN", "STATEMENT", "RETIREMENT", "401", "SAVINGS"])):
                    return potential_name
    
    return None


def _extract_account_number_last4(text: str) -> str | None:
    """Extract last 4 digits of account number."""
    match = RE_ACCT_NUM.search(text)
    if match:
        acct_str = match.group(1)
        # Extract digits only and get last 4
        digits = re.sub(r"\D", "", acct_str)
        if len(digits) >= 4:
            return digits[-4:]
    
    return None


def _extract_statement_period(text: str) -> tuple[str | None, str | None]:
    """Extract statement period start and end dates."""
    # E*TRADE format: "For the Period July 1- September 30, 2025"
    match = RE_PERIOD_ETRADE.search(text)
    if match:
        start_str = match.group(1)  # "July 1"
        end_str = match.group(2)    # "September 30, 2025"
        
        # Extract year from end date and add to start
        year_match = re.search(r"\d{4}", end_str)
        if year_match:
            year = year_match.group(0)
            start_full = f"{start_str}, {year}"
            return normalize_date(start_full), normalize_date(end_str)
    
    # Fidelity Investment Report: "October 1, 2025 - December 31, 2025"
    match = RE_PERIOD_FIDELITY.search(text)
    if match:
        return normalize_date(match.group(1)), normalize_date(match.group(2))
    
    # NetBenefits: "Statement Period: 09/01/2025 to 09/30/2025"
    match = RE_PERIOD_NETBENEFITS.search(text)
    if match:
        return normalize_date(match.group(1)), normalize_date(match.group(2))
    
    return None, None


def _extract_values(text: str) -> tuple[float | None, float | None]:
    """Extract beginning and ending values/balances."""
    beginning = None
    ending = None
    
    # Try E*TRADE patterns first
    match = RE_BEGINNING_VALUE_ETRADE.search(text)
    if match:
        beginning = parse_dollar(match.group(2))
        
    match = RE_ENDING_VALUE_ETRADE.search(text)
    if match:
        ending = parse_dollar(match.group(2))
    
    # If E*TRADE didn't work, try Fidelity Investment Report patterns
    if beginning is None:
        match = RE_BEGINNING_ACCT_VALUE.search(text)
        if match:
            beginning = parse_dollar(match.group(1))
    
    if ending is None:
        match = RE_ENDING_ACCT_VALUE.search(text)
        if match:
            ending = parse_dollar(match.group(1))
    
    # If still not found, try NetBenefits patterns
    if beginning is None:
        match = RE_BEGINNING_BALANCE.search(text)
        if match:
            beginning = parse_dollar(match.group(1))
    
    if ending is None:
        match = RE_ENDING_BALANCE.search(text)
        if match:
            ending = parse_dollar(match.group(1))
    
    # For ending value, also try "Your Account Value" as fallback
    if ending is None:
        match = RE_ACCOUNT_VALUE.search(text)
        if match:
            ending = parse_dollar(match.group(1))
    
    return beginning, ending


def _detect_account_type(text: str, doc_class: str) -> str:
    """Detect account type based on text content and doc_class."""
    # Default based on doc_class
    if doc_class == "ira_statement":
        return "IRA"
    elif doc_class == "401k_statement":
        return "401k"
    
    # For retirement_account, detect from text
    if RE_PENSION.search(text):
        return "pension"
    elif RE_401K.search(text):
        return "401k"
    elif RE_IRA.search(text):
        return "IRA"
    
    # Default for retirement_account if patterns don't match
    return "other_retirement"


def _extract_employer_name(text: str) -> str | None:
    """Extract employer name for 401k/pension statements."""
    # Look for patterns like:
    # Statement Details
    # 
    # Microsoft Corporation
    # Savings Plus 401(k) Plan...
    lines = text.split("\n")
    for i, line in enumerate(lines):
        line = line.strip()
        if line and (
            "Savings Plus" in line or 
            "Total Retirement Program" in line or
            ("401" in line and "Plan" in line) or
            "Retirement Savings Statement" in line
        ):
            # Look for company name in previous lines
            for j in range(max(0, i - 5), i):
                potential_employer = lines[j].strip()
                # Check if this looks like a company name
                if (potential_employer and 
                    not potential_employer.lower() in ["statement details", ""] and
                    potential_employer.replace(" ", "").replace(".", "").replace(",", "").isalpha() and
                    len(potential_employer) > 3):
                    # Clean up common suffixes
                    employer = re.sub(r'\s*(Corporation|Corp|Inc|LLC)\.?\s*$', r' \1', potential_employer, flags=re.I)
                    return employer.strip()
    
    return None


def extract_investment_by_rules(text: str, doc_class: str) -> RuleExtractionResult:
    """Extract investment statement data using rule-based patterns."""
    data: dict = {}
    field_confidences: dict[str, float] = {}
    warnings: list[str] = []
    
    # Extract common fields
    institution = _extract_institution_name(text)
    if institution:
        data["institution_name"] = institution
        field_confidences["institution_name"] = 0.85
    else:
        warnings.append("institution_name not found")
    
    holder = _extract_account_holder_name(text)
    if holder:
        data["account_holder_name"] = holder
        field_confidences["account_holder_name"] = 0.80
    
    acct_last4 = _extract_account_number_last4(text)
    if acct_last4:
        data["account_number_last4"] = acct_last4
        field_confidences["account_number_last4"] = 0.90
    
    period_start, period_end = _extract_statement_period(text)
    if period_end:
        data["statement_period_end"] = period_end
        field_confidences["statement_period_end"] = 0.90
    
    beginning_val, ending_val = _extract_values(text)
    
    # Return different schema based on doc_class
    if doc_class == "brokerage_statement":
        # BrokerageStatementData schema
        if beginning_val is not None:
            data["beginning_value"] = beginning_val
            field_confidences["beginning_value"] = 0.90
        else:
            warnings.append("beginning_value not found")
        
        if ending_val is not None:
            data["ending_value"] = ending_val
            field_confidences["ending_value"] = 0.90
        else:
            warnings.append("ending_value not found")
        
        if period_start:
            data["statement_period_start"] = period_start
            field_confidences["statement_period_start"] = 0.90
        
    else:
        # RetirementAccountData schema (for ira_statement, 401k_statement, retirement_account)
        account_type = _detect_account_type(text, doc_class)
        data["account_type"] = account_type
        field_confidences["account_type"] = 0.85
        
        if ending_val is not None:
            data["ending_balance"] = ending_val
            field_confidences["ending_balance"] = 0.90
        else:
            warnings.append("ending_balance not found")
        
        # For 401k/pension, try to extract employer
        if account_type in ("401k", "403b", "pension"):
            employer = _extract_employer_name(text)
            if employer:
                data["employer_name"] = employer
                field_confidences["employer_name"] = 0.80
    
    # Calculate confidence score
    confidence = 0.0
    
    # Base confidence if we have institution + ending value/balance
    if data.get("institution_name") and (data.get("ending_balance") is not None or data.get("ending_value") is not None):
        confidence = 0.80
        
        # Add confidence for additional fields
        if data.get("statement_period_end"):
            confidence += 0.05
        if data.get("account_holder_name"):
            confidence += 0.05
        if data.get("account_number_last4"):
            confidence += 0.05
        if data.get("account_type"):
            confidence += 0.05
        if data.get("employer_name"):
            confidence += 0.05
        if data.get("statement_period_start"):
            confidence += 0.05
        if data.get("beginning_value") is not None:
            confidence += 0.05
        
        # Cap at 0.95
        confidence = min(confidence, 0.95)
    
    return RuleExtractionResult(data=data, field_confidences=field_confidences, warnings=warnings, confidence=confidence)