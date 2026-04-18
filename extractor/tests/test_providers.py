"""
Phase 1 — Provider DI infrastructure tests.

Tests chain execution logic, error handling, threshold behavior, fallthrough,
classification chain, and CURRENT_CONFIG composition.
"""
from __future__ import annotations

from dataclasses import dataclass

import pytest

from azure_extractor import AzureDIExtractor
from classifier import ClassificationResult, RULE_CONFIDENCE_THRESHOLD
from providers import (
    CURRENT_CONFIG,
    ClaudeClassifier,
    ClaudeExtractor,
    ExtractionChain,
    PipelineConfig,
    ProviderResult,
    RuleBankExtractor,
    RuleClassifier,
    RuleInvestmentExtractor,
    RuleMortgageExtractor,
    RulePaystubExtractor,
    RuleTaxReturnExtractor,
    RuleW2Extractor,
    run_classification_chain,
    run_extraction_chain,
)


# ---------------------------------------------------------------------------
# Helpers — fake providers for testing chain logic
# ---------------------------------------------------------------------------

class FakeExtractor:
    """Test double for ExtractionProvider."""

    def __init__(
        self,
        name: str,
        result: ProviderResult | None = None,
        raises: Exception | None = None,
    ):
        self._name = name
        self._result = result
        self._raises = raises
        self.called = False

    @property
    def name(self) -> str:
        return self._name

    async def extract(
        self,
        *,
        doc_class: str,
        text: str,
        content: bytes,
        form_fields: dict[str, str],
    ) -> ProviderResult | None:
        self.called = True
        if self._raises:
            raise self._raises
        return self._result


class FakeClassifier:
    """Test double for ClassificationProvider."""

    def __init__(
        self,
        name: str,
        result: ClassificationResult | None = None,
        raises: Exception | None = None,
    ):
        self._name = name
        self._result = result
        self._raises = raises
        self.called = False

    @property
    def name(self) -> str:
        return self._name

    async def classify(
        self,
        *,
        text: str,
        content: bytes | None = None,
        filename: str | None = None,
    ) -> ClassificationResult | None:
        self.called = True
        if self._raises:
            raise self._raises
        return self._result


def _make_result(confidence: float) -> ProviderResult:
    return ProviderResult(
        data={"field": "value"},
        field_confidences={"field": confidence},
        warnings=[],
        confidence=confidence,
    )


# ---------------------------------------------------------------------------
# Extraction chain tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_chain_first_returns_none_falls_through():
    """First provider returns None → chain tries second provider."""
    second_result = _make_result(0.90)
    first = FakeExtractor("first", result=None)
    second = FakeExtractor("second", result=second_result)

    chain = ExtractionChain(providers=[first, second])
    result, name = await run_extraction_chain(chain, "payStub.us", "text", b"bytes", {})

    assert first.called
    assert second.called
    assert result is second_result
    assert name == "second"


@pytest.mark.asyncio
async def test_chain_provider_throws_continues():
    """Provider that raises → logged, chain continues to next."""
    second_result = _make_result(0.90)
    first = FakeExtractor("first", raises=RuntimeError("boom"))
    second = FakeExtractor("second", result=second_result)

    chain = ExtractionChain(providers=[first, second])
    result, name = await run_extraction_chain(chain, "payStub.us", "text", b"bytes", {})

    assert first.called
    assert second.called
    assert result is second_result
    assert name == "second"


@pytest.mark.asyncio
async def test_chain_above_threshold_stops_early():
    """Result above threshold → stops chain, doesn't call next provider."""
    first_result = _make_result(0.95)
    first = FakeExtractor("first", result=first_result)
    second = FakeExtractor("second", result=_make_result(0.99))

    chain = ExtractionChain(providers=[first, second], threshold=0.85)
    result, name = await run_extraction_chain(chain, "payStub.us", "text", b"bytes", {})

    assert first.called
    assert not second.called
    assert result is first_result
    assert name == "first"


@pytest.mark.asyncio
async def test_chain_all_sub_threshold_returns_last():
    """All sub-threshold → returns last non-None result."""
    first_result = _make_result(0.70)
    second_result = _make_result(0.75)
    first = FakeExtractor("first", result=first_result)
    second = FakeExtractor("second", result=second_result)

    chain = ExtractionChain(providers=[first, second], threshold=0.85)
    result, name = await run_extraction_chain(chain, "payStub.us", "text", b"bytes", {})

    assert first.called
    assert second.called
    assert result is second_result
    assert name == "second"


@pytest.mark.asyncio
async def test_chain_all_none_returns_none():
    """All providers return None → chain returns (None, 'unclassified')."""
    first = FakeExtractor("first", result=None)
    second = FakeExtractor("second", result=None)

    chain = ExtractionChain(providers=[first, second])
    result, name = await run_extraction_chain(chain, "payStub.us", "text", b"bytes", {})

    assert result is None
    assert name == "unclassified"


@pytest.mark.asyncio
async def test_chain_empty_providers():
    """Empty provider list → returns (None, 'unclassified')."""
    chain = ExtractionChain(providers=[])
    result, name = await run_extraction_chain(chain, "payStub.us", "text", b"bytes", {})

    assert result is None
    assert name == "unclassified"


@pytest.mark.asyncio
async def test_chain_first_above_second_below():
    """First provider above threshold → used even though second might be better."""
    first_result = _make_result(0.90)
    first = FakeExtractor("first", result=first_result)
    second = FakeExtractor("second", result=_make_result(0.99))

    chain = ExtractionChain(providers=[first, second], threshold=0.85)
    result, name = await run_extraction_chain(chain, "payStub.us", "text", b"bytes", {})

    assert result is first_result
    assert not second.called


# ---------------------------------------------------------------------------
# Classification chain tests
# ---------------------------------------------------------------------------

async def test_classify_chain_above_threshold_returns_immediately():
    """First classifier above threshold → returned without trying second."""
    first = FakeClassifier(
        "rules",
        result=ClassificationResult(doc_class="payStub.us", confidence=0.90, method="rule_engine"),
    )
    second = FakeClassifier("ai", result=None)

    result = await run_classification_chain([first, second], "pay stub text")

    assert first.called
    assert not second.called
    assert result.doc_class == "payStub.us"
    assert result.confidence == 0.90


async def test_classify_chain_falls_through_to_second():
    """First classifier below threshold → tries second."""
    first = FakeClassifier(
        "rules",
        result=ClassificationResult(doc_class="payStub.us", confidence=0.70, method="rule_engine"),
    )
    second = FakeClassifier(
        "ai",
        result=ClassificationResult(doc_class="payStub.us", confidence=0.88, method="ai"),
    )

    result = await run_classification_chain([first, second], "pay stub text")

    assert first.called
    assert second.called
    assert result.confidence == 0.88
    assert result.method == "ai"


async def test_classify_chain_later_sub_threshold_replaces_earlier():
    """Later classifier's sub-threshold result replaces earlier one (more capable)."""
    first = FakeClassifier(
        "rules",
        result=ClassificationResult(doc_class="payStub.us", confidence=0.80, method="rule_engine"),
    )
    second = FakeClassifier(
        "ai",
        result=ClassificationResult(doc_class="tax.us.w2", confidence=0.78, method="ai"),
    )

    result = await run_classification_chain([first, second], "text")

    assert result.doc_class == "tax.us.w2"
    assert result.confidence == 0.78


async def test_classify_chain_all_unclassified():
    """All classifiers return 'unclassified' → chain returns unclassified."""
    first = FakeClassifier(
        "rules",
        result=ClassificationResult(doc_class="unclassified", confidence=0.0, method="rule_engine"),
    )
    second = FakeClassifier("ai", result=None)

    result = await run_classification_chain([first, second], "lorem ipsum")

    assert result.doc_class == "unclassified"
    assert result.confidence == 0.0


async def test_classify_chain_exception_continues():
    """Classifier that raises → chain continues to next."""
    first = FakeClassifier("rules", raises=RuntimeError("boom"))
    second = FakeClassifier(
        "ai",
        result=ClassificationResult(doc_class="payStub.us", confidence=0.90, method="ai"),
    )

    result = await run_classification_chain([first, second], "text")

    assert result.doc_class == "payStub.us"
    assert result.confidence == 0.90


async def test_classify_chain_empty_returns_unclassified():
    """Empty classifier list → returns unclassified."""
    result = await run_classification_chain([], "text")
    assert result.doc_class == "unclassified"


# ---------------------------------------------------------------------------
# PipelineConfig tests
# ---------------------------------------------------------------------------

def test_config_chain_for_override():
    """chain_for returns the override chain for a matched doc_class."""
    paystub_chain = ExtractionChain(providers=[])
    config = PipelineConfig(
        classifiers=[],
        default_extractors=ExtractionChain(providers=[]),
        extractor_overrides={"payStub.us": paystub_chain},
    )
    assert config.chain_for("payStub.us") is paystub_chain


def test_config_chain_for_default():
    """chain_for returns the default chain for an unmatched doc_class."""
    default_chain = ExtractionChain(providers=[])
    config = PipelineConfig(
        classifiers=[],
        default_extractors=default_chain,
        extractor_overrides={},
    )
    assert config.chain_for("mortgage.us") is default_chain


# ---------------------------------------------------------------------------
# CURRENT_CONFIG composition tests
# ---------------------------------------------------------------------------

def test_current_config_classifiers():
    """CURRENT_CONFIG has RuleClassifier then ClaudeClassifier."""
    classifiers = CURRENT_CONFIG.classifiers
    assert len(classifiers) == 2
    assert isinstance(classifiers[0], RuleClassifier)
    assert isinstance(classifiers[1], ClaudeClassifier)


def test_current_config_default_extractors():
    """Default chain is AzureDI → Claude."""
    chain = CURRENT_CONFIG.default_extractors
    assert len(chain.providers) == 2
    assert isinstance(chain.providers[0], AzureDIExtractor)
    assert isinstance(chain.providers[1], ClaudeExtractor)


def test_current_config_paystub_chain():
    """Paystub chain: RulePaystubExtractor → AzureDI → ClaudeExtractor."""
    chain = CURRENT_CONFIG.chain_for("payStub.us")
    assert len(chain.providers) == 3
    assert isinstance(chain.providers[0], RulePaystubExtractor)
    assert isinstance(chain.providers[1], AzureDIExtractor)
    assert isinstance(chain.providers[2], ClaudeExtractor)


def test_current_config_bank_statement_chain():
    """Bank statement chains: RuleBankExtractor → AzureDI → ClaudeExtractor."""
    for doc_class in ("bankStatement.us.checking", "bankStatement.us.savings"):
        chain = CURRENT_CONFIG.chain_for(doc_class)
        assert len(chain.providers) == 3
        assert isinstance(chain.providers[0], RuleBankExtractor)
        assert isinstance(chain.providers[1], AzureDIExtractor)
        assert isinstance(chain.providers[2], ClaudeExtractor)


def test_current_config_w2_chain():
    """W-2 chain: RuleW2Extractor → AzureDI → ClaudeExtractor."""
    chain = CURRENT_CONFIG.chain_for("tax.us.w2")
    assert len(chain.providers) == 3
    assert isinstance(chain.providers[0], RuleW2Extractor)
    assert isinstance(chain.providers[1], AzureDIExtractor)
    assert isinstance(chain.providers[2], ClaudeExtractor)


def test_current_config_1040_chain():
    """1040 chain: RuleTaxReturnExtractor → AzureDI → ClaudeExtractor."""
    chain = CURRENT_CONFIG.chain_for("tax.us.1040")
    assert len(chain.providers) == 3
    assert chain.providers[0].name == "rule_engine:tax_return"
    assert isinstance(chain.providers[1], AzureDIExtractor)
    assert isinstance(chain.providers[2], ClaudeExtractor)


def test_current_config_investment_chains():
    """Investment statement chains: RuleInvestmentExtractor → ClaudeExtractor (no Azure DI)."""
    for doc_class in ("ira_statement", "brokerage_statement", "401k_statement", "retirement_account"):
        chain = CURRENT_CONFIG.chain_for(doc_class)
        assert len(chain.providers) == 2
        assert isinstance(chain.providers[0], RuleInvestmentExtractor)
        assert isinstance(chain.providers[1], ClaudeExtractor)


def test_current_config_mortgage_chain():
    """Mortgage chain: RuleMortgageExtractor → ClaudeExtractor (no Azure DI)."""
    chain = CURRENT_CONFIG.chain_for("mortgage.us")
    assert len(chain.providers) == 2
    assert isinstance(chain.providers[0], RuleMortgageExtractor)
    assert isinstance(chain.providers[1], ClaudeExtractor)


def test_current_config_id_chain():
    """idDocument: AzureDI → ClaudeExtractor."""
    chain = CURRENT_CONFIG.chain_for("idDocument")
    assert len(chain.providers) == 2
    assert isinstance(chain.providers[0], AzureDIExtractor)
    assert isinstance(chain.providers[1], ClaudeExtractor)


def test_current_config_ssn_card_chain():
    """social_security_card: RuleSSNCardExtractor → AzureDI → ClaudeExtractor."""
    chain = CURRENT_CONFIG.chain_for("social_security_card")
    assert len(chain.providers) == 3
    assert isinstance(chain.providers[1], AzureDIExtractor)
    assert isinstance(chain.providers[2], ClaudeExtractor)


def test_current_config_credit_card_chain():
    """Credit card chain: AzureDI → ClaudeExtractor."""
    chain = CURRENT_CONFIG.chain_for("creditCard")
    assert len(chain.providers) == 2
    assert isinstance(chain.providers[0], AzureDIExtractor)
    assert isinstance(chain.providers[1], ClaudeExtractor)


def test_current_config_no_override_uses_default():
    """Doc classes without an override chain fall back to the default (AzureDI → Claude)."""
    chain = CURRENT_CONFIG.chain_for("unclassified")
    assert chain is CURRENT_CONFIG.default_extractors


# ---------------------------------------------------------------------------
# Provider adapter doc_class filtering tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_rule_paystub_extractor_wrong_doc_class():
    """RulePaystubExtractor returns None for non-paystub doc classes."""
    extractor = RulePaystubExtractor()
    result = await extractor.extract(
        doc_class="tax.us.w2", text="", content=b"", form_fields={},
    )
    assert result is None


@pytest.mark.asyncio
async def test_rule_bank_extractor_wrong_doc_class():
    """RuleBankExtractor returns None for non-bank doc classes."""
    extractor = RuleBankExtractor()
    result = await extractor.extract(
        doc_class="payStub.us", text="", content=b"", form_fields={},
    )
    assert result is None


@pytest.mark.asyncio
async def test_rule_w2_extractor_wrong_doc_class():
    """RuleW2Extractor returns None for non-W2 doc classes."""
    extractor = RuleW2Extractor()
    result = await extractor.extract(
        doc_class="payStub.us", text="", content=b"", form_fields={},
    )
    assert result is None


@pytest.mark.asyncio
async def test_rule_tax_return_extractor_wrong_doc_class():
    """RuleTaxReturnExtractor returns None for non-1040 doc classes."""
    extractor = RuleTaxReturnExtractor()
    result = await extractor.extract(
        doc_class="payStub.us", text="", content=b"", form_fields={},
    )
    assert result is None


@pytest.mark.asyncio
async def test_rule_paystub_extractor_correct_doc_class():
    """RulePaystubExtractor returns a result for payStub.us."""
    extractor = RulePaystubExtractor()
    text = "Gross Pay 2585.81 Net Pay 2137.33"
    result = await extractor.extract(
        doc_class="payStub.us", text=text, content=b"", form_fields={},
    )
    assert result is not None
    assert result.data.get("gross_pay") == pytest.approx(2585.81)


@pytest.mark.asyncio
async def test_rule_bank_extractor_correct_doc_class():
    """RuleBankExtractor returns a result for bankStatement.us.checking."""
    extractor = RuleBankExtractor()
    text = "Bank of America, N.A.\nBeginning balance on December 18, 2025   2.26\nEnding balance on January 16, 2026   110.69"
    result = await extractor.extract(
        doc_class="bankStatement.us.checking", text=text, content=b"", form_fields={},
    )
    assert result is not None
    assert result.data.get("beginning_balance") == pytest.approx(2.26)


@pytest.mark.asyncio
async def test_rule_investment_extractor_wrong_doc_class():
    """RuleInvestmentExtractor returns None for non-investment doc classes."""
    extractor = RuleInvestmentExtractor()
    result = await extractor.extract(
        doc_class="payStub.us", text="", content=b"", form_fields={},
    )
    assert result is None


@pytest.mark.asyncio
async def test_rule_mortgage_extractor_wrong_doc_class():
    """RuleMortgageExtractor returns None for non-mortgage doc classes."""
    extractor = RuleMortgageExtractor()
    result = await extractor.extract(
        doc_class="payStub.us", text="", content=b"", form_fields={},
    )
    assert result is None


@pytest.mark.asyncio
async def test_rule_mortgage_extractor_correct_doc_class():
    """RuleMortgageExtractor returns a result for mortgage.us."""
    extractor = RuleMortgageExtractor()
    text = "Mortgage Statement\nLoan Number 0129442679\nOutstanding Principal $659,975.72"
    result = await extractor.extract(
        doc_class="mortgage.us", text=text, content=b"", form_fields={},
    )
    assert result is not None
    assert result.data.get("current_balance") == pytest.approx(659975.72)
