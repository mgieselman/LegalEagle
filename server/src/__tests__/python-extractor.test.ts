import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock global fetch before imports
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// The module reads EXTRACTOR_SHARED_SECRET at import time for its startup
// sanity check. Set it before importing so import doesn't throw.
const TEST_SECRET = 'test-shared-secret-value';
process.env.EXTRACTOR_SHARED_SECRET = TEST_SECRET;

import {
  callPythonExtractor,
  isPythonExtractorAvailable,
  PYTHON_EXTRACTOR_URL,
} from '../services/pythonExtractor';

const SAMPLE_RESULT = {
  doc_class: 'payStub.us',
  classification_confidence: 0.95,
  classification_method: 'rule_engine',
  extraction_method: 'rule_engine',
  confidence: 0.92,
  data: {
    employer_name: 'Acme Corp',
    gross_pay: 3000,
    net_pay: 2400,
  },
  field_confidences: { employer_name: 0.95, gross_pay: 0.92, net_pay: 0.9 },
  warnings: [],
};

function makeOkResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response;
}

function makeErrorResponse(status: number, text: string): Response {
  return {
    ok: false,
    status,
    json: () => Promise.reject(new Error('not json')),
    text: () => Promise.resolve(text),
  } as unknown as Response;
}

describe('callPythonExtractor', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    process.env.EXTRACTOR_SHARED_SECRET = TEST_SECRET;
  });

  it('sends multipart POST and returns parsed result', async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse(SAMPLE_RESULT));

    const result = await callPythonExtractor(
      Buffer.from('pay stub content'),
      'paystub.pdf',
      'application/pdf',
    );

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${PYTHON_EXTRACTOR_URL}/extract`);
    expect(opts.method).toBe('POST');
    expect(opts.body).toBeInstanceOf(FormData);

    expect(result.doc_class).toBe('payStub.us');
    expect(result.data.gross_pay).toBe(3000);
    expect(result.confidence).toBe(0.92);
  });

  it('includes doc_class in form data when provided', async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse(SAMPLE_RESULT));

    await callPythonExtractor(
      Buffer.from('content'),
      'doc.pdf',
      'application/pdf',
      'payStub.us',
    );

    const formData = mockFetch.mock.calls[0][1].body as FormData;
    expect(formData.get('doc_class')).toBe('payStub.us');
  });

  it('does not include doc_class when not provided', async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse(SAMPLE_RESULT));

    await callPythonExtractor(Buffer.from('content'), 'doc.pdf', 'application/pdf');

    const formData = mockFetch.mock.calls[0][1].body as FormData;
    expect(formData.get('doc_class')).toBeNull();
  });

  it('sends X-Extractor-Secret header equal to env value on /extract', async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse(SAMPLE_RESULT));

    await callPythonExtractor(Buffer.from('content'), 'doc.pdf', 'application/pdf');

    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = opts.headers as Record<string, string>;
    expect(headers['X-Extractor-Secret']).toBe(TEST_SECRET);
  });

  it('throws on non-OK response and includes body text in the error message', async () => {
    mockFetch.mockResolvedValueOnce(makeErrorResponse(500, 'Internal Server Error: DB down'));

    await expect(
      callPythonExtractor(Buffer.from('content'), 'doc.pdf', 'application/pdf'),
    ).rejects.toThrow(/Python extractor returned 500.*Internal Server Error: DB down/);
  });

  it('throws on 401 response with "unauthorized" surfaced in the message', async () => {
    mockFetch.mockResolvedValueOnce(makeErrorResponse(401, 'bad secret'));

    await expect(
      callPythonExtractor(Buffer.from('content'), 'doc.pdf', 'application/pdf'),
    ).rejects.toThrow(/401.*unauthorized/i);
  });

  it('throws on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

    await expect(
      callPythonExtractor(Buffer.from('content'), 'doc.pdf', 'application/pdf'),
    ).rejects.toThrow('Connection refused');
  });

  it('throws a clear error when EXTRACTOR_SHARED_SECRET is missing', async () => {
    delete process.env.EXTRACTOR_SHARED_SECRET;

    await expect(
      callPythonExtractor(Buffer.from('content'), 'doc.pdf', 'application/pdf'),
    ).rejects.toThrow(/EXTRACTOR_SHARED_SECRET is not set/);

    // fetch must not be called when auth is unconfigured.
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('isPythonExtractorAvailable', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    process.env.EXTRACTOR_SHARED_SECRET = TEST_SECRET;
  });

  it('returns true when health endpoint responds ok', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true } as Response);
    expect(await isPythonExtractorAvailable()).toBe(true);
  });

  it('returns false when health endpoint returns error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 503 } as Response);
    expect(await isPythonExtractorAvailable()).toBe(false);
  });

  it('returns false when fetch throws (service not running)', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    expect(await isPythonExtractorAvailable()).toBe(false);
  });

  it('sends X-Extractor-Secret header on /health', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true } as Response);

    await isPythonExtractorAvailable();

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${PYTHON_EXTRACTOR_URL}/health`);
    const headers = opts.headers as Record<string, string>;
    expect(headers['X-Extractor-Secret']).toBe(TEST_SECRET);
  });

  it('returns false when EXTRACTOR_SHARED_SECRET is missing (authHeaders throws, caught)', async () => {
    delete process.env.EXTRACTOR_SHARED_SECRET;
    // fetch should never be invoked because authHeaders() throws first.
    expect(await isPythonExtractorAvailable()).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('pythonExtractor module load guard', () => {
  // Covers the top-level throw: if PYTHON_EXTRACTOR_URL is set but the secret
  // is not, re-importing the module should fail. vi.resetModules() lets us
  // re-run the import under a controlled env.
  const originalUrl = process.env.PYTHON_EXTRACTOR_URL;
  const originalSecret = process.env.EXTRACTOR_SHARED_SECRET;

  afterEach(() => {
    if (originalUrl === undefined) delete process.env.PYTHON_EXTRACTOR_URL;
    else process.env.PYTHON_EXTRACTOR_URL = originalUrl;
    if (originalSecret === undefined) delete process.env.EXTRACTOR_SHARED_SECRET;
    else process.env.EXTRACTOR_SHARED_SECRET = originalSecret;
  });

  it('throws at import when PYTHON_EXTRACTOR_URL is set but EXTRACTOR_SHARED_SECRET is not', async () => {
    process.env.PYTHON_EXTRACTOR_URL = 'https://extractor.example.com';
    delete process.env.EXTRACTOR_SHARED_SECRET;
    vi.resetModules();

    await expect(import('../services/pythonExtractor')).rejects.toThrow(
      /PYTHON_EXTRACTOR_URL is set but EXTRACTOR_SHARED_SECRET is not/,
    );
  });

  it('imports cleanly when both PYTHON_EXTRACTOR_URL and EXTRACTOR_SHARED_SECRET are set', async () => {
    process.env.PYTHON_EXTRACTOR_URL = 'https://extractor.example.com';
    process.env.EXTRACTOR_SHARED_SECRET = 'some-secret';
    vi.resetModules();

    await expect(import('../services/pythonExtractor')).resolves.toBeDefined();
  });

  it('imports cleanly when PYTHON_EXTRACTOR_URL is unset (local dev, no secret required)', async () => {
    delete process.env.PYTHON_EXTRACTOR_URL;
    delete process.env.EXTRACTOR_SHARED_SECRET;
    vi.resetModules();

    await expect(import('../services/pythonExtractor')).resolves.toBeDefined();
  });
});
