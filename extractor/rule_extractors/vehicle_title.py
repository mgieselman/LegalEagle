"""
Rule-based vehicle title extractor.

Extracts VIN, year, make, and model from OCR text of scanned vehicle title
certificates.

Designed for Washington State titles but should generalize to other states that
use a similar "label row -> value row" layout.
"""
from __future__ import annotations

import re

from schemas import RuleExtractionResult


# ---------------------------------------------------------------------------
# Pre-compiled patterns
# ---------------------------------------------------------------------------

# The label row printed on WA titles (and many other states).  Captures the
# position so we can grab the next non-empty line as the values row.
RE_VIN_LABEL_ROW = re.compile(
    r"Vehicle\s+Identification\s+Number\s*\(VIN\)\s*Year\s+Make\s+(?:=\.+\s+)?Model",
    re.I,
)

# Standalone VIN pattern -- 17 alnum chars (no I, O, Q in real VINs but OCR may
# produce them, so we accept any alnum).
RE_VIN_17 = re.compile(r"\b([A-HJ-NPR-Z0-9]{17})\b")
# Looser VIN -- some OCR output garbles 1-2 chars (e.g. spaces or lowercase).
# Accept 15-17 contiguous alnum.
RE_VIN_LOOSE = re.compile(r"\b([A-Za-z0-9]{15,17})\b")

# 4-digit year appearing near vehicle data
RE_YEAR = re.compile(r"\b(19\d{2}|20[0-2]\d)\b")


# ---------------------------------------------------------------------------
# Main extractor
# ---------------------------------------------------------------------------

def extract_vehicle_title_by_rules(text: str) -> RuleExtractionResult:
    """Extract VIN, year, make, and model from OCR text using regex rules."""
    data: dict[str, object] = {}
    confidences: dict[str, float] = {}
    warnings: list[str] = []

    # --- VIN, Year, Make, Model from the label->value row -------------------
    label_match = RE_VIN_LABEL_ROW.search(text)
    if label_match:
        # Skip the rest of the label line (the regex may not consume trailing
        # text like "Body style ...") -- advance to the next newline first.
        after_pos = text.find("\n", label_match.end())
        if after_pos == -1:
            after_pos = label_match.end()
        after = text[after_pos:]
        # Skip OCR noise lines (very short, non-alnum-heavy) and grab the first
        # substantive line that contains a 4-digit year (our primary anchor).
        for line in after.split("\n"):
            stripped = line.strip()
            alnum_chars = sum(1 for c in stripped if c.isalnum())
            if alnum_chars < 6:
                continue
            # Must contain a plausible vehicle year to be the values row
            if not RE_YEAR.search(stripped):
                continue
            _parse_values_row(stripped, data, confidences, warnings)
            break

    # --- Fallback: standalone VIN if not found from label row ---------------
    if "vin" not in data:
        vin_match = RE_VIN_17.search(text)
        if vin_match:
            data["vin"] = vin_match.group(1)
            confidences["vin"] = 0.80
        else:
            vin_loose = RE_VIN_LOOSE.search(text)
            if vin_loose and len(vin_loose.group(1)) >= 15:
                data["vin"] = vin_loose.group(1).upper()
                confidences["vin"] = 0.60
                warnings.append("VIN may be incomplete or contain OCR errors")

    # --- Confidence calculation ---------------------------------------------
    core_fields = ["vin", "year", "make", "model"]
    core_found = sum(1 for f in core_fields if f in data)
    if core_found == 0:
        return RuleExtractionResult(
            data={}, field_confidences={}, warnings=["No vehicle title fields found"], confidence=0.0,
        )

    # Overall confidence: average of found field confidences
    if confidences:
        avg = sum(confidences.values()) / len(confidences)
    else:
        avg = 0.0

    # Penalise if core fields are missing
    if core_found < len(core_fields):
        missing = [f for f in core_fields if f not in data]
        warnings.append(f"Missing core fields: {', '.join(missing)}")
        avg *= (core_found / len(core_fields))

    return RuleExtractionResult(
        data=data,
        field_confidences=confidences,
        warnings=warnings,
        confidence=avg,
    )


def _parse_values_row(
    row: str,
    data: dict[str, object],
    confidences: dict[str, float],
    warnings: list[str],
) -> None:
    """Parse the values row that appears below the VIN/Year/Make/Model label row.

    Expected layout (from OCR): VIN YEAR MAKE MODEL [trailing noise]
    Examples:
        "= 220784 1990 AMGN M1123 PICKUP TRU Ee"
        "4S4BSANC0K3202426 2019 | SUBA ..... OUTBACK . SPORTUTIL BE:"
    """
    # Clean up common OCR artifacts
    cleaned = row
    cleaned = re.sub(r"[=|]", " ", cleaned)          # pipe/equals separators
    cleaned = re.sub(r"\.{2,}", " ", cleaned)         # "...." runs
    cleaned = re.sub(r"\s{2,}", " ", cleaned)         # multiple spaces
    cleaned = cleaned.strip()

    # Tokenise
    tokens = cleaned.split()
    if not tokens:
        return

    # Strategy: find the 4-digit year token, then VIN is everything before it
    # (joined), make is the token after year, model after that.
    year_idx: int | None = None
    for i, tok in enumerate(tokens):
        if RE_YEAR.fullmatch(tok):
            year_idx = i
            break

    if year_idx is None:
        warnings.append("Could not find year in vehicle data row")
        return

    data["year"] = tokens[year_idx]
    confidences["year"] = 0.92

    # VIN: tokens before year, joined (OCR may split a VIN across spaces)
    vin_candidate = "".join(tokens[:year_idx]).upper()
    # Strip leading OCR noise (non-alnum chars at start)
    vin_candidate = re.sub(r"^[^A-Z0-9]+", "", vin_candidate)
    if len(vin_candidate) >= 6:
        data["vin"] = vin_candidate
        if len(vin_candidate) == 17:
            confidences["vin"] = 0.92
        else:
            confidences["vin"] = 0.65
            warnings.append(f"VIN is {len(vin_candidate)} chars (expected 17)")

    # Make: token immediately after year
    remaining = tokens[year_idx + 1:]
    # Filter out noise tokens (very short non-alpha tokens)
    filtered = [t for t in remaining if len(t) >= 2 and any(c.isalpha() for c in t)]

    if filtered:
        make = re.sub(r"[^A-Za-z]", "", filtered[0]).upper()
        if make:
            data["make"] = make
            confidences["make"] = 0.92

    if len(filtered) >= 2:
        model = re.sub(r"[^A-Za-z0-9]", "", filtered[1]).upper()
        if model:
            data["model"] = model
            confidences["model"] = 0.92
