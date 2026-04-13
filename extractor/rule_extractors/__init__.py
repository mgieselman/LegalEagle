"""
Rule extractor router.
Returns rule-based extraction results for supported doc classes.
Falls through (returns None) for unsupported classes — they go to AI.
"""
from __future__ import annotations

from schemas import RuleExtractionResult

from .paystub import extract_paystub_by_rules
from .bank_statement import extract_bank_statement_by_rules
from .w2 import extract_w2_by_form_fields
from .tax_return import extract_tax_return_by_rules
from .investment import extract_investment_by_rules
from .mortgage import extract_mortgage_by_rules

from config import EXTRACTION_CHAIN_THRESHOLD as RULE_EXTRACTION_THRESHOLD

__all__ = ["try_rule_extraction", "RuleExtractionResult", "RULE_EXTRACTION_THRESHOLD"]


def try_rule_extraction(
    doc_class: str,
    text: str,
    form_fields: dict[str, str],
) -> RuleExtractionResult | None:
    """Attempt rule-based extraction. Returns None for unsupported classes."""
    if doc_class == "payStub.us":
        return extract_paystub_by_rules(text)

    if doc_class in ("bankStatement.us.checking", "bankStatement.us.savings"):
        return extract_bank_statement_by_rules(text)

    if doc_class == "tax.us.w2":
        return extract_w2_by_form_fields(form_fields)

    if doc_class == "tax.us.1040":
        return extract_tax_return_by_rules(text)

    if doc_class in ("ira_statement", "brokerage_statement", "401k_statement", "retirement_account"):
        return extract_investment_by_rules(text, doc_class)

    if doc_class == "mortgage.us":
        return extract_mortgage_by_rules(text)

    return None
