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
  },
  {
    id: 'doc-2',
    caseId: 'case-1',
    originalFilename: 'bank-statement.pdf',
    docClass: 'bank_statement_checking',
    mimeType: 'application/pdf',
    processingStatus: 'extracted',
  },
  {
    id: 'doc-3',
    caseId: 'case-1',
    originalFilename: 'tax-return.pdf',
    docClass: 'tax_return',
    mimeType: 'application/pdf',
    processingStatus: 'reviewed',
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

function renderDocumentReview(caseId = 'case-1', docId = 'doc-1') {
  return render(
    <MemoryRouter initialEntries={[`/staff/case/${caseId}/documents/${docId}`]}>
      <DocumentReview />
    </MemoryRouter>
  );
}

describe('DocumentReview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    vi.mocked(api.listDocuments).mockResolvedValue(mockDocuments);
    vi.mocked(api.getExtraction).mockResolvedValue(mockExtraction);
    vi.mocked(api.getValidations).mockResolvedValue(mockValidations);
    
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
    expect(screen.getByText(/loading/i) || screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('should render document review interface after loading', async () => {
    renderDocumentReview();
    
    await waitFor(() => {
      expect(screen.getByText('paystub.pdf')).toBeInTheDocument();
    });

    // Should show document classification
    expect(screen.getByText('Paystub')).toBeInTheDocument();
    
    // Should show confidence score
    expect(screen.getByText(/confidence/)).toBeInTheDocument();
    
    // Should show review queue navigation
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
    const imageDoc = { ...mockDocuments[0], mimeType: 'image/jpeg' };
    vi.mocked(api.listDocuments).mockResolvedValue([imageDoc, ...mockDocuments.slice(1)]);
    
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
    userEvent.setup();
    renderDocumentReview();
    
    await waitFor(() => {
      expect(screen.getByText('paystub.pdf')).toBeInTheDocument();
    });

    const nextButton = screen.getByRole('button', { name: /chevron-right/i });
    expect(nextButton).not.toBeDisabled();
    
    const prevButton = screen.getByRole('button', { name: /chevron-left/i });
    expect(prevButton).toBeDisabled(); // First document
  });

  it('should handle accept extraction workflow', async () => {
    userEvent.setup();
    vi.mocked(api.acceptExtraction).mockResolvedValue();
    
    renderDocumentReview();
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Accept/i })).toBeInTheDocument();
    });

    const acceptButton = screen.getByRole('button', { name: /Accept/i });
    await user.click(acceptButton);
    
    expect(api.acceptExtraction).toHaveBeenCalledWith('doc-1');
  });

  it('should handle correct extraction workflow with edited data', async () => {
    const user = userEvent.setup();
    vi.mocked(api.correctExtraction).mockResolvedValue();
    
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
      'Updated gross pay amount'
    );
  });

  it('should handle dismiss validation workflow', async () => {
    const user = userEvent.setup();
    vi.mocked(api.dismissValidation).mockResolvedValue();
    
    renderDocumentReview();
    
    await waitFor(() => {
      expect(screen.getByText('Pay amount seems high for stated position')).toBeInTheDocument();
    });

    const dismissButton = screen.getAllByText('dismiss')[0];
    await user.click(dismissButton);
    
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

  it('should clean up blob URLs on unmount', () => {
    const { unmount } = renderDocumentReview();
    
    unmount();
    
    expect(mockRevokeObjectURL).toHaveBeenCalled();
  });

  it('should update blob URL when navigating to different document', async () => {
    // Test that blob URLs are properly managed during navigation
    renderDocumentReview();
    
    await waitFor(() => {
      expect(mockCreateObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    });

    // When component re-renders with different document, old URL should be revoked
    renderDocumentReview('case-1', 'doc-2'); // Different document
    
    await waitFor(() => {
      expect(mockRevokeObjectURL).toHaveBeenCalled();
    });
  });
});