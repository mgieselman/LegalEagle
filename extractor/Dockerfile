# syntax=docker/dockerfile:1.7
FROM python:3.12-slim AS base

# System deps: Tesseract for pytesseract, poppler for pdftext, ca-certificates for TLS.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        tesseract-ocr \
        poppler-utils \
        ca-certificates \
        curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps first for better layer caching. Use pyproject.toml + pip.
# We install ocr-azure but NOT ocr-local — Marker's 2 GB of models aren't shipped.
COPY pyproject.toml ./
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir ".[ocr-azure]"

# Copy source. .dockerignore excludes .venv, tests, __pycache__, eval scripts.
COPY . .

# Run as non-root.
RUN useradd --create-home --uid 10001 extractor \
    && chown -R extractor:extractor /app
USER extractor

EXPOSE 8321

# Uvicorn single-worker (FastAPI is async). Scale by replica count, not workers.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8321"]
