#!/usr/bin/env python3
"""
Unified extraction pipeline evaluation script.

Runs classifier, extraction, or both on files and produces a detailed
markdown performance report with per-component timing, confidence,
token usage, and cost breakdowns.

Usage:
    cd extractor
    python scripts/eval.py <input> [options]

    # Classify only, single file
    python scripts/eval.py ~/Documents/Legal/paystub.pdf --runtype classifier

    # Full pipeline, folder, 10 parallel
    python scripts/eval.py ~/Documents/Legal/ --runtype classifier+extraction --parallel 10

    # Glob pattern with limit
    python scripts/eval.py "~/Documents/Legal/*.pdf" --parallel 5 --limit 20

Requires ANTHROPIC_API_KEY (and optionally AZURE_DOCUMENT_INTELLIGENCE_*) in
extractor/.env or the project-root .env.
"""
from __future__ import annotations

import argparse
import asyncio
import glob as globmod
import json
import os
import re
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

# Load .env from the extractor directory (or project root)
_extractor_dir = Path(__file__).parent.parent
load_dotenv(_extractor_dir / ".env")
load_dotenv(_extractor_dir.parent / ".env")

# Ensure the extractor package root is on sys.path
sys.path.insert(0, str(_extractor_dir))

from classifier import (
    RULE_CONFIDENCE_THRESHOLD,
    AI_CONFIDENCE_THRESHOLD,
    ClassificationResult,
    boost_with_filename,
    classify_by_rules,
)
from ocr import TesseractOcrProvider, get_tier1, is_scanned
from providers import (
    ClaudeClassifier,
    ClaudeExtractor,
    ExtractionChain,
    PipelineConfig,
    get_pipeline_config,
    run_extraction_chain,
)
from text_extraction import IMAGE_MIME_TYPES, extract_image_text, extract_pdf_content, extract_text

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

MIME_MAP: dict[str, str] = {
    ".pdf": "application/pdf",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".csv": "text/csv",
    ".txt": "text/plain",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".tiff": "image/tiff",
    ".tif": "image/tiff",
    ".webp": "image/webp",
}

SKIP_EXTENSIONS = {".gif", ".bmp"}
SKIP_DIRS = {".claude", "__pycache__", ".pytest_cache", ".venv"}

# Claude sonnet pricing (USD per token)
CLAUDE_INPUT_PRICE = 3.00 / 1_000_000
CLAUDE_OUTPUT_PRICE = 15.00 / 1_000_000

# Azure Document Intelligence prebuilt pricing (USD per page)
ADI_PRICE_PER_PAGE = 0.0015


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class FileResult:
    file: str
    file_size_bytes: int
    artifact_dir: str  # relative path to this file's artifact subfolder

    # Text extraction
    text_extraction_ms: float = 0.0
    text_extraction_method: str = ""
    text_length: int = 0
    text_preview: str = ""

    # OCR (if triggered)
    ocr_triggered: bool = False
    ocr_provider: str | None = None
    ocr_ms: float = 0.0

    # Classification
    rule_classification_ms: float = 0.0
    rule_doc_class: str = "unclassified"
    rule_confidence: float = 0.0
    optout_hint: bool = False
    filename_boosted: bool = False
    filename_boost_confidence: float | None = None
    ai_classification_ms: float | None = None
    ai_doc_class: str | None = None
    ai_confidence: float | None = None
    final_doc_class: str = "unclassified"
    final_classification_confidence: float = 0.0
    classification_path: str = "unclassified"

    # Claude classification tokens
    claude_classification_input_tokens: int = 0
    claude_classification_output_tokens: int = 0
    claude_classification_cost: float = 0.0

    # Extraction
    extraction_provider: str | None = None
    extraction_ms: float | None = None
    extraction_confidence: float | None = None
    extracted_data: dict | None = None
    field_confidences: dict[str, float] | None = None
    warnings: list[str] = field(default_factory=list)

    # Claude extraction tokens
    claude_extraction_input_tokens: int = 0
    claude_extraction_output_tokens: int = 0
    claude_extraction_cost: float = 0.0

    # Claude totals
    claude_total_cost: float = 0.0

    # Azure Document Intelligence
    adi_pages: int = 0
    adi_cost: float = 0.0

    # Totals
    total_ms: float = 0.0
    error: str | None = None


# ---------------------------------------------------------------------------
# Claude API wrapper that captures token usage
# ---------------------------------------------------------------------------

def _classify_with_ai_instrumented(text: str) -> tuple[ClassificationResult, int, int]:
    """Run AI classification and return (result, input_tokens, output_tokens)."""
    import anthropic
    from schemas import DOC_CLASSES

    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    classes_list = ", ".join(DOC_CLASSES)
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=256,
        messages=[
            {
                "role": "user",
                "content": f"""Classify this financial/legal document into exactly one of these classes:
{classes_list}

Respond with JSON only: {{"doc_class": "<class>", "confidence": <0.0-1.0>, "reasoning": "<one sentence>"}}

Document text (first 2000 chars):
{text[:2000]}""",
            }
        ],
    )

    input_tokens = response.usage.input_tokens
    output_tokens = response.usage.output_tokens

    text_response = response.content[0].text if response.content else ""
    match = re.search(r"\{.*\}", text_response, re.S)
    if not match:
        return (
            ClassificationResult(doc_class="unclassified", confidence=0.0, method="ai", reasoning="Failed to parse AI response"),
            input_tokens,
            output_tokens,
        )

    data = json.loads(match.group())
    return (
        ClassificationResult(
            doc_class=data.get("doc_class", "unclassified"),
            confidence=float(data.get("confidence", 0.0)),
            method="ai",
            reasoning=data.get("reasoning", ""),
        ),
        input_tokens,
        output_tokens,
    )


# ---------------------------------------------------------------------------
# Extraction chain wrapper that captures Claude token usage
# ---------------------------------------------------------------------------

class InstrumentedClaudeExtractor:
    """Wraps ClaudeExtractor to capture token usage from the API response."""

    def __init__(self) -> None:
        self.input_tokens = 0
        self.output_tokens = 0

    @property
    def name(self) -> str:
        return "ai_parse"

    async def extract(
        self,
        *,
        doc_class: str,
        text: str,
        content: bytes,
        form_fields: dict[str, str],
    ) -> Any:
        import anthropic
        from ai_extractor import SYSTEM_PROMPT, get_extraction_notes, get_extraction_template
        from schemas import RuleExtractionResult
        from schemas import DOC_CLASS_SCHEMA

        template = get_extraction_template(doc_class)
        notes = get_extraction_notes(doc_class)
        notes_section = f"\nExtraction notes:\n{notes}\n" if notes else ""

        client = anthropic.AsyncAnthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
        message = await client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            system=SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": (
                        f"Extract data from this {doc_class.replace('_', ' ')} document.\n\n"
                        f"Expected schema:\n{template}\n"
                        f"{notes_section}"
                        f"Document text:\n{text}"
                    ),
                }
            ],
        )

        self.input_tokens = message.usage.input_tokens
        self.output_tokens = message.usage.output_tokens

        response_text = message.content[0].text if message.content and message.content[0].type == "text" else ""
        json_match = re.search(r"\{[\s\S]*\}", response_text)
        if not json_match:
            return RuleExtractionResult(
                data={}, field_confidences={}, warnings=["Failed to parse AI response"], confidence=0.0,
            )

        raw = json.loads(json_match.group())
        data = raw.get("data", raw) if isinstance(raw.get("data"), dict) else raw
        field_confidences: dict[str, float] = raw.get("fieldConfidences", {})
        warnings: list[str] = raw.get("warnings", [])

        # Validate against Pydantic schema
        schema_cls = DOC_CLASS_SCHEMA.get(doc_class)
        schema_valid = False
        if schema_cls is not None:
            try:
                validated = schema_cls.model_validate(data, strict=False)
                data = validated.model_dump(exclude_none=True)
                schema_valid = True
            except Exception:
                warnings = warnings + ["Extraction data did not fully match expected schema"]

        confidence_values = list(field_confidences.values())
        if confidence_values:
            avg_confidence = sum(confidence_values) / len(confidence_values)
            if schema_cls is not None and not schema_valid:
                avg_confidence *= 0.7
        else:
            avg_confidence = 0.85

        return RuleExtractionResult(
            data=data, field_confidences=field_confidences, warnings=warnings, confidence=avg_confidence,
        )


def _make_instrumented_config(config: PipelineConfig) -> tuple[PipelineConfig, list[InstrumentedClaudeExtractor]]:
    """Replace ClaudeExtractors in the config with instrumented versions.

    Returns the new config and a list of all instrumented extractors so
    their token counts can be read after extraction.
    """
    instrumented: list[InstrumentedClaudeExtractor] = []

    def replace_chain(chain: ExtractionChain) -> ExtractionChain:
        new_providers = []
        for p in chain.providers:
            if isinstance(p, ClaudeExtractor):
                inst = InstrumentedClaudeExtractor()
                instrumented.append(inst)
                new_providers.append(inst)
            else:
                new_providers.append(p)
        return ExtractionChain(providers=new_providers, threshold=chain.threshold)

    return PipelineConfig(
        classifiers=config.classifiers,
        default_extractors=replace_chain(config.default_extractors),
        extractor_overrides={k: replace_chain(v) for k, v in config.extractor_overrides.items()},
    ), instrumented


# ---------------------------------------------------------------------------
# Per-file processing
# ---------------------------------------------------------------------------

async def process_file(
    file_path: Path,
    runtype: str,
    config: PipelineConfig,
    artifact_dir: str,
    output_dir: Path,
) -> FileResult:
    """Run the pipeline on one file, collecting per-step metrics."""
    start_total = time.perf_counter()
    ext = file_path.suffix.lower()
    mime = MIME_MAP.get(ext, "application/octet-stream")

    result = FileResult(
        file=str(file_path),
        file_size_bytes=0,
        artifact_dir=artifact_dir,
    )

    # Read file
    try:
        content = file_path.read_bytes()
        result.file_size_bytes = len(content)
    except OSError as e:
        result.error = str(e)
        result.total_ms = (time.perf_counter() - start_total) * 1000
        return result

    # Create artifact directory
    doc_artifact_path = output_dir / artifact_dir
    doc_artifact_path.mkdir(parents=True, exist_ok=True)

    # ------------------------------------------------------------------
    # Step 1: Text extraction
    # ------------------------------------------------------------------
    t0 = time.perf_counter()
    text = ""
    form_fields: dict[str, str] = {}
    try:
        if mime == "application/pdf":
            text, form_fields = extract_pdf_content(content, doc_class=None)
            # Determine which backend was used
            from text_extraction import _MARKITDOWN_CLASSES
            result.text_extraction_method = "pdftext"
        elif mime in IMAGE_MIME_TYPES:
            text = extract_image_text(content)
            result.text_extraction_method = "tesseract"
        else:
            text = extract_text(content, mime, None)
            result.text_extraction_method = "utf8"
    except Exception as e:
        result.error = f"Text extraction failed: {e}"
        result.total_ms = (time.perf_counter() - start_total) * 1000
        return result
    result.text_extraction_ms = (time.perf_counter() - t0) * 1000
    result.text_length = len(text)
    # Preview: first 200 chars, newlines replaced with " | "
    result.text_preview = text[:200].replace("\n", " | ").replace("\r", "").strip()

    # Write full extracted text
    (doc_artifact_path / "extracted_text.txt").write_text(text, encoding="utf-8")

    # ------------------------------------------------------------------
    # Step 2: Tier 1 OCR (if scanned PDF)
    # ------------------------------------------------------------------
    if mime == "application/pdf" and is_scanned(text):
        tier1 = get_tier1()
        if tier1:
            t0 = time.perf_counter()
            result.ocr_triggered = True
            result.ocr_provider = "marker" if not isinstance(tier1, TesseractOcrProvider) else "tesseract"
            try:
                if isinstance(tier1, TesseractOcrProvider):
                    ocr_text = tier1.extract_text_until(
                        content,
                        lambda candidate: classify_by_rules(candidate).confidence >= RULE_CONFIDENCE_THRESHOLD,
                    )
                else:
                    ocr_text = tier1.extract_text(content)
                if not is_scanned(ocr_text):
                    text = ocr_text
                    result.text_length = len(text)
                    result.text_preview = text[:200].replace("\n", " | ").replace("\r", "").strip()
                    # Overwrite extracted text with OCR result
                    (doc_artifact_path / "extracted_text.txt").write_text(text, encoding="utf-8")
            except Exception:
                pass
            result.ocr_ms = (time.perf_counter() - t0) * 1000

    # ------------------------------------------------------------------
    # Step 3: Classification
    # ------------------------------------------------------------------
    # Tier 1: Rule engine
    t0 = time.perf_counter()
    rule_result = classify_by_rules(text)
    result.rule_classification_ms = (time.perf_counter() - t0) * 1000
    result.rule_doc_class = rule_result.doc_class
    result.rule_confidence = rule_result.confidence
    if rule_result.doc_class == "other" and rule_result.confidence > 0:
        result.optout_hint = True

    # Tier 1.5: Filename boost
    if rule_result.confidence > 0 and rule_result.confidence < RULE_CONFIDENCE_THRESHOLD:
        boosted = boost_with_filename(rule_result, file_path.name)
        if boosted.confidence > rule_result.confidence:
            result.filename_boosted = True
            result.filename_boost_confidence = boosted.confidence
            rule_result = boosted

    # Determine if AI classification is needed
    classification = rule_result
    if rule_result.confidence >= RULE_CONFIDENCE_THRESHOLD:
        if result.filename_boosted:
            result.classification_path = "rules+filename"
        else:
            result.classification_path = "rules"
    else:
        # Tier 2: Claude AI
        t0 = time.perf_counter()
        try:
            ai_result, in_tok, out_tok = _classify_with_ai_instrumented(text)
            result.ai_classification_ms = (time.perf_counter() - t0) * 1000
            result.ai_doc_class = ai_result.doc_class
            result.ai_confidence = ai_result.confidence
            result.claude_classification_input_tokens = in_tok
            result.claude_classification_output_tokens = out_tok
            result.claude_classification_cost = (
                in_tok * CLAUDE_INPUT_PRICE + out_tok * CLAUDE_OUTPUT_PRICE
            )

            if ai_result.confidence >= AI_CONFIDENCE_THRESHOLD:
                classification = ai_result
                if result.optout_hint:
                    result.classification_path = "optout+claude"
                else:
                    result.classification_path = "rules+claude"
            elif rule_result.doc_class != "unclassified" and rule_result.confidence > ai_result.confidence:
                classification = rule_result
                result.classification_path = "rules" if not result.filename_boosted else "rules+filename"
            else:
                classification = ClassificationResult(
                    doc_class="unclassified", confidence=0.0, method="ai",
                    reasoning="Both tiers below threshold",
                )
                result.classification_path = "unclassified"
        except Exception:
            result.ai_classification_ms = (time.perf_counter() - t0) * 1000
            if rule_result.doc_class != "unclassified":
                classification = rule_result
                result.classification_path = "rules" if not result.filename_boosted else "rules+filename"
            else:
                result.classification_path = "unclassified"

    result.final_doc_class = classification.doc_class
    result.final_classification_confidence = classification.confidence

    # Write classification artifact
    cls_artifact = {
        "doc_class": classification.doc_class,
        "confidence": classification.confidence,
        "method": classification.method,
        "reasoning": getattr(classification, "reasoning", ""),
        "path": result.classification_path,
        "rule_doc_class": result.rule_doc_class,
        "rule_confidence": result.rule_confidence,
        "filename_boosted": result.filename_boosted,
        "ai_doc_class": result.ai_doc_class,
        "ai_confidence": result.ai_confidence,
    }
    (doc_artifact_path / "classification.json").write_text(
        json.dumps(cls_artifact, indent=2, default=str), encoding="utf-8"
    )

    # ------------------------------------------------------------------
    # Step 4: Extraction (if runtype includes extraction)
    # ------------------------------------------------------------------
    if runtype == "classifier+extraction" and classification.doc_class not in ("unclassified", "other"):
        # Build an instrumented config for this file's extraction
        inst_config, inst_extractors = _make_instrumented_config(config)
        chain = inst_config.chain_for(classification.doc_class)

        t0 = time.perf_counter()
        try:
            ext_result, provider_name = await run_extraction_chain(
                chain, classification.doc_class, text, content, form_fields,
            )
            result.extraction_ms = (time.perf_counter() - t0) * 1000
            result.extraction_provider = provider_name

            # Collect Claude extraction tokens from instrumented extractors
            for inst in inst_extractors:
                if inst.input_tokens > 0:
                    result.claude_extraction_input_tokens += inst.input_tokens
                    result.claude_extraction_output_tokens += inst.output_tokens
            result.claude_extraction_cost = (
                result.claude_extraction_input_tokens * CLAUDE_INPUT_PRICE
                + result.claude_extraction_output_tokens * CLAUDE_OUTPUT_PRICE
            )

            if ext_result is not None:
                result.extraction_confidence = ext_result.confidence
                result.extracted_data = ext_result.data
                result.field_confidences = ext_result.field_confidences
                result.warnings = ext_result.warnings
                if ext_result.pages_analyzed > 0:
                    result.adi_pages = ext_result.pages_analyzed
                    result.adi_cost = result.adi_pages * ADI_PRICE_PER_PAGE
        except Exception as e:
            result.extraction_ms = (time.perf_counter() - t0) * 1000
            result.warnings.append(f"Extraction error: {e}")

        # Write extraction artifact
        ext_artifact = {
            "provider": result.extraction_provider,
            "confidence": result.extraction_confidence,
            "data": result.extracted_data,
            "field_confidences": result.field_confidences,
            "warnings": result.warnings,
        }
        (doc_artifact_path / "extraction.json").write_text(
            json.dumps(ext_artifact, indent=2, default=str), encoding="utf-8"
        )

    # ------------------------------------------------------------------
    # Totals
    # ------------------------------------------------------------------
    result.claude_total_cost = result.claude_classification_cost + result.claude_extraction_cost
    result.total_ms = (time.perf_counter() - start_total) * 1000

    return result


# ---------------------------------------------------------------------------
# Parallelism
# ---------------------------------------------------------------------------

async def run_parallel(
    files: list[Path],
    parallel: int,
    runtype: str,
    config: PipelineConfig,
    output_dir: Path,
) -> list[FileResult]:
    sem = asyncio.Semaphore(parallel)
    completed = 0
    total = len(files)

    async def bounded(idx: int, path: Path) -> FileResult:
        nonlocal completed
        artifact_dir = f"documents/{idx + 1:03d}_{path.stem}"
        async with sem:
            r = await process_file(path, runtype, config, artifact_dir, output_dir)
        completed += 1
        status = r.final_doc_class if not r.error else f"ERROR: {r.error[:40]}"
        print(f"  [{completed}/{total}] {path.name} — {status} ({r.total_ms:.0f}ms)")
        return r

    tasks = [asyncio.create_task(bounded(i, f)) for i, f in enumerate(files)]
    results: list[FileResult] = [None] * len(tasks)  # type: ignore[list-item]
    for coro in asyncio.as_completed(tasks):
        r = await coro
        # Find index by artifact_dir prefix
        idx = int(Path(r.artifact_dir).name.split("_")[0]) - 1
        results[idx] = r
    return results


# ---------------------------------------------------------------------------
# Report generation
# ---------------------------------------------------------------------------

def _percentile(values: list[float], pct: float) -> float:
    if not values:
        return 0.0
    s = sorted(values)
    idx = min(int(len(s) * pct / 100), len(s) - 1)
    return s[idx]


def _fmt_ms(ms: float) -> str:
    if ms < 1:
        return "<1ms"
    return f"{ms:.0f}ms"


def _fmt_cost(cost: float) -> str:
    if cost == 0:
        return "—"
    return f"${cost:.4f}"


def _fmt_tokens(inp: int, out: int) -> str:
    if inp == 0 and out == 0:
        return "—"
    return f"{inp:,} / {out:,}"


def generate_report(
    results: list[FileResult],
    runtype: str,
    input_path: str,
    parallel: int,
    wall_time_s: float,
) -> str:
    lines: list[str] = []
    ok = [r for r in results if r.error is None]
    errors = [r for r in results if r.error is not None]
    n = len(results)

    # ------------------------------------------------------------------
    # Header
    # ------------------------------------------------------------------
    lines.append("# Extraction Pipeline Evaluation Report")
    lines.append("")
    lines.append("| | |")
    lines.append("|---|---|")
    lines.append(f"| **Run type** | {runtype} |")
    lines.append(f"| **Date** | {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} |")
    lines.append(f"| **Input** | {input_path} |")
    lines.append(f"| **Files processed** | {n} |")
    lines.append(f"| **Parallelism** | {parallel} |")
    lines.append(f"| **Wall time** | {wall_time_s:.1f}s |")
    if n > 0 and wall_time_s > 0:
        lines.append(f"| **Throughput** | {n / wall_time_s:.1f} docs/sec |")
    lines.append("")
    lines.append("---")
    lines.append("")

    # ------------------------------------------------------------------
    # Summary — Overall
    # ------------------------------------------------------------------
    lines.append("## Summary")
    lines.append("")
    lines.append("### Overall")
    lines.append("")

    total_claude = sum(r.claude_total_cost for r in results)
    total_adi = sum(r.adi_cost for r in results)
    total_cost = total_claude + total_adi
    avg_ms = sum(r.total_ms for r in ok) / len(ok) if ok else 0

    lines.append("| Metric | Value |")
    lines.append("|---|---|")
    lines.append(f"| Successfully processed | {len(ok)} |")
    lines.append(f"| Errors | {len(errors)} |")
    lines.append(f"| Avg total time per file | {avg_ms:.0f}ms |")
    lines.append(f"| **Total Claude cost** | **{_fmt_cost(total_claude)}** |")
    lines.append(f"| **Total ADI cost** | **{_fmt_cost(total_adi)}** |")
    lines.append(f"| **Total cost** | **{_fmt_cost(total_cost)}** |")
    lines.append("")

    # ------------------------------------------------------------------
    # Summary — Latency percentiles
    # ------------------------------------------------------------------
    lines.append("### Latency Percentiles")
    lines.append("")

    total_ms_list = [r.total_ms for r in ok]
    text_ms_list = [r.text_extraction_ms for r in ok]
    cls_ms_list = [r.rule_classification_ms + (r.ai_classification_ms or 0) for r in ok]
    ext_ms_list = [r.extraction_ms for r in ok if r.extraction_ms is not None]

    lines.append("| Percentile | Total | Text Extract | Classification | Extraction |")
    lines.append("|---|---|---|---|---|")
    for pct, label in [(50, "p50"), (95, "p95"), (99, "p99")]:
        ext_val = _fmt_ms(_percentile(ext_ms_list, pct)) if ext_ms_list else "—"
        lines.append(
            f"| {label} | {_fmt_ms(_percentile(total_ms_list, pct))} "
            f"| {_fmt_ms(_percentile(text_ms_list, pct))} "
            f"| {_fmt_ms(_percentile(cls_ms_list, pct))} "
            f"| {ext_val} |"
        )
    lines.append("")

    # ------------------------------------------------------------------
    # Summary — Classification breakdown
    # ------------------------------------------------------------------
    lines.append("### Classification Breakdown")
    lines.append("")
    lines.append("| Path | Count | % | Avg Confidence | Claude Tokens (in/out) | Claude Cost |")
    lines.append("|---|---|---|---|---|---|")

    path_groups: dict[str, list[FileResult]] = {}
    for r in ok:
        path_groups.setdefault(r.classification_path, []).append(r)

    path_order = ["rules", "rules+filename", "optout+claude", "rules+claude", "unclassified"]
    path_labels = {
        "rules": "Rules only (>=0.85)",
        "rules+filename": "Rules + filename boost",
        "optout+claude": "Opt-out hint + Claude AI",
        "rules+claude": "Rules + Claude AI",
        "unclassified": "Unclassified",
    }
    for path in path_order:
        group = path_groups.get(path, [])
        if not group:
            continue
        count = len(group)
        pct = 100 * count // len(ok) if ok else 0
        avg_conf = sum(r.final_classification_confidence for r in group) / count
        total_in = sum(r.claude_classification_input_tokens for r in group)
        total_out = sum(r.claude_classification_output_tokens for r in group)
        cost = sum(r.claude_classification_cost for r in group)
        lines.append(
            f"| {path_labels.get(path, path)} | {count} | {pct}% | {avg_conf:.2f} "
            f"| {_fmt_tokens(total_in, total_out)} | {_fmt_cost(cost)} |"
        )
    lines.append("")

    # ------------------------------------------------------------------
    # Summary — Extraction breakdown
    # ------------------------------------------------------------------
    if runtype == "classifier+extraction":
        lines.append("### Extraction Breakdown")
        lines.append("")
        lines.append("| Provider | Count | % | Avg Confidence | Avg Time | Avg Cost |")
        lines.append("|---|---|---|---|---|---|")

        provider_groups: dict[str, list[FileResult]] = {}
        for r in ok:
            key = r.extraction_provider or "No extraction"
            provider_groups.setdefault(key, []).append(r)

        for provider, group in sorted(provider_groups.items()):
            count = len(group)
            pct = 100 * count // len(ok) if ok else 0
            confs = [r.extraction_confidence for r in group if r.extraction_confidence is not None]
            avg_conf = f"{sum(confs) / len(confs):.2f}" if confs else "—"
            times = [r.extraction_ms for r in group if r.extraction_ms is not None]
            avg_time = _fmt_ms(sum(times) / len(times)) if times else "—"
            costs = [r.claude_extraction_cost + r.adi_cost for r in group]
            avg_cost_val = sum(costs) / len(costs) if costs else 0
            avg_cost = _fmt_cost(avg_cost_val) if avg_cost_val > 0 else "—"
            lines.append(f"| {provider} | {count} | {pct}% | {avg_conf} | {avg_time} | {avg_cost} |")
        lines.append("")

    # ------------------------------------------------------------------
    # Summary — Cost breakdown
    # ------------------------------------------------------------------
    lines.append("### Cost Summary")
    lines.append("")
    lines.append("| Stage | Claude Tokens (in/out) | Claude Cost | ADI Pages | ADI Cost | Total |")
    lines.append("|---|---|---|---|---|---|")

    cls_in = sum(r.claude_classification_input_tokens for r in results)
    cls_out = sum(r.claude_classification_output_tokens for r in results)
    cls_cost = sum(r.claude_classification_cost for r in results)

    ext_in = sum(r.claude_extraction_input_tokens for r in results)
    ext_out = sum(r.claude_extraction_output_tokens for r in results)
    ext_cost = sum(r.claude_extraction_cost for r in results)

    adi_pages = sum(r.adi_pages for r in results)
    adi_cost_total = sum(r.adi_cost for r in results)

    lines.append(
        f"| Classification | {_fmt_tokens(cls_in, cls_out)} | {_fmt_cost(cls_cost)} | — | — | {_fmt_cost(cls_cost)} |"
    )
    lines.append(
        f"| Extraction | {_fmt_tokens(ext_in, ext_out)} | {_fmt_cost(ext_cost)} "
        f"| {adi_pages} | {_fmt_cost(adi_cost_total)} | {_fmt_cost(ext_cost + adi_cost_total)} |"
    )
    lines.append(
        f"| **Total** | **{_fmt_tokens(cls_in + ext_in, cls_out + ext_out)}** "
        f"| **{_fmt_cost(cls_cost + ext_cost)}** "
        f"| **{adi_pages}** | **{_fmt_cost(adi_cost_total)}** "
        f"| **{_fmt_cost(total_cost)}** |"
    )
    lines.append("")

    # ------------------------------------------------------------------
    # Summary — Doc class distribution
    # ------------------------------------------------------------------
    lines.append("### Doc Class Distribution")
    lines.append("")
    lines.append("| Doc Class | Count | Avg Classification Conf | Avg Extraction Conf |")
    lines.append("|---|---|---|---|")

    class_groups: dict[str, list[FileResult]] = {}
    for r in ok:
        class_groups.setdefault(r.final_doc_class, []).append(r)

    for doc_class, group in sorted(class_groups.items(), key=lambda x: -len(x[1])):
        count = len(group)
        avg_cls = sum(r.final_classification_confidence for r in group) / count
        ext_confs = [r.extraction_confidence for r in group if r.extraction_confidence is not None]
        avg_ext = f"{sum(ext_confs) / len(ext_confs):.2f}" if ext_confs else "—"
        lines.append(f"| {doc_class} | {count} | {avg_cls:.2f} | {avg_ext} |")
    lines.append("")

    # ------------------------------------------------------------------
    # Per-file details
    # ------------------------------------------------------------------
    lines.append("---")
    lines.append("")
    lines.append("## Per-File Details")

    for i, r in enumerate(results):
        lines.append("")
        lines.append(f"### {i + 1}. {Path(r.file).name}")
        lines.append("")

        if r.error:
            lines.append(f"**ERROR:** {r.error}")
            lines.append("")
            lines.append("---")
            continue

        # Step timing table
        lines.append("| Step | Time | Confidence | Method | Tokens (in/out) | Cost |")
        lines.append("|---|---|---|---|---|---|")

        # Text extraction row
        text_method = r.text_extraction_method
        if r.ocr_triggered:
            text_method += f" + {r.ocr_provider} OCR"
        text_time = r.text_extraction_ms + r.ocr_ms
        lines.append(
            f"| Text extraction | {_fmt_ms(text_time)} | — | {text_method} | — | — |"
        )

        # Classification rows
        if r.classification_path == "rules":
            lines.append(
                f"| Classification | {_fmt_ms(r.rule_classification_ms)} "
                f"| {r.final_classification_confidence:.2f} | rules | — | — |"
            )
        elif r.classification_path == "rules+filename":
            lines.append(
                f"| Classification (rules) | {_fmt_ms(r.rule_classification_ms)} "
                f"| {r.rule_confidence:.2f} | rules (below threshold) | — | — |"
            )
            lines.append(
                f"| Classification (filename) | <1ms "
                f"| {r.filename_boost_confidence:.2f} | rules+filename boost | — | — |"
            )
        elif r.classification_path == "optout+claude":
            lines.append(
                f"| Classification (opt-out) | {_fmt_ms(r.rule_classification_ms)} "
                f"| {r.rule_confidence:.2f} | opt-out hint (no financial keywords) | — | — |"
            )
            lines.append(
                f"| Classification (AI) | {_fmt_ms(r.ai_classification_ms or 0)} "
                f"| {r.ai_confidence:.2f} | claude "  # type: ignore[arg-type]
                f"| {_fmt_tokens(r.claude_classification_input_tokens, r.claude_classification_output_tokens)} "
                f"| {_fmt_cost(r.claude_classification_cost)} |"
            )
        elif r.classification_path == "rules+claude":
            lines.append(
                f"| Classification (rules) | {_fmt_ms(r.rule_classification_ms)} "
                f"| {r.rule_confidence:.2f} | rules (below threshold) | — | — |"
            )
            lines.append(
                f"| Classification (AI) | {_fmt_ms(r.ai_classification_ms or 0)} "
                f"| {r.ai_confidence:.2f} | claude "  # type: ignore[arg-type]
                f"| {_fmt_tokens(r.claude_classification_input_tokens, r.claude_classification_output_tokens)} "
                f"| {_fmt_cost(r.claude_classification_cost)} |"
            )
        else:
            cls_time = r.rule_classification_ms + (r.ai_classification_ms or 0)
            lines.append(
                f"| Classification | {_fmt_ms(cls_time)} "
                f"| {r.final_classification_confidence:.2f} | {r.classification_path} "
                f"| {_fmt_tokens(r.claude_classification_input_tokens, r.claude_classification_output_tokens)} "
                f"| {_fmt_cost(r.claude_classification_cost)} |"
            )

        # Extraction row
        if r.extraction_provider is not None:
            ext_conf = f"{r.extraction_confidence:.2f}" if r.extraction_confidence is not None else "—"
            lines.append(
                f"| Extraction | {_fmt_ms(r.extraction_ms or 0)} "
                f"| {ext_conf} "
                f"| {r.extraction_provider} "
                f"| {_fmt_tokens(r.claude_extraction_input_tokens, r.claude_extraction_output_tokens)} "
                f"| {_fmt_cost(r.claude_extraction_cost + r.adi_cost)} |"
            )

        # Total row
        file_cost = r.claude_total_cost + r.adi_cost
        total_in = r.claude_classification_input_tokens + r.claude_extraction_input_tokens
        total_out = r.claude_classification_output_tokens + r.claude_extraction_output_tokens
        final_conf = r.extraction_confidence if r.extraction_confidence is not None else r.final_classification_confidence
        lines.append(
            f"| **Total** | **{_fmt_ms(r.total_ms)}** "
            f"| **{final_conf:.2f}** "
            f"| | **{_fmt_tokens(total_in, total_out)}** "
            f"| **{_fmt_cost(file_cost)}** |"
        )
        lines.append("")

        # Classification path narrative
        narrative = _build_classification_narrative(r)
        lines.append(f"**Classification path:** {narrative}")
        lines.append("")

        # Input text with link
        text_link = f"{r.artifact_dir}/extracted_text.txt"
        lines.append(
            f"**Input text** ({r.text_length:,} chars): "
            f"`{r.text_preview}` — [full text]({text_link})"
        )
        lines.append("")

        # Extracted fields
        if r.extracted_data:
            lines.append("**Extracted fields:**")
            lines.append("")
            lines.append("| Field | Value | Confidence |")
            lines.append("|---|---|---|")
            for key, val in r.extracted_data.items():
                conf = r.field_confidences.get(key) if r.field_confidences else None
                conf_str = f"{conf:.2f}" if conf is not None else "—"
                # Truncate long values (e.g. transaction lists)
                val_str = str(val)
                if len(val_str) > 80:
                    val_str = val_str[:77] + "..."
                lines.append(f"| {key} | {val_str} | {conf_str} |")
            lines.append("")

        if r.warnings:
            lines.append("**Warnings:** " + "; ".join(r.warnings))
            lines.append("")

        lines.append("---")

    # ------------------------------------------------------------------
    # Errors section
    # ------------------------------------------------------------------
    if errors:
        lines.append("")
        lines.append("## Errors")
        lines.append("")
        lines.append("| # | File | Error |")
        lines.append("|---|---|---|")
        for i, r in enumerate(errors):
            lines.append(f"| {i + 1} | {Path(r.file).name} | {r.error} |")
        lines.append("")

    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("*Generated by `eval.py` | LegalEagle Extraction Pipeline*")
    lines.append("")

    return "\n".join(lines)


def _build_classification_narrative(r: FileResult) -> str:
    """Human-readable description of the classification path taken."""
    parts: list[str] = []

    if r.optout_hint:
        parts.append("opt-out hint (no financial keywords, 0.60 other)")
    else:
        parts.append(f"rules ({r.rule_confidence:.2f} {r.rule_doc_class})")

    if r.rule_confidence >= RULE_CONFIDENCE_THRESHOLD:
        parts.append("--> above threshold, no AI needed")
        return " ".join(parts)

    if r.filename_boosted:
        parts.append(f"--> filename boost to {r.filename_boost_confidence:.2f}")
        if (r.filename_boost_confidence or 0) >= RULE_CONFIDENCE_THRESHOLD:
            parts.append("--> above threshold, no AI needed")
            return " ".join(parts)

    if r.ai_classification_ms is not None:
        parts.append(f"--> below threshold --> Claude AI ({r.ai_confidence:.2f} {r.ai_doc_class})")
        if (r.ai_confidence or 0) >= AI_CONFIDENCE_THRESHOLD:
            parts.append("--> above AI threshold")
        else:
            parts.append("--> below AI threshold --> unclassified")

    if r.classification_path == "unclassified" and r.ai_classification_ms is None:
        parts.append("--> no match, unclassified")

    return " ".join(parts)


# ---------------------------------------------------------------------------
# File collection
# ---------------------------------------------------------------------------

def resolve_files(input_path: str, limit: int | None) -> list[Path]:
    """Resolve input to a list of files: single file, directory, or glob pattern."""
    # Expand ~ in path
    expanded = str(Path(input_path).expanduser())

    # Glob pattern
    if "*" in expanded or "?" in expanded:
        paths = [Path(p) for p in globmod.glob(expanded, recursive=True)]
        files = [p for p in paths if p.is_file() and _is_supported(p)]
        files.sort()
        if limit:
            files = files[:limit]
        return files

    target = Path(expanded)
    if target.is_file():
        return [target]

    if target.is_dir():
        files: list[Path] = []
        for entry in sorted(target.rglob("*")):
            if any(part in SKIP_DIRS for part in entry.parts):
                continue
            if not entry.is_file():
                continue
            if not _is_supported(entry):
                continue
            files.append(entry)
        if limit:
            files = files[:limit]
        return files

    print(f"Error: {input_path} does not exist", file=sys.stderr)
    sys.exit(1)


def _is_supported(path: Path) -> bool:
    ext = path.suffix.lower()
    return ext in MIME_MAP and ext not in SKIP_EXTENSIONS


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Run the extraction pipeline and produce a detailed markdown performance report.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""examples:
  python scripts/eval.py ~/Documents/Legal/paystub.pdf --runtype classifier
  python scripts/eval.py ~/Documents/Legal/ --runtype classifier+extraction --parallel 10
  python scripts/eval.py "~/Documents/Legal/*.pdf" --parallel 5 --limit 20""",
    )
    p.add_argument("input", help="File path, directory, or glob pattern")
    p.add_argument(
        "--runtype",
        choices=["classifier", "classifier+extraction"],
        default="classifier+extraction",
        help="What to run (default: classifier+extraction)",
    )
    p.add_argument("--parallel", type=int, default=1, help="Max concurrent files (default: 1)")
    p.add_argument("--output", type=Path, default=None, help="Output directory (default: eval_<timestamp>/)")
    p.add_argument("--limit", type=int, default=None, help="Max files to process")
    return p.parse_args()


async def main() -> None:
    args = parse_args()

    files = resolve_files(args.input, args.limit)
    if not files:
        print(f"No supported files found for: {args.input}", file=sys.stderr)
        sys.exit(1)

    # Output directory
    if args.output:
        output_dir = args.output
    else:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_dir = Path(f"eval_{timestamp}")
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"Run type:    {args.runtype}")
    print(f"Files:       {len(files)}")
    print(f"Parallel:    {args.parallel}")
    print(f"Output:      {output_dir}/")
    print()

    # Build pipeline config (strip AI classifiers — we call them manually for instrumentation)
    config = get_pipeline_config()

    # Run
    wall_start = time.perf_counter()
    results = await run_parallel(files, args.parallel, args.runtype, config, output_dir)
    wall_time = time.perf_counter() - wall_start

    print(f"\nCompleted in {wall_time:.1f}s")

    # Generate report
    report = generate_report(results, args.runtype, args.input, args.parallel, wall_time)
    report_path = output_dir / "report.md"
    report_path.write_text(report, encoding="utf-8")
    print(f"Report written to {report_path}")

    # Print summary stats
    ok = [r for r in results if r.error is None]
    errors = [r for r in results if r.error is not None]
    total_claude = sum(r.claude_total_cost for r in results)
    total_adi = sum(r.adi_cost for r in results)
    print(f"\n  {len(ok)} ok, {len(errors)} errors")
    if total_claude > 0 or total_adi > 0:
        print(f"  Claude: {_fmt_cost(total_claude)}  ADI: {_fmt_cost(total_adi)}  Total: {_fmt_cost(total_claude + total_adi)}")


if __name__ == "__main__":
    asyncio.run(main())
