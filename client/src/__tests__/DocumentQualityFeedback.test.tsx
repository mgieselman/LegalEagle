import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { DocumentsPanel } from '@/components/DocumentsPanel';
import { api } from '@/api/client';

// Mock the API module
vi.mock('@/api/client', () => ({
  api: {
    listDocuments: vi.fn(),
    uploadDocument: vi.fn(),
    deleteDocument: vi.fn(),
    downloadDocument: vi.fn(),
    processDocument: vi.fn(),
    autofillForm: vi.fn(),
  },
}));

const mockDocuments = [
  {
    id: 'doc-1',
    caseId: 'case-1',
    originalFilename: 'paystub.pdf',
    docClass: 'paystub',
    mimeType: 'application/pdf',
    processingStatus: 'reviewed',
    qualityIssues: [],
    fileSizeBytes: 102400,
    createdAt: '2024-01-15T10:00:00Z',
  },
  {
    id: 'doc-2',
    caseId: 'case-1',
    originalFilename: 'blurry-scan.pdf',
    docClass: 'bank_statement_checking',
    mimeType: 'application/pdf',
    processingStatus: 'extracted',
    qualityIssues: [
      {
        type: 'blurry',
        message: 'Document appears blurry or low quality. Consider rescanning at higher resolution.',
        severity: 'warning',
        canRetry: true,
      },
    ],
    fileSizeBytes: 204800,
    createdAt: '2024-01-16T10:00:00Z',
  },
  {
    id: 'doc-3',
    caseId: 'case-1',
    originalFilename: 'duplicate-file.pdf',
    docClass: 'tax_return',
    mimeType: 'application/pdf',
    processingStatus: 'extracted',
    qualityIssues: [
      {
        type: 'duplicate',
        message: 'Identical file already uploaded as "existing-tax-return.pdf"',
        severity: 'error',
        canRetry: false,
      },
    ],
    fileSizeBytes: 51200,
    createdAt: '2024-01-17T10:00:00Z',
  },
];

function renderDocumentsPanel(caseId = 'case-1') {
  return render(<DocumentsPanel caseId={caseId} />);
}

describe('DocumentsPanel Quality Feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.listDocuments).mockResolvedValue(mockDocuments);
  });

  it('should display quality issue type badges for documents with warnings', async () => {
    renderDocumentsPanel();

    await waitFor(() => {
      // Both desktop and mobile layouts render, so use getAllByText
      expect(screen.getAllByText('blurry-scan.pdf').length).toBeGreaterThan(0);
    });

    // Should show warning type label for blurry document (rendered in both layouts)
    expect(screen.getAllByText('blurry').length).toBeGreaterThan(0);
  });

  it('should display quality issue type badges for documents with errors', async () => {
    renderDocumentsPanel();

    await waitFor(() => {
      expect(screen.getAllByText('duplicate-file.pdf').length).toBeGreaterThan(0);
    });

    // Should show error type label for duplicate document
    expect(screen.getAllByText('duplicate').length).toBeGreaterThan(0);
  });

  it('should display quality issue messages in title attributes', async () => {
    renderDocumentsPanel();

    await waitFor(() => {
      expect(screen.getAllByText('blurry').length).toBeGreaterThan(0);
    });

    // Messages are in title attributes of the badge elements
    const blurryBadges = screen.getAllByText('blurry');
    const blurryBadge = blurryBadges[0].closest('div[title]');
    expect(blurryBadge).toHaveAttribute(
      'title',
      'Document appears blurry or low quality. Consider rescanning at higher resolution.'
    );

    const duplicateBadges = screen.getAllByText('duplicate');
    const duplicateBadge = duplicateBadges[0].closest('div[title]');
    expect(duplicateBadge).toHaveAttribute(
      'title',
      'Identical file already uploaded as "existing-tax-return.pdf"'
    );
  });

  it('should apply warning styling for warning-level quality issues', async () => {
    renderDocumentsPanel();

    await waitFor(() => {
      const warningBadge = screen.getAllByText('blurry')[0].closest('div');
      expect(warningBadge).toHaveClass('bg-amber-100', 'text-amber-800');
    });
  });

  it('should apply error styling for error-level quality issues', async () => {
    renderDocumentsPanel();

    await waitFor(() => {
      const errorBadge = screen.getAllByText('duplicate')[0].closest('div');
      expect(errorBadge).toHaveClass('bg-red-100', 'text-red-800');
    });
  });

  it('should handle empty quality issues array', async () => {
    const documentsWithoutIssues = [
      {
        ...mockDocuments[0],
        qualityIssues: [],
      },
    ];

    vi.mocked(api.listDocuments).mockResolvedValue(documentsWithoutIssues);

    renderDocumentsPanel();

    await waitFor(() => {
      expect(screen.getAllByText('paystub.pdf').length).toBeGreaterThan(0);
    });

    // Should not show any quality issue badges
    expect(screen.queryByText('blurry')).not.toBeInTheDocument();
    expect(screen.queryByText('duplicate')).not.toBeInTheDocument();
  });

  it('should handle missing qualityIssues property', async () => {
    const documentsWithoutProperty = [
      {
        id: 'doc-1',
        caseId: 'case-1',
        originalFilename: 'paystub.pdf',
        docClass: 'paystub',
        mimeType: 'application/pdf',
        processingStatus: 'reviewed',
        fileSizeBytes: 102400,
        createdAt: '2024-01-15T10:00:00Z',
        // qualityIssues property omitted
      },
    ];

    vi.mocked(api.listDocuments).mockResolvedValue(documentsWithoutProperty);

    renderDocumentsPanel();

    await waitFor(() => {
      expect(screen.getAllByText('paystub.pdf').length).toBeGreaterThan(0);
    });

    // Should handle gracefully without crashing
    expect(screen.queryByText('blurry')).not.toBeInTheDocument();
  });

  it('should render drop zone for file uploads', async () => {
    renderDocumentsPanel();

    await waitFor(() => {
      expect(screen.getAllByText('paystub.pdf').length).toBeGreaterThan(0);
    });

    // Drop zone should be present with "browse" label
    expect(screen.getByText(/browse/i)).toBeInTheDocument();
    expect(screen.getByText(/drag and drop/i)).toBeInTheDocument();
  });

  it('should display document list with file names', async () => {
    renderDocumentsPanel();

    await waitFor(() => {
      // Both desktop table and mobile cards render; use getAllByText
      expect(screen.getAllByText('paystub.pdf').length).toBeGreaterThan(0);
      expect(screen.getAllByText('blurry-scan.pdf').length).toBeGreaterThan(0);
      expect(screen.getAllByText('duplicate-file.pdf').length).toBeGreaterThan(0);
    });
  });

  it('should display no documents message when list is empty', async () => {
    vi.mocked(api.listDocuments).mockResolvedValue([]);

    renderDocumentsPanel();

    await waitFor(() => {
      expect(screen.getByText(/no documents uploaded/i)).toBeInTheDocument();
    });
  });

  it('should call listDocuments on mount', async () => {
    renderDocumentsPanel();

    await waitFor(() => {
      expect(api.listDocuments).toHaveBeenCalledWith('case-1');
    });
  });

  it('should display error when loading fails', async () => {
    vi.mocked(api.listDocuments).mockRejectedValue(new Error('Network error'));

    renderDocumentsPanel();

    await waitFor(() => {
      expect(screen.getByText(/failed to load documents/i)).toBeInTheDocument();
    });
  });
});
