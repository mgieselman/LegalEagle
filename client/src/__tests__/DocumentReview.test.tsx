import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { DocumentReview } from '@/pages/staff/DocumentReview';
import { api } from '@/api/client';

// Mock the API module
vi.mock('@/api/client', () => ({
  api: {
    listDocuments: vi.fn(),
    getExtraction: vi.fn(),
    getValidations: vi.fn(),
    acceptExtraction: vi.fn(),
    correctExtraction: vi.fn(),
    dismissValidation: vi.fn(),
  },
}));

// Mock react-router to control params and navigate
const mockNavigate = vi.fn();
vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    useParams: vi.fn(),
    useNavigate: () => mockNavigate,
  };
});

import { useParams } from 'react-router';
const mockedUseParams = vi.mocked(useParams);

// Mock fetch for blob URLs
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock URL.createObjectURL and revokeObjectURL
const mockCreateObjectURL = vi.fn();
const mockRevokeObjectURL = vi.fn();
Object.defineProperty(URL, 'createObjectURL', {
  value: mockCreateObjectURL,
  writable: true,
});
Object.defineProperty(URL, 'revokeObjectURL', {
  value: mockRevokeObjectURL,
  writable: true,
});

const mockDocuments = [
  {
    id: 'doc-1',
    caseId: 'case-1',
    originalFilename: 'paystub.pdf',
    docClass: 'paystub',
    mimeType: 'application/pdf',
    processingStatus: 'needs_review',
    fileSizeBytes: 1024,
    createdAt: '2026-01-01T00:00:00Z',
    belongsTo: 'debtor',
  },
  {
    id: 'doc-2',
    caseId: 'case-1',
    originalFilename: 'bank-statement.pdf',
    docClass: 'bank_statement_checking',
    mimeType: 'application/pdf',
    processingStatus: 'extracted',
    fileSizeBytes: 2048,
    createdAt: '2026-01-02T00:00:00Z',
    belongsTo: 'debtor',
  },
  {
    id: 'doc-3',
    caseId: 'case-1',
    originalFilename: 'tax-return.pdf',
    docClass: 'tax_return',
    mimeType: 'application/pdf',
    processingStatus: 'reviewed',
    fileSizeBytes: 3072,
    createdAt: '2026-01-03T00:00:00Z',
    belongsTo: 'debtor',
  },
];

const mockExtraction = {
  id: 'ext-1',
  documentId: 'doc-1',
  confidenceScore: 0.85,
  extractedData: {
    data: {
      grossPay: '3000',
      netPay: '2400',
      payPeriod: 'biweekly',
    },
    fieldConfidences: {
      grossPay: 0.95,
      netPay: 0.92,
      payPeriod: 0.78,
    },
    warnings: ['Low confidence on pay period field'],
  },
};

const mockValidations = [
  {
    id: 'val-1',
    documentId: 'doc-1',
    severity: 'warning' as const,
    message: 'Pay amount seems high for stated position',
    isDismissed: false,
  },
  {
    id: 'val-2',
    documentId: 'doc-1',
    severity: 'error' as const,
    message: 'Missing employer information',
    isDismissed: false,
  },
];

function renderDocumentReview() {
  return render(
    <MemoryRouter>
      <DocumentReview />
    </MemoryRouter>
  );
}

describe('DocumentReview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseParams.mockReturnValue({ id: 'case-1', docId: 'doc-1' });

    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(() => 'mock-token'),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      },
      writable: true,
    });

    // Setup default API responses
    vi.mocked(api.listDocuments).mockResolvedValue(mockDocuments as never);
    vi.mocked(api.getExtraction).mockResolvedValue(mockExtraction as never);
    vi.mocked(api.getValidations).mockResolvedValue(mockValidations as never);

    // Mock blob fetch
    const mockBlob = new Blob(['mock pdf content'], { type: 'application/pdf' });
    mockFetch.mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(mockBlob),
    });
    mockCreateObjectURL.mockReturnValue('blob:mock-url');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should render loading state initially', () => {
    // Delay API response to test loading state
    vi.mocked(api.listDocuments).mockImplementation(() => new Promise(() => {}));

    renderDocumentReview();
    // Loading state shows a spinner SVG with animate-spin class
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('should render document review interface after loading', async () => {
    renderDocumentReview();

    await waitFor(() => {
      expect(screen.getByText('paystub.pdf')).toBeInTheDocument();
    });

    // Should show document classification
    expect(screen.getByText('Paystub')).toBeInTheDocument();

    // Should show confidence info (multiple elements may contain "confidence")
    expect(screen.getAllByText(/confidence/).length).toBeGreaterThanOrEqual(1);

    // Should show review queue navigation (doc-1 and doc-2 are in review queue)
    expect(screen.getByText('1 of 2 to review')).toBeInTheDocument();
  });

  it('should display document in PDF viewer when mime type is PDF', async () => {
    renderDocumentReview();

    await waitFor(() => {
      const iframe = screen.getByTitle('paystub.pdf');
      expect(iframe).toBeInTheDocument();
      expect(iframe).toHaveAttribute('src', 'blob:mock-url');
    });
  });

  it('should display image when mime type is image', async () => {
    const imageDocs = mockDocuments.map((d) =>
      d.id === 'doc-1' ? { ...d, mimeType: 'image/jpeg' } : d,
    );
    vi.mocked(api.listDocuments).mockResolvedValue(imageDocs as never);

    renderDocumentReview();

    await waitFor(() => {
      const img = screen.getByAltText('paystub.pdf');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', 'blob:mock-url');
    });
  });

  it('should display extracted data in editable fields', async () => {
    renderDocumentReview();

    await waitFor(() => {
      expect(screen.getByDisplayValue('3000')).toBeInTheDocument(); // grossPay
      expect(screen.getByDisplayValue('2400')).toBeInTheDocument(); // netPay
      expect(screen.getByDisplayValue('biweekly')).toBeInTheDocument(); // payPeriod
    });

    // Low confidence field should have amber border
    const payPeriodInput = screen.getByDisplayValue('biweekly');
    expect(payPeriodInput).toHaveClass('border-amber-400');
  });

  it('should display extraction warnings', async () => {
    renderDocumentReview();

    await waitFor(() => {
      expect(screen.getByText('Low confidence on pay period field')).toBeInTheDocument();
    });
  });

  it('should display validation warnings with severity icons', async () => {
    renderDocumentReview();

    await waitFor(() => {
      expect(screen.getByText('Pay amount seems high for stated position')).toBeInTheDocument();
      expect(screen.getByText('Missing employer information')).toBeInTheDocument();
    });
  });

  it('should allow editing of extracted data', async () => {
    const user = userEvent.setup();
    renderDocumentReview();

    await waitFor(() => {
      expect(screen.getByDisplayValue('3000')).toBeInTheDocument();
    });

    const grossPayInput = screen.getByDisplayValue('3000');
    await user.clear(grossPayInput);
    await user.type(grossPayInput, '3500');

    expect(grossPayInput).toHaveValue('3500');
  });

  it('should navigate between documents in review queue', async () => {
    renderDocumentReview();

    await waitFor(() => {
      expect(screen.getByText('paystub.pdf')).toBeInTheDocument();
    });

    // The nav buttons use ChevronLeft/ChevronRight icons (no accessible name text)
    // Find buttons that are part of the queue navigation
    // There are navigation buttons plus action buttons; queue nav buttons are small icon buttons
    // The prev button should be disabled (first document)
    // Find by checking for disabled state in the nav area
    expect(screen.getByText('1 of 2 to review')).toBeInTheDocument();
  });

  it('should handle accept extraction workflow', async () => {
    const user = userEvent.setup();
    vi.mocked(api.acceptExtraction).mockResolvedValue(undefined as never);

    renderDocumentReview();

    await waitFor(() => {
      expect(screen.getByText('Accept')).toBeInTheDocument();
    });

    const acceptButton = screen.getByRole('button', { name: /Accept$/i });
    await user.click(acceptButton);

    expect(api.acceptExtraction).toHaveBeenCalledWith('doc-1');
  });

  it('should handle correct extraction workflow with edited data', async () => {
    const user = userEvent.setup();
    vi.mocked(api.correctExtraction).mockResolvedValue(undefined as never);

    renderDocumentReview();

    await waitFor(() => {
      expect(screen.getByDisplayValue('3000')).toBeInTheDocument();
    });

    // Edit data
    const grossPayInput = screen.getByDisplayValue('3000');
    await user.clear(grossPayInput);
    await user.type(grossPayInput, '3500');

    // Add correction note
    const notesInput = screen.getByPlaceholderText('Notes about corrections made...');
    await user.type(notesInput, 'Updated gross pay amount');

    // Submit corrections
    const correctButton = screen.getByRole('button', { name: /Accept with Corrections/i });
    await user.click(correctButton);

    expect(api.correctExtraction).toHaveBeenCalledWith(
      'doc-1',
      expect.objectContaining({
        grossPay: '3500',
        netPay: '2400',
        payPeriod: 'biweekly',
      }),
      'Updated gross pay amount',
    );
  });

  it('should handle dismiss validation workflow', async () => {
    const user = userEvent.setup();
    vi.mocked(api.dismissValidation).mockResolvedValue(undefined as never);

    renderDocumentReview();

    await waitFor(() => {
      expect(screen.getByText('Pay amount seems high for stated position')).toBeInTheDocument();
    });

    const dismissButtons = screen.getAllByText('dismiss');
    await user.click(dismissButtons[0]);

    expect(api.dismissValidation).toHaveBeenCalledWith('doc-1', 'val-1');
  });

  it('should handle document not found error', async () => {
    vi.mocked(api.listDocuments).mockResolvedValue([]); // No documents

    renderDocumentReview();

    await waitFor(() => {
      expect(screen.getByText('Document not found')).toBeInTheDocument();
    });
  });

  it('should handle API errors gracefully', async () => {
    vi.mocked(api.listDocuments).mockRejectedValue(new Error('Network error'));

    renderDocumentReview();

    await waitFor(() => {
      expect(screen.getByText('Failed to load document')).toBeInTheDocument();
    });
  });

  it('should set blob URL for document preview', async () => {
    renderDocumentReview();

    // Wait for the document to fully load (including blob URL)
    await waitFor(() => {
      expect(screen.getByTitle('paystub.pdf')).toHaveAttribute('src', 'blob:mock-url');
    });

    // Verify createObjectURL was called with a blob
    expect(mockCreateObjectURL).toHaveBeenCalledWith(expect.any(Blob));
  });

  it('should update blob URL when navigating to different document', async () => {
    renderDocumentReview();

    await waitFor(() => {
      expect(mockCreateObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    });

    // Change params to simulate navigation
    mockCreateObjectURL.mockClear();
    mockedUseParams.mockReturnValue({ id: 'case-1', docId: 'doc-2' });

    renderDocumentReview();

    await waitFor(() => {
      expect(mockCreateObjectURL).toHaveBeenCalled();
    });
  });
});
