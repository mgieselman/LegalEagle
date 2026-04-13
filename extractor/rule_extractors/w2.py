"""
W-2 form field extractor.
Ported from server/src/services/extraction/ruleExtractors/w2.ts.
Receives pre-extracted PDF form fields — no PDF re-parse needed.
If form fields are empty (text-layer W-2), returns confidence 0 and caller falls through to AI.
"""
from __future__ import annotations

from .utils import parse_dollar
from schemas import RuleExtractionResult

# IMPORTANT: More-specific entries MUST precede less-specific ones.
# "ss_wages" contains "wages" → Box 3 must be checked before Box 1.
# "medicare_wages" contains "wages" → Box 5 must be checked before Box 1.
FIELD_KEYWORD_MAP: list[tuple[list[str], str]] = [
    # Box 3: Social security wages
    (["box3", "f2_3", "ss_wage", "soc_sec_wage", "social_sec_w"], "social_security_wages"),
    # Box 4: Social security tax
    (["box4", "f2_4", "ss_tax", "soc_sec_tax", "social_sec_t"], "social_security_tax"),
    # Box 5: Medicare wages
    (["box5", "f2_5", "med_wage", "medicare_w", "med_tips", "medicare"], "medicare_wages"),
    # Box 6: Medicare tax
    (["box6", "f2_6", "med_tax", "medicare_t"], "medicare_tax"),
    # Box 1: Wages — after all more-specific entries above
    (["box1", "f2_1", "wages", "wag_tip", "c1_"], "wages"),
    # Box 2: Federal income tax withheld
    (["box2", "f2_2", "federal", "fed_tax", "inc_tax_wh"], "federal_tax_withheld"),
    # Employer fields
    (["employer_name", "emp_name", "employer_n", "c_name", "payer_name"], "employer_name"),
    (["ein", "employer_id", "fed_id", "emp_id_no"], "employer_ein"),
    # Employee fields
    (["employee_name", "empl_name", "emp_name_e"], "employee_name"),
    (["ssn", "employee_ssn", "soc_sec_no", "emp_ssn"], "employee_ssn_last4"),
    # Tax year
    (["tax_year", "taxyear", "year"], "tax_year"),
    # State fields (Box 15–17)
    (["state_w", "state_wage", "box16", "f2_16"], "state_wages"),
    (["state_tax", "box17", "f2_17"], "state_tax"),
    (["state", "box15", "f2_15"], "state"),
]

DOLLAR_FIELDS = {
    "wages", "federal_tax_withheld", "social_security_wages",
    "social_security_tax", "medicare_wages", "medicare_tax",
    "state_wages", "state_tax",
}

DOLLAR_BOX_FIELDS = [
    "wages", "federal_tax_withheld", "social_security_wages",
    "social_security_tax", "medicare_wages", "medicare_tax",
]


def _match_field_name(pdf_field_name: str) -> str | None:
    normalized = pdf_field_name.lower().replace(" ", "_").replace("-", "_")
    for keywords, field in FIELD_KEYWORD_MAP:
        for kw in keywords:
            if kw in normalized:
                return field
    return None


def extract_w2_by_form_fields(form_fields: dict[str, str]) -> RuleExtractionResult:
    """Extract W-2 data from pre-extracted PDF form fields.

    Returns confidence 0 when no form fields are found (text-layer W-2) —
    the caller falls through to AI extraction.
    """
    data: dict = {}
    field_confidences: dict[str, float] = {}
    warnings: list[str] = []

    if not form_fields:
        return RuleExtractionResult(
            data=data,
            field_confidences=field_confidences,
            warnings=["No PDF form fields found — W-2 may be text-layer, falling through to AI"],
            confidence=0.0,
        )

    for pdf_field, raw_value in form_fields.items():
        w2_field = _match_field_name(pdf_field)
        if w2_field is None or w2_field in data:  # first match wins
            continue

        if w2_field in DOLLAR_FIELDS:
            val = parse_dollar(raw_value)
            if val is not None:
                data[w2_field] = val
                field_confidences[w2_field] = 0.95
        elif w2_field == "employee_ssn_last4":
            digits = "".join(c for c in raw_value if c.isdigit())
            if len(digits) >= 4:
                data["employee_ssn_last4"] = digits[-4:]
                field_confidences["employee_ssn_last4"] = 0.95
        else:
            data[w2_field] = raw_value.strip()
            field_confidences[w2_field] = 0.9

    # Confidence: based on how many of the 6 key dollar boxes were found
    found_boxes = sum(1 for f in DOLLAR_BOX_FIELDS if f in data)
    confidence = 0.0
    if found_boxes >= 4:
        confidence = 0.90 + (found_boxes - 4) * 0.02  # 0.90, 0.92, 0.94
    elif found_boxes >= 2:
        confidence = 0.50 + found_boxes * 0.10         # 0.70, 0.80
    elif found_boxes >= 1:
        confidence = 0.40
    if data.get("employer_name"): confidence += 0.02
    if data.get("employer_ein"):  confidence += 0.02
    confidence = min(confidence, 1.0)

    if "wages" not in data:                warnings.append("wages (Box 1) not found in PDF form fields")
    if "federal_tax_withheld" not in data: warnings.append("federal_tax_withheld (Box 2) not found in PDF form fields")
    if "employer_name" not in data:        warnings.append("employer_name not found in PDF form fields")
    if found_boxes < 4:
        warnings.append(f"Only {found_boxes}/6 dollar boxes found — W-2 may use non-standard field names")

    return RuleExtractionResult(data=data, field_confidences=field_confidences, warnings=warnings, confidence=confidence)
