"""Shared pytest configuration for extractor tests."""
from __future__ import annotations

import pytest


def pytest_addoption(parser: pytest.Parser) -> None:
    parser.addoption(
        "--azure-compare",
        action="store_true",
        default=False,
        help="Run A/B comparison: current config vs Azure DI config for each gold sample",
    )
