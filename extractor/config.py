"""
Centralized configuration constants for the extraction pipeline.

All thresholds and tunables in one place — previously scattered across
classifier.py, ocr.py, providers.py, rule_extractors/__init__.py, and main.py.
"""
from __future__ import annotations

import os

# -- Classification thresholds ------------------------------------------------
RULE_CONFIDENCE_THRESHOLD = 0.85
AI_CONFIDENCE_THRESHOLD = 0.70
OPT_OUT_CONFIDENCE = 0.60

# -- Extraction thresholds ----------------------------------------------------
EXTRACTION_CHAIN_THRESHOLD = 0.85

# -- OCR thresholds -----------------------------------------------------------
SCANNED_THRESHOLD_CHARS = 50
AZURE_FALLBACK_CONFIDENCE_THRESHOLD = 0.65

# -- AI model -----------------------------------------------------------------
EXTRACTION_MODEL = os.environ.get("EXTRACTION_MODEL", "claude-sonnet-4-20250514")

# -- Upload limits ------------------------------------------------------------
MAX_UPLOAD_BYTES = 50 * 1024 * 1024  # 50 MB
