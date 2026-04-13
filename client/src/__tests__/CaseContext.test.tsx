import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { CaseProvider, useCaseContext, useCaseData } from '@/context/CaseContext';

// Mock the API client
vi.mock('@/api/client', () => ({
  api: {
    getCase: vi.fn(),
    clientGetCase: vi.fn(),
  },
}));

import { api } from '@/api/client';
const mockedApi = vi.mocked(api);

function TestConsumer() {
  const { caseId, caseData, questionnaire, isLoading, error, refetch } = useCaseContext();
  return (
    <div>
      <p data-testid="case-id">{caseId}</p>
      <p data-testid="loading">{String(isLoading)}</p>
      <p data-testid="error">{error || 'none'}</p>
      <p data-testid="client-name">
        {caseData ? `${caseData.clientFirstName} ${caseData.clientLastName}` : 'none'}
      </p>
      <p data-testid="questionnaire-name">{questionnaire?.name || 'none'}</p>
      <button onClick={refetch}>Refetch</button>
    </div>
  );
}

function TestUseCaseData({ caseId, clientMode }: { caseId: string; clientMode?: boolean }) {
  const { caseData, questionnaire, isLoading, error, refetch } = useCaseData(caseId, clientMode);
  return (
    <div>
      <p data-testid="loading">{String(isLoading)}</p>
      <p data-testid="error">{error || 'none'}</p>
      <p data-testid="client-name">
        {caseData ? `${caseData.clientFirstName} ${caseData.clientLastName}` : 'none'}
      </p>
      <p data-testid="questionnaire-name">{questionnaire?.name || 'none'}</p>
      <button onClick={refetch}>Refetch</button>
    </div>
  );
}

const mockCaseData = {
  id: 'case-1',
  clientId: 'client-1',
  clientFirstName: 'John',
  clientLastName: 'Doe',
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
  },
};

describe('CaseContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('CaseProvider', () => {
    it('renders children', () => {
      mockedApi.getCase.mockResolvedValue(mockCaseData);
      
      render(
        <CaseProvider caseId="case-1">
          <div data-testid="child">Child content</div>
        </CaseProvider>
      );

      expect(screen.getByTestId('child')).toBeInTheDocument();
    });

    it('fetches case data on mount using getCase in staff mode', async () => {
      mockedApi.getCase.mockResolvedValue(mockCaseData);

      render(
        <CaseProvider caseId="case-1" clientMode={false}>
          <TestConsumer />
        </CaseProvider>
      );

      expect(mockedApi.getCase).toHaveBeenCalledWith('case-1');
      expect(mockedApi.clientGetCase).not.toHaveBeenCalled();

      await waitFor(() => {
        expect(screen.getByTestId('client-name')).toHaveTextContent('John Doe');
      });
    });

    it('fetches case data on mount using clientGetCase in client mode', async () => {
      mockedApi.clientGetCase.mockResolvedValue(mockCaseData);

      render(
        <CaseProvider caseId="case-1" clientMode={true}>
          <TestConsumer />
        </CaseProvider>
      );

      expect(mockedApi.clientGetCase).toHaveBeenCalledWith('case-1');
      expect(mockedApi.getCase).not.toHaveBeenCalled();

      await waitFor(() => {
        expect(screen.getByTestId('client-name')).toHaveTextContent('John Doe');
      });
    });

    it('shows loading state initially', () => {
      mockedApi.getCase.mockImplementation(() => new Promise(() => {})); // Never resolves

      render(
        <CaseProvider caseId="case-1">
          <TestConsumer />
        </CaseProvider>
      );

      expect(screen.getByTestId('loading')).toHaveTextContent('true');
    });

    it('handles loading state transitions', async () => {
      mockedApi.getCase.mockResolvedValue(mockCaseData);

      render(
        <CaseProvider caseId="case-1">
          <TestConsumer />
        </CaseProvider>
      );

      // Initially loading
      expect(screen.getByTestId('loading')).toHaveTextContent('true');

      // After fetch completes
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });
    });

    it('handles error state when fetch fails', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockedApi.getCase.mockRejectedValue(new Error('API Error'));

      render(
        <CaseProvider caseId="case-1">
          <TestConsumer />
        </CaseProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Failed to load case data');
      });

      expect(screen.getByTestId('loading')).toHaveTextContent('false');
      consoleError.mockRestore();
    });

    it('provides case data and questionnaire', async () => {
      mockedApi.getCase.mockResolvedValue(mockCaseData);

      render(
        <CaseProvider caseId="case-1">
          <TestConsumer />
        </CaseProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('case-id')).toHaveTextContent('case-1');
        expect(screen.getByTestId('client-name')).toHaveTextContent('John Doe');
        expect(screen.getByTestId('questionnaire-name')).toHaveTextContent('Test Questionnaire');
      });
    });

    it('handles case data without questionnaire', async () => {
      const caseDataNoQuestionnaire = {
        ...mockCaseData,
        questionnaire: null,
      };
      mockedApi.getCase.mockResolvedValue(caseDataNoQuestionnaire);

      render(
        <CaseProvider caseId="case-1">
          <TestConsumer />
        </CaseProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('client-name')).toHaveTextContent('John Doe');
        expect(screen.getByTestId('questionnaire-name')).toHaveTextContent('none');
      });
    });

    it('refetches data when refetch is called', async () => {
      mockedApi.getCase.mockResolvedValue(mockCaseData);

      render(
        <CaseProvider caseId="case-1">
          <TestConsumer />
        </CaseProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('client-name')).toHaveTextContent('John Doe');
      });

      // Clear call history
      mockedApi.getCase.mockClear();

      // Trigger refetch
      screen.getByRole('button', { name: 'Refetch' }).click();

      expect(mockedApi.getCase).toHaveBeenCalledWith('case-1');
    });

    it('re-fetches when caseId changes', async () => {
      mockedApi.getCase.mockResolvedValue(mockCaseData);

      const { rerender } = render(
        <CaseProvider caseId="case-1">
          <TestConsumer />
        </CaseProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('client-name')).toHaveTextContent('John Doe');
      });

      mockedApi.getCase.mockClear();
      mockedApi.getCase.mockResolvedValue({
        ...mockCaseData,
        id: 'case-2',
        clientFirstName: 'Jane',
      });

      rerender(
        <CaseProvider caseId="case-2">
          <TestConsumer />
        </CaseProvider>
      );

      expect(mockedApi.getCase).toHaveBeenCalledWith('case-2');
      
      await waitFor(() => {
        expect(screen.getByTestId('client-name')).toHaveTextContent('Jane Doe');
      });
    });

    it('re-fetches when clientMode changes', async () => {
      mockedApi.getCase.mockResolvedValue(mockCaseData);
      mockedApi.clientGetCase.mockResolvedValue(mockCaseData);

      const { rerender } = render(
        <CaseProvider caseId="case-1" clientMode={false}>
          <TestConsumer />
        </CaseProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('client-name')).toHaveTextContent('John Doe');
      });

      expect(mockedApi.getCase).toHaveBeenCalled();
      expect(mockedApi.clientGetCase).not.toHaveBeenCalled();

      mockedApi.getCase.mockClear();
      mockedApi.clientGetCase.mockClear();

      rerender(
        <CaseProvider caseId="case-1" clientMode={true}>
          <TestConsumer />
        </CaseProvider>
      );

      expect(mockedApi.clientGetCase).toHaveBeenCalledWith('case-1');
      expect(mockedApi.getCase).not.toHaveBeenCalled();
    });
  });

  describe('useCaseContext', () => {
    it('throws error when used outside provider', () => {
      const TestComponent = () => {
        useCaseContext();
        return null;
      };

      expect(() => render(<TestComponent />)).toThrow(
        'useCaseContext must be used within a CaseProvider'
      );
    });
  });

  describe('useCaseData', () => {
    it('fetches case data using getCase by default', async () => {
      mockedApi.getCase.mockResolvedValue(mockCaseData);

      render(<TestUseCaseData caseId="case-1" />);

      expect(mockedApi.getCase).toHaveBeenCalledWith('case-1');
      expect(mockedApi.clientGetCase).not.toHaveBeenCalled();

      await waitFor(() => {
        expect(screen.getByTestId('client-name')).toHaveTextContent('John Doe');
      });
    });

    it('fetches case data using clientGetCase in client mode', async () => {
      mockedApi.clientGetCase.mockResolvedValue(mockCaseData);

      render(<TestUseCaseData caseId="case-1" clientMode={true} />);

      expect(mockedApi.clientGetCase).toHaveBeenCalledWith('case-1');
      expect(mockedApi.getCase).not.toHaveBeenCalled();

      await waitFor(() => {
        expect(screen.getByTestId('client-name')).toHaveTextContent('John Doe');
      });
    });

    it('handles loading state', () => {
      mockedApi.getCase.mockImplementation(() => new Promise(() => {}));

      render(<TestUseCaseData caseId="case-1" />);

      expect(screen.getByTestId('loading')).toHaveTextContent('true');
    });

    it('handles error state', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockedApi.getCase.mockRejectedValue(new Error('API Error'));

      render(<TestUseCaseData caseId="case-1" />);

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Failed to load case data');
      });

      consoleError.mockRestore();
    });

    it('re-fetches when caseId changes', async () => {
      mockedApi.getCase.mockResolvedValue(mockCaseData);

      const { rerender } = render(<TestUseCaseData caseId="case-1" />);

      await waitFor(() => {
        expect(screen.getByTestId('client-name')).toHaveTextContent('John Doe');
      });

      mockedApi.getCase.mockClear();
      mockedApi.getCase.mockResolvedValue({
        ...mockCaseData,
        id: 'case-2',
        clientFirstName: 'Jane',
      });

      rerender(<TestUseCaseData caseId="case-2" />);

      expect(mockedApi.getCase).toHaveBeenCalledWith('case-2');
    });
  });
});