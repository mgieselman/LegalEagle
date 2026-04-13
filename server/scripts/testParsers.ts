/**
 * Test all files in the Legal directory against the document parsers.
 * Outputs test_results.md with a summary table.
 *
 * Usage: cd server && npx tsx scripts/testParsers.ts
 */
import fs from 'fs';
import path from 'path';
import { extractText } from '../src/services/textExtraction';
import { classifyByRules } from '../src/services/classification/ruleClassifier';

const LEGAL_DIR = '/Users/matt/Library/CloudStorage/OneDrive-GieselmanSoftware/Documents/Legal/';
const OUTPUT_PATH = path.join(__dirname, '../../test_results.md');

const MIME_MAP: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.csv': 'text/csv',
  '.txt': 'text/plain',
};

const SKIP_EXTENSIONS = new Set(['.jpeg', '.jpg', '.png', '.gif', '.bmp']);
const SKIP_DIRS = new Set(['.claude']);

interface FileResult {
  relativePath: string;
  extension: string;
  sizeBytes: number;
  textLength: number | null;
  docClass: string | null;
  confidence: number | null;
  notes: string;
  error: string | null;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getAllFiles(dir: string, basePath: string = dir): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllFiles(fullPath, basePath));
    } else {
      files.push(fullPath);
    }
  }
  return files.sort();
}

async function processFile(filePath: string): Promise<FileResult> {
  const relativePath = path.relative(LEGAL_DIR, filePath);
  const extension = path.extname(filePath).toLowerCase();
  const stats = fs.statSync(filePath);
  const sizeBytes = stats.size;

  // Skip unsupported image formats
  if (SKIP_EXTENSIONS.has(extension)) {
    return {
      relativePath,
      extension,
      sizeBytes,
      textLength: null,
      docClass: null,
      confidence: null,
      notes: `Skipped: ${extension.toUpperCase().slice(1)} not supported for text extraction`,
      error: null,
    };
  }

  const mimeType = MIME_MAP[extension];
  if (!mimeType) {
    return {
      relativePath,
      extension,
      sizeBytes,
      textLength: null,
      docClass: null,
      confidence: null,
      notes: `Skipped: unknown extension ${extension}`,
      error: null,
    };
  }

  try {
    const buffer = fs.readFileSync(filePath);
    const text = await extractText(buffer, mimeType);
    const textLength = text.length;

    // Classify using rule engine only (no AI API calls)
    const classification = classifyByRules(path.basename(filePath), text);

    return {
      relativePath,
      extension,
      sizeBytes,
      textLength,
      docClass: classification.docClass,
      confidence: classification.confidence,
      notes: classification.docClass === 'unclassified' ? 'No rule match' : 'OK',
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      relativePath,
      extension,
      sizeBytes,
      textLength: null,
      docClass: null,
      confidence: null,
      notes: 'FAILED',
      error: message,
    };
  }
}

function generateMarkdown(results: FileResult[]): string {
  const now = new Date().toISOString().split('T')[0];
  const total = results.length;
  const skipped = results.filter((r) => r.notes.startsWith('Skipped')).length;
  const failed = results.filter((r) => r.error !== null).length;
  const parsed = total - skipped - failed;

  const pdfResults = results.filter((r) => r.extension === '.pdf');
  const pdfParsed = pdfResults.filter((r) => r.error === null && !r.notes.startsWith('Skipped')).length;
  const pdfFailed = pdfResults.filter((r) => r.error !== null).length;

  const imageResults = results.filter((r) => SKIP_EXTENSIONS.has(r.extension));
  const xlsxResults = results.filter((r) => r.extension === '.xlsx');
  const xlsxParsed = xlsxResults.filter((r) => r.error === null).length;

  // Count classifications
  const classificationCounts = new Map<string, number>();
  for (const r of results) {
    if (r.docClass) {
      classificationCounts.set(r.docClass, (classificationCounts.get(r.docClass) ?? 0) + 1);
    }
  }

  let md = `# Document Parser Test Results\n\n`;
  md += `**Run:** ${now} | **Files:** ${total} | **Parsed:** ${parsed} | **Skipped:** ${skipped} | **Failed:** ${failed}\n\n`;

  md += `## Summary\n\n`;
  md += `- PDFs parsed: ${pdfParsed}/${pdfResults.length}${pdfFailed > 0 ? ` (${pdfFailed} failed)` : ''}\n`;
  md += `- Images skipped: ${imageResults.length} (not supported for text extraction)\n`;
  md += `- XLSX parsed: ${xlsxParsed}/${xlsxResults.length}\n\n`;

  md += `### Classifications Detected\n\n`;
  md += `| Classification | Count |\n|---|---|\n`;
  for (const [cls, count] of [...classificationCounts.entries()].sort((a, b) => b[1] - a[1])) {
    md += `| ${cls} | ${count} |\n`;
  }
  md += `\n`;

  // Results table
  md += `## Results\n\n`;
  md += `| File | Type | Size | Text Extracted | Classification | Confidence | Notes |\n`;
  md += `|------|------|------|---------------|----------------|------------|-------|\n`;

  for (const r of results) {
    const file = r.relativePath;
    const type = r.extension.toUpperCase().slice(1);
    const size = formatSize(r.sizeBytes);
    const text = r.textLength !== null ? `${r.textLength.toLocaleString()} chars` : '—';
    const cls = r.docClass ?? '—';
    const conf = r.confidence !== null ? r.confidence.toFixed(2) : '—';
    const notes = r.error ? `FAILED` : r.notes;
    md += `| ${file} | ${type} | ${size} | ${text} | ${cls} | ${conf} | ${notes} |\n`;
  }

  // Failures section
  const failures = results.filter((r) => r.error !== null);
  if (failures.length > 0) {
    md += `\n## Failures\n\n`;
    md += `| File | Error |\n|------|-------|\n`;
    for (const r of failures) {
      md += `| ${r.relativePath} | ${r.error} |\n`;
    }
  } else {
    md += `\n## Failures\n\nNone! All parseable files processed successfully.\n`;
  }

  return md;
}

async function main() {
  console.log(`Scanning: ${LEGAL_DIR}`);
  const files = getAllFiles(LEGAL_DIR);
  console.log(`Found ${files.length} files\n`);

  const results: FileResult[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const name = path.relative(LEGAL_DIR, file);
    process.stdout.write(`[${i + 1}/${files.length}] ${name}... `);

    const result = await processFile(file);
    results.push(result);

    if (result.error) {
      console.log(`FAILED: ${result.error}`);
    } else if (result.notes.startsWith('Skipped')) {
      console.log('skipped');
    } else {
      console.log(`${result.docClass} (${result.confidence?.toFixed(2)}) — ${result.textLength} chars`);
    }
  }

  const markdown = generateMarkdown(results);
  fs.writeFileSync(OUTPUT_PATH, markdown);
  console.log(`\nResults written to: ${OUTPUT_PATH}`);

  // Print summary
  const failed = results.filter((r) => r.error !== null).length;
  const skipped = results.filter((r) => r.notes.startsWith('Skipped')).length;
  console.log(`\nTotal: ${results.length} | Parsed: ${results.length - skipped - failed} | Skipped: ${skipped} | Failed: ${failed}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
