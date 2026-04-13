import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DocumentsPanel } from '@/components/DocumentsPanel';
import { api } from '@/api/client';

// Mock the API module
vi.mock('@/api/client', () => ({
  api: {
    listDocuments: vi.fn(),
    uploadDocument: vi.fn(),
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

  it('should display quality issue badges for documents with warnings', async () => {
    renderDocumentsPanel();

    await waitFor(() => {
      expect(screen.getByText('blurry-scan.pdf')).toBeInTheDocument();
    });

    // Should show warning indicator for blurry document
    expect(screen.getByText(/blurry/i)).toBeInTheDocument();
  });

  it('should display quality issue badges for documents with errors', async () => {
    renderDocumentsPanel();

    await waitFor(() => {
      expect(screen.getByText('duplicate-file.pdf')).toBeInTheDocument();
    });

    // Should show error indicator for duplicate document
    expect(screen.getByText(/duplicate/i)).toBeInTheDocument();
  });

  it('should display quality issue messages inline', async () => {
    renderDocumentsPanel();

    await waitFor(() => {
      expect(screen.getByText('Document appears blurry or low quality. Consider rescanning at higher resolution.')).toBeInTheDocument();
      expect(screen.getByText('Identical file already uploaded as "existing-tax-return.pdf"')).toBeInTheDocument();
    });
  });

  it('should apply warning styling for warning-level quality issues', async () => {
    renderDocumentsPanel();

    await waitFor(() => {
      const warningElement = screen.getByText(/blurry/i).closest('div');
      expect(warningElement).toHaveClass(/warning|amber|yellow/);
    });
  });

  it('should apply error styling for error-level quality issues', async () => {
    renderDocumentsPanel();

    await waitFor(() => {
      const errorElement = screen.getByText(/duplicate/i).closest('div');
      expect(errorElement).toHaveClass(/error|red|destructive/);
    });
  });

  describe('Client-side file validation', () => {
    it('should validate file size limits', async () => {
      const user = userEvent.setup();
      renderDocumentsPanel();

      await waitFor(() => {
        expect(screen.getByText('Upload Documents')).toBeInTheDocument();
      });

      // Create a mock file that's too large (> 50MB)
      const oversizedFile = new File(['x'.repeat(51 * 1024 * 1024)], 'large.pdf', { type: 'application/pdf' });
      
      const fileInput = screen.getByLabelText(/upload|choose files/i);
      await user.upload(fileInput, oversizedFile);

      // Should show size validation error
      await waitFor(() => {
        expect(screen.getByText(/file size exceeds|too large/i)).toBeInTheDocument();
      });

      expect(api.uploadDocument).not.toHaveBeenCalled();
    });

    it('should validate supported file extensions', async () => {
      const user = userEvent.setup();
      renderDocumentsPanel();

      await waitFor(() => {
        expect(screen.getByText('Upload Documents')).toBeInTheDocument();
      });

      // Create a mock file with unsupported extension
      const unsupportedFile = new File(['content'], 'document.txt', { type: 'text/plain' });
      
      const fileInput = screen.getByLabelText(/upload|choose files/i);
      await user.upload(fileInput, unsupportedFile);

      // Should show extension validation error
      await waitFor(() => {
        expect(screen.getByText(/unsupported file type|invalid extension/i)).toBeInTheDocument();
      });

      expect(api.uploadDocument).not.toHaveBeenCalled();
    });

    it('should detect duplicate filenames', async () => {
      const user = userEvent.setup();
      renderDocumentsPanel();

      await waitFor(() => {
        expect(screen.getByText('paystub.pdf')).toBeInTheDocument();
      });

      // Try to upload file with same name as existing document
      const duplicateFile = new File(['content'], 'paystub.pdf', { type: 'application/pdf' });
      
      const fileInput = screen.getByLabelText(/upload|choose files/i);
      await user.upload(fileInput, duplicateFile);

      // Should show duplicate filename warning
      await waitFor(() => {
        expect(screen.getByText(/file with this name already exists|duplicate filename/i)).toBeInTheDocument();
      });

      // Should still allow upload but with warning
      expect(api.uploadDocument).toHaveBeenCalled();
    });

    it('should allow valid file uploads', async () => {
      const user = userEvent.setup();
      vi.mocked(api.uploadDocument).mockResolvedValue({
        id: 'new-doc-id',
        originalFilename: 'valid-document.pdf',
        qualityIssues: [],
      });

      renderDocumentsPanel();

      await waitFor(() => {
        expect(screen.getByText('Upload Documents')).toBeInTheDocument();
      });

      const validFile = new File(['content'], 'valid-document.pdf', { type: 'application/pdf' });
      
      const fileInput = screen.getByLabelText(/upload|choose files/i);
      await user.upload(fileInput, validFile);

      await waitFor(() => {
        expect(api.uploadDocument).toHaveBeenCalledWith(
          'case-1',
          expect.any(FormData)
        );
      });
    });

    it('should validate multiple files at once', async () => {
      const user = userEvent.setup();
      renderDocumentsPanel();

      await waitFor(() => {
        expect(screen.getByText('Upload Documents')).toBeInTheDocument();
      });

      const validFile = new File(['content'], 'valid.pdf', { type: 'application/pdf' });
      const oversizedFile = new File(['x'.repeat(51 * 1024 * 1024)], 'large.pdf', { type: 'application/pdf' });
      const unsupportedFile = new File(['content'], 'doc.txt', { type: 'text/plain' });
      
      const fileInput = screen.getByLabelText(/upload|choose files/i);
      await user.upload(fileInput, [validFile, oversizedFile, unsupportedFile]);

      // Should show multiple validation errors
      await waitFor(() => {
        expect(screen.getByText(/too large/i)).toBeInTheDocument();
        expect(screen.getByText(/unsupported file type/i)).toBeInTheDocument();
      });

      // Should only upload the valid file
      expect(api.uploadDocument).toHaveBeenCalledTimes(1);
    });
  });

  describe('Quality issue display and interaction', () => {
    it('should show quality issues in expanded view', async () => {
      renderDocumentsPanel();

      await waitFor(() => {
        expect(screen.getByText('blurry-scan.pdf')).toBeInTheDocument();
      });

      // Click to expand document details
      const expandButton = screen.getAllByRole('button', { name: /expand|details/i })[1]; // Second document
      await userEvent.setup().click(expandButton);

      // Should show detailed quality issue information
      await waitFor(() => {
        expect(screen.getByText('Document appears blurry or low quality. Consider rescanning at higher resolution.')).toBeInTheDocument();
      });
    });

    it('should indicate retryable quality issues', async () => {
      renderDocumentsPanel();

      await waitFor(() => {
        const retryableIssue = screen.getByText(/blurry/i).closest('[data-testid="quality-issue"]');
        expect(retryableIssue).toHaveAttribute('data-can-retry', 'true');
      });
    });

    it('should indicate non-retryable quality issues', async () => {
      renderDocumentsPanel();

      await waitFor(() => {
        const nonRetryableIssue = screen.getByText(/duplicate/i).closest('[data-testid="quality-issue"]');
        expect(nonRetryableIssue).toHaveAttribute('data-can-retry', 'false');
      });
    });

    it('should provide contextual help for quality issues', async () => {
      renderDocumentsPanel();

      await waitFor(() => {
        // Should show help icon or tooltip for quality issues
        const helpIcon = screen.getByRole('button', { name: /help|info/i });
        expect(helpIcon).toBeInTheDocument();
      });
    });

    it('should allow reupload for retryable quality issues', async () => {
      renderDocumentsPanel();

      await waitFor(() => {
        expect(screen.getByText('blurry-scan.pdf')).toBeInTheDocument();
      });

      // Should show reupload option for retryable issues (blur)
      const reuploadButton = screen.getByRole('button', { name: /reupload|replace/i });
      expect(reuploadButton).toBeInTheDocument();
      expect(reuploadButton).not.toBeDisabled();
    });

    it('should not allow reupload for non-retryable quality issues', async () => {
      renderDocumentsPanel();

      await waitFor(() => {
        expect(screen.getByText('duplicate-file.pdf')).toBeInTheDocument();
      });

      // For duplicate file, reupload should not be offered or should be disabled
      const duplicateRow = screen.getByText('duplicate-file.pdf').closest('tr');
      const reuploadButton = duplicateRow?.querySelector('[data-testid="reupload-button"]');
      
      if (reuploadButton) {
        expect(reuploadButton).toBeDisabled();
      } else {
        // Reupload option should not be present for duplicates
        expect(duplicateRow).not.toHaveTextContent(/reupload|replace/i);
      }
    });
  });

  describe('Quality issue filtering and sorting', () => {
    it('should filter documents by quality issue status', async () => {
      renderDocumentsPanel();

      await waitFor(() => {
        expect(screen.getByText('paystub.pdf')).toBeInTheDocument();
      });

      // Apply filter to show only documents with quality issues
      const filterButton = screen.getByRole('button', { name: /filter|quality issues/i });
      await userEvent.setup().click(filterButton);

      // Should only show documents with quality issues
      await waitFor(() => {
        expect(screen.getByText('blurry-scan.pdf')).toBeInTheDocument();
        expect(screen.getByText('duplicate-file.pdf')).toBeInTheDocument();
        expect(screen.queryByText('paystub.pdf')).not.toBeInTheDocument();
      });
    });

    it('should show quality issue count in filter badge', async () => {
      renderDocumentsPanel();

      await waitFor(() => {
        // Should show count of documents with quality issues
        expect(screen.getByText('2')).toBeInTheDocument(); // 2 documents with issues
      });
    });

    it('should sort by quality issue severity', async () => {
      renderDocumentsPanel();

      await waitFor(() => {
        expect(screen.getByText('blurry-scan.pdf')).toBeInTheDocument();
      });

      // Sort by severity (errors first)
      const sortButton = screen.getByRole('button', { name: /sort.*severity/i });
      await userEvent.setup().click(sortButton);

      // Error documents should appear first
      const documentRows = screen.getAllByRole('row');
      const errorDocIndex = documentRows.findIndex(row => row.textContent?.includes('duplicate-file.pdf'));
      const warningDocIndex = documentRows.findIndex(row => row.textContent?.includes('blurry-scan.pdf'));
      
      expect(errorDocIndex).toBeLessThan(warningDocIndex);
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
      expect(screen.getByText('paystub.pdf')).toBeInTheDocument();
    });

    // Should not show any quality issue indicators
    expect(screen.queryByText(/warning|error|quality issue/i)).not.toBeInTheDocument();
  });

  it('should handle missing qualityIssues property', async () => {
    const documentsWithoutProperty = [
      {
        ...mockDocuments[0],
        // qualityIssues property omitted
      },
    ];
    
    vi.mocked(api.listDocuments).mockResolvedValue(documentsWithoutProperty);
    
    renderDocumentsPanel();

    await waitFor(() => {
      expect(screen.getByText('paystub.pdf')).toBeInTheDocument();
    });

    // Should handle gracefully without crashing
    expect(screen.queryByText(/warning|error|quality issue/i)).not.toBeInTheDocument();
  });
});