"""
Document classification — rule engine first, AI fallback.

Thresholds match the TypeScript ruleClassifier.ts and classification/index.ts:
  - Rule confidence >= 0.85 → use rule result immediately
  - Rule confidence < 0.85 → try AI (Claude)
  - AI confidence >= 0.70 → use AI result
  - Both < threshold → return 'unclassified'
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

import anthropic

from config import (
    AI_CONFIDENCE_THRESHOLD,
    EXTRACTION_MODEL,
    OPT_OUT_CONFIDENCE,
    RULE_CONFIDENCE_THRESHOLD,
)

_client: anthropic.AsyncAnthropic | None = None


def _get_client() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        _client = anthropic.AsyncAnthropic()
    return _client


@dataclass
class ClassificationResult:
    doc_class: str
    confidence: float
    method: Literal["rule_engine", "ai"]
    reasoning: str = ""


# ---- Content patterns (full document text) ----------------------------------
_CONTENT_PATTERNS: list[tuple[re.Pattern, str, float]] = [
    # --- Paystub ---
    (re.compile(r"pay\s*statement|earnings\s*statement|pay\s*period", re.I), "payStub.us", 0.90),
    (re.compile(r"gross\s*pay.{0,80}net\s*pay|net\s*pay.{0,80}gross\s*pay", re.I | re.S), "payStub.us", 0.88),
    # --- W-2 / Tax return ---
    # 1040 confidence is higher than W-2 (0.97 > 0.95) so that a full tax return package,
    # which contains both "Form 1040" and embedded W-2 text, is classified as the wrapper
    # document (1040) rather than a component form (W-2).
    (re.compile(r"wage\s*and\s*tax\s*statement|form\s*w-?2", re.I), "tax.us.w2", 0.95),
    (re.compile(r"form\s*1040|u\.?s\.?\s*individual\s*income\s*tax", re.I), "tax.us.1040", 0.97),
    # --- Bank statements ---
    # Span limits on all multiline patterns prevent matching across unrelated paragraphs.
    (re.compile(r"statement\s*period.{0,80}checking|checking.{0,80}account\s*statement", re.I | re.S), "bankStatement.us.checking", 0.88),
    (re.compile(r"statement\s*period.{0,80}(?:savings\s+account|money\s+market\s+savings|premium\s+savings)|savings.{0,80}account\s*statement", re.I | re.S), "bankStatement.us.savings", 0.88),
    # "savings account" appears in checking boilerplate (e.g. Chase Total Checking fee-waiver
    # text mentions "savings accounts" in the Zelle and deposit sections).  Chase Total Checking
    # is given a stronger signal so it wins when both patterns fire in the same document.
    (re.compile(r"chase\s+total\s+checking", re.I), "bankStatement.us.checking", 0.92),
    (re.compile(r"checking\s+summary", re.I), "bankStatement.us.checking", 0.90),
    # ETrade/Morgan Stanley checking statements mirror the savings layout and identify
    # the account type as "Checking - <account_number>" in the banking sidebar.
    (re.compile(r"checking\s*-\s*\n?\s*\d{6,}", re.I), "bankStatement.us.checking", 0.90),
    (re.compile(r"(?<!health\s)savings\s*account", re.I), "bankStatement.us.savings", 0.85),
    # ETrade savings statements list the account type as "Savings - <account_number>" or
    # "Premium Savings - <account_number>" in the sidebar header.
    (re.compile(r"(?:premium\s+)?savings\s*-\s*\n?\s*\d{6,}", re.I), "bankStatement.us.savings", 0.90),
    # E*TRADE brokerage statements include "CLIENT STATEMENT" with SIPC or value rollups.
    (re.compile(r"client\s+statement.{0,200}(?:beginning\s+total\s+value|member\s+sipc)", re.I | re.S), "brokerage_statement", 0.88),
    (re.compile(r"beginning\s+total\s+value.{0,200}ending\s+total\s+value", re.I | re.S), "brokerage_statement", 0.88),
    # Chase savings statements have a "SAVINGS SUMMARY" header block. This can appear past
    # the 2000-char title window when Chase inserts a long policy notice before the summary
    # (seen in some months), so it lives in _CONTENT_PATTERNS rather than _TITLE_PATTERNS.
    (re.compile(r"savings\s+summary", re.I), "bankStatement.us.savings", 0.90),
    (re.compile(r"account\s*statement.{0,200}beginning\s*balance|beginning\s*balance.{0,500}ending\s*balance", re.I | re.S), "bankStatement.us.checking", 0.80),
    (re.compile(r"your\s*combined\s*statement", re.I), "bankStatement.us.checking", 0.88),
    # Bank of America's "Advantage Plus" / "Adv Plus" product label is a checking-only
    # header. A generic "Bank of America ... statement" signal is too broad and can match
    # retirement statements serviced by Fidelity for Bank of America plans.
    (re.compile(r"your\s+adv(?:antage)?\s+plus\s+banking|adv\s+plus\s+banking", re.I), "bankStatement.us.checking", 0.90),
    # --- Credit card ---
    (re.compile(r"credit\s*card\s*statement|previous\s*balance.{0,80}new\s*charges", re.I | re.S), "creditCard", 0.88),
    # --- Retirement accounts ---
    (re.compile(r"401\s*\(?\s*k\s*\)?(?:\s*plan)?(?:.{0,80}statement)?|statement.{0,80}401\s*\(?\s*k\s*\)?", re.I | re.S), "401k_statement", 0.90),
    # "Roth IRA" (singular) and "Self-Directed Retirement Account" are specific enough
    # to use at full scan depth.
    # Brokerage/IRA statement boilerplate uses the PLURAL "Roth IRAs" in tax disclaimers
    # ("In Roth IRAs and HSAs, earnings are reported as tax-exempt income"), so the
    # negative lookahead (?!s) excludes those false positives.
    # "Rollover IRA" / "Traditional IRA" also appear plural in boilerplate — those are
    # restricted to the title window below.
    (re.compile(r"roth\s+ira\b(?!s)|self.?directed\s*retirement\s*account", re.I), "ira_statement", 0.93),
    # ETrade portfolio history exports identify the account as "IRA -1234" and pair it
    # with portfolio-only fields such as Net Account Value or Historical Value.
    (re.compile(r"\bira\s*-\s*\d{3,}\b.{0,200}(?:net\s+account\s+value|historical\s+value|contributions)", re.I | re.S), "ira_statement", 0.90),
    # Pension statements should route through the unified retirement-account extraction path.
    (re.compile(r"guaranteed\s+pension\s+minimum|pension\s+plan\s+account", re.I), "retirement_account", 0.95),
    # OCR text from state title certificates reliably includes these title/VIN anchors.
    (re.compile(r"vehicle\s+certificate\s+of\s+title", re.I), "vehicle_title", 0.92),
    (re.compile(r"title\s+number.{0,60}vehicle\s+identification\s+number", re.I | re.S), "vehicle_title", 0.90),
    # Title request / replacement forms (CA REG 227, etc.) and vehicle sale titling paperwork
    # contain "DRIVER LICENSE" as a field label, which triggers idDocument at 0.92.
    # These patterns score higher so vehicle_title wins.
    (re.compile(r"certificate\s+of\s+title", re.I), "vehicle_title", 0.94),
    (re.compile(r"authorization\s+for\s+titling\s+and\s+registration", re.I), "vehicle_title", 0.94),
    (re.compile(r"application\s+for\s+replacement.*?title", re.I | re.S), "vehicle_title", 0.93),
    # --- Mortgage payment confirmation (must precede mortgage statement patterns) ---
    # Payment confirmation emails from lender portals — "one time payment" or "payment draft"
    # paired with "loan" signals. Higher confidence than mortgage statement patterns so these
    # win when both fire.
    (re.compile(r"one[- ]time\s+payment.{0,120}loan\s+(?:number\s+)?ending\s+in", re.I | re.S), "mortgage_payment", 0.95),
    (re.compile(r"payment\s+draft.{0,120}loan\s+ending\s+in", re.I | re.S), "mortgage_payment", 0.95),
    (re.compile(r"one[- ]time\s+payment\s+request.{0,400}(?:total\s+amount|payment\s+date|confirmation\s+number)", re.I | re.S), "mortgage_payment", 0.93),
    (re.compile(r"one[- ]time\s+payment.{0,400}loan\s+number\s+ending\s+in", re.I | re.S), "mortgage_payment", 0.93),
    # --- Mortgage ---
    (re.compile(r"mortgage\s*statement", re.I), "mortgage.us", 0.92),
    (re.compile(r"escrow\s*(impound|balance|payment)|principal.{0,80}interest.{0,80}escrow", re.I | re.S), "mortgage.us", 0.87),
    (re.compile(r"loan\s*number.{0,60}(payment\s*due|amount\s*due|payment\s*date)", re.I | re.S), "mortgage.us", 0.85),
    # --- Vehicle / equipment loan ---
    # Payment history reports from dealers/lenders with "LOAN RECEIVABLES" + payment table.
    (re.compile(r"account\s+payment\s+history", re.I), "vehicle_loan_statement", 0.90),
    (re.compile(r"loan\s+receivables.{0,200}payment.{0,60}principal\s+balance", re.I | re.S), "vehicle_loan_statement", 0.88),
    # --- Other ---
    (re.compile(r"social\s*security\s*benefit|supplemental\s*security\s*income", re.I), "social_security_letter", 0.85),
    (re.compile(r"reaffirmation\s+agreement|cover\s+sheet\s+for\s+reaffirmation\s+agreement", re.I), "legal_document", 0.90),
    (re.compile(r"notice\s*of\s*garnishment|writ\s*of\s*garnishment", re.I), "legal_document", 0.88),
    (re.compile(r"summons|complaint.*court|filed.*court", re.I), "legal_document", 0.90),
    # --- ID documents (Tesseract OCR output from card images/scans) ---
    # Driver's licenses contain "DRIVER LICENSE", "DRIVER'S LICENSE", or state DL number
    # prefixes (WDL = Washington, etc.) alongside physical fields like SEX, HGT, WGT.
    (re.compile(r"driver'?s?\s*licen[sc]e|driver\s*id\b", re.I), "idDocument", 0.92),
    # Physical DL fields that only appear on the card itself: SEX M/F and HGT (height).
    # HGT is sometimes truncated to "HG" by Tesseract; OCR may embed digits into the
    # field label (e.g. "45SEX M") so no \b required before SEX.
    (re.compile(r"SEX\s+[MFX]\b.{0,100}\bHGT?\b|\bHGT?\b.{0,100}SEX\s+[MFX]\b", re.I | re.S), "idDocument", 0.90),
    (re.compile(r"\bdate\s*of\s*birth\b.{0,200}\bexpir", re.I | re.S), "idDocument", 0.88),
    # Social Security cards are issued by the SSA and show "SOCIAL SECURITY" prominently.
    # The SSN number pattern (NNN-NN-NNNN) is a strong secondary signal.
    (re.compile(r"social\s*security\s*administration", re.I), "social_security_card", 0.95),
    (re.compile(r"\bsocial\s*security\b.{0,100}\d{3}-\d{2}-\d{4}", re.I | re.S), "social_security_card", 0.90),
    # "THIS NUMBER HAS BEEN ESTABLISHED FOR" is the standard text on every US SSN card —
    # unique enough to classify on its own even when OCR garbles the rest of the card.
    # Allow optional whitespace between words to handle OCR word-merging artifacts
    # (e.g. Tesseract sometimes produces "BEENESTABLISHED" with no space).
    (re.compile(r"this\s+number\s+has\s+been\s*established\s*for", re.I), "social_security_card", 0.92),
]

# ---- Title patterns (first _TITLE_SCAN_CHARS chars only) --------------------
_TITLE_PATTERNS: list[tuple[re.Pattern, str, float]] = [
    # 1099: "Form 1099" and specific type variants appear as headers in actual 1099s,
    # but are cited in disclaimers ("not a substitute for Form 1099") deep in brokerage
    # and IRA statements.
    (re.compile(r"form\s*1099|consolidated\s*1099", re.I), "tax.us.1099", 0.90),
    # IRA variants that appear in tax boilerplate mid-document:
    # "In Traditional IRAs, Rollover IRAs, SEP-IRAs... earnings are reported as tax-deferred"
    # Real IRA account statements put the account type in the header (e.g. "FIDELITY ROLLOVER IRA").
    (re.compile(r"rollover\s*ira|traditional\s*ira|individual\s*retirement\s*account|ira\s*statement", re.I), "ira_statement", 0.90),
    # Savings account type labels that appear near the top of pure savings statements but
    # appear deep (>9000 chars) in combined checking+savings statements.  Title-window
    # restriction keeps them from misfiring on combined statements.
    # BofA: "Your Regular Savings" / "Your Money Market Savings"
    (re.compile(r"your\s+(?:regular|money\s+market|premium)\s+savings", re.I), "bankStatement.us.savings", 0.92),
    # Fidelity brokerage statements begin with "INVESTMENT REPORT" as the page header.
    # Restricted to the title window because the phrase can appear mid-document in other contexts.
    (re.compile(r"investment\s+report", re.I), "brokerage_statement", 0.90),
]

# ---- Filename patterns (boost only, never sole classifier) -------------------

_FILENAME_BOOST = 0.10

_FILENAME_PATTERNS: list[tuple[re.Pattern, str]] = [
    (re.compile(r"securities|brokerage|investment", re.I), "brokerage_statement"),
    (re.compile(r"\btitle\b", re.I), "vehicle_title"),
    (re.compile(r"pension", re.I), "retirement_account"),
    (re.compile(r"mortgage.*payment|payment.*mortgage", re.I), "mortgage_payment"),
    (re.compile(r"mortgage", re.I), "mortgage.us"),
    (re.compile(r"checking", re.I), "bankStatement.us.checking"),
    (re.compile(r"savings", re.I), "bankStatement.us.savings"),
    (re.compile(r"pay\s*stub|earnings\s*statement", re.I), "payStub.us"),
    (re.compile(r"\bw-?2\b", re.I), "tax.us.w2"),
    (re.compile(r"\b1040\b", re.I), "tax.us.1040"),
    (re.compile(r"\b1099\b", re.I), "tax.us.1099"),
    (re.compile(r"credit\s*card", re.I), "creditCard"),
    (re.compile(r"401\s*\(?k\)?", re.I), "401k_statement"),
    (re.compile(r"\bira\b", re.I), "ira_statement"),
    (re.compile(r"driver|licen[sc]e", re.I), "idDocument"),
]


def _filename_doc_classes(filename: str) -> set[str]:
    """Return all doc classes hinted by the filename (stem only, no extension)."""
    stem = Path(filename).stem
    return {doc_class for pattern, doc_class in _FILENAME_PATTERNS if pattern.search(stem)}


def boost_with_filename(result: ClassificationResult, filename: str) -> ClassificationResult:
    """If the filename confirms the content-based classification, boost confidence.

    Only applies when the content rules found a class below threshold.
    Never changes the doc_class — only increases confidence.
    """
    if result.doc_class == "unclassified" or result.confidence >= RULE_CONFIDENCE_THRESHOLD:
        return result

    hints = _filename_doc_classes(filename)
    if result.doc_class in hints:
        return ClassificationResult(
            doc_class=result.doc_class,
            confidence=min(result.confidence + _FILENAME_BOOST, RULE_CONFIDENCE_THRESHOLD),
            method=result.method,
            reasoning=f"filename-boosted from {result.confidence:.2f}",
        )
    return result


# Real 1099 form type labels (e.g. "1099-DIV", "1099-INT") are document headers.
# Brokerage/IRA statement boilerplate references specific form types too ("Form 1099-B
# by March 15..."), but those always appear deep in the document, never in the title.
_TITLE_SCAN_CHARS = 2_000

_FINANCIAL_KEYWORDS = re.compile(
    r"(?:"
    # Bank / account
    r"account|balance|deposit|withdrawal|statement\s*period"
    r"|routing\s*number|account\s*number"
    # Payroll
    r"|gross\s*pay|net\s*pay|earnings|deduction|withholding|pay\s*period"
    # Tax
    r"|tax\s*return|taxable|adjusted\s*gross|refund|form\s*(?:1040|w-?2|1099)"
    # Insurance
    r"|premium|beneficiary|coverage|policy\s*number|death\s*benefit"
    # Lending
    r"|(?:loan|mortgage)\s*(?:number|statement|payment)|escrow|amortization"
    r"|principal.{0,20}interest"
    # Investment
    r"|dividend|capital\s*gain|portfolio|securities|shares|brokerage"
    r"|(?:roth|traditional|rollover)\s*ira|401\s*\(?k\)?"
    # Government benefits
    r"|social\s*security|(?:weekly\s*)?benefit\s*amount|disability"
    # Legal
    r"|(?:court|plaintiff|defendant|garnishment|judgment|reaffirmation)"
    # ID documents
    r"|driver.?s?\s*licen[sc]e|vehicle\s*identification"
    # General financial
    r"|payment|invoice|interest\s*rate"
    r")",
    re.IGNORECASE,
)


def _check_opt_out(text: str) -> ClassificationResult:
    """If text contains no financial keywords, suggest 'other' at sub-threshold confidence."""
    if _FINANCIAL_KEYWORDS.search(text):
        return ClassificationResult(doc_class="unclassified", confidence=0.0, method="rule_engine")
    return ClassificationResult(
        doc_class="other",
        confidence=OPT_OUT_CONFIDENCE,
        method="rule_engine",
        reasoning="no financial keywords detected",
    )


def classify_by_rules(text: str) -> ClassificationResult:
    """Content-based rule classification. Returns 'unclassified' if nothing matches."""
    scores: dict[str, float] = {}

    title_slice = text[:_TITLE_SCAN_CHARS]
    for pattern, doc_class, conf in _TITLE_PATTERNS:
        if pattern.search(title_slice):
            existing = scores.get(doc_class, 0.0)
            scores[doc_class] = min(1.0, max(existing, conf))

    # Content patterns scan full text — some statements place the decisive header
    # after lengthy disclosures, and title-window safeguards already keep
    # boilerplate-sensitive phrases restricted to the title window above.
    for pattern, doc_class, conf in _CONTENT_PATTERNS:
        if pattern.search(text):
            existing = scores.get(doc_class, 0.0)
            scores[doc_class] = min(1.0, max(existing, conf))

    if not scores:
        return _check_opt_out(text)

    best_class = max(scores, key=lambda k: scores[k])
    return ClassificationResult(
        doc_class=best_class,
        confidence=scores[best_class],
        method="rule_engine",
    )


async def classify_with_ai(text: str) -> ClassificationResult:
    """AI classification using Claude. Falls back to 'unclassified' if confidence < 0.70."""
    from schemas import DOC_CLASSES

    classes_list = ", ".join(DOC_CLASSES)
    response = await _get_client().messages.create(
        model=EXTRACTION_MODEL,
        max_tokens=256,
        messages=[
            {
                "role": "user",
                "content": f"""Classify this financial/legal document into exactly one of these classes:
{classes_list}

Respond with JSON only: {{"doc_class": "<class>", "confidence": <0.0-1.0>, "reasoning": "<one sentence>"}}

Document text (first 2000 chars):
{text[:2000]}""",
            }
        ],
    )

    import json
    text_response = response.content[0].text if response.content else ""
    match = re.search(r"\{.*\}", text_response, re.S)
    if not match:
        return ClassificationResult(doc_class="unclassified", confidence=0.0, method="ai", reasoning="Failed to parse AI response")

    data = json.loads(match.group())
    doc_class_value = data.get("doc_class", "unclassified")
    if doc_class_value not in DOC_CLASSES:
        return ClassificationResult(
            doc_class="unclassified",
            confidence=0.0,
            method="ai",
            reasoning=f"AI returned invalid doc_class: {doc_class_value}",
        )
    return ClassificationResult(
        doc_class=doc_class_value,
        confidence=float(data.get("confidence", 0.0)),
        method="ai",
        reasoning=data.get("reasoning", ""),
    )
