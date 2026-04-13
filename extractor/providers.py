"""
DI infrastructure for the extraction pipeline.

Defines protocols for extraction and classification providers, chain execution
logic, pipeline configuration, and adapter classes that wrap existing extractors
and classifiers as providers.

The pipeline is configured via PipelineConfig, which maps doc classes to ordered
chains of providers.  Providers are tried in sequence; the first to return a
result above the chain's confidence threshold wins.  If none do, the last
non-None result is used (later providers are more capable, so their sub-threshold
results are preferred).
"""
from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from typing import Protocol

from classifier import (
    ClassificationResult,
    boost_with_filename,
    classify_by_rules,
    classify_with_ai,
)
from config import AI_CONFIDENCE_THRESHOLD, EXTRACTION_CHAIN_THRESHOLD, RULE_CONFIDENCE_THRESHOLD
from schemas import RuleExtractionResult

logger = logging.getLogger(__name__)

# Keep backward compatibility for any callers using the old alias
ProviderResult = RuleExtractionResult


# ---------------------------------------------------------------------------
# Protocols
# ---------------------------------------------------------------------------

class ExtractionProvider(Protocol):
    """Any callable that can extract fields from a document."""

    @property
    def name(self) -> str: ...

    async def extract(
        self,
        *,
        doc_class: str,
        text: str,
        content: bytes,
        form_fields: dict[str, str],
    ) -> ProviderResult | None:
        """Return extraction result, or None if this provider can't handle the doc_class."""
        ...


class ClassificationProvider(Protocol):
    """Any callable that can classify a document."""

    @property
    def name(self) -> str: ...

    async def classify(
        self,
        *,
        text: str,
        content: bytes | None = None,
        filename: str | None = None,
    ) -> ClassificationResult | None:
        """Return classification result, or None to defer to next provider."""
        ...


# ---------------------------------------------------------------------------
# Chain execution
# ---------------------------------------------------------------------------

@dataclass
class ExtractionChain:
    providers: list[ExtractionProvider]
    threshold: float = EXTRACTION_CHAIN_THRESHOLD


async def run_extraction_chain(
    chain: ExtractionChain,
    doc_class: str,
    text: str,
    content: bytes,
    form_fields: dict[str, str],
) -> tuple[ProviderResult | None, str]:
    """Try providers in order.  Return (result, provider_name) for the first
    that returns confidence >= threshold, or the last non-None result."""
    last: tuple[ProviderResult | None, str] = (None, "unclassified")
    for provider in chain.providers:
        try:
            result = await provider.extract(
                doc_class=doc_class, text=text, content=content, form_fields=form_fields,
            )
        except Exception:
            logger.warning("Provider %s failed for %s", provider.name, doc_class, exc_info=True)
            continue
        if result is None:
            continue
        last = (result, provider.name)
        if result.confidence >= chain.threshold:
            return last
    return last


async def run_classification_chain(
    classifiers: list[ClassificationProvider],
    text: str,
    filename: str | None = None,
) -> ClassificationResult:
    """Walk classifiers in order.  Return the first above-threshold result,
    or the last non-None non-unclassified result, or 'unclassified'.

    Later classifiers are assumed more capable, so their sub-threshold results
    replace earlier ones (matching the existing rule → AI fallback behavior).
    """
    best_sub: ClassificationResult | None = None
    for classifier in classifiers:
        try:
            result = await classifier.classify(text=text, filename=filename)
        except Exception:
            logger.warning("Classifier %s failed", classifier.name, exc_info=True)
            continue
        if result is None:
            continue
        if result.confidence >= RULE_CONFIDENCE_THRESHOLD:
            return result
        if result.doc_class != "unclassified":
            best_sub = result  # Later result replaces earlier (more capable)
    if best_sub is not None:
        return best_sub
    return ClassificationResult(doc_class="unclassified", confidence=0.0, method="rule_engine")


# ---------------------------------------------------------------------------
# Pipeline config
# ---------------------------------------------------------------------------

@dataclass
class PipelineConfig:
    classifiers: list[ClassificationProvider]
    default_extractors: ExtractionChain
    extractor_overrides: dict[str, ExtractionChain]

    def chain_for(self, doc_class: str) -> ExtractionChain:
        return self.extractor_overrides.get(doc_class, self.default_extractors)


# ---------------------------------------------------------------------------
# Provider adapters — extraction
# ---------------------------------------------------------------------------

class RulePaystubExtractor:
    """Adapter for extract_paystub_by_rules."""

    @property
    def name(self) -> str:
        return "rule_engine:paystub"

    async def extract(
        self,
        *,
        doc_class: str,
        text: str,
        content: bytes,
        form_fields: dict[str, str],
    ) -> ProviderResult | None:
        if doc_class != "payStub.us":
            return None
        from rule_extractors.paystub import extract_paystub_by_rules
        return extract_paystub_by_rules(text)


class RuleBankExtractor:
    """Adapter for extract_bank_statement_by_rules."""

    @property
    def name(self) -> str:
        return "rule_engine:bank_statement"

    async def extract(
        self,
        *,
        doc_class: str,
        text: str,
        content: bytes,
        form_fields: dict[str, str],
    ) -> ProviderResult | None:
        if doc_class not in ("bankStatement.us.checking", "bankStatement.us.savings"):
            return None
        from rule_extractors.bank_statement import extract_bank_statement_by_rules
        return extract_bank_statement_by_rules(text)


class RuleW2Extractor:
    """Adapter for extract_w2_by_form_fields."""

    @property
    def name(self) -> str:
        return "rule_engine:w2"

    async def extract(
        self,
        *,
        doc_class: str,
        text: str,
        content: bytes,
        form_fields: dict[str, str],
    ) -> ProviderResult | None:
        if doc_class != "tax.us.w2":
            return None
        from rule_extractors.w2 import extract_w2_by_form_fields
        return extract_w2_by_form_fields(form_fields)


class RuleTaxReturnExtractor:
    """Adapter for extract_tax_return_by_rules."""

    @property
    def name(self) -> str:
        return "rule_engine:tax_return"

    async def extract(
        self,
        *,
        doc_class: str,
        text: str,
        content: bytes,
        form_fields: dict[str, str],
    ) -> ProviderResult | None:
        if doc_class != "tax.us.1040":
            return None
        from rule_extractors.tax_return import extract_tax_return_by_rules
        return extract_tax_return_by_rules(text)


class RuleInvestmentExtractor:
    """Adapter for extract_investment_by_rules."""

    @property
    def name(self) -> str:
        return "rule_engine:investment"

    async def extract(
        self,
        *,
        doc_class: str,
        text: str,
        content: bytes,
        form_fields: dict[str, str],
    ) -> ProviderResult | None:
        if doc_class not in ("ira_statement", "brokerage_statement", "401k_statement", "retirement_account"):
            return None
        from rule_extractors.investment import extract_investment_by_rules
        return extract_investment_by_rules(text, doc_class)


class RuleMortgageExtractor:
    """Adapter for extract_mortgage_by_rules."""

    @property
    def name(self) -> str:
        return "rule_engine:mortgage"

    async def extract(
        self,
        *,
        doc_class: str,
        text: str,
        content: bytes,
        form_fields: dict[str, str],
    ) -> ProviderResult | None:
        if doc_class != "mortgage.us":
            return None
        from rule_extractors.mortgage import extract_mortgage_by_rules
        return extract_mortgage_by_rules(text)


class RuleMortgagePaymentExtractor:
    """Adapter for extract_mortgage_payment_by_rules."""

    @property
    def name(self) -> str:
        return "rule_engine:mortgage_payment"

    async def extract(
        self,
        *,
        doc_class: str,
        text: str,
        content: bytes,
        form_fields: dict[str, str],
    ) -> ProviderResult | None:
        if doc_class != "mortgage_payment":
            return None
        from rule_extractors.mortgage_payment import extract_mortgage_payment_by_rules
        return extract_mortgage_payment_by_rules(text)


class RuleVehicleLoanExtractor:
    """Adapter for extract_vehicle_loan_by_rules."""

    @property
    def name(self) -> str:
        return "rule_engine:vehicle_loan"

    async def extract(
        self,
        *,
        doc_class: str,
        text: str,
        content: bytes,
        form_fields: dict[str, str],
    ) -> ProviderResult | None:
        if doc_class != "vehicle_loan_statement":
            return None
        from rule_extractors.vehicle_loan import extract_vehicle_loan_by_rules
        return extract_vehicle_loan_by_rules(text)


class RuleSSNCardExtractor:
    """Adapter for extract_ssn_card_by_rules."""

    @property
    def name(self) -> str:
        return "rule_engine:ssn_card"

    async def extract(
        self,
        *,
        doc_class: str,
        text: str,
        content: bytes,
        form_fields: dict[str, str],
    ) -> ProviderResult | None:
        if doc_class != "social_security_card":
            return None
        from rule_extractors.social_security_card import extract_ssn_card_by_rules
        return extract_ssn_card_by_rules(text)


class RuleTitleExtractor:
    """Adapter for extract_vehicle_title_by_rules."""

    @property
    def name(self) -> str:
        return "rule_engine:vehicle_title"

    async def extract(
        self,
        *,
        doc_class: str,
        text: str,
        content: bytes,
        form_fields: dict[str, str],
    ) -> ProviderResult | None:
        if doc_class != "vehicle_title":
            return None
        from rule_extractors.vehicle_title import extract_vehicle_title_by_rules
        return extract_vehicle_title_by_rules(text)


class ClaudeExtractor:
    """Adapter for extract_with_ai."""

    @property
    def name(self) -> str:
        return "ai_parse"

    async def extract(
        self,
        *,
        doc_class: str,
        text: str,
        content: bytes,
        form_fields: dict[str, str],
    ) -> ProviderResult | None:
        from ai_extractor import extract_with_ai
        return await extract_with_ai(text, doc_class)


# ---------------------------------------------------------------------------
# Provider adapters — classification
# ---------------------------------------------------------------------------

class RuleClassifier:
    """Adapter for classify_by_rules + boost_with_filename."""

    @property
    def name(self) -> str:
        return "rule_engine"

    async def classify(
        self,
        *,
        text: str,
        content: bytes | None = None,
        filename: str | None = None,
    ) -> ClassificationResult | None:
        result = classify_by_rules(text)
        if filename:
            result = boost_with_filename(result, filename)
        return result


class ClaudeClassifier:
    """Adapter for classify_with_ai.  Returns None when confidence < AI threshold."""

    @property
    def name(self) -> str:
        return "ai"

    async def classify(
        self,
        *,
        text: str,
        content: bytes | None = None,
        filename: str | None = None,
    ) -> ClassificationResult | None:
        result = await classify_with_ai(text)
        if result.confidence < AI_CONFIDENCE_THRESHOLD:
            return None
        return result


# ---------------------------------------------------------------------------
# Config presets
# ---------------------------------------------------------------------------

def _build_current_config() -> PipelineConfig:
    """Default config: Rule → Azure DI → Claude extraction chain.

    AzureDIExtractor.extract() returns None when Azure env vars are missing
    (the ValueError from _get_client is caught by the blanket try/except),
    so it falls through to Claude gracefully in dev environments.
    """
    from azure_extractor import AzureDIExtractor

    azure = AzureDIExtractor()
    return PipelineConfig(
        classifiers=[RuleClassifier(), ClaudeClassifier()],
        default_extractors=ExtractionChain([azure, ClaudeExtractor()]),
        extractor_overrides={
            "payStub.us": ExtractionChain([RulePaystubExtractor(), azure, ClaudeExtractor()]),
            "bankStatement.us.checking": ExtractionChain([RuleBankExtractor(), azure, ClaudeExtractor()]),
            "bankStatement.us.savings": ExtractionChain([RuleBankExtractor(), azure, ClaudeExtractor()]),
            "tax.us.w2": ExtractionChain([RuleW2Extractor(), azure, ClaudeExtractor()]),
            "tax.us.1040": ExtractionChain([RuleTaxReturnExtractor(), azure, ClaudeExtractor()]),
            "ira_statement": ExtractionChain([RuleInvestmentExtractor(), ClaudeExtractor()]),
            "brokerage_statement": ExtractionChain([RuleInvestmentExtractor(), ClaudeExtractor()]),
            "401k_statement": ExtractionChain([RuleInvestmentExtractor(), ClaudeExtractor()]),
            "retirement_account": ExtractionChain([RuleInvestmentExtractor(), ClaudeExtractor()]),
            "mortgage.us": ExtractionChain([RuleMortgageExtractor(), ClaudeExtractor()]),
            "mortgage_payment": ExtractionChain([RuleMortgagePaymentExtractor(), ClaudeExtractor()]),
            "creditCard": ExtractionChain([azure, ClaudeExtractor()]),
            "idDocument": ExtractionChain([azure, ClaudeExtractor()]),
            "social_security_card": ExtractionChain([RuleSSNCardExtractor(), azure, ClaudeExtractor()]),
            # No Azure DI prebuilt model — Claude only
            "legal_document": ExtractionChain([ClaudeExtractor()]),
            "vehicle_loan_statement": ExtractionChain([RuleVehicleLoanExtractor(), ClaudeExtractor()]),
            "vehicle_title": ExtractionChain([RuleTitleExtractor(), ClaudeExtractor()]),
        },
    )


CURRENT_CONFIG = _build_current_config()


def _build_azure_eval_config() -> PipelineConfig:
    """Azure DI evaluation: inserts AzureDIExtractor into chains for supported doc classes."""
    from azure_extractor import AzureDIExtractor

    azure = AzureDIExtractor()
    return PipelineConfig(
        classifiers=[RuleClassifier(), ClaudeClassifier()],
        default_extractors=ExtractionChain([ClaudeExtractor()]),
        extractor_overrides={
            "payStub.us": ExtractionChain([RulePaystubExtractor(), azure, ClaudeExtractor()]),
            "tax.us.w2": ExtractionChain([RuleW2Extractor(), azure, ClaudeExtractor()]),
            "tax.us.1040": ExtractionChain([azure, ClaudeExtractor()]),
            "bankStatement.us.checking": ExtractionChain([RuleBankExtractor(), azure, ClaudeExtractor()]),
            "bankStatement.us.savings": ExtractionChain([RuleBankExtractor(), azure, ClaudeExtractor()]),
            "creditCard": ExtractionChain([azure, ClaudeExtractor()]),
            "idDocument": ExtractionChain([azure, ClaudeExtractor()]),
            "social_security_card": ExtractionChain([azure, ClaudeExtractor()]),
        },
    )


_azure_eval_config: PipelineConfig | None = None


def get_pipeline_config() -> PipelineConfig:
    """Return the active pipeline config based on EXTRACTION_PIPELINE env var."""
    global _azure_eval_config
    mode = os.environ.get("EXTRACTION_PIPELINE", "default")
    if mode == "azure_eval":
        if _azure_eval_config is None:
            _azure_eval_config = _build_azure_eval_config()
        return _azure_eval_config
    return CURRENT_CONFIG
