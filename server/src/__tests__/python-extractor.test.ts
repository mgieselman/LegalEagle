import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock global fetch before imports
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

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
  field_confidences: { employer_name: 0.95, gross_pay: 0.92, net_pay: 0.90 },
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

  it('throws on non-OK response', async () => {
    mockFetch.mockResolvedValueOnce(makeErrorResponse(500, 'Internal Server Error'));

    await expect(
      callPythonExtractor(Buffer.from('content'), 'doc.pdf', 'application/pdf'),
    ).rejects.toThrow('Python extractor returned 500');
  });

  it('throws on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

    await expect(
      callPythonExtractor(Buffer.from('content'), 'doc.pdf', 'application/pdf'),
    ).rejects.toThrow('Connection refused');
  });
});

describe('isPythonExtractorAvailable', () => {
  beforeEach(() => {
    mockFetch.mockReset();
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
});
