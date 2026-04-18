"""Tests for the PiiRedactor logging filter.

Covers:
- SSN with dashes (`123-45-6789`)        → redacted
- `ssn: 123456789` prefix style          → redacted
- 16-digit account number                → redacted
- 4-digit zip-like value                 → untouched (no false positive)
- Non-string record.msg (e.g. dict)      → no raise, filter returns True
"""
from __future__ import annotations

import logging

from main import PiiRedactor


def _make_record(msg: object, *args: object) -> logging.LogRecord:
    return logging.LogRecord(
        name="test",
        level=logging.INFO,
        pathname=__file__,
        lineno=1,
        msg=msg,
        args=args if args else None,
        exc_info=None,
    )


def test_ssn_dashed_is_redacted() -> None:
    record = _make_record("Client SSN is 123-45-6789 in the tax return.")
    assert PiiRedactor().filter(record) is True
    assert "123-45-6789" not in record.getMessage()
    assert "[REDACTED]" in record.getMessage()


def test_ssn_prefix_nine_digits_is_redacted() -> None:
    record = _make_record('payload {"ssn": "123456789"} received')
    assert PiiRedactor().filter(record) is True
    # The 9-digit run inside the ssn prefix match should be gone.
    assert "123456789" not in record.getMessage()
    assert "[REDACTED]" in record.getMessage()


def test_ssn_prefix_case_insensitive() -> None:
    record = _make_record("SSN=987654321 logged")
    assert PiiRedactor().filter(record) is True
    assert "987654321" not in record.getMessage()


def test_sixteen_digit_account_number_is_redacted() -> None:
    record = _make_record("Account 4111111111111111 debited")
    assert PiiRedactor().filter(record) is True
    assert "4111111111111111" not in record.getMessage()
    assert "[REDACTED]" in record.getMessage()


def test_ten_digit_account_number_is_redacted() -> None:
    record = _make_record("acct 1234567890 saw activity")
    assert PiiRedactor().filter(record) is True
    assert "1234567890" not in record.getMessage()


def test_four_digit_value_is_untouched() -> None:
    """Zip-like 4-digit numbers must not trip the account-number regex."""
    record = _make_record("Zip code 94103 resolved")
    assert PiiRedactor().filter(record) is True
    assert "94103" in record.getMessage()
    assert "[REDACTED]" not in record.getMessage()


def test_nine_digit_value_without_ssn_prefix_is_untouched() -> None:
    """A bare 9-digit number (no ssn: prefix, no dashes) should pass through —
    the SSN regex requires either the dashed form or the `ssn:`-style prefix.
    The account regex only matches 10-16 digits."""
    record = _make_record("Routing 123456789 for the bank")
    assert PiiRedactor().filter(record) is True
    # 9 digits alone — not matched by SSN (no prefix) or account (too short).
    assert "123456789" in record.getMessage()


def test_non_string_msg_does_not_raise() -> None:
    """Some loggers pass dicts or other objects as record.msg. The filter
    must no-op gracefully (return True, not raise)."""
    record = _make_record({"event": "upload", "ssn": "123-45-6789"})
    # Should not raise.
    result = PiiRedactor().filter(record)
    assert result is True
    # Non-string msg is left alone — dict key values are not walked.
    assert record.msg == {"event": "upload", "ssn": "123-45-6789"}


def test_non_string_msg_none_does_not_raise() -> None:
    record = _make_record(None)
    assert PiiRedactor().filter(record) is True


def test_args_are_also_redacted() -> None:
    """LogRecord args (used with %-formatting) should also be scrubbed so
    the rendered message is clean."""
    record = _make_record("user %s uploaded", "SSN 123-45-6789")
    assert PiiRedactor().filter(record) is True
    assert "123-45-6789" not in record.getMessage()
    assert "[REDACTED]" in record.getMessage()
