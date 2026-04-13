"""
Phase 1 — Schema contract tests.
Verifies that every Pydantic model matches the expected JSON shape and
field names align with the TypeScript Zod schemas.
"""
import json
import pytest
from pydantic import ValidationError

from schemas import (
    PaystubData,
    BankStatementData,
    BrokerageStatementData,
    W2Data,
    TaxReturnData,
    CreditCardData,
    ProfitLossData,
    RetirementAccountData,
    CollectionLetterData,
    LegalDocumentData,
    VehicleLoanData,
    MortgageData,
    SocialSecurityData,
    VehicleTitleData,
    OtherDeduction,
    BankTransaction,
    OtherExpense,
    ExtractionResult,
    DOC_CLASSES,
    DOC_CLASS_SCHEMA,
)


# ---- PaystubData -----------------------------------------------------------

def test_paystub_minimal():
    p = PaystubData(employer_name="Acme Corp", gross_pay=4500.0, net_pay=3200.0)
    assert p.employer_name == "Acme Corp"
    assert p.gross_pay == 4500.0
    assert p.net_pay == 3200.0
    assert p.federal_tax is None


def test_paystub_full():
    p = PaystubData(
        employer_name="Acme Corp",
        employee_name="Jane Doe",
        pay_period_start="2026-01-01",
        pay_period_end="2026-01-14",
        pay_date="2026-01-18",
        pay_frequency="biweekly",
        gross_pay=4500.0,
        federal_tax=650.0,
        state_tax=200.0,
        social_security=279.0,
        medicare=65.25,
        health_insurance=180.0,
        retirement_401k=225.0,
        other_deductions=[OtherDeduction(name="Union dues", amount=25.0)],
        net_pay=2875.75,
        ytd_gross=9000.0,
        ytd_net=5751.50,
        hours_worked=80.0,
        hourly_rate=56.25,
    )
    serialized = json.loads(p.model_dump_json(exclude_none=True))
    assert serialized["pay_frequency"] == "biweekly"
    assert serialized["other_deductions"] == [{"name": "Union dues", "amount": 25.0}]


def test_paystub_requires_gross_pay():
    with pytest.raises(ValidationError):
        PaystubData(employer_name="Acme", net_pay=100.0)  # missing gross_pay


def test_paystub_requires_net_pay():
    with pytest.raises(ValidationError):
        PaystubData(employer_name="Acme", gross_pay=100.0)  # missing net_pay


def test_paystub_invalid_pay_frequency():
    with pytest.raises(ValidationError):
        PaystubData(employer_name="A", gross_pay=100.0, net_pay=80.0, pay_frequency="fortnightly")


# ---- BankStatementData -----------------------------------------------------

def test_bank_statement_minimal():
    b = BankStatementData(
        institution_name="Bank of America, N.A.",
        beginning_balance=1000.0,
        ending_balance=1250.0,
    )
    assert b.institution_name == "Bank of America, N.A."
    assert b.transactions is None


def test_bank_statement_with_transactions():
    b = BankStatementData(
        institution_name="Chase",
        beginning_balance=500.0,
        ending_balance=600.0,
        transactions=[
            BankTransaction(date="2026-01-05", description="Direct deposit", amount=200.0, type="credit"),
            BankTransaction(date="2026-01-10", description="Grocery store", amount=100.0, type="debit"),
        ],
    )
    assert len(b.transactions) == 2
    assert b.transactions[0].type == "credit"


def test_bank_statement_invalid_transaction_type():
    with pytest.raises(ValidationError):
        BankStatementData(
            institution_name="Chase",
            beginning_balance=500.0,
            ending_balance=600.0,
            transactions=[BankTransaction(date="2026-01-05", description="x", amount=10.0, type="withdrawal")],
        )


# ---- W2Data ----------------------------------------------------------------

def test_w2_minimal():
    w = W2Data(employer_name="Univ of Pittsburgh", wages=44629.35, federal_tax_withheld=7631.62)
    assert w.wages == 44629.35
    assert w.employee_ssn_last4 is None


def test_w2_full():
    w = W2Data(
        employer_name="University of Pittsburgh",
        employer_ein="25-0965591",
        employee_name="Elizabeth A Darling",
        employee_ssn_last4="6789",
        tax_year="2024",
        wages=44629.35,
        federal_tax_withheld=7631.62,
        social_security_wages=48736.35,
        social_security_tax=3021.65,
        medicare_wages=48736.35,
        medicare_tax=706.68,
        state="PA",
        state_wages=44629.35,
        state_tax=1338.88,
    )
    serialized = json.loads(w.model_dump_json(exclude_none=True))
    assert "employee_ssn_last4" in serialized
    assert "employer_ein" in serialized


# ---- TaxReturnData ---------------------------------------------------------

def test_tax_return_minimal():
    t = TaxReturnData(tax_year="2023", adjusted_gross_income=426934.0)
    assert t.taxable_income is None


def test_tax_return_full():
    t = TaxReturnData(
        tax_year="2023",
        return_type="federal",
        filing_status="married_jointly",
        adjusted_gross_income=426934.0,
        taxable_income=370971.0,
        total_tax=75597.0,
        total_payments=80000.0,
        refund_amount=4403.0,
    )
    assert t.filing_status == "married_jointly"


def test_tax_return_invalid_filing_status():
    with pytest.raises(ValidationError):
        TaxReturnData(tax_year="2023", adjusted_gross_income=100000.0, filing_status="divorced")


# ---- CreditCardData --------------------------------------------------------

def test_credit_card_minimal():
    c = CreditCardData(issuer="Chase", previous_balance=1200.0, ending_balance=1450.0)
    assert c.cash_advances is None


# ---- ProfitLossData --------------------------------------------------------

def test_profit_loss_minimal():
    p = ProfitLossData(business_name="Gieselman LLC", gross_revenue=120000.0, net_profit=45000.0)
    assert p.other_expenses is None


def test_profit_loss_with_expenses():
    p = ProfitLossData(
        business_name="Gieselman LLC",
        gross_revenue=120000.0,
        net_profit=45000.0,
        other_expenses=[OtherExpense(name="Subscriptions", amount=1200.0)],
    )
    assert p.other_expenses[0].name == "Subscriptions"


# ---- RetirementAccountData -------------------------------------------------

def test_retirement_account():
    r = RetirementAccountData(
        institution_name="Fidelity",
        account_type="401k",
        ending_balance=150000.0,
    )
    assert r.account_type == "401k"


def test_retirement_account_invalid_type():
    with pytest.raises(ValidationError):
        RetirementAccountData(institution_name="X", account_type="roth", ending_balance=1000.0)


# ---- CollectionLetterData --------------------------------------------------

def test_collection_letter_minimal():
    c = CollectionLetterData(collection_agency_name="Midland Credit", amount_claimed=4500.0)
    assert c.references_lawsuit is None


# ---- LegalDocumentData -----------------------------------------------------

def test_legal_document():
    d = LegalDocumentData(document_type="summons", plaintiff_name="LVNV Funding LLC")
    assert d.document_type == "summons"


def test_legal_document_invalid_type():
    with pytest.raises(ValidationError):
        LegalDocumentData(document_type="subpoena", plaintiff_name="ABC")


# ---- VehicleLoanData -------------------------------------------------------

def test_vehicle_loan():
    v = VehicleLoanData(lender_name="Ford Motor Credit", current_balance=18500.0)
    assert v.vehicle_description is None


# ---- MortgageData ----------------------------------------------------------

def test_mortgage():
    m = MortgageData(lender_name="Wells Fargo", current_balance=285000.0)
    assert m.loan_type is None


# ---- SocialSecurityData ----------------------------------------------------

def test_social_security():
    s = SocialSecurityData(monthly_benefit=1850.0, benefit_type="SSDI")
    assert s.benefit_type == "SSDI"


# ---- BrokerageStatementData ------------------------------------------------

def test_brokerage_statement_minimal():
    b = BrokerageStatementData(
        institution_name="Fidelity",
        beginning_value=1000.0,
        ending_value=1125.0,
    )
    assert b.institution_name == "Fidelity"
    assert b.beginning_value == 1000.0
    assert b.ending_value == 1125.0


def test_brokerage_statement_full():
    b = BrokerageStatementData(
        institution_name="E*TRADE",
        account_holder_name="Jane Doe",
        account_number_last4="1234",
        statement_period_start="2025-07-01",
        statement_period_end="2025-09-30",
        beginning_value=5000.25,
        ending_value=5500.75,
    )
    serialized = json.loads(b.model_dump_json(exclude_none=True))
    assert serialized["account_holder_name"] == "Jane Doe"
    assert serialized["account_number_last4"] == "1234"


# ---- VehicleTitleData ------------------------------------------------------

def test_vehicle_title_with_core_fields():
    v = VehicleTitleData(vin="1HGCM82633A004352", year="2019", make="SUBA", model="OUTBACK")
    assert v.vin == "1HGCM82633A004352"
    assert v.year == "2019"
    assert v.make == "SUBA"
    assert v.model == "OUTBACK"


# ---- ExtractionResult (API response) ---------------------------------------

def test_extraction_result_shape():
    r = ExtractionResult(
        doc_class="payStub.us",
        classification_confidence=0.95,
        classification_method="rule_engine",
        extraction_method="rule_engine",
        confidence=0.91,
        data={"employer_name": "Acme", "gross_pay": 4500.0, "net_pay": 3200.0},
        field_confidences={"employer_name": 0.95, "gross_pay": 0.98},
        warnings=[],
    )
    serialized = json.loads(r.model_dump_json())
    assert serialized["doc_class"] == "payStub.us"
    assert serialized["classification_method"] == "rule_engine"
    assert serialized["extraction_method"] == "rule_engine"
    assert isinstance(serialized["warnings"], list)


def test_extraction_result_unclassified():
    r = ExtractionResult(
        doc_class="unclassified",
        classification_confidence=0.0,
        classification_method="rule_engine",
        extraction_method="unclassified",
        confidence=0.0,
        data={},
        field_confidences={},
        warnings=["No matching document class"],
    )
    assert r.doc_class == "unclassified"


# ---- DOC_CLASSES completeness ----------------------------------------------

def test_doc_classes_list():
    assert "payStub.us" in DOC_CLASSES
    assert "tax.us.w2" in DOC_CLASSES
    assert "bankStatement.us.checking" in DOC_CLASSES
    assert "bankStatement.us.savings" in DOC_CLASSES
    assert "unclassified" in DOC_CLASSES
    assert "idDocument" in DOC_CLASSES
    assert "social_security_card" in DOC_CLASSES
    assert "brokerage_statement" in DOC_CLASSES
    assert "vehicle_title" in DOC_CLASSES
    assert len(DOC_CLASSES) == 23


def test_doc_class_schema_map():
    assert DOC_CLASS_SCHEMA["payStub.us"] is PaystubData
    assert DOC_CLASS_SCHEMA["bankStatement.us.checking"] is BankStatementData
    assert DOC_CLASS_SCHEMA["bankStatement.us.savings"] is BankStatementData
    assert DOC_CLASS_SCHEMA["tax.us.w2"] is W2Data
    assert DOC_CLASS_SCHEMA["tax.us.1040"] is TaxReturnData
    # Legacy retirement classes map to same model
    assert DOC_CLASS_SCHEMA["ira_statement"] is RetirementAccountData
    assert DOC_CLASS_SCHEMA["401k_statement"] is RetirementAccountData
    assert DOC_CLASS_SCHEMA["brokerage_statement"] is BrokerageStatementData
    assert DOC_CLASS_SCHEMA["vehicle_title"] is VehicleTitleData


# ---- JSON serialization (exclude_none removes optional absent fields) ------

def test_serialization_excludes_none():
    p = PaystubData(employer_name="X", gross_pay=1000.0, net_pay=800.0)
    d = json.loads(p.model_dump_json(exclude_none=True))
    assert "federal_tax" not in d
    assert "pay_date" not in d
    assert "employer_name" in d
    assert "gross_pay" in d
