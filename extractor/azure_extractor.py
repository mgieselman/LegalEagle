"""
Azure Document Intelligence prebuilt extractor.

Implements ExtractionProvider for Azure DI prebuilt document models.  Routes each
doc_class to its corresponding Azure DI prebuilt model, calls the API with raw
document bytes, and maps the response fields to our Pydantic schemas.

Unlike the Tier 2 OCR usage in ocr.py (which uses prebuilt-layout for raw text),
this provider uses document-specific prebuilt models that return structured fields
directly — no text re-processing through the classify → extract pipeline.

Requires:
    pip install "legaleagle-extractor[ocr-azure]"
    AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT and AZURE_DOCUMENT_INTELLIGENCE_KEY env vars
"""
from __future__ import annotations

import asyncio
import logging
import os
import re
from collections.abc import Callable
from typing import TYPE_CHECKING

from schemas import RuleExtractionResult

if TYPE_CHECKING:
    from azure.ai.documentintelligence import DocumentIntelligenceClient
    from azure.ai.documentintelligence.models import AnalyzeResult, DocumentField

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Azure DI prebuilt model routing
# ---------------------------------------------------------------------------

_PREBUILT_MODELS: dict[str, str] = {
    "payStub.us": "prebuilt-payStub.us",
    "tax.us.w2": "prebuilt-tax.us.w2",
    "tax.us.1040": "prebuilt-tax.us.1040",
    "tax.us.1099": "prebuilt-tax.us.1099Combo",
    "bankStatement.us.checking": "prebuilt-bankStatement.us",
    "bankStatement.us.savings": "prebuilt-bankStatement.us",
    # creditCard — Azure DI's prebuilt-creditCard extracts physical card data
    # (card number, expiration), not statement data. Omitted.
    # mortgage.us — Azure DI has mortgage *application* form models (1003, 1008,
    # closingDisclosure) but no monthly *statement* model.  Omitted until a
    # statement-specific model is available.
    "idDocument": "prebuilt-idDocument",
    "social_security_card": "prebuilt-idDocument",
}


# ---------------------------------------------------------------------------
# Provider
# ---------------------------------------------------------------------------

class AzureDIExtractor:
    """Extraction provider using Azure Document Intelligence prebuilt models.

    Lazy-initializes the Azure DI client on first use.  Construction is cheap;
    the API client is created on the first ``extract()`` call.
    """

    def __init__(self) -> None:
        self._client: DocumentIntelligenceClient | None = None

    @property
    def name(self) -> str:
        return "azure_di"

    def _get_client(self) -> DocumentIntelligenceClient:
        if self._client is None:
            from azure.ai.documentintelligence import DocumentIntelligenceClient
            from azure.core.credentials import AzureKeyCredential

            endpoint = os.environ.get("AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT", "")
            key = os.environ.get("AZURE_DOCUMENT_INTELLIGENCE_KEY", "")
            if not endpoint or not key:
                raise ValueError(
                    "AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT and "
                    "AZURE_DOCUMENT_INTELLIGENCE_KEY must be set"
                )
            self._client = DocumentIntelligenceClient(
                endpoint, AzureKeyCredential(key)
            )
        return self._client

    async def extract(
        self,
        *,
        doc_class: str,
        text: str,
        content: bytes,
        form_fields: dict[str, str],
    ) -> RuleExtractionResult | None:
        model_id = _PREBUILT_MODELS.get(doc_class)
        if model_id is None:
            return None

        mapper = _MAPPERS.get(doc_class)
        if mapper is None:
            return None

        try:
            client = self._get_client()

            def _analyze() -> AnalyzeResult:
                import io
                poller = client.begin_analyze_document(
                    model_id,
                    body=io.BytesIO(content),
                    content_type="application/octet-stream",
                )
                return poller.result()

            result = await asyncio.to_thread(_analyze)
        except Exception:
            logger.warning(
                "Azure DI API call failed for %s (model %s)",
                doc_class,
                model_id,
                exc_info=True,
            )
            return None

        if not result.documents:
            logger.warning("Azure DI returned no documents for %s", doc_class)
            return None

        page_count = len(result.pages) if result.pages else 1
        fields = result.documents[0].fields or {}
        extraction = mapper(fields, doc_class)
        extraction.pages_analyzed = page_count
        return extraction


# ---------------------------------------------------------------------------
# Value extraction helpers
# ---------------------------------------------------------------------------

def _get_str(fields: dict[str, DocumentField], key: str) -> tuple[str | None, float]:
    """Extract a string value and its confidence."""
    field = fields.get(key)
    if field is None:
        return None, 0.0
    conf = field.confidence or 0.0
    if hasattr(field, "value_string") and field.value_string is not None:
        return field.value_string, conf
    if hasattr(field, "content") and field.content is not None:
        return field.content, conf
    return None, 0.0


def _get_float(fields: dict[str, DocumentField], key: str) -> tuple[float | None, float]:
    """Extract a numeric value (handles currency and number types)."""
    field = fields.get(key)
    if field is None:
        return None, 0.0
    conf = field.confidence or 0.0
    if hasattr(field, "value_currency") and field.value_currency is not None:
        return field.value_currency.amount, conf
    if hasattr(field, "value_number") and field.value_number is not None:
        return field.value_number, conf
    return None, 0.0


def _get_date(fields: dict[str, DocumentField], key: str) -> tuple[str | None, float]:
    """Extract a date value as ISO 8601 string."""
    field = fields.get(key)
    if field is None:
        return None, 0.0
    conf = field.confidence or 0.0
    if hasattr(field, "value_date") and field.value_date is not None:
        return str(field.value_date), conf
    return None, 0.0


def _get_object_fields(fields: dict[str, DocumentField], key: str) -> tuple[dict[str, DocumentField] | None, float]:
    """Extract sub-fields from an object-typed field."""
    field = fields.get(key)
    if field is None:
        return None, 0.0
    conf = field.confidence or 0.0
    if hasattr(field, "value_object") and field.value_object is not None:
        return field.value_object, conf
    return None, 0.0


def _get_array(fields: dict[str, DocumentField], key: str) -> tuple[list[DocumentField] | None, float]:
    """Extract array items from an array-typed field."""
    field = fields.get(key)
    if field is None:
        return None, 0.0
    conf = field.confidence or 0.0
    if hasattr(field, "value_array") and field.value_array is not None:
        return field.value_array, conf
    return None, 0.0


def _mask_last4(value: str | None) -> str | None:
    """Extract last 4 digits from an SSN or account number."""
    if not value:
        return None
    digits = re.sub(r"\D", "", value)
    if len(digits) >= 4:
        return digits[-4:]
    return None


def _address_to_str(field: DocumentField | None) -> str | None:
    """Convert an AddressValue field to a single-line string."""
    if field is None:
        return None
    addr = field.value_address if hasattr(field, "value_address") else None
    if addr is None:
        return field.content if hasattr(field, "content") else None
    parts: list[str] = []
    if hasattr(addr, "street_address") and addr.street_address:
        parts.append(addr.street_address)
    elif hasattr(addr, "house_number") and hasattr(addr, "road"):
        street = " ".join(p for p in [addr.house_number, addr.road] if p)
        if street:
            parts.append(street)
    if hasattr(addr, "city") and addr.city:
        parts.append(addr.city)
    if hasattr(addr, "state") and addr.state:
        parts.append(addr.state)
    if hasattr(addr, "postal_code") and addr.postal_code:
        parts.append(addr.postal_code)
    return ", ".join(parts) if parts else None


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _set(
    data: dict[str, object], confs: dict[str, float], key: str, value: object, conf: float,
) -> None:
    """Set a field in data and field_confidences if value is not None."""
    if value is not None:
        data[key] = value
        confs[key] = conf


def _build_result(
    data: dict[str, object],
    field_confidences: dict[str, float],
    warnings: list[str],
) -> RuleExtractionResult:
    """Compute overall confidence and return result."""
    if field_confidences:
        confidence = sum(field_confidences.values()) / len(field_confidences)
    else:
        confidence = 0.0
    return RuleExtractionResult(
        data=data,
        field_confidences=field_confidences,
        warnings=warnings,
        confidence=confidence,
    )


# ---------------------------------------------------------------------------
# Deduction classification (paystubs)
# ---------------------------------------------------------------------------

_DEDUCTION_PATTERNS: dict[str, re.Pattern[str]] = {
    "federal_tax": re.compile(r"federal|fed\s+(?:inc|tax)|FIT|fed\s+w/h", re.I),
    "state_tax": re.compile(r"state\s+(?:inc|tax)|SIT|state\s+w/h", re.I),
    "social_security": re.compile(r"social\s*security|FICA|OASDI|\bSS\b", re.I),
    "medicare": re.compile(r"medicare|MEDI\b", re.I),
    "health_insurance": re.compile(r"health|medical|dental|vision|insurance", re.I),
    "retirement_401k": re.compile(r"401\s*\(?k\)?|retirement|pension|TSP", re.I),
}


def _classify_deduction(description: str) -> str | None:
    """Map a deduction description to a known field name, or None."""
    for field_name, pattern in _DEDUCTION_PATTERNS.items():
        if pattern.search(description):
            return field_name
    return None


# ---------------------------------------------------------------------------
# Normalization maps
# ---------------------------------------------------------------------------

_PAY_FREQUENCY_MAP: dict[str, str] = {
    "weekly": "weekly",
    "bi-weekly": "biweekly",
    "biweekly": "biweekly",
    "semi-monthly": "semimonthly",
    "semimonthly": "semimonthly",
    "monthly": "monthly",
}

_FILING_STATUS_MAP: dict[str, str] = {
    "single": "single",
    "married filing jointly": "married_jointly",
    "married filing separately": "married_separately",
    "head of household": "head_of_household",
    "qualifying surviving spouse": "qualifying_surviving_spouse",
    "qualifying widow(er)": "qualifying_surviving_spouse",
}


# ---------------------------------------------------------------------------
# Per-doc-class mappers
# ---------------------------------------------------------------------------

def _map_paystub(fields: dict[str, DocumentField], doc_class: str) -> RuleExtractionResult:
    data: dict[str, object] = {}
    confs: dict[str, float] = {}
    warnings: list[str] = []

    # Employer / employee from sub-objects
    employer, _ = _get_object_fields(fields, "Employer")
    if employer:
        name, conf = _get_str(employer, "Name")
        _set(data, confs, "employer_name", name, conf)

    employee, _ = _get_object_fields(fields, "Employee")
    if employee:
        name, conf = _get_str(employee, "Name")
        _set(data, confs, "employee_name", name, conf)

    # Pay date and period
    pay_date, conf = _get_date(fields, "PayStubDate")
    _set(data, confs, "pay_date", pay_date, conf)

    pay_period, _ = _get_object_fields(fields, "PayPeriod")
    if pay_period:
        start, conf = _get_date(pay_period, "StartDate")
        _set(data, confs, "pay_period_start", start, conf)
        end, conf = _get_date(pay_period, "EndDate")
        _set(data, confs, "pay_period_end", end, conf)

    # Pay frequency
    freq_str, conf = _get_str(fields, "PayFrequency")
    if freq_str:
        normalized = _PAY_FREQUENCY_MAP.get(freq_str.lower().strip())
        _set(data, confs, "pay_frequency", normalized, conf)

    # Gross / net pay
    gross, conf = _get_float(fields, "CurrentPeriodGrossPay")
    _set(data, confs, "gross_pay", gross, conf)

    net, conf = _get_float(fields, "CurrentPeriodNetPay")
    _set(data, confs, "net_pay", net, conf)

    # YTD
    ytd_gross, conf = _get_float(fields, "YearToDateGrossPay")
    _set(data, confs, "ytd_gross", ytd_gross, conf)

    ytd_net, conf = _get_float(fields, "YearToDateNetPay")
    _set(data, confs, "ytd_net", ytd_net, conf)

    # Deductions — scan for known categories
    deductions_arr, _ = _get_array(fields, "CurrentPeriodDeductions")
    other_deductions: list[dict[str, object]] = []
    if deductions_arr:
        for item in deductions_arr:
            item_fields = (
                item.value_object
                if hasattr(item, "value_object") and item.value_object
                else {}
            )
            desc, _ = _get_str(item_fields, "Description")
            amount, conf = _get_float(item_fields, "Amount")
            if not desc or amount is None:
                continue
            field_name = _classify_deduction(desc)
            if field_name and field_name not in data:
                _set(data, confs, field_name, amount, conf)
            elif field_name is None:
                other_deductions.append({"name": desc, "amount": amount})

    if other_deductions:
        data["other_deductions"] = other_deductions
        confs["other_deductions"] = 0.85

    # Earnings — extract hours and rate from the first line item
    earnings_arr, _ = _get_array(fields, "CurrentPeriodEarnings")
    if earnings_arr:
        for item in earnings_arr:
            item_fields = (
                item.value_object
                if hasattr(item, "value_object") and item.value_object
                else {}
            )
            hours, conf = _get_float(item_fields, "Hours")
            if hours is not None and "hours_worked" not in data:
                _set(data, confs, "hours_worked", hours, conf)
            rate, conf = _get_float(item_fields, "Rate")
            if rate is not None and "hourly_rate" not in data:
                _set(data, confs, "hourly_rate", rate, conf)

    if "gross_pay" not in data:
        warnings.append("Required field gross_pay not found in Azure DI response")
    if "net_pay" not in data:
        warnings.append("Required field net_pay not found in Azure DI response")

    return _build_result(data, confs, warnings)


def _map_w2(fields: dict[str, DocumentField], doc_class: str) -> RuleExtractionResult:
    data: dict[str, object] = {}
    confs: dict[str, float] = {}
    warnings: list[str] = []

    # Employer
    employer, _ = _get_object_fields(fields, "Employer")
    if employer:
        name, conf = _get_str(employer, "Name")
        _set(data, confs, "employer_name", name, conf)
        ein, conf = _get_str(employer, "IdNumber")
        _set(data, confs, "employer_ein", ein, conf)

    # Employee
    employee, _ = _get_object_fields(fields, "Employee")
    if employee:
        name, conf = _get_str(employee, "Name")
        _set(data, confs, "employee_name", name, conf)
        ssn, conf = _get_str(employee, "SocialSecurityNumber")
        masked = _mask_last4(ssn)
        _set(data, confs, "employee_ssn_last4", masked, conf)
        if ssn and len(re.sub(r"\D", "", ssn)) > 4:
            warnings.append("Full SSN visible in document — only last 4 stored")

    # Tax year
    year, conf = _get_str(fields, "TaxYear")
    _set(data, confs, "tax_year", year, conf)

    # Box values
    wages, conf = _get_float(fields, "WagesTipsAndOtherCompensation")
    _set(data, confs, "wages", wages, conf)

    fed_tax, conf = _get_float(fields, "FederalIncomeTaxWithheld")
    _set(data, confs, "federal_tax_withheld", fed_tax, conf)

    ss_wages, conf = _get_float(fields, "SocialSecurityWages")
    _set(data, confs, "social_security_wages", ss_wages, conf)

    ss_tax, conf = _get_float(fields, "SocialSecurityTaxWithheld")
    _set(data, confs, "social_security_tax", ss_tax, conf)

    med_wages, conf = _get_float(fields, "MedicareWagesAndTips")
    _set(data, confs, "medicare_wages", med_wages, conf)

    med_tax, conf = _get_float(fields, "MedicareTaxWithheld")
    _set(data, confs, "medicare_tax", med_tax, conf)

    # State tax — first state only
    state_arr, _ = _get_array(fields, "StateTaxInfos")
    if state_arr and len(state_arr) > 0:
        st_fields = (
            state_arr[0].value_object
            if hasattr(state_arr[0], "value_object") and state_arr[0].value_object
            else {}
        )
        st, conf = _get_str(st_fields, "State")
        _set(data, confs, "state", st, conf)
        st_wages, conf = _get_float(st_fields, "StateWagesTipsEtc")
        _set(data, confs, "state_wages", st_wages, conf)
        st_tax, conf = _get_float(st_fields, "StateIncomeTax")
        _set(data, confs, "state_tax", st_tax, conf)
        if len(state_arr) > 1:
            warnings.append(
                f"Multiple states found ({len(state_arr)}) — only first extracted"
            )

    if "wages" not in data:
        warnings.append("Required field wages (Box 1) not found")
    if "federal_tax_withheld" not in data:
        warnings.append("Required field federal_tax_withheld (Box 2) not found")

    return _build_result(data, confs, warnings)


def _map_1040(fields: dict[str, DocumentField], doc_class: str) -> RuleExtractionResult:
    """Map Azure DI prebuilt-tax.us.1040 fields to our schema.

    Azure DI uses Box-number field names that correspond to 1040 line numbers:
      Box11 = Adjusted Gross Income (Line 11)
      Box15 = Taxable Income (Line 15)
      Box24 = Total Tax (Line 24)
      Box33 = Total Payments (Line 33)
      Box34 = Overpaid / Refund (Line 34)
      Box37 = Amount Owed (Line 37)
    """
    data: dict[str, object] = {}
    confs: dict[str, float] = {}
    warnings: list[str] = []

    year, conf = _get_str(fields, "TaxYear")
    _set(data, confs, "tax_year", year, conf)

    # FilingStatus is a SELECTION_GROUP — extract from content or value_string
    status, conf = _get_str(fields, "FilingStatus")
    if status and status.strip():
        normalized = _FILING_STATUS_MAP.get(status.lower().strip())
        if normalized:
            _set(data, confs, "filing_status", normalized, conf)

    # Box-number fields (1040 line numbers)
    agi, conf = _get_float(fields, "Box11")
    _set(data, confs, "adjusted_gross_income", agi, conf)

    taxable, conf = _get_float(fields, "Box15")
    _set(data, confs, "taxable_income", taxable, conf)

    total_tax, conf = _get_float(fields, "Box24")
    _set(data, confs, "total_tax", total_tax, conf)

    payments, conf = _get_float(fields, "Box33")
    _set(data, confs, "total_payments", payments, conf)

    refund, conf = _get_float(fields, "Box34")
    _set(data, confs, "refund_amount", refund, conf)

    owed, conf = _get_float(fields, "Box37")
    _set(data, confs, "amount_owed", owed, conf)

    # Azure DI doesn't distinguish federal vs state — default to federal
    if "tax_year" in data:
        data["return_type"] = "federal"
        confs["return_type"] = 0.80

    if "tax_year" not in data:
        warnings.append("Required field tax_year not found")
    if "adjusted_gross_income" not in data:
        warnings.append("Required field adjusted_gross_income not found")

    return _build_result(data, confs, warnings)


def _map_bank_statement(fields: dict[str, DocumentField], doc_class: str) -> RuleExtractionResult:
    data: dict[str, object] = {}
    confs: dict[str, float] = {}
    warnings: list[str] = []

    name, conf = _get_str(fields, "BankName")
    _set(data, confs, "institution_name", name, conf)

    acct, conf = _get_str(fields, "AccountNumber")
    masked = _mask_last4(acct)
    _set(data, confs, "account_number_last4", masked, conf)

    # Account type from doc_class (Azure uses one model for both)
    if "checking" in doc_class:
        data["account_type"] = "checking"
        confs["account_type"] = 1.0
    elif "savings" in doc_class:
        data["account_type"] = "savings"
        confs["account_type"] = 1.0

    start, conf = _get_date(fields, "StartDate")
    _set(data, confs, "statement_period_start", start, conf)

    end, conf = _get_date(fields, "EndDate")
    _set(data, confs, "statement_period_end", end, conf)

    begin_bal, conf = _get_float(fields, "BeginningBalance")
    _set(data, confs, "beginning_balance", begin_bal, conf)

    end_bal, conf = _get_float(fields, "EndingBalance")
    _set(data, confs, "ending_balance", end_bal, conf)

    deposits, conf = _get_float(fields, "TotalDeposits")
    _set(data, confs, "total_deposits", deposits, conf)

    withdrawals, conf = _get_float(fields, "TotalWithdrawals")
    _set(data, confs, "total_withdrawals", withdrawals, conf)

    if "institution_name" not in data:
        warnings.append("Required field institution_name not found")
    if "beginning_balance" not in data:
        warnings.append("Required field beginning_balance not found")
    if "ending_balance" not in data:
        warnings.append("Required field ending_balance not found")

    return _build_result(data, confs, warnings)


def _map_credit_card(fields: dict[str, DocumentField], doc_class: str) -> RuleExtractionResult:
    data: dict[str, object] = {}
    confs: dict[str, float] = {}
    warnings: list[str] = []

    issuer, conf = _get_str(fields, "BankName")
    _set(data, confs, "issuer", issuer, conf)

    acct, conf = _get_str(fields, "AccountNumber")
    masked = _mask_last4(acct)
    _set(data, confs, "account_number_last4", masked, conf)

    start, conf = _get_date(fields, "StatementStartDate")
    _set(data, confs, "statement_period_start", start, conf)

    end, conf = _get_date(fields, "StatementEndDate")
    _set(data, confs, "statement_period_end", end, conf)

    prev, conf = _get_float(fields, "PreviousBalance")
    _set(data, confs, "previous_balance", prev, conf)

    payments, conf = _get_float(fields, "PaymentsAndCredits")
    _set(data, confs, "payments", payments, conf)

    charges, conf = _get_float(fields, "Purchases")
    _set(data, confs, "new_charges", charges, conf)

    new_bal, conf = _get_float(fields, "NewBalance")
    _set(data, confs, "ending_balance", new_bal, conf)

    min_pay, conf = _get_float(fields, "MinimumPaymentDue")
    _set(data, confs, "minimum_payment_due", min_pay, conf)

    due_date, conf = _get_date(fields, "PaymentDueDate")
    _set(data, confs, "payment_due_date", due_date, conf)

    limit, conf = _get_float(fields, "CreditLimit")
    _set(data, confs, "credit_limit", limit, conf)

    avail, conf = _get_float(fields, "AvailableCredit")
    _set(data, confs, "available_credit", avail, conf)

    cash, conf = _get_float(fields, "CashAdvances")
    _set(data, confs, "cash_advances", cash, conf)

    if "issuer" not in data:
        warnings.append("Required field issuer not found")
    if "previous_balance" not in data:
        warnings.append("Required field previous_balance not found")
    if "ending_balance" not in data:
        warnings.append("Required field ending_balance not found")

    return _build_result(data, confs, warnings)


def _map_mortgage(fields: dict[str, DocumentField], doc_class: str) -> RuleExtractionResult:
    data: dict[str, object] = {}
    confs: dict[str, float] = {}
    warnings: list[str] = []

    lender, conf = _get_str(fields, "Lender")
    _set(data, confs, "lender_name", lender, conf)

    loan_num, conf = _get_str(fields, "LoanNumber")
    _set(data, confs, "loan_number", loan_num, conf)  # full number for mortgages

    addr_field = fields.get("PropertyAddress")
    if addr_field:
        addr_str = _address_to_str(addr_field)
        conf = addr_field.confidence or 0.0
        _set(data, confs, "property_address", addr_str, conf)

    rate, conf = _get_float(fields, "InterestRate")
    _set(data, confs, "interest_rate", rate, conf)

    payment, conf = _get_float(fields, "MonthlyPayment")
    _set(data, confs, "monthly_payment", payment, conf)

    balance, conf = _get_float(fields, "CurrentBalance")
    _set(data, confs, "current_balance", balance, conf)

    escrow, conf = _get_float(fields, "EscrowBalance")
    _set(data, confs, "escrow_balance", escrow, conf)

    stmt_date, conf = _get_date(fields, "StatementDate")
    _set(data, confs, "statement_period_end", stmt_date, conf)

    if "lender_name" not in data:
        warnings.append("Required field lender_name not found")
    if "current_balance" not in data:
        warnings.append("Required field current_balance not found")

    return _build_result(data, confs, warnings)


def _map_id_document(fields: dict[str, DocumentField], doc_class: str) -> RuleExtractionResult:
    data: dict[str, object] = {}
    confs: dict[str, float] = {}
    warnings: list[str] = []

    first, conf1 = _get_str(fields, "FirstName")
    last, conf2 = _get_str(fields, "LastName")
    if first or last:
        parts = [p for p in [first, last] if p]
        full_name = " ".join(parts).title()
        conf = min(conf1, conf2) if (first and last) else max(conf1, conf2)
        _set(data, confs, "full_name", full_name, conf)

    dob, conf = _get_date(fields, "DateOfBirth")
    _set(data, confs, "date_of_birth", dob, conf)

    doc_num, conf = _get_str(fields, "DocumentNumber")
    _set(data, confs, "license_number", doc_num, conf)

    exp, conf = _get_date(fields, "DateOfExpiration")
    _set(data, confs, "expiration_date", exp, conf)

    addr_field = fields.get("Address")
    if addr_field:
        addr_str = _address_to_str(addr_field)
        conf = addr_field.confidence or 0.0
        _set(data, confs, "address", addr_str, conf)

    region, conf = _get_str(fields, "Region")
    _set(data, confs, "state", region, conf)

    sex, conf = _get_str(fields, "Sex")
    _set(data, confs, "sex", sex, conf)

    if "full_name" not in data:
        warnings.append("Required field full_name not found")

    return _build_result(data, confs, warnings)


def _map_social_security_card(fields: dict[str, DocumentField], doc_class: str) -> RuleExtractionResult:
    data: dict[str, object] = {}
    confs: dict[str, float] = {}
    warnings: list[str] = []

    first, conf1 = _get_str(fields, "FirstName")
    last, conf2 = _get_str(fields, "LastName")
    if first or last:
        parts = [p for p in [first, last] if p]
        full_name = " ".join(parts).title()
        conf = min(conf1, conf2) if (first and last) else max(conf1, conf2)
        _set(data, confs, "full_name", full_name, conf)

    # Azure DI idDocument model may expose SSN via DocumentNumber
    ssn, conf = _get_str(fields, "SocialSecurityNumber")
    if ssn is None:
        ssn, conf = _get_str(fields, "DocumentNumber")
    masked = _mask_last4(ssn)
    _set(data, confs, "ssn_last4", masked, conf)
    if ssn and len(re.sub(r"\D", "", ssn)) > 4:
        warnings.append("Full SSN visible in document — only last 4 stored")

    if "full_name" not in data:
        warnings.append("Required field full_name not found")

    return _build_result(data, confs, warnings)


# ---------------------------------------------------------------------------
# Mapper routing
# ---------------------------------------------------------------------------

_MAPPERS: dict[str, Callable[[dict[str, DocumentField], str], RuleExtractionResult]] = {
    "payStub.us": _map_paystub,
    "tax.us.w2": _map_w2,
    "tax.us.1040": _map_1040,
    "bankStatement.us.checking": _map_bank_statement,
    "bankStatement.us.savings": _map_bank_statement,
    # creditCard — removed: prebuilt-creditCard extracts physical card data, not statements
    # mortgage.us mapper exists (_map_mortgage) but no Azure DI statement model
    "idDocument": _map_id_document,
    "social_security_card": _map_social_security_card,
}
