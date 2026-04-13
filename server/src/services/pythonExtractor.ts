/**
 * Client for the Python extraction service (extractor/).
 * Calls POST /extract with the raw file bytes and returns a structured result.
 *
 * Configure via PYTHON_EXTRACTOR_URL (default: http://localhost:8000).
 */

export const PYTHON_EXTRACTOR_URL =
  process.env.PYTHON_EXTRACTOR_URL ?? 'http://localhost:8000';

export interface PythonExtractionResult {
  doc_class: string;
  classification_confidence: number;
  classification_method: 'rule_engine' | 'ai';
  extraction_method: 'rule_engine' | 'ai_parse' | 'unclassified';
  confidence: number;
  data: Record<string, unknown>;
  field_confidences: Record<string, number>;
  warnings: string[];
}

/**
 * POST a document to the Python extractor service and return its result.
 *
 * @param content   Raw file bytes
 * @param filename  Original filename (used for content-type and classification hints)
 * @param mimeType  MIME type of the file
 * @param docClass  Optional classification hint — skips AI classification when provided
 */
export async function callPythonExtractor(
  content: Buffer,
  filename: string,
  mimeType: string,
  docClass?: string,
): Promise<PythonExtractionResult> {
  const formData = new FormData();
  formData.append('file', new Blob([content.buffer as ArrayBuffer], { type: mimeType }), filename);
  if (docClass) {
    formData.append('doc_class', docClass);
  }

  const response = await fetch(`${PYTHON_EXTRACTOR_URL}/extract`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'unknown error');
    throw new Error(`Python extractor returned ${response.status}: ${errorText}`);
  }

  return response.json() as Promise<PythonExtractionResult>;
}

/**
 * Check if the Python extractor service is reachable.
 * Returns true if the /health endpoint responds successfully.
 */
export async function isPythonExtractorAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${PYTHON_EXTRACTOR_URL}/health`, {
      signal: AbortSignal.timeout(2000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
