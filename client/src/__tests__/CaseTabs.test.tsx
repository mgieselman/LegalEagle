import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { DocumentsTab } from '@/components/case/DocumentsTab';
import { ReviewTab } from '@/components/case/ReviewTab';
import { QuestionnaireTab } from '@/components/case/QuestionnaireTab';
import { CaseProvider } from '@/context/CaseContext';

// Mock the API client  
vi.mock('@/api/client', () => ({
  api: {
    getCase: vi.fn(),
    clientGetCase: vi.fn(),
    autofillAndMerge: vi.fn(),
    getReviewSummary: vi.fn(),
    listDocuments: vi.fn(),
    uploadDocument: vi.fn(),
    deleteDocument: vi.fn(),
    processDocument: vi.fn(),
    autofillForm: vi.fn(),
  },
}));

// Mock FormShell component
vi.mock('@/components/FormShell', () => ({
  FormShell: ({ caseId, mode, questionnaireData }: Record<string, unknown>) => (
    <div data-testid="form-shell">
      <p data-testid="form-case-id">Case ID: {caseId as string}</p>
      <p data-testid="form-mode">Mode: {mode as string}</p>
      <p data-testid="form-questionnaire">
        Questionnaire: {questionnaireData ? (questionnaireData as { name: string }).name : 'none'}
      </p>
    </div>
  ),
}));

// Mock DocumentsPanel component (heavy component with many deps)
vi.mock('@/components/DocumentsPanel', () => ({
  DocumentsPanel: ({ caseId, onAutofillAction }: { caseId: string; onAutofillAction?: () => Promise<void> }) => (
    <div data-testid="documents-panel">
      <p data-testid="docs-case-id">Case ID: {caseId}</p>
      {onAutofillAction && (
        <button data-testid="autofill-button" onClick={() => onAutofillAction()}>
          Autofill
        </button>
      )}
    </div>
  ),
}));

import { api } from '@/api/client';
const mockedApi = vi.mocked(api);

const mockCaseData = {
  id: 'case-1',
  clientId: 'client-1',
  client: { id: 'client-1', firstName: 'John', lastName: 'Doe' },
  chapter: '7',
  status: 'intake' as const,
  filingDate: null,
  filingDistrict: null,
  householdSize: 2,
  isJointFiling: false,
  createdAt: '2026-01-01T00:00:00Z',
  questionnaire: {
    id: 'quest-1',
    name: 'Test Questionnaire',
    data: { fullName: 'John Doe' },
    version: 1,
  },
};

describe('Case Tab Components', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('DocumentsTab', () => {
    it('renders page header and DocumentsPanel', async () => {
      mockedApi.getCase.mockResolvedValue(mockCaseData);

      render(
        <MemoryRouter>
          <CaseProvider caseId="case-1" clientMode={false}>
            <DocumentsTab />
          </CaseProvider>
        </MemoryRouter>
      );

      await screen.findByTestId('documents-panel');
      expect(screen.getByText('Documents')).toBeInTheDocument();
      expect(screen.getByTestId('docs-case-id')).toHaveTextContent('Case ID: case-1');
    });

    it('passes autofill action to DocumentsPanel', async () => {
      mockedApi.getCase.mockResolvedValue(mockCaseData);

      render(
        <MemoryRouter>
          <CaseProvider caseId="case-1" clientMode={false}>
            <DocumentsTab />
          </CaseProvider>
        </MemoryRouter>
      );

      await screen.findByTestId('documents-panel');
      expect(screen.getByTestId('autofill-button')).toBeInTheDocument();
    });

    it('calls autofillAndMerge and refetch on autofill action', async () => {
      mockedApi.getCase.mockResolvedValue(mockCaseData);
      mockedApi.autofillAndMerge.mockResolvedValue({ filledFields: ['fullName'], skippedFields: [] });

      render(
        <MemoryRouter>
          <CaseProvider caseId="case-1" clientMode={false}>
            <DocumentsTab />
          </CaseProvider>
        </MemoryRouter>
      );

      await screen.findByTestId('documents-panel');
      screen.getByTestId('autofill-button').click();

      await waitFor(() => {
        expect(mockedApi.autofillAndMerge).toHaveBeenCalledWith('case-1');
      });
    });
  });

  describe('ReviewTab', () => {
    it('renders loading state initially', async () => {
      mockedApi.getCase.mockResolvedValue(mockCaseData);
      mockedApi.getReviewSummary.mockImplementation(() => new Promise(() => {})); // never resolves

      render(
        <MemoryRouter>
          <CaseProvider caseId="case-1" clientMode={false}>
            <ReviewTab />
          </CaseProvider>
        </MemoryRouter>
      );

      // Should show loading spinner (Loader2 with animate-spin)
      await waitFor(() => {
        expect(document.querySelector('.animate-spin')).toBeInTheDocument();
      });
    });

    it('renders review summary with extraction queue', async () => {
      mockedApi.getCase.mockResolvedValue(mockCaseData);
      mockedApi.getReviewSummary.mockResolvedValue({
        extractionQueue: [
          { id: 'doc-1', originalFilename: 'paystub.pdf', docClass: 'payStub.us', processingStatus: 'needs_review', classificationConfidence: 0.95, createdAt: '2026-01-01' },
        ],
        validationWarnings: [],
        counts: { extraction: 1, validation: 0 },
      });

      render(
        <MemoryRouter>
          <CaseProvider caseId="case-1" clientMode={false}>
            <ReviewTab />
          </CaseProvider>
        </MemoryRouter>
      );

      await screen.findByText('paystub.pdf');
      expect(screen.getByText('Review')).toBeInTheDocument();
      expect(screen.getByText('Needs Review')).toBeInTheDocument();
      expect(screen.getByText('1 document')).toBeInTheDocument();
    });

    it('renders validation warnings', async () => {
      mockedApi.getCase.mockResolvedValue(mockCaseData);
      mockedApi.getReviewSummary.mockResolvedValue({
        extractionQueue: [],
        validationWarnings: [
          { id: 'val-1', validationType: 'internal_consistency', severity: 'warning' as const, message: 'Income inconsistency detected', isDismissed: false },
        ],
        counts: { extraction: 0, validation: 1 },
      });

      render(
        <MemoryRouter>
          <CaseProvider caseId="case-1" clientMode={false}>
            <ReviewTab />
          </CaseProvider>
        </MemoryRouter>
      );

      await screen.findByText('Income inconsistency detected');
      expect(screen.getByText('1 warning')).toBeInTheDocument();
    });

    it('renders empty state when no items', async () => {
      mockedApi.getCase.mockResolvedValue(mockCaseData);
      mockedApi.getReviewSummary.mockResolvedValue({
        extractionQueue: [],
        validationWarnings: [],
        counts: { extraction: 0, validation: 0 },
      });

      render(
        <MemoryRouter>
          <CaseProvider caseId="case-1" clientMode={false}>
            <ReviewTab />
          </CaseProvider>
        </MemoryRouter>
      );

      await screen.findByText('Everything looks good');
    });

    it('renders error state with retry', async () => {
      mockedApi.getCase.mockResolvedValue(mockCaseData);
      mockedApi.getReviewSummary.mockRejectedValue(new Error('Network error'));

      render(
        <MemoryRouter>
          <CaseProvider caseId="case-1" clientMode={false}>
            <ReviewTab />
          </CaseProvider>
        </MemoryRouter>
      );

      await screen.findByText('Failed to load review summary');
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });
  });

  describe('QuestionnaireTab', () => {
    it('renders FormShell with correct props in staff mode', async () => {
      mockedApi.getCase.mockResolvedValue(mockCaseData);

      render(
        <CaseProvider caseId="case-1" clientMode={false}>
          <QuestionnaireTab mode="staff" />
        </CaseProvider>
      );

      await screen.findByTestId('form-shell');
      
      expect(screen.getByTestId('form-case-id')).toHaveTextContent('Case ID: case-1');
      expect(screen.getByTestId('form-mode')).toHaveTextContent('Mode: staff');
      expect(screen.getByTestId('form-questionnaire')).toHaveTextContent('Questionnaire: Test Questionnaire');
    });

    it('renders FormShell with correct props in client mode', async () => {
      mockedApi.clientGetCase.mockResolvedValue(mockCaseData);

      render(
        <CaseProvider caseId="case-1" clientMode={true}>
          <QuestionnaireTab mode="client" />
        </CaseProvider>
      );

      await screen.findByTestId('form-shell');
      
      expect(screen.getByTestId('form-case-id')).toHaveTextContent('Case ID: case-1');
      expect(screen.getByTestId('form-mode')).toHaveTextContent('Mode: client');
      expect(screen.getByTestId('form-questionnaire')).toHaveTextContent('Questionnaire: Test Questionnaire');
    });

    it('passes undefined questionnaire when none exists', async () => {
      const caseDataNoQuestionnaire = {
        ...mockCaseData,
        questionnaire: null,
      };
      mockedApi.getCase.mockResolvedValue(caseDataNoQuestionnaire);

      render(
        <CaseProvider caseId="case-1" clientMode={false}>
          <QuestionnaireTab mode="staff" />
        </CaseProvider>
      );

      await screen.findByTestId('form-shell');
      
      expect(screen.getByTestId('form-questionnaire')).toHaveTextContent('Questionnaire: none');
    });

    it('uses caseId from context', async () => {
      mockedApi.getCase.mockResolvedValue(mockCaseData);

      render(
        <CaseProvider caseId="different-case-id" clientMode={false}>
          <QuestionnaireTab mode="staff" />
        </CaseProvider>
      );

      expect(mockedApi.getCase).toHaveBeenCalledWith('different-case-id');
      
      await screen.findByTestId('form-shell');
      expect(screen.getByTestId('form-case-id')).toHaveTextContent('Case ID: different-case-id');
    });

    it('works with both staff and client context modes', async () => {
      // Test staff mode context
      mockedApi.getCase.mockResolvedValue(mockCaseData);

      const { unmount } = render(
        <CaseProvider caseId="case-1" clientMode={false}>
          <QuestionnaireTab mode="staff" />
        </CaseProvider>
      );

      await screen.findByTestId('form-shell');
      expect(mockedApi.getCase).toHaveBeenCalledWith('case-1');

      unmount();
      vi.clearAllMocks();

      // Test client mode context
      mockedApi.clientGetCase.mockResolvedValue(mockCaseData);

      render(
        <CaseProvider caseId="case-1" clientMode={true}>
          <QuestionnaireTab mode="client" />
        </CaseProvider>
      );

      await screen.findByTestId('form-shell');
      expect(mockedApi.clientGetCase).toHaveBeenCalledWith('case-1');
    });

    it('handles questionnaire data structure correctly', async () => {
      const complexQuestionnaireData = {
        ...mockCaseData,
        questionnaire: {
          id: 'complex-quest',
          name: 'Complex Questionnaire',
          data: {
            section1: { complete: true },
            section2: { complete: false },
            personalInfo: { name: 'John', age: 30 },
          },
          version: 1,
        },
      };
      mockedApi.getCase.mockResolvedValue(complexQuestionnaireData);

      render(
        <CaseProvider caseId="case-1" clientMode={false}>
          <QuestionnaireTab mode="staff" />
        </CaseProvider>
      );

      await screen.findByTestId('form-shell');
      expect(screen.getByTestId('form-questionnaire')).toHaveTextContent('Questionnaire: Complex Questionnaire');
    });
  });

  describe('Tab Layout Consistency', () => {
    it('DocumentsTab uses consistent spacing classes', async () => {
      mockedApi.getCase.mockResolvedValue(mockCaseData);

      const { container } = render(
        <MemoryRouter>
          <CaseProvider caseId="case-1" clientMode={false}>
            <DocumentsTab />
          </CaseProvider>
        </MemoryRouter>
      );

      await screen.findByTestId('documents-panel');
      const outerDiv = container.firstChild as HTMLElement;
      expect(outerDiv).toHaveClass('p-6', 'space-y-6');
    });

    it('ReviewTab uses consistent spacing classes', async () => {
      mockedApi.getCase.mockResolvedValue(mockCaseData);
      mockedApi.getReviewSummary.mockResolvedValue({
        extractionQueue: [],
        validationWarnings: [],
        counts: { extraction: 0, validation: 0 },
      });

      const { container } = render(
        <MemoryRouter>
          <CaseProvider caseId="case-1" clientMode={false}>
            <ReviewTab />
          </CaseProvider>
        </MemoryRouter>
      );

      await screen.findByText('Everything looks good');
      const outerDiv = container.firstChild as HTMLElement;
      expect(outerDiv).toHaveClass('p-6', 'space-y-6');
    });
  });
});