"""
Rule-based extractor for US Social Security cards.

SSN cards are scanned images with notoriously bad Tesseract OCR. This
extractor uses fuzzy matching on known anchor text rather than exact patterns.

Key anchors:
- "THIS NUMBER HAS BEEN ESTABLISHED FOR" (followed by full name)
- SSN pattern: 3 digits, 2 digits, 4 digits (possibly garbled by OCR)

Only the last 4 digits of the SSN are ever extracted.
"""
from __future__ import annotations

import re

from schemas import RuleExtractionResult

# ---- Patterns ---------------------------------------------------------------

# The anchor text "THIS NUMBER HAS BEEN ESTABLISHED FOR" is unique to SSN cards
# but OCR frequently garbles it. Match fuzzy variants:
# "BEENTESTABLISHED", "BEEN ESTABLISHED", "BEENESTABLISHED", "EN ESTABLISHED"
_RE_ESTABLISHED_FOR = re.compile(
    r"(?:THIS\s+)?NUMBER\s+HAS\s+BEEN?\s*T?ESTABLISHED\s+FOR"
    r"|EN\s+ESTABLISHED\s+FOR",
    re.I,
)

# SSN pattern: NNN-NN-NNNN — OCR may insert spaces, drop dashes, or garble
_RE_SSN_CLEAN = re.compile(r"\b(\d{3})[- ]?(\d{2})[- ]?(\d{4})\b")

# OCR-garbled SSN: the last group of 4 digits often survives OCR even when
# the rest is corrupted. Look for patterns like "XXX#<space>NNNN" or similar
# where garbled digits precede a clean 4-digit group.
_RE_SSN_LAST4_FRAGMENT = re.compile(
    r"[0-9A-Za-z#]{3,}[#\s]+(\d{4})\b"
)


def _normalize_name(raw: str) -> str:
    """Clean OCR-garbled name: strip junk chars, normalize to title case."""
    # Remove common OCR noise: quotes, asterisks, stray punctuation, pipes
    cleaned = re.sub(r'["\'\*\#\@\!\?\(\)\[\]\{\}<>\|]', "", raw)
    # Remove stray single non-alpha chars surrounded by spaces
    cleaned = re.sub(r"\s+[^A-Za-z\s]\s+", " ", cleaned)
    # Remove leading/trailing non-alpha
    cleaned = re.sub(r"^[^A-Za-z]+|[^A-Za-z]+$", "", cleaned)
    # Collapse whitespace
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    # Title case
    return cleaned.title() if cleaned else ""


def _extract_name_after_anchor(text: str, anchor_end: int) -> str | None:
    """Extract name from the text following an ESTABLISHED FOR anchor.

    The name typically appears on the next 1-2 lines, possibly garbled.
    OCR often inserts garbage lines between first and last name.
    We collect all "name-like" lines (>60% alphabetic) from the first 6 lines.
    """
    after = text[anchor_end:anchor_end + 300]
    lines = after.split("\n")

    name_parts: list[str] = []
    for line in lines[:6]:  # Check up to 6 lines
        stripped = line.strip()
        if not stripped:
            continue
        # Clean the line
        cleaned = _normalize_name(stripped)
        if not cleaned or len(cleaned) < 2:
            continue
        # A name-like line should be mostly alphabetic
        alpha_count = sum(1 for c in cleaned if c.isalpha())
        total = len(cleaned)
        if alpha_count >= 3 and alpha_count / max(total, 1) > 0.6:
            name_parts.append(cleaned)
        # Stop after finding 3 name-like parts (first, middle, last)
        if len(name_parts) >= 3:
            break

    if name_parts:
        return " ".join(name_parts)
    return None


def extract_ssn_card_by_rules(text: str) -> RuleExtractionResult:
    """Extract fields from a US Social Security card (OCR text)."""
    data: dict[str, str] = {}
    confidences: dict[str, float] = {}
    warnings: list[str] = []

    # ---- SSN last 4 ----
    # Try clean pattern first
    ssn_match = _RE_SSN_CLEAN.search(text)
    if ssn_match:
        data["ssn_last4"] = ssn_match.group(3)
        confidences["ssn_last4"] = 0.95
    else:
        # Try fragment pattern (garbled prefix + clean last 4)
        ssn_match = _RE_SSN_LAST4_FRAGMENT.search(text)
        if ssn_match:
            data["ssn_last4"] = ssn_match.group(1)
            confidences["ssn_last4"] = 0.85
            warnings.append("SSN last 4 extracted from OCR-garbled text — verify manually")

    # ---- Full name ----
    # Find all "ESTABLISHED FOR" anchors, then try each one.
    # SSN cards often have the text twice (front and back of same scan).
    # The LAST match tends to be cleaner, so try in reverse order.
    established_matches = list(_RE_ESTABLISHED_FOR.finditer(text))

    best_name: str | None = None
    best_quality = 0.0

    for em in established_matches:
        name = _extract_name_after_anchor(text, em.end())
        if name:
            alpha_count = sum(1 for c in name if c.isalpha())
            total_len = len(name)
            # Real names are short (5-35 chars). Penalize excessively long
            # "names" — those are OCR garbage that happens to be alphabetic.
            length_penalty = 1.0 if total_len <= 35 else (35 / total_len)
            # Quality = alpha ratio * length penalty
            quality = (alpha_count / max(total_len, 1)) * length_penalty
            if quality > best_quality:
                best_name = name
                best_quality = quality

    if best_name and sum(1 for c in best_name if c.isalpha()) >= 3:
        data["full_name"] = best_name
        # Confidence based on how clean the name looks
        junk_ratio = sum(1 for c in best_name if not c.isalpha() and c != " " and c != "-") / max(len(best_name), 1)
        if junk_ratio < 0.1:
            confidences["full_name"] = 0.85
        elif junk_ratio < 0.2:
            confidences["full_name"] = 0.75
        else:
            confidences["full_name"] = 0.65
            warnings.append("Name contains OCR artifacts — verify manually")
    else:
        warnings.append("Could not find name on SSN card — OCR quality too poor")

    # Overall confidence
    conf_values = list(confidences.values())
    overall = sum(conf_values) / len(conf_values) if conf_values else 0.0

    if not data:
        overall = 0.0
        warnings.append("No fields could be extracted — document may need rescanning")

    return RuleExtractionResult(
        data=data,
        field_confidences=confidences,
        warnings=warnings,
        confidence=round(overall, 2),
    )
