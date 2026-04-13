"""Phase 3 — Classifier tests."""
from __future__ import annotations

from classifier import (
    _CONTENT_PATTERNS,
    _FILENAME_BOOST,
    _FILENAME_PATTERNS,
    _TITLE_PATTERNS,
    _filename_doc_classes,
    boost_with_filename,
    classify_by_rules,
    ClassificationResult,
    AI_CONFIDENCE_THRESHOLD,
    OPT_OUT_CONFIDENCE,
    RULE_CONFIDENCE_THRESHOLD,
)
from schemas import DOC_CLASSES


def test_content_paystub():
    r = classify_by_rules("gross pay 4500.00 net pay 3200.00 pay period")
    assert r.doc_class == "payStub.us"
    assert r.confidence >= RULE_CONFIDENCE_THRESHOLD


def test_content_w2():
    r = classify_by_rules("Wage and Tax Statement Form W-2 2024")
    assert r.doc_class == "tax.us.w2"
    assert r.confidence >= RULE_CONFIDENCE_THRESHOLD


def test_1099_in_title():
    """'Form 1099' in the document title area should classify as tax.us.1099."""
    r = classify_by_rules("Form 1099-DIV  Dividends and Distributions  2024\nPAYER'S name: Fidelity")
    assert r.doc_class == "tax.us.1099"
    assert r.confidence >= RULE_CONFIDENCE_THRESHOLD


def test_1099_boilerplate_not_classified():
    """'Form 1099' appearing only deep in boilerplate should NOT classify as 1099.
    This replicates E*TRADE/Fidelity quarterly statements that mention 1099 in
    disclaimers but are actually IRA or brokerage statements."""
    # 2001 chars of filler before the 1099 mention puts it past the title window
    filler = "x" * 2001
    r = classify_by_rules(filler + "It is not a substitute for IRS Form 1099 on which we report cost basis")
    assert r.doc_class == "unclassified"


def test_roth_ira_beats_boilerplate_1099():
    """Roth IRA label found after boilerplate 1099 mentions should win."""
    filler = "x" * 2001
    boilerplate = "It is not a substitute for IRS Form 1099 on which we report cost basis. " * 5
    ira_section = "\nSelf-Directed Retirement Account\n666-307629-203\nRoth IRA\n"
    r = classify_by_rules(filler + boilerplate + ira_section)
    assert r.doc_class == "ira_statement"
    assert r.confidence >= RULE_CONFIDENCE_THRESHOLD


def test_roth_iras_plural_boilerplate_not_classified():
    """'Roth IRAs' (plural) in brokerage boilerplate should NOT classify as ira_statement.
    Replicates Fidelity brokerage statement disclaimer: 'In Roth IRAs and HSAs, earnings
    are reported as tax-exempt income.'"""
    filler = "x" * 2001  # push past title window
    boilerplate = "In Traditional IRAs, Rollover IRAs, SEP-IRAs, SIMPLE IRAs and Keoghs, earnings are reported as tax-deferred income. In Roth IRAs and HSAs, earnings are reported as tax-exempt income."
    r = classify_by_rules(filler + boilerplate)
    assert r.doc_class == "unclassified"


def test_content_tax_return():
    r = classify_by_rules("Form 1040 U.S. Individual Income Tax Return 2023")
    assert r.doc_class == "tax.us.1040"
    assert r.confidence >= RULE_CONFIDENCE_THRESHOLD


def test_content_bofa_combined_statement():
    r = classify_by_rules("Your combined statement for December 18, 2025 to January 16, 2026 Your deposit accounts")
    assert r.doc_class == "bankStatement.us.checking"
    assert r.confidence >= RULE_CONFIDENCE_THRESHOLD


def test_content_bank_statement_checking():
    r = classify_by_rules("Checking Account Statement beginning balance 1000.00 ending balance 1250.00")
    assert r.doc_class == "bankStatement.us.checking"
    assert r.confidence >= RULE_CONFIDENCE_THRESHOLD


def test_content_savings_account():
    """'Savings Account' in content should classify as bankStatement.us.savings."""
    r = classify_by_rules("Savings Account  Account Number: XXXX4854  Beginning Balance $0.06  Ending Balance $0.06")
    assert r.doc_class == "bankStatement.us.savings"
    assert r.confidence >= RULE_CONFIDENCE_THRESHOLD


def test_savings_beats_generic_balance_pattern():
    """'savings account' in content should win over the generic beginning/ending balance pattern."""
    r = classify_by_rules("Savings Account  beginning balance 500.00  ending balance 510.00")
    assert r.doc_class == "bankStatement.us.savings"


def test_checking_summary_is_high_confidence_checking():
    r = classify_by_rules("Chase First Checking\nCHECKING SUMMARY\nBeginning Balance $24.00\nEnding Balance $24.00")
    assert r.doc_class == "bankStatement.us.checking"
    assert r.confidence >= RULE_CONFIDENCE_THRESHOLD


def test_etrade_checking_account_number_pattern():
    r = classify_by_rules(
        "Morgan Stanley Private Bank\naccounts\nChecking -\n2007814870\nStatement Summary\nBeginning balance $19,269.84\nEnding balance $5,812.38"
    )
    assert r.doc_class == "bankStatement.us.checking"
    assert r.confidence >= RULE_CONFIDENCE_THRESHOLD


def test_mortgage_statement_explicit():
    r = classify_by_rules("Mortgage Statement  Statement Date 01/01/26  Loan Number 0129442679  Payment Date 02/01/26")
    assert r.doc_class == "mortgage.us"
    assert r.confidence >= RULE_CONFIDENCE_THRESHOLD


def test_mortgage_escrow():
    r = classify_by_rules("Principal $1,356.82  Interest $2,131.17  Escrow/Impound (for Taxes and/or Insurance) $2,114.41")
    assert r.doc_class == "mortgage.us"
    assert r.confidence >= RULE_CONFIDENCE_THRESHOLD


def test_mortgage_loan_number_payment_due():
    r = classify_by_rules("Loan Number 0129442679  Payment Due Date 02/01/26  Amount Due $5,602.40")
    assert r.doc_class == "mortgage.us"
    assert r.confidence >= RULE_CONFIDENCE_THRESHOLD


def test_roth_ira():
    r = classify_by_rules("Self-Directed Retirement Account  Roth IRA  Account Summary  Beginning Total Value $53.25")
    assert r.doc_class == "ira_statement"
    assert r.confidence >= RULE_CONFIDENCE_THRESHOLD


def test_rollover_ira():
    r = classify_by_rules("FIDELITY ROLLOVER IRA  FIDELITY MANAGEMENT TRUST CO - CUSTODIAN  Beginning Account Value $3.41")
    assert r.doc_class == "ira_statement"
    assert r.confidence >= RULE_CONFIDENCE_THRESHOLD


def test_traditional_ira():
    r = classify_by_rules("Traditional IRA  Account Number: XXX-1234  Beginning Value $12,000.00  Ending Value $12,450.00")
    assert r.doc_class == "ira_statement"
    assert r.confidence >= RULE_CONFIDENCE_THRESHOLD


def test_etrade_historical_value_ira():
    r = classify_by_rules(
        "Historical Value\nAccount\nIRA -7449\nNet Account Value $0.00\nContributions made for 2026 $0.00"
    )
    assert r.doc_class == "ira_statement"
    assert r.confidence >= RULE_CONFIDENCE_THRESHOLD


def test_bofa_regular_savings_title():
    """BofA savings statements say 'Your Regular Savings' near the top."""
    r = classify_by_rules("Your Regular Savings\nfor May 17, 2025 to June 16, 2025\nBeginning balance $1,878.63\nEnding balance $1,881.65")
    assert r.doc_class == "bankStatement.us.savings"
    assert r.confidence >= 0.90


def test_bofa_money_market_savings_title():
    """BofA money market savings statements say 'Your Money Market Savings'."""
    r = classify_by_rules("Your Money Market Savings\nfor May 17, 2025 to June 16, 2025\nBeginning balance $6.78\nEnding balance $6.78")
    assert r.doc_class == "bankStatement.us.savings"
    assert r.confidence >= 0.90


def test_chase_savings_summary():
    """Chase savings statements have a 'SAVINGS SUMMARY' header block."""
    r = classify_by_rules("Chase Savings\n\nSAVINGS SUMMARY\nBeginning Balance $25.00\nEnding Balance $25.00")
    assert r.doc_class == "bankStatement.us.savings"
    assert r.confidence >= 0.90


def test_etrade_savings_account_number():
    """ETrade savings statements list 'Savings - <account_number>' as the account type."""
    r = classify_by_rules("Morgan Stanley Private Bank\naccounts\nSavings -\n2007814854\nBeginning balance $0.06\nEnding balance $0.06")
    assert r.doc_class == "bankStatement.us.savings"
    assert r.confidence >= 0.88


def test_etrade_premium_savings_account_number():
    """ETrade premium savings statements list 'Premium Savings - <account_number>'."""
    r = classify_by_rules("Morgan Stanley Private Bank\naccounts\nPremium\nSavings -\n2026255675\nBeginning balance $2.64\nEnding balance $2.65")
    assert r.doc_class == "bankStatement.us.savings"
    assert r.confidence >= 0.88


def test_chase_total_checking_beats_savings_boilerplate():
    """Chase Total Checking boilerplate mentions 'savings accounts' in fee-waiver text —
    the 'Chase Total Checking' signal must win."""
    text = (
        "Chase Total Checking\nBeginning Balance $2,386.57\nDeposits and Additions 160.00\n"
        "Enrollment in Zelle at a participating financial institution using an eligible "
        "U.S. checking or savings account is required to use the service."
    )
    r = classify_by_rules(text)
    assert r.doc_class == "bankStatement.us.checking"
    assert r.confidence >= 0.90


def test_bofa_combined_stays_checking():
    """BofA combined statements have 'Your Regular Savings' deep in the document (>9000 chars).
    The title-window restriction must prevent it from reclassifying as savings."""
    # Simulate the combined statement: checking content up front, savings section deep in
    checking_header = "Bank of America Combined Statement Period June 2025\nYour combined statement\nBeginning Balance $5,000.00\n"
    padding = "x " * 5000  # push savings header past 2000-char title window
    savings_section = "Your Regular Savings\nBeginning balance $1,000.00\nEnding balance $1,000.00"
    r = classify_by_rules(checking_header + padding + savings_section)
    assert r.doc_class == "bankStatement.us.checking"


def test_brokerage_fidelity_investment_report():
    r = classify_by_rules("INVESTMENT REPORT\nOctober 1, 2025 - December 31, 2025\nFIDELITY ACCOUNT")
    assert r.doc_class == "brokerage_statement"
    assert r.confidence >= RULE_CONFIDENCE_THRESHOLD


def test_brokerage_etrade_client_statement():
    r = classify_by_rules(
        "CLIENT STATEMENT For the Period July 1- September 30, 2025\n"
        "Beginning Total Value (as of 7/1/25) $0.16\n"
        "Ending Total Value (as of 9/30/25) $0.16\n"
        "Member SIPC"
    )
    assert r.doc_class == "brokerage_statement"
    assert r.confidence >= RULE_CONFIDENCE_THRESHOLD


def test_investment_report_not_ira():
    r = classify_by_rules("INVESTMENT REPORT\nAccount Summary\nBeginning Total Value $5000\nEnding Total Value $5500")
    assert r.doc_class == "brokerage_statement"


def test_vehicle_certificate_of_title():
    r = classify_by_rules("Vehicle Certificate of Title\nTitle Number 1862990375\nVehicle Identification Number (VIN)")
    assert r.doc_class == "vehicle_title"
    assert r.confidence >= RULE_CONFIDENCE_THRESHOLD


def test_vehicle_title_number_vin():
    r = classify_by_rules("Title Number\n1758351673\nVehicle Identification Number\n2019 SUBA OUTBACK SPORT UTIL")
    assert r.doc_class == "vehicle_title"
    assert r.confidence >= RULE_CONFIDENCE_THRESHOLD


def test_bank_of_america_retirement_statement_not_checking():
    text = (
        "Bank of America\nTotal Retirement Program Retirement Savings Statement\n"
        "Statement Details\nGuaranteed Pension Minimum $7,347.13\npension plan account"
    )
    r = classify_by_rules(text)
    assert r.doc_class != "bankStatement.us.checking"
    assert r.doc_class != "bankStatement.us.savings"
    assert r.doc_class != "401k_statement"
    assert r.doc_class == "retirement_account"


def test_unclassified_random_text():
    """Random non-financial text triggers opt-out → 'other' at sub-threshold confidence."""
    r = classify_by_rules("lorem ipsum dolor sit amet")
    assert r.doc_class == "other"
    assert r.confidence == OPT_OUT_CONFIDENCE


def test_rule_engine_method():
    r = classify_by_rules("gross pay 4500.00 net pay 3200.00")
    assert r.method == "rule_engine"


def test_summons_is_high_confidence_legal_document():
    r = classify_by_rules("IN THE KING COUNTY DISTRICT COURT\nSUMMONS\nPlaintiff\nDefendant")
    assert r.doc_class == "legal_document"
    assert r.confidence >= RULE_CONFIDENCE_THRESHOLD


def test_reaffirmation_agreement_is_high_confidence_legal_document():
    r = classify_by_rules("Official Form 427\nCover Sheet for Reaffirmation Agreement\nReaffirmation Agreement")
    assert r.doc_class == "legal_document"
    assert r.confidence >= RULE_CONFIDENCE_THRESHOLD


def test_401k_statement_is_high_confidence():
    r = classify_by_rules("Microsoft Corporation Savings Plus 401(k) Plan Retirement Savings Statement")
    assert r.doc_class == "401k_statement"
    assert r.confidence >= RULE_CONFIDENCE_THRESHOLD


# ---- ID document tests ------------------------------------------------------

def test_drivers_license_explicit():
    r = classify_by_rules("WASHINGTON\nDRIVER LICENSE\nLic# WDL123456\nDate of Birth: 01/15/1985")
    assert r.doc_class == "idDocument"
    assert r.confidence >= 0.90


def test_drivers_license_sex_hgt():
    """Physical DL fields SEX and HGT (or truncated HG) are strong DL signals."""
    r = classify_by_rules("STATE ID\nSEX M\nHGT 5-11\nWGT 175\nEYES BRN")
    assert r.doc_class == "idDocument"
    assert r.confidence >= 0.88


def test_drivers_license_sex_hg_truncated():
    """Tesseract sometimes truncates HGT to HG — pattern must still match."""
    r = classify_by_rules("~WASHINGTON DRIVER LICENSE\nSEX M\nHG 5-10\nDOB 03/22/1990")
    assert r.doc_class == "idDocument"
    assert r.confidence >= 0.88


def test_drivers_license_dob_expiry():
    r = classify_by_rules("Date of Birth: 05/12/1978\nExpiration Date: 05/12/2030")
    assert r.doc_class == "idDocument"
    assert r.confidence >= 0.85


def test_social_security_card_administration():
    r = classify_by_rules("SOCIAL SECURITY ADMINISTRATION\nTHIS NUMBER HAS BEEN ESTABLISHED FOR\nJOHN DOE")
    assert r.doc_class == "social_security_card"
    assert r.confidence >= 0.95


def test_social_security_card_number_pattern():
    r = classify_by_rules("SOCIAL SECURITY\n123-45-6789\nJANE DOE")
    assert r.doc_class == "social_security_card"
    assert r.confidence >= 0.88


def test_social_security_card_established_for():
    """'THIS NUMBER HAS BEEN ESTABLISHED FOR' is a unique SSN card phrase."""
    r = classify_by_rules("THIS NUMBER HAS BEEN ESTABLISHED FOR\nEMPLOYMENT PURPOSES")
    assert r.doc_class == "social_security_card"
    assert r.confidence >= 0.90


# ---- Filename boost tests ---------------------------------------------------

def test_filename_boost_confirms_content():
    """Filename matching the content classification should boost confidence to threshold."""
    result = ClassificationResult(doc_class="brokerage_statement", confidence=0.80, method="rule_engine")
    boosted = boost_with_filename(result, "ETrade Securities 09302025.pdf")
    assert boosted.doc_class == "brokerage_statement"
    assert boosted.confidence == RULE_CONFIDENCE_THRESHOLD


def test_filename_boost_no_match_no_change():
    """Filename that doesn't match the content classification should not boost."""
    result = ClassificationResult(doc_class="brokerage_statement", confidence=0.80, method="rule_engine")
    boosted = boost_with_filename(result, "Chase Bank Statement January.pdf")
    assert boosted.confidence == 0.80


def test_filename_boost_unclassified_no_change():
    """Unclassified content should never be boosted, even if filename has a hint."""
    result = ClassificationResult(doc_class="unclassified", confidence=0.0, method="rule_engine")
    boosted = boost_with_filename(result, "ETrade Securities 09302025.pdf")
    assert boosted.doc_class == "unclassified"
    assert boosted.confidence == 0.0


def test_filename_boost_already_above_threshold():
    """Content already above threshold should not be modified."""
    result = ClassificationResult(doc_class="brokerage_statement", confidence=0.92, method="rule_engine")
    boosted = boost_with_filename(result, "ETrade Securities 09302025.pdf")
    assert boosted.confidence == 0.92


def test_filename_boost_caps_at_threshold():
    """Boost should cap at RULE_CONFIDENCE_THRESHOLD, not exceed it."""
    result = ClassificationResult(doc_class="mortgage.us", confidence=0.82, method="rule_engine")
    boosted = boost_with_filename(result, "Cenlar Mortgage Payment 12242025.pdf")
    assert boosted.confidence == RULE_CONFIDENCE_THRESHOLD


def test_filename_doc_classes_multiple():
    """Filename with multiple hints returns all matching classes."""
    hints = _filename_doc_classes("My IRA Savings Account.pdf")
    assert "ira_statement" in hints
    assert "bankStatement.us.savings" in hints


def test_filename_doc_classes_no_match():
    """Filename with no recognizable keywords returns empty set."""
    hints = _filename_doc_classes("random document 2025.pdf")
    assert hints == set()


def test_filename_boost_vehicle_title():
    """'Title' in filename should boost vehicle_title classification."""
    result = ClassificationResult(doc_class="vehicle_title", confidence=0.80, method="rule_engine")
    boosted = boost_with_filename(result, "HMMWV Title.pdf")
    assert boosted.doc_class == "vehicle_title"
    assert boosted.confidence == RULE_CONFIDENCE_THRESHOLD


def test_filename_boost_pension():
    """'Pension' in filename should boost retirement_account classification."""
    result = ClassificationResult(doc_class="retirement_account", confidence=0.80, method="rule_engine")
    boosted = boost_with_filename(result, "Fidelity Liz Pension 12312025.pdf")
    assert boosted.doc_class == "retirement_account"
    assert boosted.confidence == RULE_CONFIDENCE_THRESHOLD


# ---- Pattern validation tests ------------------------------------------------

def test_all_pattern_doc_classes_are_valid():
    """Every doc_class string in pattern tables must exist in DOC_CLASSES."""
    valid = set(DOC_CLASSES)
    for _, doc_class, _ in _CONTENT_PATTERNS:
        assert doc_class in valid, f"Unknown doc_class in _CONTENT_PATTERNS: {doc_class}"
    for _, doc_class, _ in _TITLE_PATTERNS:
        assert doc_class in valid, f"Unknown doc_class in _TITLE_PATTERNS: {doc_class}"
    for _, doc_class in _FILENAME_PATTERNS:
        assert doc_class in valid, f"Unknown doc_class in _FILENAME_PATTERNS: {doc_class}"


# ---- Opt-out rule tests ----------------------------------------------------

def test_opt_out_no_financial_keywords():
    """Text with no financial keywords should suggest 'other' at OPT_OUT_CONFIDENCE."""
    r = classify_by_rules("the quick brown fox jumps over the lazy dog")
    assert r.doc_class == "other"
    assert r.confidence == OPT_OUT_CONFIDENCE
    assert "no financial keywords" in r.reasoning


def test_opt_out_military_vehicle_spec():
    """Military vehicle specs contain no financial keywords — should opt out."""
    r = classify_by_rules("HMMWV M1123 Heavy Variant specifications")
    assert r.doc_class == "other"
    assert r.confidence == OPT_OUT_CONFIDENCE


def test_opt_out_not_triggered_with_financial_keywords():
    """Financial keyword present but no type match → stays unclassified for Claude."""
    r = classify_by_rules("Your account balance is $500")
    assert r.doc_class == "unclassified"
    assert r.confidence == 0.0


def test_opt_out_does_not_override_positive_match():
    """Text with a clear mortgage pattern should still classify as mortgage."""
    r = classify_by_rules("Mortgage Statement  Loan Number 0129442679  Payment Due 02/01/26")
    assert r.doc_class == "mortgage.us"
    assert r.confidence >= RULE_CONFIDENCE_THRESHOLD


def test_opt_out_confidence_below_both_thresholds():
    """OPT_OUT_CONFIDENCE must be below both RULE and AI thresholds."""
    assert OPT_OUT_CONFIDENCE < RULE_CONFIDENCE_THRESHOLD
    assert OPT_OUT_CONFIDENCE < AI_CONFIDENCE_THRESHOLD
