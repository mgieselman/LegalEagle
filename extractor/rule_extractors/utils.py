"""
Shared utilities for rule extractors.
Ported from server/src/services/extraction/ruleExtractors/utils.ts.
"""
from __future__ import annotations

import re

# Pre-compiled patterns (module-level for performance)
_RE_DOLLAR = re.compile(r"^\s*\(?\$?\s*([\d,]+(?:\.\d{2})?)\s*\)?\s*$")
_RE_DATE_MDY = re.compile(r"^(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})$")
_RE_DATE_MONTH = re.compile(
    r"^(January|February|March|April|May|June|July|August|September|October|November|December)"
    r"\s+(\d{1,2}),?\s+(\d{4})$",
    re.I,
)
_RE_DATE_MDY_SLASH = re.compile(r"^(\d{1,2})/(\d{1,2})/(\d{4})$")

_MONTH_MAP = {
    "january": "01", "february": "02", "march": "03", "april": "04",
    "may": "05", "june": "06", "july": "07", "august": "08",
    "september": "09", "october": "10", "november": "11", "december": "12",
}


def parse_dollar(s: str) -> float | None:
    """Parse a dollar amount string to float.

    Handles: '1,234.56', '(1,234.56)', '$1,234.56', '-1234.56', '1234'
    Returns None if the string is not a recognizable dollar amount.
    """
    if not s or not s.strip():
        return None
    s = s.strip()
    # Handle parenthetical negatives: (1,234.56) → -1234.56
    negative = s.startswith("(") and s.endswith(")")
    m = _RE_DOLLAR.match(s)
    if not m:
        return None
    value = float(m.group(1).replace(",", ""))
    return -value if negative else value


def normalize_date(s: str) -> str | None:
    """Normalize a date string to YYYY-MM-DD.

    Handles: MM/DD/YYYY, MM/DD/YY, MM-DD-YYYY, Month DD YYYY, Month DD, YYYY
    Returns None if the string is not a recognizable date.
    """
    if not s or not s.strip():
        return None
    s = s.strip()

    # MM/DD/YYYY or MM-DD-YYYY
    m = _RE_DATE_MDY.match(s)
    if m:
        month, day, year = m.group(1), m.group(2), m.group(3)
        if len(year) == 2:
            year = ("20" if int(year) <= 50 else "19") + year
        return f"{year}-{int(month):02d}-{int(day):02d}"

    # Month DD, YYYY or Month DD YYYY
    m = _RE_DATE_MONTH.match(s)
    if m:
        month_name, day, year = m.group(1).lower(), m.group(2), m.group(3)
        month_num = _MONTH_MAP.get(month_name)
        if month_num:
            return f"{year}-{month_num}-{int(day):02d}"

    return None
