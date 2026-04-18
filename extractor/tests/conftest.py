"""Shared pytest configuration for extractor tests."""
from __future__ import annotations

import os

import pytest

# The SharedSecretMiddleware requires EXTRACTOR_SHARED_SECRET to be set on
# every non-/health request. Set a default test value here so the existing
# /extract tests (and any newly-added tests that don't explicitly test the
# auth middleware) can hit the endpoint. The dedicated auth-middleware tests
# override / unset this fixture-locally via monkeypatch.
os.environ.setdefault("EXTRACTOR_SHARED_SECRET", "test-shared-secret")


def pytest_addoption(parser: pytest.Parser) -> None:
    parser.addoption(
        "--azure-compare",
        action="store_true",
        default=False,
        help="Run A/B comparison: current config vs Azure DI config for each gold sample",
    )
