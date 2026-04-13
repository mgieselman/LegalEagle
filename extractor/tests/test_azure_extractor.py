"""
Phase 2 — Azure DI extractor tests.

Unit tests for each field mapper using mock Azure DI response objects.
No Azure SDK dependency or API calls required.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import pytest

from azure_extractor import (
    AzureDIExtractor,
    _MAPPERS,
    _PREBUILT_MODELS,
    _classify_deduction,
    _map_bank_statement,
    _map_credit_card,
    _map_id_document,
    _map_mortgage,
    _map_paystub,
    _map_social_security_card,
    _map_w2,
    _map_1040,
    _mask_last4,
)


# ---------------------------------------------------------------------------
# Mock Azure DI SDK types (duck-typed to match real SDK attributes)
# ---------------------------------------------------------------------------

@dataclass
class MockCurrencyValue:
    amount: float
    currency_code: str | None = None


@dataclass
class MockAddressValue:
    street_address: str | None = None
    city: str | None = None
    state: str | None = None
    postal_code: str | None = None
    house_number: str | None = None
    road: str | None = None


@dataclass
class MockDocumentField:
    type: str
    value_string: str | None = None
    value_number: float | None = None
    value_date: str | None = None
    value_currency: MockCurrencyValue | None = None
    value_object: dict[str, Any] | None = None
    value_array: list[Any] | None = None
    value_address: MockAddressValue | None = None
    content: str | None = None
    confidence: float | None = None


# -- Convenience constructors --

def _s(value: str, conf: float = 0.95) -> MockDocumentField:
    return MockDocumentField(type="string", value_string=value, confidence=conf)


def _n(value: float, conf: float = 0.95) -> MockDocumentField:
    return MockDocumentField(type="number", value_number=value, confidence=conf)


def _c(amount: float, conf: float = 0.95) -> MockDocumentField:
    return MockDocumentField(
        type="currency",
        value_currency=MockCurrencyValue(amount=amount),
        confidence=conf,
    )


def _d(value: str, conf: float = 0.95) -> MockDocumentField:
    return MockDocumentField(type="date", value_date=value, confidence=conf)


def _obj(fields: dict, conf: float = 0.95) -> MockDocumentField:
    return MockDocumentField(type="object", value_object=fields, confidence=conf)


def _arr(items: list, conf: float = 0.95) -> MockDocumentField:
    return MockDocumentField(type="array", value_array=items, confidence=conf)


def _addr(
    street: str | None = None,
    city: str | None = None,
    state: str | None = None,
    postal: str | None = None,
    conf: float = 0.90,
) -> MockDocumentField:
    return MockDocumentField(
        type="address",
        value_address=MockAddressValue(
            street_address=street, city=city, state=state, postal_code=postal,
        ),
        confidence=conf,
    )


# ---------------------------------------------------------------------------
# _mask_last4 utility
# ---------------------------------------------------------------------------

def test_mask_last4_full_ssn():
    assert _mask_last4("123-45-6789") == "6789"


def test_mask_last4_account_number():
    assert _mask_last4("0010 8211 5472") == "5472"


def test_mask_last4_short():
    assert _mask_last4("12") is None


def test_mask_last4_none():
    assert _mask_last4(None) is None


def test_mask_last4_exactly_four():
    assert _mask_last4("1234") == "1234"


# ---------------------------------------------------------------------------
# Deduction classification
# ---------------------------------------------------------------------------

def test_classify_deduction_federal():
    assert _classify_deduction("Federal Income Tax") == "federal_tax"
    assert _classify_deduction("FIT") == "federal_tax"


def test_classify_deduction_state():
    assert _classify_deduction("State Income Tax") == "state_tax"


def test_classify_deduction_fica():
    assert _classify_deduction("FICA / OASDI") == "social_security"


def test_classify_deduction_medicare():
    assert _classify_deduction("Medicare") == "medicare"


def test_classify_deduction_health():
    assert _classify_deduction("Health Insurance") == "health_insurance"


def test_classify_deduction_401k():
    assert _classify_deduction("401(k) Contribution") == "retirement_401k"


def test_classify_deduction_unknown():
    assert _classify_deduction("Union Dues") is None


# ---------------------------------------------------------------------------
# Paystub mapper
# ---------------------------------------------------------------------------

def test_paystub_basic_fields():
    fields = {
        "Employer": _obj({"Name": _s("ACME Corp")}),
        "Employee": _obj({"Name": _s("John Doe")}),
        "PayStubDate": _d("2026-01-15"),
        "CurrentPeriodGrossPay": _c(2585.81),
        "CurrentPeriodNetPay": _c(2137.33),
    }
    result = _map_paystub(fields, "payStub.us")
    assert result.data["employer_name"] == "ACME Corp"
    assert result.data["employee_name"] == "John Doe"
    assert result.data["pay_date"] == "2026-01-15"
    assert result.data["gross_pay"] == pytest.approx(2585.81)
    assert result.data["net_pay"] == pytest.approx(2137.33)
    assert result.confidence > 0.0
    assert not result.warnings


def test_paystub_pay_period():
    fields = {
        "Employer": _obj({"Name": _s("ACME")}),
        "CurrentPeriodGrossPay": _c(1000.0),
        "CurrentPeriodNetPay": _c(800.0),
        "PayPeriod": _obj({
            "StartDate": _d("2026-01-01"),
            "EndDate": _d("2026-01-14"),
        }),
    }
    result = _map_paystub(fields, "payStub.us")
    assert result.data["pay_period_start"] == "2026-01-01"
    assert result.data["pay_period_end"] == "2026-01-14"


def test_paystub_pay_frequency():
    fields = {
        "Employer": _obj({"Name": _s("X")}),
        "CurrentPeriodGrossPay": _c(1000.0),
        "CurrentPeriodNetPay": _c(800.0),
        "PayFrequency": _s("Bi-Weekly"),
    }
    result = _map_paystub(fields, "payStub.us")
    assert result.data["pay_frequency"] == "biweekly"


def test_paystub_deductions():
    fields = {
        "Employer": _obj({"Name": _s("X")}),
        "CurrentPeriodGrossPay": _c(3000.0),
        "CurrentPeriodNetPay": _c(2200.0),
        "CurrentPeriodDeductions": _arr([
            _obj({"Description": _s("Federal Income Tax"), "Amount": _c(350.0)}),
            _obj({"Description": _s("State Income Tax"), "Amount": _c(120.0)}),
            _obj({"Description": _s("FICA"), "Amount": _c(186.0)}),
            _obj({"Description": _s("Medicare"), "Amount": _c(43.5)}),
            _obj({"Description": _s("Union Dues"), "Amount": _c(25.0)}),
        ]),
    }
    result = _map_paystub(fields, "payStub.us")
    assert result.data["federal_tax"] == pytest.approx(350.0)
    assert result.data["state_tax"] == pytest.approx(120.0)
    assert result.data["social_security"] == pytest.approx(186.0)
    assert result.data["medicare"] == pytest.approx(43.5)
    assert result.data["other_deductions"] == [{"name": "Union Dues", "amount": 25.0}]


def test_paystub_ytd_and_earnings():
    fields = {
        "Employer": _obj({"Name": _s("X")}),
        "CurrentPeriodGrossPay": _c(2000.0),
        "CurrentPeriodNetPay": _c(1600.0),
        "YearToDateGrossPay": _c(24000.0),
        "YearToDateNetPay": _c(19200.0),
        "CurrentPeriodEarnings": _arr([
            _obj({"Description": _s("Regular"), "Hours": _n(80.0), "Rate": _c(25.0)}),
        ]),
    }
    result = _map_paystub(fields, "payStub.us")
    assert result.data["ytd_gross"] == pytest.approx(24000.0)
    assert result.data["ytd_net"] == pytest.approx(19200.0)
    assert result.data["hours_worked"] == pytest.approx(80.0)
    assert result.data["hourly_rate"] == pytest.approx(25.0)


def test_paystub_missing_required_fields():
    fields = {"Employer": _obj({"Name": _s("X")})}
    result = _map_paystub(fields, "payStub.us")
    assert any("gross_pay" in w for w in result.warnings)
    assert any("net_pay" in w for w in result.warnings)


# ---------------------------------------------------------------------------
# W-2 mapper
# ---------------------------------------------------------------------------

def test_w2_full():
    fields = {
        "Employer": _obj({"Name": _s("ACME Corp"), "IdNumber": _s("25-0965591")}),
        "Employee": _obj({
            "Name": _s("Jane Doe"),
            "SocialSecurityNumber": _s("123-45-6789"),
        }),
        "TaxYear": _s("2025"),
        "WagesTipsAndOtherCompensation": _c(75000.0, 0.98),
        "FederalIncomeTaxWithheld": _c(12500.0, 0.97),
        "SocialSecurityWages": _c(75000.0),
        "SocialSecurityTaxWithheld": _c(4650.0),
        "MedicareWagesAndTips": _c(75000.0),
        "MedicareTaxWithheld": _c(1087.50),
        "StateTaxInfos": _arr([
            _obj({
                "State": _s("WA"),
                "StateWagesTipsEtc": _c(75000.0),
                "StateIncomeTax": _c(0.0),
            }),
        ]),
    }
    result = _map_w2(fields, "tax.us.w2")
    assert result.data["employer_name"] == "ACME Corp"
    assert result.data["employer_ein"] == "25-0965591"
    assert result.data["employee_name"] == "Jane Doe"
    assert result.data["employee_ssn_last4"] == "6789"
    assert result.data["tax_year"] == "2025"
    assert result.data["wages"] == pytest.approx(75000.0)
    assert result.data["federal_tax_withheld"] == pytest.approx(12500.0)
    assert result.data["state"] == "WA"
    assert result.confidence > 0.9
    # Full SSN was visible
    assert any("SSN" in w for w in result.warnings)


def test_w2_multiple_states_warning():
    fields = {
        "Employer": _obj({"Name": _s("X")}),
        "Employee": _obj({"Name": _s("Y")}),
        "TaxYear": _s("2025"),
        "WagesTipsAndOtherCompensation": _c(50000.0),
        "FederalIncomeTaxWithheld": _c(8000.0),
        "StateTaxInfos": _arr([
            _obj({"State": _s("WA"), "StateIncomeTax": _c(0.0)}),
            _obj({"State": _s("CA"), "StateIncomeTax": _c(3000.0)}),
        ]),
    }
    result = _map_w2(fields, "tax.us.w2")
    assert result.data["state"] == "WA"
    assert any("Multiple states" in w for w in result.warnings)


def test_w2_missing_required():
    fields = {
        "Employer": _obj({"Name": _s("X")}),
        "TaxYear": _s("2025"),
    }
    result = _map_w2(fields, "tax.us.w2")
    assert any("wages" in w.lower() for w in result.warnings)
    assert any("federal_tax_withheld" in w.lower() for w in result.warnings)


# ---------------------------------------------------------------------------
# 1040 mapper
# ---------------------------------------------------------------------------

def test_1040_full():
    """Azure DI 1040 uses Box-number fields (Box11=AGI, Box15=Taxable, etc.)."""
    fields = {
        "TaxYear": _s("2025"),
        "FilingStatus": _s("Married Filing Jointly"),
        "Box11": _c(125000.0),   # AGI (Line 11)
        "Box15": _c(95000.0),    # Taxable income (Line 15)
        "Box24": _c(14250.0),    # Total tax (Line 24)
        "Box33": _c(18000.0),    # Total payments (Line 33)
        "Box34": _c(3750.0),     # Overpaid / Refund (Line 34)
    }
    result = _map_1040(fields, "tax.us.1040")
    assert result.data["tax_year"] == "2025"
    assert result.data["filing_status"] == "married_jointly"
    assert result.data["adjusted_gross_income"] == pytest.approx(125000.0)
    assert result.data["taxable_income"] == pytest.approx(95000.0)
    assert result.data["refund_amount"] == pytest.approx(3750.0)
    assert result.data["return_type"] == "federal"
    assert not result.warnings


def test_1040_amount_owed():
    fields = {
        "TaxYear": _s("2025"),
        "Box11": _c(80000.0),    # AGI
        "Box37": _c(1200.0),     # Amount owed (Line 37)
    }
    result = _map_1040(fields, "tax.us.1040")
    assert result.data["amount_owed"] == pytest.approx(1200.0)
    assert "refund_amount" not in result.data


def test_1040_missing_required():
    fields = {}
    result = _map_1040(fields, "tax.us.1040")
    assert any("tax_year" in w for w in result.warnings)
    assert any("adjusted_gross_income" in w for w in result.warnings)


# ---------------------------------------------------------------------------
# Bank statement mapper
# ---------------------------------------------------------------------------

def test_bank_statement_checking():
    fields = {
        "BankName": _s("Chase"),
        "AccountNumber": _s("0010821154"),
        "StartDate": _d("2026-01-01"),
        "EndDate": _d("2026-01-31"),
        "BeginningBalance": _c(2500.00),
        "EndingBalance": _c(3100.50),
        "TotalDeposits": _c(2000.00),
        "TotalWithdrawals": _c(1399.50),
    }
    result = _map_bank_statement(fields, "bankStatement.us.checking")
    assert result.data["institution_name"] == "Chase"
    assert result.data["account_number_last4"] == "1154"
    assert result.data["account_type"] == "checking"
    assert result.data["beginning_balance"] == pytest.approx(2500.00)
    assert result.data["ending_balance"] == pytest.approx(3100.50)
    assert result.data["total_deposits"] == pytest.approx(2000.00)
    assert result.data["total_withdrawals"] == pytest.approx(1399.50)


def test_bank_statement_savings():
    fields = {
        "BankName": _s("Bank of America, N.A."),
        "BeginningBalance": _c(5000.0),
        "EndingBalance": _c(5025.0),
    }
    result = _map_bank_statement(fields, "bankStatement.us.savings")
    assert result.data["account_type"] == "savings"
    assert result.data["institution_name"] == "Bank of America, N.A."


def test_bank_statement_missing_required():
    fields = {}
    result = _map_bank_statement(fields, "bankStatement.us.checking")
    assert any("institution_name" in w for w in result.warnings)
    assert any("beginning_balance" in w for w in result.warnings)
    assert any("ending_balance" in w for w in result.warnings)


# ---------------------------------------------------------------------------
# Credit card mapper
# ---------------------------------------------------------------------------

def test_credit_card_full():
    fields = {
        "BankName": _s("Discover"),
        "AccountNumber": _s("**** **** **** 4321"),
        "StatementStartDate": _d("2026-02-01"),
        "StatementEndDate": _d("2026-02-28"),
        "PreviousBalance": _c(1250.00),
        "PaymentsAndCredits": _c(500.00),
        "Purchases": _c(320.50),
        "NewBalance": _c(1070.50),
        "MinimumPaymentDue": _c(35.00),
        "PaymentDueDate": _d("2026-03-25"),
        "CreditLimit": _c(5000.00),
        "AvailableCredit": _c(3929.50),
        "CashAdvances": _c(0.0),
    }
    result = _map_credit_card(fields, "creditCard")
    assert result.data["issuer"] == "Discover"
    assert result.data["account_number_last4"] == "4321"
    assert result.data["previous_balance"] == pytest.approx(1250.00)
    assert result.data["payments"] == pytest.approx(500.00)
    assert result.data["new_charges"] == pytest.approx(320.50)
    assert result.data["ending_balance"] == pytest.approx(1070.50)
    assert result.data["cash_advances"] == pytest.approx(0.0)
    assert not result.warnings


def test_credit_card_missing_required():
    fields = {}
    result = _map_credit_card(fields, "creditCard")
    assert any("issuer" in w for w in result.warnings)
    assert any("previous_balance" in w for w in result.warnings)
    assert any("ending_balance" in w for w in result.warnings)


# ---------------------------------------------------------------------------
# Mortgage mapper
# ---------------------------------------------------------------------------

def test_mortgage_full():
    fields = {
        "Lender": _s("Wells Fargo"),
        "LoanNumber": _s("0129442679"),
        "PropertyAddress": _addr(
            street="123 Main St", city="Seattle", state="WA", postal="98101",
        ),
        "InterestRate": _n(0.065),
        "MonthlyPayment": _c(2850.00),
        "CurrentBalance": _c(415000.00),
        "EscrowBalance": _c(3200.00),
        "StatementDate": _d("2026-03-01"),
    }
    result = _map_mortgage(fields, "mortgage.us")
    assert result.data["lender_name"] == "Wells Fargo"
    assert result.data["loan_number"] == "0129442679"
    assert result.data["property_address"] == "123 Main St, Seattle, WA, 98101"
    assert result.data["interest_rate"] == pytest.approx(0.065)
    assert result.data["monthly_payment"] == pytest.approx(2850.00)
    assert result.data["current_balance"] == pytest.approx(415000.00)
    assert result.data["escrow_balance"] == pytest.approx(3200.00)
    assert not result.warnings


def test_mortgage_missing_required():
    fields = {}
    result = _map_mortgage(fields, "mortgage.us")
    assert any("lender_name" in w for w in result.warnings)
    assert any("current_balance" in w for w in result.warnings)


# ---------------------------------------------------------------------------
# ID document mapper
# ---------------------------------------------------------------------------

def test_id_document_full():
    fields = {
        "FirstName": _s("MATTHEW"),
        "LastName": _s("GIESELMAN"),
        "DateOfBirth": _d("1985-03-22"),
        "DocumentNumber": _s("WDL1234567"),
        "DateOfExpiration": _d("2030-03-22"),
        "Address": _addr(street="456 Oak Ave", city="Bellevue", state="WA", postal="98004"),
        "Region": _s("WA"),
        "Sex": _s("M"),
    }
    result = _map_id_document(fields, "idDocument")
    assert result.data["full_name"] == "Matthew Gieselman"
    assert result.data["date_of_birth"] == "1985-03-22"
    assert result.data["license_number"] == "WDL1234567"
    assert result.data["expiration_date"] == "2030-03-22"
    assert result.data["address"] == "456 Oak Ave, Bellevue, WA, 98004"
    assert result.data["state"] == "WA"
    assert result.data["sex"] == "M"
    assert not result.warnings


def test_id_document_first_name_only():
    """Only first name present — still produces full_name."""
    fields = {"FirstName": _s("JOHN", 0.80)}
    result = _map_id_document(fields, "idDocument")
    assert result.data["full_name"] == "John"
    assert result.field_confidences["full_name"] == pytest.approx(0.80)


def test_id_document_missing_name():
    fields = {"DocumentNumber": _s("ABC123")}
    result = _map_id_document(fields, "idDocument")
    assert "full_name" not in result.data
    assert any("full_name" in w for w in result.warnings)


# ---------------------------------------------------------------------------
# Social Security card mapper
# ---------------------------------------------------------------------------

def test_ssn_card_full():
    fields = {
        "FirstName": _s("JANE"),
        "LastName": _s("DOE"),
        "SocialSecurityNumber": _s("987-65-4321"),
    }
    result = _map_social_security_card(fields, "social_security_card")
    assert result.data["full_name"] == "Jane Doe"
    assert result.data["ssn_last4"] == "4321"
    assert any("Full SSN" in w for w in result.warnings)


def test_ssn_card_falls_back_to_document_number():
    """When SocialSecurityNumber is absent, try DocumentNumber."""
    fields = {
        "FirstName": _s("JOHN"),
        "LastName": _s("SMITH"),
        "DocumentNumber": _s("555-12-9876"),
    }
    result = _map_social_security_card(fields, "social_security_card")
    assert result.data["ssn_last4"] == "9876"


def test_ssn_card_no_ssn():
    fields = {"FirstName": _s("JANE"), "LastName": _s("DOE")}
    result = _map_social_security_card(fields, "social_security_card")
    assert result.data["full_name"] == "Jane Doe"
    assert "ssn_last4" not in result.data


# ---------------------------------------------------------------------------
# AzureDIExtractor provider — doc_class routing
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_azure_di_extractor_unsupported_doc_class():
    """Unsupported doc classes return None without calling Azure."""
    ext = AzureDIExtractor()
    result = await ext.extract(
        doc_class="brokerage_statement", text="", content=b"", form_fields={},
    )
    assert result is None


@pytest.mark.asyncio
async def test_azure_di_extractor_1099_no_mapper():
    """1099 is in _PREBUILT_MODELS but has no mapper yet — returns None."""
    assert "tax.us.1099" in _PREBUILT_MODELS
    assert "tax.us.1099" not in _MAPPERS
    ext = AzureDIExtractor()
    result = await ext.extract(
        doc_class="tax.us.1099", text="", content=b"", form_fields={},
    )
    assert result is None


# ---------------------------------------------------------------------------
# Model / mapper coverage
# ---------------------------------------------------------------------------

def test_all_mappers_have_prebuilt_models():
    """Every mapper has a corresponding prebuilt model."""
    for doc_class in _MAPPERS:
        assert doc_class in _PREBUILT_MODELS, f"{doc_class} in _MAPPERS but not _PREBUILT_MODELS"


def test_prebuilt_models_completeness():
    """Spot-check expected doc classes are in the model routing."""
    expected = [
        "payStub.us", "tax.us.w2", "tax.us.1040", "bankStatement.us.checking",
        "bankStatement.us.savings", "idDocument",
        "social_security_card",
    ]
    for dc in expected:
        assert dc in _PREBUILT_MODELS
    # creditCard deliberately excluded — prebuilt-creditCard extracts physical card data,
    # not statement data.
    assert "creditCard" not in _PREBUILT_MODELS
    # mortgage.us deliberately excluded — no Azure DI statement model exists
    assert "mortgage.us" not in _PREBUILT_MODELS
