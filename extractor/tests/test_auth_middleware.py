"""Tests for the SharedSecretMiddleware.

Covers:
- No `X-Extractor-Secret` header on /extract → 401
- Wrong header value on /extract → 401
- Correct header on /extract → 200 (pipeline internals stubbed)
- /health requires NO header and still returns 200
- If `EXTRACTOR_SHARED_SECRET` env var is unset → 500 misconfigured
"""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

import main
from main import app
from schemas import ExtractionResult

TEST_SECRET = "test-shared-secret"


@pytest.fixture
def client_with_secret(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    """TestClient with the env var set to TEST_SECRET (no default headers)."""
    monkeypatch.setenv("EXTRACTOR_SHARED_SECRET", TEST_SECRET)
    return TestClient(app)


@pytest.fixture
def client_without_secret_env(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    """TestClient with the env var deliberately removed."""
    monkeypatch.delenv("EXTRACTOR_SHARED_SECRET", raising=False)
    return TestClient(app)


def _stub_extract_result() -> ExtractionResult:
    return ExtractionResult(
        doc_class="other",
        classification_confidence=1.0,
        classification_method="rule_engine",
        extraction_method="skipped",
        confidence=0.0,
        data={},
        field_confidences={},
        warnings=[],
    )


# ---- /extract auth ----------------------------------------------------------


def test_extract_without_header_returns_401(client_with_secret: TestClient) -> None:
    r = client_with_secret.post(
        "/extract",
        files={"file": ("x.txt", b"hello", "text/plain")},
    )
    assert r.status_code == 401
    assert r.json() == {"error": "unauthorized"}


def test_extract_with_wrong_header_returns_401(client_with_secret: TestClient) -> None:
    r = client_with_secret.post(
        "/extract",
        files={"file": ("x.txt", b"hello", "text/plain")},
        headers={"X-Extractor-Secret": "not-the-secret"},
    )
    assert r.status_code == 401
    assert r.json() == {"error": "unauthorized"}


def test_extract_with_correct_header_passes_auth(client_with_secret: TestClient) -> None:
    """Right header → middleware allows the request through. Internals are
    stubbed so the test doesn't exercise the real pipeline."""
    async def _fake_pipeline(*args, **kwargs):  # noqa: ANN001, ANN202
        return _stub_extract_result()

    with patch.object(main, "_run_pipeline", AsyncMock(side_effect=_fake_pipeline)):
        r = client_with_secret.post(
            "/extract",
            files={"file": ("x.txt", b"lorem ipsum", "text/plain")},
            headers={"X-Extractor-Secret": TEST_SECRET},
        )
    assert r.status_code == 200
    body = r.json()
    assert body["doc_class"] == "other"


# ---- /health bypass ---------------------------------------------------------


def test_health_requires_no_header(client_with_secret: TestClient) -> None:
    """/health must respond 200 even without the shared-secret header
    (Azure probes call it unauthenticated)."""
    r = client_with_secret.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_health_works_without_env_var(client_without_secret_env: TestClient) -> None:
    """Even if EXTRACTOR_SHARED_SECRET isn't configured, /health must still
    work — probes must not flap because of config drift."""
    r = client_without_secret_env.get("/health")
    assert r.status_code == 200


# ---- Misconfiguration -------------------------------------------------------


def test_extract_without_env_var_returns_500(
    client_without_secret_env: TestClient,
) -> None:
    r = client_without_secret_env.post(
        "/extract",
        files={"file": ("x.txt", b"hello", "text/plain")},
        headers={"X-Extractor-Secret": "anything"},
    )
    assert r.status_code == 500
    assert r.json() == {"error": "server misconfigured"}
