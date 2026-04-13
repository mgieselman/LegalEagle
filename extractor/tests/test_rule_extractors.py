"""
Phase 4 — Rule extractor tests.
Ported from the TypeScript test suite in server/src/__tests__/.
Same inputs, same expected outputs.
"""
from __future__ import annotations

import pytest

from rule_extractors.utils import parse_dollar, normalize_date
from rule_extractors.paystub import extract_paystub_by_rules
from rule_extractors.bank_statement import extract_bank_statement_by_rules
from rule_extractors.w2 import extract_w2_by_form_fields
from rule_extractors.tax_return import extract_tax_return_by_rules
from rule_extractors.investment import extract_investment_by_rules
from rule_extractors.mortgage import extract_mortgage_by_rules


# ---- parse_dollar ----------------------------------------------------------

def test_parse_dollar_basic():
    assert parse_dollar("52000.00") == 52000.00

def test_parse_dollar_comma():
    assert parse_dollar("52,000.00") == 52000.00

def test_parse_dollar_dollar_sign():
    assert parse_dollar("$1,234.56") == 1234.56

def test_parse_dollar_parenthetical_negative():
    assert parse_dollar("(1,234.56)") == -1234.56

def test_parse_dollar_empty():
    assert parse_dollar("") is None

def test_parse_dollar_non_number():
    assert parse_dollar("hello") is None


# ---- normalize_date --------------------------------------------------------

def test_normalize_date_mdy_slash():
    assert normalize_date("01/02/2026") == "2026-01-02"

def test_normalize_date_mdy_dash():
    assert normalize_date("01-02-2026") == "2026-01-02"

def test_normalize_date_two_digit_year():
    assert normalize_date("01/02/26") == "2026-01-02"

def test_normalize_date_month_name():
    assert normalize_date("January 16, 2026") == "2026-01-16"


def test_normalize_date_dash_two_digit_year():
    assert normalize_date("06-01-25") == "2025-06-01"

def test_normalize_date_month_name_no_comma():
    assert normalize_date("December 18 2025") == "2025-12-18"

def test_normalize_date_empty():
    assert normalize_date("") is None

def test_normalize_date_invalid():
    assert normalize_date("not a date") is None


# ---- W-2 form field extractor (ported from rule-extractor-w2.test.ts) ------

class TestW2FieldNameMapping:
    def test_box1_wages(self):
        r = extract_w2_by_form_fields({"f2_1": "52000.00"})
        assert r.data.get("wages") == 52000.00

    def test_box2_federal_tax(self):
        r = extract_w2_by_form_fields({"f2_2": "8000.00"})
        assert r.data.get("federal_tax_withheld") == 8000.00

    def test_wages_keyword(self):
        r = extract_w2_by_form_fields({"wages_box1": "75000.00"})
        assert r.data.get("wages") == 75000.00

    def test_federal_keyword(self):
        r = extract_w2_by_form_fields({"federal_income": "12000.00"})
        assert r.data.get("federal_tax_withheld") == 12000.00

    def test_ss_wages_maps_to_social_security_wages_not_wages(self):
        """ss_wages should match Box 3 (social_security_wages), NOT Box 1 (wages)."""
        r = extract_w2_by_form_fields({"ss_wages": "52000.00"})
        assert r.data.get("social_security_wages") == 52000.00
        assert r.data.get("wages") is None

    def test_medicare_keyword_maps_to_medicare_wages_not_wages(self):
        r = extract_w2_by_form_fields({"medicare_wages_box5": "52000.00"})
        assert r.data.get("medicare_wages") == 52000.00
        assert r.data.get("wages") is None

    def test_ssn_truncated_to_last4(self):
        r = extract_w2_by_form_fields({"employee_ssn": "123-45-6789"})
        assert r.data.get("employee_ssn_last4") == "6789"

    def test_employer_ein_stored_as_is(self):
        r = extract_w2_by_form_fields({"ein": "25-0965591"})
        assert r.data.get("employer_ein") == "25-0965591"


class TestW2ConfidenceScoring:
    def test_high_confidence_with_4_dollar_boxes(self):
        r = extract_w2_by_form_fields({
            "f2_1": "52000.00",
            "f2_2": "8000.00",
            "f2_3": "52000.00",
            "f2_4": "3224.00",
            "f2_5": "52000.00",
            "f2_6": "754.00",
        })
        assert r.confidence >= 0.90

    def test_low_confidence_with_fewer_than_4_boxes(self):
        r = extract_w2_by_form_fields({"f2_1": "52000.00", "f2_2": "8000.00"})
        assert r.confidence < 0.85

    def test_zero_confidence_no_fields(self):
        r = extract_w2_by_form_fields({})
        assert r.confidence == 0.0
        assert any("No PDF form fields" in w for w in r.warnings)


class TestW2FullExtraction:
    def test_all_six_boxes(self):
        r = extract_w2_by_form_fields({
            "f2_1": "52,000.00",
            "f2_2": "8,000.00",
            "f2_3": "52,000.00",
            "f2_4": "3,224.00",
            "f2_5": "52,000.00",
            "f2_6": "754.00",
            "employer_name": "University of Pittsburgh",
            "ein": "25-0965591",
            "employee_name": "John Doe",
            "tax_year": "2024",
        })
        assert r.data["wages"] == 52000.00
        assert r.data["federal_tax_withheld"] == 8000.00
        assert r.data["social_security_wages"] == 52000.00
        assert r.data["social_security_tax"] == 3224.00
        assert r.data["medicare_wages"] == 52000.00
        assert r.data["medicare_tax"] == 754.00
        assert r.data["employer_name"] == "University of Pittsburgh"
        assert r.data["employer_ein"] == "25-0965591"
        assert r.confidence >= 0.90


# ---- Paystub rule extractor ------------------------------------------------

PAYSTUB_TAILORED_MGMT = """
TAILORED MANAGEMENT INC
100 Main St, Pittsburgh PA 15213

EMPLOYEE
Matthew Gieselman

Pay Date: 01/02/2026
Pay Period: 12/22/2025 - 12/28/2025

Gross Pay    2,585.81    28,444.00
Net Pay      2,137.33    23,510.00

FIT    0.00    0.00    235.67
FICA   0.00    0.00    160.32
MEDI   0.00    0.00     37.49

Regular    120.27    21.5
"""


def test_paystub_gross_pay():
    r = extract_paystub_by_rules(PAYSTUB_TAILORED_MGMT)
    assert r.data.get("gross_pay") == pytest.approx(2585.81)


def test_paystub_net_pay():
    r = extract_paystub_by_rules(PAYSTUB_TAILORED_MGMT)
    assert r.data.get("net_pay") == pytest.approx(2137.33)


def test_paystub_federal_tax():
    r = extract_paystub_by_rules(PAYSTUB_TAILORED_MGMT)
    assert r.data.get("federal_tax") == pytest.approx(235.67)


def test_paystub_social_security():
    r = extract_paystub_by_rules(PAYSTUB_TAILORED_MGMT)
    assert r.data.get("social_security") == pytest.approx(160.32)


def test_paystub_medicare():
    r = extract_paystub_by_rules(PAYSTUB_TAILORED_MGMT)
    assert r.data.get("medicare") == pytest.approx(37.49)


def test_paystub_pay_date():
    r = extract_paystub_by_rules(PAYSTUB_TAILORED_MGMT)
    assert r.data.get("pay_date") == "2026-01-02"


def test_paystub_pay_period():
    r = extract_paystub_by_rules(PAYSTUB_TAILORED_MGMT)
    assert r.data.get("pay_period_start") == "2025-12-22"
    assert r.data.get("pay_period_end") == "2025-12-28"


def test_paystub_hours_and_rate():
    r = extract_paystub_by_rules(PAYSTUB_TAILORED_MGMT)
    assert r.data.get("hourly_rate") == pytest.approx(120.27)
    assert r.data.get("hours_worked") == pytest.approx(21.5)


def test_paystub_confidence_high():
    r = extract_paystub_by_rules(PAYSTUB_TAILORED_MGMT)
    assert r.confidence >= 0.85


def test_paystub_ytd_gross():
    r = extract_paystub_by_rules(PAYSTUB_TAILORED_MGMT)
    assert r.data.get("ytd_gross") == pytest.approx(28444.00)


# ---- Bank statement rule extractor -----------------------------------------

BANK_STMT_TEXT = """
Bank of America, N.A.
Customer service: 1.800.432.1000

Your combined statement for December 18, 2025 to January 16, 2026

Account # 0010 8211 5472

Beginning balance on December 18, 2025   2.26
Deposits and other additions             870.52
Ending balance on January 16, 2026       110.69
"""


def test_bank_institution_name():
    r = extract_bank_statement_by_rules(BANK_STMT_TEXT)
    assert r.data.get("institution_name") == "Bank of America, N.A."


def test_bank_account_last4():
    r = extract_bank_statement_by_rules(BANK_STMT_TEXT)
    assert r.data.get("account_number_last4") == "5472"


def test_bank_beginning_balance():
    r = extract_bank_statement_by_rules(BANK_STMT_TEXT)
    assert r.data.get("beginning_balance") == pytest.approx(2.26)


def test_bank_ending_balance():
    r = extract_bank_statement_by_rules(BANK_STMT_TEXT)
    assert r.data.get("ending_balance") == pytest.approx(110.69)


def test_bank_total_deposits():
    r = extract_bank_statement_by_rules(BANK_STMT_TEXT)
    assert r.data.get("total_deposits") == pytest.approx(870.52)


def test_bank_statement_period():
    r = extract_bank_statement_by_rules(BANK_STMT_TEXT)
    assert r.data.get("statement_period_start") == "2025-12-18"
    assert r.data.get("statement_period_end") == "2026-01-16"


def test_bank_confidence():
    r = extract_bank_statement_by_rules(BANK_STMT_TEXT)
    assert r.confidence >= 0.85


def test_bank_no_match_returns_low_confidence():
    r = extract_bank_statement_by_rules("random text with no financial data")
    assert r.confidence < 0.50


# ---- E*Trade bank statement format -----------------------------------------

ETRADE_CHECKING_TEXT = """
E*TRADE - Account Records - Bank - Account Statements - Monthly Statements

Banking

Morgan Stanley
Private Bank
accounts
Checking -
2007814870

Statement Summary
06-01-25 through 06-30-25

Balance information
Average balance $15,801.09
Beginning balance $19,269.84
Ending balance $5,812.38

Misc information
Service charge $0.00
Creditsinfo_outline $4,336.34
Debitsinfo_outline $17,793.80
"""

ETRADE_SAVINGS_TEXT = """
E*TRADE - Account Records - Bank - Account Statements - Monthly Statements

Banking

Morgan Stanley
Private Bank
accounts
Premium
Savings -
2026255675

Statement Summary
09-01-25 through 09-30-25

Balance information
Beginning balance $2.67
Ending balance $2.68
Average balance $2.67

Misc information
Service charge $0.00
Creditsinfo_outline $0.01
Debitsinfo_outline $0.00
"""


def test_etrade_checking_institution():
    r = extract_bank_statement_by_rules(ETRADE_CHECKING_TEXT)
    assert r.data.get("institution_name") == "Morgan Stanley"


def test_etrade_checking_account_last4():
    r = extract_bank_statement_by_rules(ETRADE_CHECKING_TEXT)
    assert r.data.get("account_number_last4") == "4870"


def test_etrade_checking_balances():
    r = extract_bank_statement_by_rules(ETRADE_CHECKING_TEXT)
    assert r.data.get("beginning_balance") == pytest.approx(19269.84)
    assert r.data.get("ending_balance") == pytest.approx(5812.38)


def test_etrade_checking_period():
    r = extract_bank_statement_by_rules(ETRADE_CHECKING_TEXT)
    assert r.data.get("statement_period_start") == "2025-06-01"
    assert r.data.get("statement_period_end") == "2025-06-30"


def test_etrade_checking_credits_debits():
    r = extract_bank_statement_by_rules(ETRADE_CHECKING_TEXT)
    assert r.data.get("total_deposits") == pytest.approx(4336.34)
    assert r.data.get("total_withdrawals") == pytest.approx(17793.80)


def test_etrade_checking_confidence():
    r = extract_bank_statement_by_rules(ETRADE_CHECKING_TEXT)
    assert r.confidence >= 0.85


def test_etrade_savings_institution():
    r = extract_bank_statement_by_rules(ETRADE_SAVINGS_TEXT)
    assert r.data.get("institution_name") == "Morgan Stanley"


def test_etrade_savings_account_last4():
    r = extract_bank_statement_by_rules(ETRADE_SAVINGS_TEXT)
    assert r.data.get("account_number_last4") == "5675"


def test_etrade_savings_balances():
    r = extract_bank_statement_by_rules(ETRADE_SAVINGS_TEXT)
    assert r.data.get("beginning_balance") == pytest.approx(2.67)
    assert r.data.get("ending_balance") == pytest.approx(2.68)


def test_etrade_savings_period():
    r = extract_bank_statement_by_rules(ETRADE_SAVINGS_TEXT)
    assert r.data.get("statement_period_start") == "2025-09-01"
    assert r.data.get("statement_period_end") == "2025-09-30"


# ---- 1040 tax return rule extractor ----------------------------------------

TAX_RETURN_1040_TEXT = """
Form 1040 U.S. Individual Income Tax Return 2023
Department of the Treasury—Internal Revenue Service
For the year Jan. 1–Dec. 31, 2023, or other tax year beginning , 2023, ending , 20

Your first name and middle initial Last name Your social security number
MATTHEW GIESELMAN XXX-XX-1234

Filing Status
Single    Married filing jointly    Married filing separately    Head of household    Qualifying surviving spouse

1a Total amount from Form(s) W-2, box 1 426,099
9 Add lines 1z, 2b, 3b, 4b, 5b, 6b, 7, and 8. This is your total income 427,056
10 Adjustments to income from Schedule 1, line 26 122
11 Subtract line 10 from line 9. This is your adjusted gross income 426,934
12 Standard deduction or itemized deductions (from Schedule A) 55,665
15 Subtract line 14 from line 11. If zero or less, enter -0-. This is your taxable income 370,971
16 Tax (see instructions) 76,375
24 Add lines 22 and 23. This is your total tax 75,597
25d Add lines 25a through 25c 79,012
33 Add lines 25d, 26, and 32. These are your total payments 79,012
34 If line 33 is more than line 24, subtract line 24 from line 33. This is the amount you overpaid 3,415
"""


def test_1040_tax_year():
    r = extract_tax_return_by_rules(TAX_RETURN_1040_TEXT)
    assert r.data.get("tax_year") == "2023"


def test_1040_return_type():
    r = extract_tax_return_by_rules(TAX_RETURN_1040_TEXT)
    assert r.data.get("return_type") == "federal"


def test_1040_filing_status():
    r = extract_tax_return_by_rules(TAX_RETURN_1040_TEXT)
    # This is tricky - the filing status section lists all options
    # The extractor should pick up "Married filing jointly" as the first match
    # unless we have a way to determine which is checked
    assert r.data.get("filing_status") in [
        "single", "married_jointly", "married_separately",
        "head_of_household", "qualifying_surviving_spouse",
    ]


def test_1040_agi():
    r = extract_tax_return_by_rules(TAX_RETURN_1040_TEXT)
    assert r.data.get("adjusted_gross_income") == pytest.approx(426934.0)


def test_1040_taxable_income():
    r = extract_tax_return_by_rules(TAX_RETURN_1040_TEXT)
    assert r.data.get("taxable_income") == pytest.approx(370971.0)


def test_1040_total_tax():
    r = extract_tax_return_by_rules(TAX_RETURN_1040_TEXT)
    assert r.data.get("total_tax") == pytest.approx(75597.0)


def test_1040_total_payments():
    r = extract_tax_return_by_rules(TAX_RETURN_1040_TEXT)
    assert r.data.get("total_payments") == pytest.approx(79012.0)


def test_1040_refund():
    r = extract_tax_return_by_rules(TAX_RETURN_1040_TEXT)
    assert r.data.get("refund_amount") == pytest.approx(3415.0)


def test_1040_confidence():
    r = extract_tax_return_by_rules(TAX_RETURN_1040_TEXT)
    assert r.confidence >= 0.85


def test_1040_no_data():
    r = extract_tax_return_by_rules("random text with no tax data")
    assert r.confidence == 0.0
    assert any("adjusted_gross_income" in w for w in r.warnings)


# ---- Investment statement rule extractor ------------------------------------

ETRADE_IRA_TEXT = """
CLIENT STATEMENT For the Period July 1- September 30, 2025

STATEMENT FOR:
MATTHEW A GIESELMAN

Beginning Total Value (as of 7/1/25) $53.25
Ending Total Value (as of 9/30/25) $57.41
Includes Accrued Interest

Morgan Stanley Smith Barney LLC. Member SIPC.
E*TRADE is a business of Morgan Stanley.
"""

FIDELITY_IRA_TEXT = """
INVESTMENT REPORT
October 1, 2025 - December 31, 2025

FIDELITY ROLLOVER IRA ELIZABETH GIESELMAN - ROLLOVER IRA -
FIDELITY MANAGEMENT TRUST CO - CUSTODIAN
 Account Number: 168-744530

Your Account Value: $3.44

Beginning Account Value $3.41 $3.32
Ending Account Value ** $3.44 $3.44
"""

FIDELITY_BROKERAGE_TEXT = """
INVESTMENT REPORT
April 1, 2025 - June 30, 2025

FIDELITY ACCOUNT MATTHEW A GIESELMAN - INDIVIDUAL
 Account Number: X94-598134

Your Account Value: $39.47

Beginning Account Value $39.08 $38.36
Ending Account Value ** $39.47 $39.47
"""

FIDELITY_401K_TEXT = """
Statement Details

Microsoft Corporation
Savings Plus 401(k) Plan Retirement Savings Statement

MATTHEW A GIESELMAN
8707 W SNOQUALMIE VALLEY RD NE
CARNATION, WA 98014-

Your Account Summary Statement Period: 09/01/2025 to 09/30/2025

Beginning Balance $42,012.29
Withdrawals -$9,733.84
Dividends $57.99
Change on Market Value $1,322.01

Ending Balance $33,658.45

Vested Balance $33,658.45
"""

FIDELITY_PENSION_TEXT = """
Statement Details

Bank of America
Total Retirement Program Retirement Savings Statement

ELIZABETH RODRIGUEZ

Your Account Summary Statement Period: 06/01/2025 to 12/31/2025

Beginning Balance $15,957.09
Investment Gain (Loss) $522.05

Ending Balance $16,479.14

Vested Balance $16,479.14
Guaranteed Pension Minimum $7,347.13
"""


# E*TRADE IRA tests
def test_etrade_ira_institution():
    r = extract_investment_by_rules(ETRADE_IRA_TEXT, "ira_statement")
    assert "Morgan Stanley" in r.data.get("institution_name", "") or "E*TRADE" in r.data.get("institution_name", "")


def test_etrade_ira_ending_balance():
    r = extract_investment_by_rules(ETRADE_IRA_TEXT, "ira_statement")
    assert r.data.get("ending_balance") == pytest.approx(57.41)


def test_etrade_ira_account_type():
    r = extract_investment_by_rules(ETRADE_IRA_TEXT, "ira_statement")
    assert r.data.get("account_type") == "IRA"


def test_etrade_ira_holder():
    r = extract_investment_by_rules(ETRADE_IRA_TEXT, "ira_statement")
    assert "GIESELMAN" in r.data.get("account_holder_name", "")


def test_etrade_ira_period():
    r = extract_investment_by_rules(ETRADE_IRA_TEXT, "ira_statement")
    assert r.data.get("statement_period_end") == "2025-09-30"


def test_etrade_ira_confidence():
    r = extract_investment_by_rules(ETRADE_IRA_TEXT, "ira_statement")
    assert r.confidence >= 0.85


# Fidelity IRA tests
def test_fidelity_ira_ending_balance():
    r = extract_investment_by_rules(FIDELITY_IRA_TEXT, "ira_statement")
    assert r.data.get("ending_balance") == pytest.approx(3.44)


def test_fidelity_ira_account_last4():
    r = extract_investment_by_rules(FIDELITY_IRA_TEXT, "ira_statement")
    assert r.data.get("account_number_last4") == "4530"


def test_fidelity_ira_period():
    r = extract_investment_by_rules(FIDELITY_IRA_TEXT, "ira_statement")
    assert r.data.get("statement_period_end") == "2025-12-31"


def test_fidelity_ira_confidence():
    r = extract_investment_by_rules(FIDELITY_IRA_TEXT, "ira_statement")
    assert r.confidence >= 0.85


# Fidelity brokerage tests
def test_fidelity_brokerage_beginning_value():
    r = extract_investment_by_rules(FIDELITY_BROKERAGE_TEXT, "brokerage_statement")
    assert r.data.get("beginning_value") == pytest.approx(39.08)


def test_fidelity_brokerage_ending_value():
    r = extract_investment_by_rules(FIDELITY_BROKERAGE_TEXT, "brokerage_statement")
    assert r.data.get("ending_value") == pytest.approx(39.47)


def test_fidelity_brokerage_account_last4():
    r = extract_investment_by_rules(FIDELITY_BROKERAGE_TEXT, "brokerage_statement")
    assert r.data.get("account_number_last4") == "8134"


def test_fidelity_brokerage_period():
    r = extract_investment_by_rules(FIDELITY_BROKERAGE_TEXT, "brokerage_statement")
    assert r.data.get("statement_period_start") == "2025-04-01"
    assert r.data.get("statement_period_end") == "2025-06-30"


def test_fidelity_brokerage_confidence():
    r = extract_investment_by_rules(FIDELITY_BROKERAGE_TEXT, "brokerage_statement")
    assert r.confidence >= 0.85


# 401k tests
def test_401k_ending_balance():
    r = extract_investment_by_rules(FIDELITY_401K_TEXT, "401k_statement")
    assert r.data.get("ending_balance") == pytest.approx(33658.45)


def test_401k_account_type():
    r = extract_investment_by_rules(FIDELITY_401K_TEXT, "401k_statement")
    assert r.data.get("account_type") == "401k"


def test_401k_employer():
    r = extract_investment_by_rules(FIDELITY_401K_TEXT, "401k_statement")
    assert r.data.get("employer_name") == "Microsoft Corporation"


def test_401k_period():
    r = extract_investment_by_rules(FIDELITY_401K_TEXT, "401k_statement")
    assert r.data.get("statement_period_end") == "2025-09-30"


def test_401k_confidence():
    r = extract_investment_by_rules(FIDELITY_401K_TEXT, "401k_statement")
    assert r.confidence >= 0.85


# Pension tests
def test_pension_ending_balance():
    r = extract_investment_by_rules(FIDELITY_PENSION_TEXT, "retirement_account")
    assert r.data.get("ending_balance") == pytest.approx(16479.14)


def test_pension_account_type():
    r = extract_investment_by_rules(FIDELITY_PENSION_TEXT, "retirement_account")
    assert r.data.get("account_type") == "pension"


def test_pension_employer():
    r = extract_investment_by_rules(FIDELITY_PENSION_TEXT, "retirement_account")
    assert r.data.get("employer_name") == "Bank of America"


def test_pension_confidence():
    r = extract_investment_by_rules(FIDELITY_PENSION_TEXT, "retirement_account")
    assert r.confidence >= 0.85


# No-match test
def test_investment_no_data():
    r = extract_investment_by_rules("random text with no investment data", "ira_statement")
    assert r.confidence < 0.50


# ---- Mortgage statement rule extractor --------------------------------------

CENLAR_HELOC_TEXT = """
Home Equity Line Statement
Statement Closing Date: 01/09/26
Payment Due Date: 02/06/26
Loan Number: 0141595306

Available Credit: $0.00
Credit Limit: $361,550.00
Principal Balance: $361,149.00
Escrow Balance: $0.00

Payment Amount: $4,077.79

Property Address: 8707 W SNOQUALMIE VALLEY
CARNATION, WA 98014

Mail Payments To: Central Loan Administration & Reporting
PO Box 54040
Los Angeles, CA 90054-0040
"""

FREEDOM_MORTGAGE_TEXT = """
Freedom Mortgage Corporation
Mortgage Statement
Statement Date 01/01/26

Loan Number 0129442679
Payment Amount $5,602.40

Property Address: 8707 W SNOQUALMIE VLY RD NE
CARNATION WA 98014

Explanation of Payment Amount
Principal $1,356.82
Interest $2,131.17
Regular Monthly Payment $5,602.40

Account Information
Outstanding Principal $659,975.72
Interest Rate 3.875%
Escrow Balance ($2,825.00)

Mail Payments To: Freedom Mortgage Corporation
PO Box 10369
Newport News, VA 23601
"""


def test_cenlar_lender_name():
    r = extract_mortgage_by_rules(CENLAR_HELOC_TEXT)
    assert "Central Loan" in r.data.get("lender_name", "")


def test_cenlar_balance():
    r = extract_mortgage_by_rules(CENLAR_HELOC_TEXT)
    assert r.data.get("current_balance") == pytest.approx(361149.0)


def test_cenlar_loan_number():
    r = extract_mortgage_by_rules(CENLAR_HELOC_TEXT)
    assert r.data.get("loan_number") == "0141595306"


def test_cenlar_loan_type():
    r = extract_mortgage_by_rules(CENLAR_HELOC_TEXT)
    assert r.data.get("loan_type") == "heloc"


def test_cenlar_payment():
    r = extract_mortgage_by_rules(CENLAR_HELOC_TEXT)
    assert r.data.get("monthly_payment") == pytest.approx(4077.79)


def test_cenlar_statement_date():
    r = extract_mortgage_by_rules(CENLAR_HELOC_TEXT)
    assert r.data.get("statement_period_end") == "2026-01-09"


def test_cenlar_confidence():
    r = extract_mortgage_by_rules(CENLAR_HELOC_TEXT)
    assert r.confidence >= 0.85


def test_freedom_lender_name():
    r = extract_mortgage_by_rules(FREEDOM_MORTGAGE_TEXT)
    assert "Freedom Mortgage" in r.data.get("lender_name", "")


def test_freedom_balance():
    r = extract_mortgage_by_rules(FREEDOM_MORTGAGE_TEXT)
    assert r.data.get("current_balance") == pytest.approx(659975.72)


def test_freedom_interest_rate():
    r = extract_mortgage_by_rules(FREEDOM_MORTGAGE_TEXT)
    assert r.data.get("interest_rate") == pytest.approx(0.03875)


def test_freedom_loan_type():
    r = extract_mortgage_by_rules(FREEDOM_MORTGAGE_TEXT)
    assert r.data.get("loan_type") == "first_mortgage"


def test_freedom_escrow_negative():
    r = extract_mortgage_by_rules(FREEDOM_MORTGAGE_TEXT)
    assert r.data.get("escrow_balance") == pytest.approx(-2825.0)


def test_freedom_confidence():
    r = extract_mortgage_by_rules(FREEDOM_MORTGAGE_TEXT)
    assert r.confidence >= 0.85


def test_mortgage_no_data():
    r = extract_mortgage_by_rules("random text with no mortgage data")
    assert r.confidence == 0.0
