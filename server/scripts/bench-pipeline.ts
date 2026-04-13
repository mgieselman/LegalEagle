/**
 * Benchmark the full document processing pipeline against local files.
 * Measures per-step timing, rule hit rates, and Claude API call counts.
 * No database writes — calls classification + extraction services directly.
 *
 * Usage:
 *   cd server && npx tsx scripts/bench-pipeline.ts [options]
 *
 * Options:
 *   --rules-only        Skip AI steps (no Claude calls, measures rule engine only)
 *   --concurrency N     Process N documents in parallel (default: 1, serial)
 *   --dir PATH          Directory to scan (default: ~/OneDrive/.../Legal/)
 *   --output PATH       Output file (default: ../../bench_results_pipeline.md)
 *   --limit N           Process at most N files (useful for quick spot-checks)
 */
import '../src/env';
import fs from 'fs';
import path from 'path';
import { extractPdfContent, extractText } from '../src/services/textExtraction';
import { classifyDocument } from '../src/services/classification';
import { classifyByRules } from '../src/services/classification/ruleClassifier';
import type { DocClass, ClassificationResult } from '../src/services/classification/types';
import { tryRuleExtraction } from '../src/services/extraction/ruleExtractors';
import { extractWithAI } from '../src/services/extraction/aiExtractor';

const RULE_EXTRACTION_THRESHOLD = 0.85;

const DEFAULT_DIR = '/Users/matt/Library/CloudStorage/OneDrive-GieselmanSoftware/Documents/Legal/';

const MIME_MAP: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.csv': 'text/csv',
  '.txt': 'text/plain',
};

const SKIP_EXTENSIONS = new Set(['.jpeg', '.jpg', '.png', '.gif', '.bmp']);
const SKIP_DIRS = new Set(['.claude']);

// ---- Types ----------------------------------------------------------------

interface DocResult {
  file: string;
  extension: string;
  sizeBytes: number;
  textExtractionMs: number;
  classificationMs: number;
  ruleExtractionMs: number;
  aiClassificationMs: number | null;   // > 0 when Claude was used for classification
  aiExtractionMs: number | null;       // > 0 when Claude was used for extraction
  totalMs: number;
  docClass: string;
  classificationConfidence: number;
  classificationMethod: string;
  extractionMethod: 'rule_engine' | 'ai_parse' | 'skipped' | 'unclassified' | null;
  extractionConfidence: number | null;
  ruleExtractionConfidence: number | null; // rule result even if below threshold
  skipped: boolean;
  skipReason?: string;
  error: string | null;
}

interface BenchOptions {
  rulesOnly: boolean;
  concurrency: number;
  dir: string;
  output: string;
  limit: number | null;
}

// ---- Arg parsing ----------------------------------------------------------

function parseArgs(): BenchOptions {
  const args = process.argv.slice(2);
  let rulesOnly = false;
  let concurrency = 1;
  let dir = DEFAULT_DIR;
  let output = path.join(__dirname, '../../bench_results_pipeline.md');
  let limit: number | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--rules-only') rulesOnly = true;
    if (args[i] === '--concurrency' && args[i + 1]) concurrency = Math.max(1, parseInt(args[++i], 10));
    if (args[i] === '--dir' && args[i + 1]) dir = args[++i];
    if (args[i] === '--output' && args[i + 1]) output = args[++i];
    if (args[i] === '--limit' && args[i + 1]) limit = parseInt(args[++i], 10);
  }

  return { rulesOnly, concurrency, dir, output, limit };
}

// ---- File discovery -------------------------------------------------------

function getAllFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllFiles(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files.sort();
}

// ---- Per-file benchmark ---------------------------------------------------

async function benchFile(
  filePath: string,
  baseDir: string,
  rulesOnly: boolean,
): Promise<DocResult> {
  const relPath = path.relative(baseDir, filePath);
  const ext = path.extname(filePath).toLowerCase();
  const sizeBytes = fs.statSync(filePath).size;
  const startTotal = performance.now();

  const blank: Omit<DocResult, 'file' | 'extension' | 'sizeBytes'> = {
    textExtractionMs: 0,
    classificationMs: 0,
    ruleExtractionMs: 0,
    aiClassificationMs: null,
    aiExtractionMs: null,
    totalMs: 0,
    docClass: '—',
    classificationConfidence: 0,
    classificationMethod: '—',
    extractionMethod: null,
    extractionConfidence: null,
    ruleExtractionConfidence: null,
    skipped: true,
    error: null,
  };

  if (SKIP_EXTENSIONS.has(ext)) {
    return { ...blank, file: relPath, extension: ext, sizeBytes, skipReason: `${ext.slice(1).toUpperCase()} images not supported` };
  }

  const mimeType = MIME_MAP[ext];
  if (!mimeType) {
    return { ...blank, file: relPath, extension: ext, sizeBytes, skipReason: `Unknown extension ${ext}` };
  }

  try {
    const buffer = fs.readFileSync(filePath);
    const filename = path.basename(filePath);

    // Step 1: Text extraction
    const t0 = performance.now();
    let textContent: string;
    let pdfFormFields: Record<string, string> = {};
    if (mimeType === 'application/pdf') {
      const extracted = await extractPdfContent(buffer);
      textContent = extracted.text;
      pdfFormFields = extracted.formFields;
    } else {
      textContent = await extractText(buffer, mimeType);
    }
    const textExtractionMs = performance.now() - t0;

    // Step 2: Classification (rule-only mode uses only the rule classifier)
    let classification: ClassificationResult;
    let classificationMs: number;
    let aiClassificationMs: number | null = null;

    if (rulesOnly) {
      const t1 = performance.now();
      classification = classifyByRules(filename, textContent);
      classificationMs = performance.now() - t1;
    } else {
      const t1 = performance.now();
      // Time rule classification separately to detect when AI fallback fires
      const ruleClass = classifyByRules(filename, textContent);
      const rulePart = performance.now() - t1;
      if (ruleClass.confidence >= 0.85) {
        classification = ruleClass;
        classificationMs = rulePart;
      } else {
        // AI classification will fire — time it
        const t2 = performance.now();
        classification = await classifyDocument(filename, textContent);
        aiClassificationMs = performance.now() - t2;
        classificationMs = rulePart + aiClassificationMs;
      }
    }

    // Step 3: Rule extraction (synchronous — always measure it)
    const t2 = performance.now();
    const ruleResult = classification.docClass !== 'unclassified'
      ? tryRuleExtraction(classification.docClass as DocClass, textContent, pdfFormFields)
      : null;
    const ruleExtractionMs = performance.now() - t2;

    const ruleHit = ruleResult !== null && ruleResult.confidence >= RULE_EXTRACTION_THRESHOLD;

    // Step 4: AI extraction — only if rule missed and AI mode is enabled
    let aiExtractionMs: number | null = null;
    let extractionMethod: DocResult['extractionMethod'];
    let extractionConfidence: number | null;

    if (classification.docClass === 'unclassified') {
      extractionMethod = 'unclassified';
      extractionConfidence = null;
    } else if (ruleHit) {
      extractionMethod = 'rule_engine';
      extractionConfidence = ruleResult!.confidence;
    } else if (rulesOnly) {
      extractionMethod = 'skipped';
      extractionConfidence = ruleResult?.confidence ?? null;
    } else {
      const t3 = performance.now();
      const aiResult = await extractWithAI(textContent, classification.docClass as DocClass);
      aiExtractionMs = performance.now() - t3;
      extractionMethod = 'ai_parse';
      extractionConfidence = aiResult.confidence;
    }

    const totalMs = performance.now() - startTotal;

    return {
      file: relPath,
      extension: ext,
      sizeBytes,
      textExtractionMs,
      classificationMs,
      ruleExtractionMs,
      aiClassificationMs,
      aiExtractionMs,
      totalMs,
      docClass: classification.docClass,
      classificationConfidence: classification.confidence,
      classificationMethod: classification.method,
      extractionMethod,
      extractionConfidence,
      ruleExtractionConfidence: ruleResult?.confidence ?? null,
      skipped: false,
      error: null,
    };
  } catch (err) {
    return {
      file: relPath,
      extension: ext,
      sizeBytes,
      textExtractionMs: 0,
      classificationMs: 0,
      ruleExtractionMs: 0,
      aiClassificationMs: null,
      aiExtractionMs: null,
      totalMs: performance.now() - startTotal,
      docClass: '—',
      classificationConfidence: 0,
      classificationMethod: '—',
      extractionMethod: null,
      extractionConfidence: null,
      ruleExtractionConfidence: null,
      skipped: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ---- Concurrency runner ---------------------------------------------------

async function runWithConcurrency(
  files: string[],
  baseDir: string,
  opts: BenchOptions,
  onComplete: (result: DocResult, index: number, total: number) => void,
): Promise<DocResult[]> {
  const results: DocResult[] = new Array(files.length);
  const pending = files.map((f, i) => ({ f, i }));
  const inFlight = new Set<Promise<void>>();

  return new Promise((resolve, reject) => {
    function tryLaunch() {
      while (inFlight.size < opts.concurrency && pending.length > 0) {
        const { f, i } = pending.shift()!;
        const p = benchFile(f, baseDir, opts.rulesOnly).then((result) => {
          results[i] = result;
          inFlight.delete(p);
          onComplete(result, i, files.length);
          tryLaunch();
          if (inFlight.size === 0 && pending.length === 0) {
            resolve(results);
          }
        }).catch(reject);
        inFlight.add(p);
      }
    }
    tryLaunch();
    // Handle empty input
    if (files.length === 0) resolve([]);
  });
}

// ---- Reporting ------------------------------------------------------------

function ms(n: number): string {
  if (n < 1000) return `${n.toFixed(0)}ms`;
  return `${(n / 1000).toFixed(1)}s`;
}

function avg(values: number[]): number {
  return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function generateReport(results: DocResult[], opts: BenchOptions, wallMs: number): string {
  const processed = results.filter((r) => !r.skipped && r.error === null);
  const skipped = results.filter((r) => r.skipped);
  const errored = results.filter((r) => r.error !== null);

  const ruleExtracted = processed.filter((r) => r.extractionMethod === 'rule_engine');
  const aiExtracted = processed.filter((r) => r.extractionMethod === 'ai_parse');
  const aiClassified = processed.filter((r) => r.aiClassificationMs !== null && r.aiClassificationMs > 0);
  const unclassified = processed.filter((r) => r.docClass === 'unclassified');

  const totalClaudeCalls = aiClassified.length + aiExtracted.length;

  const totalSerialMs = processed.reduce((s, r) => s + r.totalMs, 0);
  const projectedConcurrency5 = processed.length > 0
    ? Math.ceil(processed.length / 5) * avg(processed.map((r) => r.totalMs))
    : 0;

  const textTimes = processed.map((r) => r.textExtractionMs);
  const classifyTimes = processed.map((r) => r.classificationMs);
  const aiExtractTimes = processed.filter((r) => r.aiExtractionMs !== null).map((r) => r.aiExtractionMs!);
  const ruleExtractTimes = processed.filter((r) => r.ruleExtractionConfidence !== null).map((r) => r.ruleExtractionMs);

  let md = `# Pipeline Benchmark Results\n\n`;
  md += `**Run:** ${new Date().toISOString()} | **Mode:** ${opts.rulesOnly ? 'rules-only' : 'full (rules + AI fallback)'} | **Concurrency:** ${opts.concurrency}\n\n`;

  // ---- Summary section ----
  md += `## Summary\n\n`;
  md += `| Metric | Value |\n|--------|-------|\n`;
  md += `| Total files scanned | ${results.length} |\n`;
  md += `| Processed | ${processed.length} |\n`;
  md += `| Skipped (images/unsupported) | ${skipped.length} |\n`;
  md += `| Errors | ${errored.length} |\n`;
  md += `| Unclassified | ${unclassified.length} |\n`;
  md += `\n`;

  // ---- Rule hit rates ----
  const ruleClassified = processed.filter((r) => r.classificationConfidence >= 0.85 && r.classificationMethod === 'rule_engine');

  md += `## Classification & Extraction Hit Rates\n\n`;
  md += `| | Count | % of processed |\n|---|---|---|\n`;
  md += `| Rule-classified (conf ≥0.85) | ${ruleClassified.length} | ${pct(ruleClassified.length, processed.length)} |\n`;
  md += `| AI-classified | ${aiClassified.length} | ${pct(aiClassified.length, processed.length)} |\n`;
  md += `| Unclassified (both tiers failed) | ${unclassified.length} | ${pct(unclassified.length, processed.length)} |\n`;
  md += `| Rule-extracted (conf ≥0.85) | ${ruleExtracted.length} | ${pct(ruleExtracted.length, processed.length)} |\n`;
  md += `| AI-extracted | ${aiExtracted.length} | ${pct(aiExtracted.length, processed.length)} |\n`;
  md += `| **Total Claude API calls** | **${totalClaudeCalls}** | — |\n`;
  md += `\n`;

  // ---- Timing summary ----
  md += `## Timing\n\n`;
  md += `| Step | Avg | Min | Max |\n|------|-----|-----|-----|\n`;
  md += timingRow('Text extraction', textTimes);
  md += timingRow('Classification (all)', classifyTimes);
  if (aiExtractTimes.length > 0) {
    md += timingRow('AI extraction (Claude)', aiExtractTimes);
  }
  if (ruleExtractTimes.length > 0) {
    md += timingRow('Rule extraction', ruleExtractTimes);
  }
  md += `\n`;

  md += `| Wall clock (${opts.concurrency > 1 ? `concurrency=${opts.concurrency}` : 'serial'}) | ${ms(wallMs)} |\n`;
  md += `| Sum of serial times | ${ms(totalSerialMs)} |\n`;
  if (opts.concurrency === 1 && processed.length > 0) {
    md += `| Projected @ concurrency=5 | ~${ms(projectedConcurrency5)} |\n`;
    md += `| Projected @ concurrency=10 | ~${ms(Math.ceil(processed.length / 10) * avg(processed.map((r) => r.totalMs)))} |\n`;
  }
  md += `\n`;

  // ---- Doc class breakdown ----
  const classCounts = new Map<string, number>();
  for (const r of processed) {
    classCounts.set(r.docClass, (classCounts.get(r.docClass) ?? 0) + 1);
  }
  md += `## Doc Class Breakdown\n\n`;
  md += `| Doc Class | Count |\n|-----------|-------|\n`;
  for (const [cls, count] of [...classCounts.entries()].sort((a, b) => b[1] - a[1])) {
    md += `| ${cls} | ${count} |\n`;
  }
  md += `\n`;

  // ---- Per-file table ----
  md += `## Per-File Results\n\n`;
  md += `| File | Size | TextExtract | Classify | RuleExtract | AIExtract | Total | DocClass | ExtrMethod | ExtrConf |\n`;
  md += `|------|------|-------------|----------|-------------|-----------|-------|----------|------------|----------|\n`;

  for (const r of results) {
    if (r.skipped) {
      md += `| ${r.file} | ${formatSize(r.sizeBytes)} | — | — | — | — | — | SKIPPED | — | — |\n`;
      continue;
    }
    if (r.error) {
      md += `| ${r.file} | ${formatSize(r.sizeBytes)} | — | — | — | — | ${ms(r.totalMs)} | ERROR | — | — |\n`;
      continue;
    }
    const aiExtract = r.aiExtractionMs !== null ? ms(r.aiExtractionMs) : '—';
    const extrConf = r.extractionConfidence !== null ? r.extractionConfidence.toFixed(2) : '—';
    const ruleConf = r.ruleExtractionConfidence !== null ? ` (rule:${r.ruleExtractionConfidence.toFixed(2)})` : '';
    md += `| ${r.file} | ${formatSize(r.sizeBytes)} | ${ms(r.textExtractionMs)} | ${ms(r.classificationMs)} | ${ms(r.ruleExtractionMs)} | ${aiExtract} | ${ms(r.totalMs)} | ${r.docClass} | ${r.extractionMethod ?? '—'} | ${extrConf}${ruleConf} |\n`;
  }

  // ---- Errors ----
  if (errored.length > 0) {
    md += `\n## Errors\n\n`;
    md += `| File | Error |\n|------|-------|\n`;
    for (const r of errored) {
      md += `| ${r.file} | ${r.error} |\n`;
    }
  }

  return md;
}

function pct(n: number, total: number): string {
  if (total === 0) return '—';
  return `${((n / total) * 100).toFixed(0)}%`;
}

function timingRow(label: string, times: number[]): string {
  if (times.length === 0) return '';
  const a = avg(times);
  const mn = Math.min(...times);
  const mx = Math.max(...times);
  return `| ${label} | ${ms(a)} | ${ms(mn)} | ${ms(mx)} |\n`;
}

// ---- Main -----------------------------------------------------------------

async function main() {
  const opts = parseArgs();

  console.log(`\nPipeline Benchmark`);
  console.log(`==================`);
  console.log(`Dir:         ${opts.dir}`);
  console.log(`Mode:        ${opts.rulesOnly ? 'rules-only (no Claude)' : 'full pipeline'}`);
  console.log(`Concurrency: ${opts.concurrency}`);
  if (opts.limit) console.log(`Limit:       ${opts.limit} files`);
  console.log('');

  if (!fs.existsSync(opts.dir)) {
    console.error(`Directory not found: ${opts.dir}`);
    process.exit(1);
  }

  let files = getAllFiles(opts.dir);
  if (opts.limit !== null) {
    files = files.slice(0, opts.limit);
  }
  console.log(`Found ${files.length} files\n`);

  const wallStart = performance.now();
  let completed = 0;

  const results = await runWithConcurrency(files, opts.dir, opts, (result, _i, total) => {
    completed++;
    const icon = result.skipped ? '—' : result.error ? '✗' : result.extractionMethod === 'rule_engine' ? '⚡' : result.extractionMethod === 'ai_parse' ? '🤖' : '?';
    const timing = result.skipped ? 'skipped' : result.error ? `ERROR: ${result.error}` : ms(result.totalMs);
    const extraction = result.skipped ? '' : result.error ? '' : ` → ${result.docClass} [${result.extractionMethod}]`;
    console.log(`[${completed}/${total}] ${icon} ${result.file} (${timing})${extraction}`);
  });

  const wallMs = performance.now() - wallStart;

  console.log(`\n${'='.repeat(60)}`);
  const processed = results.filter((r) => !r.skipped && r.error === null);
  const aiCalls = results.filter((r) => r.aiExtractionMs !== null || (r.aiClassificationMs !== null && r.aiClassificationMs > 0));
  console.log(`Processed:    ${processed.length} / ${results.length}`);
  console.log(`Claude calls: ${aiCalls.length}`);
  console.log(`Wall time:    ${ms(wallMs)}`);

  const report = generateReport(results, opts, wallMs);
  fs.writeFileSync(opts.output, report);
  console.log(`\nReport written to: ${opts.output}`);
}

main().catch((err: unknown) => {
  console.error('Fatal:', err);
  process.exit(1);
});
