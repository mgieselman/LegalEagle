/**
 * Client for the Python extraction service (extractor/).
 * Calls POST /extract with the raw file bytes and returns a structured result.
 *
 * Configure via PYTHON_EXTRACTOR_URL (default: http://localhost:8000).
 * Authenticates with the extractor via the `X-Extractor-Secret` header
 * (EXTRACTOR_SHARED_SECRET env var).
 */

export const PYTHON_EXTRACTOR_URL =
  process.env.PYTHON_EXTRACTOR_URL ?? 'http://localhost:8000';

const EXTRACTOR_SHARED_SECRET = process.env.EXTRACTOR_SHARED_SECRET;

// Fail loudly at module load if PYTHON_EXTRACTOR_URL is configured but the
// shared secret is not. This prevents silent 401s in prod — the Node server
// should crash on boot rather than accept uploads that will all fail auth.
if (process.env.PYTHON_EXTRACTOR_URL && !EXTRACTOR_SHARED_SECRET) {
  throw new Error(
    'PYTHON_EXTRACTOR_URL is set but EXTRACTOR_SHARED_SECRET is not. ' +
      'Refusing to start — remote extractor auth would fail on every request. ' +
      'Set EXTRACTOR_SHARED_SECRET in the environment or unset PYTHON_EXTRACTOR_URL.',
  );
}

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

function authHeaders(): Record<string, string> {
  // Read the env var fresh each call so tests can stub it after import.
  // In prod the value is set once at process start and never changes.
  const secret = process.env.EXTRACTOR_SHARED_SECRET ?? EXTRACTOR_SHARED_SECRET;
  if (!secret) {
    throw new Error(
      'EXTRACTOR_SHARED_SECRET is not set. The Python extractor requires ' +
        'shared-secret auth on every request.',
    );
  }
  return { 'X-Extractor-Secret': secret };
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
    headers: authHeaders(),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'unknown error');
    const suffix = response.status === 401 ? ' (unauthorized)' : '';
    throw new Error(`Python extractor returned ${response.status}${suffix}: ${errorText}`);
  }

  return response.json() as Promise<PythonExtractionResult>;
}

/**
 * Check if the Python extractor service is reachable.
 * Returns true if the /health endpoint responds successfully.
 *
 * The extractor skips shared-secret auth on /health (for Azure probes), but we
 * still send the header for consistency and so misconfiguration fails the same
 * way on both endpoints.
 */
export async function isPythonExtractorAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${PYTHON_EXTRACTOR_URL}/health`, {
      signal: AbortSignal.timeout(2000),
      headers: authHeaders(),
    });
    return response.ok;
  } catch {
    return false;
  }
}
