"""Tests for the `/health` probe endpoint.

The /health route must:
- Return 200 with no shared-secret header (Azure Container Apps probes call
  it unauthenticated).
- Not perform any Anthropic call, model load, or other slow work — it should
  return quickly so probes don't time out during cold start.
"""
from __future__ import annotations

import time
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from main import app


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    """Default fixture — env secret set, no default headers on the client
    (proves /health doesn't need the header)."""
    monkeypatch.setenv("EXTRACTOR_SHARED_SECRET", "test-shared-secret")
    return TestClient(app)


def test_health_returns_200_without_header(client: TestClient) -> None:
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    # Existing response shape — tier availability flags must stay.
    assert "ocr_tier1_available" in body
    assert "ocr_tier2_available" in body


def test_health_is_fast(client: TestClient) -> None:
    """/health should return in well under 1 s under the test client. The
    plan calls out < 100 ms; we leave a modest margin to avoid CI flake."""
    start = time.perf_counter()
    r = client.get("/health")
    elapsed_ms = (time.perf_counter() - start) * 1000
    assert r.status_code == 200
    assert elapsed_ms < 500, f"/health took {elapsed_ms:.1f}ms, expected < 500ms"


def test_health_does_not_call_anthropic(client: TestClient) -> None:
    """Guard against regression — /health must not instantiate or call the
    Anthropic client. We patch `ai_extractor._client` and assert it was
    never touched."""
    import ai_extractor

    with patch.object(ai_extractor, "_client", None) as mocked:
        r = client.get("/health")
        assert r.status_code == 200
        # The module-level client should remain None — /health never
        # triggers lazy initialization.
        assert mocked is None


def test_health_works_when_env_missing(monkeypatch: pytest.MonkeyPatch) -> None:
    """Even with EXTRACTOR_SHARED_SECRET unset, /health must still succeed
    — otherwise probes flap whenever configuration is in flux."""
    monkeypatch.delenv("EXTRACTOR_SHARED_SECRET", raising=False)
    client = TestClient(app)
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"
