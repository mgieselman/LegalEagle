"""
Pydantic models mirroring the Zod schemas in server/src/services/extraction/schemas.ts.
Field names, types, and optionality must match exactly — the Node.js server consumes
this JSON without transformation.

Dates: YYYY-MM-DD strings.
Numbers: float, never string.
Optional fields: omitted when not found (not null or 0).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

from pydantic import BaseModel, ConfigDict


# ---- Extraction result (shared across all providers) -----------------------

@dataclass
class RuleExtractionResult:
    data: dict
    field_confidences: dict[str, float]
    warnings: list[str]
    confidence: float
    pages_analyzed: int = 0


# ---- Shared config ---------------------------------------------------------

class _Base(BaseModel):
    model_config = ConfigDict(extra="forbid")


# ---- Per-class data models -------------------------------------------------

class OtherDeduction(BaseModel):
    name: str
    amount: float


class PaystubData(_Base):
    employer_name: str
    employee_name: str | None = None
    pay_period_start: str | None = None
    pay_period_end: str | None = None
    pay_date: str | None = None
    pay_frequency: Literal["weekly", "biweekly", "semimonthly", "monthly"] | None = None
    gross_pay: float
    federal_tax: float | None = None
    state_tax: float | None = None
    social_security: float | None = None
    medicare: float | None = None
    health_insurance: float | None = None
    retirement_401k: float | None = None
    other_deductions: list[OtherDeduction] | None = None
    net_pay: float
    ytd_gross: float | None = None
    ytd_net: float | None = None
    hours_worked: float | None = None
    hourly_rate: float | None = None


class BankTransaction(BaseModel):
    date: str
    description: str
    amount: float
    type: Literal["credit", "debit"]


class BankStatementData(_Base):
    institution_name: str
    account_type: Literal["checking", "savings", "investment"] | None = None
    account_number_last4: str | None = None
    statement_period_start: str | None = None
    statement_period_end: str | None = None
    beginning_balance: float
    ending_balance: float
    total_deposits: float | None = None
    total_withdrawals: float | None = None
    transactions: list[BankTransaction] | None = None


class W2Data(_Base):
    employer_name: str
    employer_ein: str | None = None
    employee_name: str | None = None
    employee_ssn_last4: str | None = None
    tax_year: str | None = None
    wages: float
    federal_tax_withheld: float
    social_security_wages: float | None = None
    social_security_tax: float | None = None
    medicare_wages: float | None = None
    medicare_tax: float | None = None
    state: str | None = None
    state_wages: float | None = None
    state_tax: float | None = None


class TaxReturnData(_Base):
    tax_year: str
    return_type: Literal["federal", "state"] | None = None
    filing_status: Literal[
        "single",
        "married_jointly",
        "married_separately",
        "head_of_household",
        "qualifying_surviving_spouse",
    ] | None = None
    adjusted_gross_income: float
    taxable_income: float | None = None
    total_tax: float | None = None
    total_payments: float | None = None
    refund_amount: float | None = None
    amount_owed: float | None = None


class CreditCardData(_Base):
    issuer: str
    account_number_last4: str | None = None
    statement_period_start: str | None = None
    statement_period_end: str | None = None
    previous_balance: float
    payments: float | None = None
    new_charges: float | None = None
    ending_balance: float
    minimum_payment_due: float | None = None
    payment_due_date: str | None = None
    credit_limit: float | None = None
    available_credit: float | None = None
    cash_advances: float | None = None


class OtherExpense(BaseModel):
    name: str
    amount: float


class ProfitLossData(_Base):
    business_name: str
    gross_revenue: float
    net_profit: float
    period_start: str | None = None
    period_end: str | None = None
    total_expenses: float | None = None
    owner_name: str | None = None
    cost_of_goods_sold: float | None = None
    payroll_expenses: float | None = None
    rent_expense: float | None = None
    utilities: float | None = None
    other_expenses: list[OtherExpense] | None = None


class RetirementAccountData(_Base):
    institution_name: str
    account_type: Literal["IRA", "401k", "403b", "pension", "other_retirement"]
    ending_balance: float
    account_number_last4: str | None = None
    statement_period_end: str | None = None
    account_holder_name: str | None = None
    employer_name: str | None = None


class CollectionLetterData(_Base):
    collection_agency_name: str
    amount_claimed: float
    original_creditor: str | None = None
    account_number_last4: str | None = None
    letter_date: str | None = None
    debt_type: str | None = None
    references_lawsuit: bool | None = None
    references_judgment: bool | None = None
    judgment_amount: float | None = None
    court_name: str | None = None
    collection_agency_address: str | None = None
    phone: str | None = None


class LegalDocumentData(_Base):
    document_type: Literal[
        "summons", "complaint", "judgment", "garnishment_order", "foreclosure_notice", "other"
    ]
    plaintiff_name: str
    defendant_name: str | None = None
    case_number: str | None = None
    court_name: str | None = None
    court_address: str | None = None
    filing_date: str | None = None
    case_type: str | None = None
    amount_claimed: float | None = None
    judgment_amount: float | None = None
    garnishment_amount: float | None = None
    property_address: str | None = None


class VehicleLoanData(_Base):
    lender_name: str | None = None
    current_balance: float
    account_number_last4: str | None = None
    interest_rate: float | None = None
    monthly_payment: float | None = None
    vehicle_description: str | None = None
    loan_origination_date: str | None = None
    payoff_amount: float | None = None
    lender_address: str | None = None


class MortgageData(_Base):
    lender_name: str
    current_balance: float
    loan_number: str | None = None
    property_address: str | None = None
    interest_rate: float | None = None
    monthly_payment: float | None = None
    statement_period_end: str | None = None
    loan_type: Literal["first_mortgage", "second_mortgage", "heloc", "other"] | None = None
    escrow_balance: float | None = None
    payoff_amount: float | None = None
    lender_address: str | None = None


class MortgagePaymentData(_Base):
    lender_name: str
    payment_amount: float
    payment_date: str | None = None
    loan_number_last4: str | None = None
    confirmation_number: str | None = None


class SocialSecurityData(_Base):
    monthly_benefit: float
    benefit_type: Literal["SSDI", "SSI", "retirement", "survivor", "other"] | None = None
    effective_date: str | None = None
    recipient_name: str | None = None
    net_monthly_benefit: float | None = None
    medicare_premium: float | None = None
    annual_benefit: float | None = None


class DriversLicenseData(_Base):
    full_name: str
    date_of_birth: str | None = None   # YYYY-MM-DD
    license_number: str | None = None
    expiration_date: str | None = None  # YYYY-MM-DD
    address: str | None = None
    state: str | None = None
    sex: str | None = None


class SocialSecurityCardData(_Base):
    full_name: str
    # Full SSN is never stored — only last 4 digits if clearly visible
    ssn_last4: str | None = None


class BrokerageStatementData(_Base):
    institution_name: str
    account_holder_name: str | None = None
    account_number_last4: str | None = None
    statement_period_start: str | None = None
    statement_period_end: str | None = None
    beginning_value: float
    ending_value: float


class VehicleTitleData(_Base):
    vin: str | None = None
    year: str | None = None
    make: str | None = None
    model: str | None = None


class Tax1099Data(_Base):
    form_variant: str  # 1099-MISC, 1099-NEC, 1099-INT, 1099-DIV, 1099-R, 1099-SSA, 1099-G, etc.
    payer_name: str
    recipient_name: str | None = None
    recipient_ssn_last4: str | None = None
    tax_year: str | None = None
    total_amount: float
    federal_tax_withheld: float | None = None


# Union of all data types
ExtractionData = (
    PaystubData
    | BankStatementData
    | W2Data
    | TaxReturnData
    | CreditCardData
    | ProfitLossData
    | RetirementAccountData
    | CollectionLetterData
    | LegalDocumentData
    | VehicleLoanData
    | MortgageData
    | SocialSecurityData
    | DriversLicenseData
    | SocialSecurityCardData
    | BrokerageStatementData
    | VehicleTitleData
    | Tax1099Data
)

# All valid doc class strings (matches TypeScript DOC_CLASS_VALUES)
DOC_CLASSES = [
    "payStub.us",
    "bankStatement.us.checking",
    "bankStatement.us.savings",
    "tax.us.1040",
    "ira_statement",
    "401k_statement",
    "creditCard",
    "payroll_export",
    "tax.us.w2",
    "tax.us.1099",
    "other",
    "unclassified",
    "profit_loss_statement",
    "retirement_account",
    "collection_letter",
    "legal_document",
    "vehicle_loan_statement",
    "mortgage.us",
    "mortgage_payment",
    "social_security_letter",
    "idDocument",
    "social_security_card",
    "brokerage_statement",
    "vehicle_title",
]

# Map doc_class → data model (for validation)
DOC_CLASS_SCHEMA: dict[str, type[_Base]] = {
    "payStub.us": PaystubData,
    "bankStatement.us.checking": BankStatementData,
    "bankStatement.us.savings": BankStatementData,
    "tax.us.1040": TaxReturnData,
    "ira_statement": RetirementAccountData,
    "401k_statement": RetirementAccountData,
    "creditCard": CreditCardData,
    "tax.us.w2": W2Data,
    "profit_loss_statement": ProfitLossData,
    "retirement_account": RetirementAccountData,
    "collection_letter": CollectionLetterData,
    "legal_document": LegalDocumentData,
    "vehicle_loan_statement": VehicleLoanData,
    "mortgage.us": MortgageData,
    "mortgage_payment": MortgagePaymentData,
    "social_security_letter": SocialSecurityData,
    "idDocument": DriversLicenseData,
    "social_security_card": SocialSecurityCardData,
    "brokerage_statement": BrokerageStatementData,
    "vehicle_title": VehicleTitleData,
    "tax.us.1099": Tax1099Data,
}


# ---- API response model ----------------------------------------------------

class ExtractionResult(BaseModel):
    """The contract returned by POST /extract. Consumed by the Node.js server as-is."""
    doc_class: str
    classification_confidence: float
    classification_method: Literal["rule_engine", "ai"]
    extraction_method: str  # Provider name: "rule_engine", "ai_parse", "unclassified", etc.
    confidence: float
    data: dict  # Typed per doc_class — Node.js validates against its own Zod schema
    field_confidences: dict[str, float]
    warnings: list[str]
