"""
Rule-based paystub extractor.
Ported from server/src/services/extraction/ruleExtractors/paystub.ts.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date

from schemas import RuleExtractionResult

from .utils import parse_dollar, normalize_date

# ---- Pre-compiled regex constants ------------------------------------------

RE_GROSS_TWO    = re.compile(r"gross\s+pay\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})", re.I)
RE_GROSS_SINGLE = re.compile(r"gross\s+(?:pay|earnings?)[:\s]+([\d,]+\.\d{2})", re.I)
RE_GROSS_TOTAL  = re.compile(r"total\s+gross[:\s]+([\d,]+\.\d{2})", re.I)

RE_NET_TWO      = re.compile(r"net\s+(?:pay|earnings?|amount)[:\s]+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})", re.I)
RE_NET_SINGLE   = re.compile(r"net\s+(?:pay|earnings?|amount)[:\s]+([\d,]+\.\d{2})", re.I)

RE_PAY_DATE     = re.compile(r"(?:pay\s*date|check\s*date)[:\s]+(\d{1,2}/\d{1,2}/\d{2,4})", re.I)

RE_PERIOD_RANGE = re.compile(r"pay\s*period[:\s]*(\d{1,2}/\d{1,2}/\d{2,4})\s*[-\u2013to]+\s*(\d{1,2}/\d{1,2}/\d{2,4})", re.I)
RE_PERIOD_CA    = re.compile(r"(?:pay\s*)?period[:\s]*(\d{1,2}/\d{1,2}/(?:\d{2,4}|XX))\s*(?:to|[-\u2013])\s*(\d{1,2}/\d{1,2}/(?:\d{2,4}|XX))", re.I)
RE_PERIOD_BEGIN = re.compile(r"(?:period\s+begin|period\s+start|from)[:\s]+(\d{1,2}/\d{1,2}/\d{2,4})", re.I)
RE_PERIOD_END   = re.compile(r"(?:period\s+end|to)[:\s]+(\d{1,2}/\d{1,2}/\d{2,4})", re.I)

RE_EMPLOYER_LABEL  = re.compile(r"(?:employer|company|firm)\s*:\s*([A-Z][A-Za-z0-9&.,' -]{2,50})", re.I)
RE_EMPLOYER_ADDR   = re.compile(r"([A-Z][A-Za-z0-9 &.,'-]{2,50})\n[A-Z0-9 ]+\n[A-Za-z ]+,\s*[A-Z]{2}\s*\d{5}", re.M)
RE_EMPLOYEE_LABEL  = re.compile(r"(?:employee(?:\s+name)?|pay\s+to|employee\s+id[:\s]+\S+\s)(?:[:\s]+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})", re.I)
RE_EMPLOYEE_SECT   = re.compile(r"\bEMPLOYEE\b[\s\S]{0,20}?\n([A-Za-z,\s]{3,50})\n", re.I)
# Stop capturing at "Voucher", "Pay", "#(" so we don't include doc type words in the name
RE_EMPLOYEE_VOUCHER = re.compile(r"#\d+\s*-\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+?)(?:\s+(?:Voucher|Pay\b|Check\b)|#\()", re.I)

RE_FIT_LINE  = re.compile(r"^FIT\s+[\d,]+\.\d{2}\s+[\d,]+\.\d{2}\s+([\d,]+\.\d{2})", re.I | re.M)
RE_FIT_LABEL = re.compile(r"federal\s+(?:w/h|income\s+tax|tax|withhold(?:ing)?)[:\s]+([\d,]+\.\d{2})", re.I)
RE_FICA_LINE  = re.compile(r"^FICA\s+[\d,]+\.\d{2}\s+[\d,]+\.\d{2}\s+([\d,]+\.\d{2})", re.I | re.M)
RE_FICA_LABEL = re.compile(r"(?:FICA|social\s*security)[:\s]+([\d,]+\.\d{2})", re.I)
RE_MEDI_LINE  = re.compile(r"^MEDI\s+[\d,]+\.\d{2}\s+[\d,]+\.\d{2}\s+([\d,]+\.\d{2})", re.I | re.M)
RE_MEDI_LABEL = re.compile(r"medicare[:\s]+([\d,]+\.\d{2})", re.I)
RE_STATE_TAX  = re.compile(r"(?:state\s+(?:w/h|income\s+tax|tax)|CA\s+State\s+W/H)[:\s]+([\d,]+\.\d{2})", re.I)
RE_401K       = re.compile(r"(?:401k|401\(k\)|retirement)[:\s]+([\d,]+\.\d{2})", re.I)

RE_HOURS      = re.compile(r"(?:regular|reg)\s+([\d.]+)\s+([\d.]+)", re.I)

RE_COL_BLOCK  = re.compile(r"DEDUCTIONS\s*\n([\s\S]*?)\n\s*AMOUNT\s*\n([\s\S]*?)(?=\n\s*(?:GROSS|TOTAL|NET|$))", re.I)
RE_COL_AMOUNT = re.compile(r"^[\d,]+\.\d{2}$")


def _extract_pay_period(text: str) -> tuple[str | None, str | None]:
    current_year = str(date.today().year)

    m = RE_PERIOD_RANGE.search(text)
    if m:
        return normalize_date(m.group(1)), normalize_date(m.group(2))

    m = RE_PERIOD_CA.search(text)
    if m:
        start = normalize_date(m.group(1).replace("XX", current_year))
        end = normalize_date(m.group(2).replace("XX", current_year))
        return start, end

    begin_m = RE_PERIOD_BEGIN.search(text)
    end_m = RE_PERIOD_END.search(text)
    return (
        normalize_date(begin_m.group(1)) if begin_m else None,
        normalize_date(end_m.group(1)) if end_m else None,
    )


def _infer_pay_frequency(start: str | None, end: str | None) -> str | None:
    if not start or not end:
        return None
    try:
        d0 = date.fromisoformat(start)
        d1 = date.fromisoformat(end)
        days = (d1 - d0).days + 1
        if days <= 7:  return "weekly"
        if days <= 16: return "biweekly"
        if days <= 17: return "semimonthly"
        if days <= 32: return "monthly"
    except ValueError:
        pass
    return None


def _extract_employer_name(text: str) -> str | None:
    m = RE_EMPLOYER_LABEL.search(text)
    if m:
        return m.group(1).strip()

    # CA DIR: company name appears before "EMPLOYEE" header
    emp_match = re.search(r"\bEMPLOYEE\b", text, re.I)
    if emp_match:
        header_phrases = ["california labor", "pay stub", "paystub", "commissioner"]
        lines = [l.strip() for l in text[:emp_match.start()].strip().split("\n") if l.strip()]
        for line in reversed(lines):
            if not any(h in line.lower() for h in header_phrases) and len(line) > 2:
                return line

    m = RE_EMPLOYER_ADDR.search(text)
    if m:
        return m.group(1).strip()

    return None


def _extract_employee_name(text: str) -> str | None:
    m = RE_EMPLOYEE_LABEL.search(text)
    if m:
        return m.group(1).strip()

    m = RE_EMPLOYEE_SECT.search(text)
    if m:
        name = m.group(1).strip()
        if not re.match(r"^[A-Z\s]+$", name) or "," in name:
            return name

    m = RE_EMPLOYEE_VOUCHER.search(text)
    if m:
        return m.group(1).strip()

    return None


def _extract_columnar_deductions(text: str) -> dict[str, float]:
    result: dict[str, float] = {}
    m = RE_COL_BLOCK.search(text)
    if not m:
        return result

    labels = [l.strip() for l in m.group(1).split("\n") if l.strip()]
    amounts = []
    for l in m.group(2).split("\n"):
        l = l.strip()
        if RE_COL_AMOUNT.match(l):
            val = parse_dollar(l)
            if val is not None:
                amounts.append(val)

    for i in range(min(len(labels), len(amounts))):
        result[labels[i].lower()] = amounts[i]
    return result


def extract_paystub_by_rules(text: str) -> RuleExtractionResult:
    data: dict = {}
    field_confidences: dict[str, float] = {}
    warnings: list[str] = []

    col = _extract_columnar_deductions(text)

    # --- Gross Pay ---
    gross_two = RE_GROSS_TWO.search(text)
    if gross_two:
        val = parse_dollar(gross_two.group(1))
        if val is not None:
            data["gross_pay"] = val
            field_confidences["gross_pay"] = 0.9
    else:
        m = RE_GROSS_SINGLE.search(text) or RE_GROSS_TOTAL.search(text)
        if m:
            val = parse_dollar(m.group(1))
            if val is not None:
                data["gross_pay"] = val
                field_confidences["gross_pay"] = 0.85

    # --- Net Pay ---
    net_two = RE_NET_TWO.search(text)
    if net_two:
        val = parse_dollar(net_two.group(1))
        if val is not None:
            data["net_pay"] = val
            field_confidences["net_pay"] = 0.9
    else:
        m = RE_NET_SINGLE.search(text)
        if m:
            val = parse_dollar(m.group(1))
            if val is not None:
                data["net_pay"] = val
                field_confidences["net_pay"] = 0.85

    # --- Pay Date ---
    m = RE_PAY_DATE.search(text)
    if m:
        d = normalize_date(m.group(1))
        if d:
            data["pay_date"] = d
            field_confidences["pay_date"] = 0.95

    # --- Pay Period ---
    period_start, period_end = _extract_pay_period(text)
    if period_start:
        data["pay_period_start"] = period_start
        field_confidences["pay_period_start"] = 0.9
    if period_end:
        data["pay_period_end"] = period_end
        field_confidences["pay_period_end"] = 0.9

    # --- Pay Frequency ---
    freq = _infer_pay_frequency(data.get("pay_period_start"), data.get("pay_period_end"))
    if freq:
        data["pay_frequency"] = freq
        field_confidences["pay_frequency"] = 0.8

    # --- Employer / Employee ---
    employer = _extract_employer_name(text)
    if employer:
        data["employer_name"] = employer
        field_confidences["employer_name"] = 0.8

    employee = _extract_employee_name(text)
    if employee:
        data["employee_name"] = employee
        field_confidences["employee_name"] = 0.8

    # --- Federal Tax ---
    m = RE_FIT_LINE.search(text) or RE_FIT_LABEL.search(text)
    if m:
        val = parse_dollar(m.group(1))
        if val is not None:
            data["federal_tax"] = val
            field_confidences["federal_tax"] = 0.9 if RE_FIT_LINE.match(m.group(0)) else 0.85
    else:
        col_val = col.get("federal w/h") or col.get("federal income tax")
        if col_val is not None:
            data["federal_tax"] = col_val
            field_confidences["federal_tax"] = 0.85

    # --- Social Security ---
    m = RE_FICA_LINE.search(text) or RE_FICA_LABEL.search(text)
    if m:
        val = parse_dollar(m.group(1))
        if val is not None:
            data["social_security"] = val
            field_confidences["social_security"] = 0.9 if RE_FICA_LINE.match(m.group(0)) else 0.85
    else:
        col_val = col.get("fica") or col.get("social security")
        if col_val is not None:
            data["social_security"] = col_val
            field_confidences["social_security"] = 0.85

    # --- Medicare ---
    m = RE_MEDI_LINE.search(text) or RE_MEDI_LABEL.search(text)
    if m:
        val = parse_dollar(m.group(1))
        if val is not None:
            data["medicare"] = val
            field_confidences["medicare"] = 0.9 if RE_MEDI_LINE.match(m.group(0)) else 0.85
    else:
        col_val = col.get("medicare")
        if col_val is not None:
            data["medicare"] = col_val
            field_confidences["medicare"] = 0.85

    # --- State Tax ---
    m = RE_STATE_TAX.search(text)
    if m:
        val = parse_dollar(m.group(1))
        if val is not None:
            data["state_tax"] = val
            field_confidences["state_tax"] = 0.85
    else:
        col_val = col.get("ca state w/h") or col.get("state tax") or col.get("state w/h")
        if col_val is not None:
            data["state_tax"] = col_val
            field_confidences["state_tax"] = 0.8

    # --- 401k ---
    m = RE_401K.search(text)
    if m:
        val = parse_dollar(m.group(1))
        if val is not None:
            data["retirement_401k"] = val
            field_confidences["retirement_401k"] = 0.85
    else:
        col_val = col.get("401k") or col.get("401(k)")
        if col_val is not None:
            data["retirement_401k"] = col_val
            field_confidences["retirement_401k"] = 0.85

    # --- YTD Gross / Net ---
    if gross_two:
        ytd_val = parse_dollar(gross_two.group(2))
        if ytd_val is not None and ytd_val != data.get("gross_pay"):
            data["ytd_gross"] = ytd_val
            field_confidences["ytd_gross"] = 0.85
    if net_two:
        ytd_net_val = parse_dollar(net_two.group(2))
        if ytd_net_val is not None and ytd_net_val != data.get("net_pay"):
            data["ytd_net"] = ytd_net_val
            field_confidences["ytd_net"] = 0.85

    # --- Hours and Rate ---
    m = RE_HOURS.search(text)
    if m:
        try:
            rate = float(m.group(1))
            hours = float(m.group(2))
            data["hourly_rate"] = rate
            field_confidences["hourly_rate"] = 0.8
            data["hours_worked"] = hours
            field_confidences["hours_worked"] = 0.8
        except ValueError:
            pass

    # --- Confidence scoring ---
    confidence = 0.0
    if data.get("gross_pay") is not None:    confidence += 0.25
    if data.get("net_pay") is not None:      confidence += 0.25
    if data.get("employer_name"):            confidence += 0.25
    if data.get("pay_date"):
        confidence += 0.25
    elif data.get("pay_period_end"):
        confidence += 0.15

    for f in ("pay_period_start", "pay_period_end", "federal_tax", "social_security", "medicare"):
        if data.get(f) is not None:
            confidence += 0.02

    confidence = min(confidence, 1.0)

    if not data.get("employer_name"): warnings.append("employer_name not found — document may need AI extraction")
    if data.get("gross_pay") is None:  warnings.append("gross_pay not found")
    if data.get("net_pay") is None:    warnings.append("net_pay not found")

    return RuleExtractionResult(data=data, field_confidences=field_confidences, warnings=warnings, confidence=confidence)
