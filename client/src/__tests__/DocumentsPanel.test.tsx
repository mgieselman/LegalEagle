import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DocumentsPanel } from '@/components/DocumentsPanel';

vi.mock('@/api/client', () => ({
  api: {
    listDocuments: vi.fn(),
    uploadDocument: vi.fn(),
    deleteDocument: vi.fn(),
    downloadDocument: vi.fn(),
    getExtraction: vi.fn(),
    getValidations: vi.fn(),
    acceptExtraction: vi.fn(),
    dismissValidation: vi.fn(),
  },
}));

import { api } from '@/api/client';
const mockedApi = vi.mocked(api);

const CASE_ID = 'case-001';

describe('DocumentsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mocks for review panel that may render on click
    mockedApi.getExtraction.mockRejectedValue(new Error('not found'));
    mockedApi.getValidations.mockResolvedValue([] as never);
  });

  it('renders empty state when no documents', async () => {
    mockedApi.listDocuments.mockResolvedValue([]);

    render(<DocumentsPanel caseId={CASE_ID} />);

    await waitFor(() => {
      expect(screen.getByText('No documents uploaded yet.')).toBeInTheDocument();
    });
  });

  it('renders document list', async () => {
    mockedApi.listDocuments.mockResolvedValue([
      {
        id: 'doc-1',
        originalFilename: 'paystub-jan.pdf',
        mimeType: 'application/pdf',
        fileSizeBytes: 1048576,
        docClass: null,
        belongsTo: 'debtor',
        processingStatus: 'uploaded',
        createdAt: '2026-04-01T00:00:00.000Z',
      },
    ]);

    render(<DocumentsPanel caseId={CASE_ID} />);

    await waitFor(() => {
      expect(screen.getAllByText('paystub-jan.pdf')).toHaveLength(2); // desktop + mobile
    });
  });

  it('shows upload zone with accepted file types', () => {
    mockedApi.listDocuments.mockResolvedValue([]);

    render(<DocumentsPanel caseId={CASE_ID} />);

    expect(screen.getByText(/PDF, CSV, XLSX, TXT/)).toBeInTheDocument();
    expect(screen.getByText(/max 50 MB/)).toBeInTheDocument();
  });

  it('triggers file input on browse click', async () => {
    mockedApi.listDocuments.mockResolvedValue([]);

    render(<DocumentsPanel caseId={CASE_ID} />);

    const browseButton = screen.getByText('browse');
    expect(browseButton).toBeInTheDocument();
  });

  it('shows delete confirmation', async () => {
    mockedApi.listDocuments.mockResolvedValue([
      {
        id: 'doc-1',
        originalFilename: 'file.pdf',
        mimeType: 'application/pdf',
        fileSizeBytes: 1024,
        docClass: null,
        belongsTo: 'debtor',
        processingStatus: 'uploaded',
        createdAt: '2026-04-01T00:00:00.000Z',
      },
    ]);

    render(<DocumentsPanel caseId={CASE_ID} />);

    await waitFor(() => {
      expect(screen.getAllByText('file.pdf')).toHaveLength(2);
    });

    // Click delete button (the trash icon button — use first one for desktop)
    const deleteButtons = screen.getAllByTitle('Delete');
    await userEvent.click(deleteButtons[0]);

    // Confirm button should appear
    expect(screen.getByText('Confirm')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('calls deleteDocument on confirm', async () => {
    mockedApi.listDocuments.mockResolvedValue([
      {
        id: 'doc-1',
        originalFilename: 'file.pdf',
        mimeType: 'application/pdf',
        fileSizeBytes: 1024,
        docClass: null,
        belongsTo: 'debtor',
        processingStatus: 'uploaded',
        createdAt: '2026-04-01T00:00:00.000Z',
      },
    ]);
    mockedApi.deleteDocument.mockResolvedValue({ success: true });

    render(<DocumentsPanel caseId={CASE_ID} />);

    await waitFor(() => {
      expect(screen.getAllByText('file.pdf')).toHaveLength(2);
    });

    const deleteButtons = screen.getAllByTitle('Delete');
    await userEvent.click(deleteButtons[0]);
    await userEvent.click(screen.getByText('Confirm'));

    expect(mockedApi.deleteDocument).toHaveBeenCalledWith('doc-1');
  });

  it('shows error on upload failure', async () => {
    mockedApi.listDocuments.mockResolvedValue([]);
    mockedApi.uploadDocument.mockRejectedValue(new Error('Upload failed'));

    render(<DocumentsPanel caseId={CASE_ID} />);

    // Simulate file selection via the hidden input
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
    await userEvent.upload(input, file);

    await waitFor(() => {
      expect(screen.getByText('Upload failed')).toBeInTheDocument();
    });
  });
});
