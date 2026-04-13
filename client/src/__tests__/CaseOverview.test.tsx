import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { CaseOverview } from '@/components/case/CaseOverview';
import { CaseProvider } from '@/context/CaseContext';

// Mock the API client
vi.mock('@/api/client', () => ({
  api: {
    getCase: vi.fn(),
    clientGetCase: vi.fn(),
  },
}));

// Mock ProgressBar component
vi.mock('@/components/ProgressBar', () => ({
  ProgressBar: ({ data }: { data: any }) => (
    <div data-testid="progress-bar">Progress Bar with data: {JSON.stringify(data)}</div>
  ),
}));

// Mock StatusBadge component 
vi.mock('@/components/ui/status-badge', () => ({
  StatusBadge: ({ status }: { status: string }) => (
    <span data-testid="status-badge">{status}</span>
  ),
}));

import { api } from '@/api/client';
const mockedApi = vi.mocked(api);

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
    data: { fullName: 'John Doe', section1Complete: true },
  },
};

const mockCaseDataWithFiling = {
  ...mockCaseData,
  status: 'filed' as const,
  filingDate: '2026-02-01',
  filingDistrict: 'Southern District of New York',
  householdSize: 3,
  isJointFiling: true,
};

function renderCaseOverview(mode: 'staff' | 'client', caseData = mockCaseData) {
  mockedApi.getCase.mockResolvedValue(caseData);
  mockedApi.clientGetCase.mockResolvedValue(caseData);

  return render(
    <MemoryRouter>
      <CaseProvider caseId="case-1" clientMode={mode === 'client'}>
        <CaseOverview mode={mode} />
      </CaseProvider>
    </MemoryRouter>
  );
}

describe('CaseOverview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Staff Mode', () => {
    it('renders staff title with client name', async () => {
      renderCaseOverview('staff');

      await screen.findByText('Case: John Doe');
      expect(screen.getByText('Chapter 7 bankruptcy case')).toBeInTheDocument();
    });

    it('displays case details card with all fields', async () => {
      renderCaseOverview('staff', mockCaseDataWithFiling);

      await screen.findByText('Case Details');
      
      // Client info
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      
      // Chapter
      expect(screen.getByText('Chapter 7')).toBeInTheDocument();
      
      // Status badge
      expect(screen.getByTestId('status-badge')).toHaveTextContent('filed');
      
      // Household size
      expect(screen.getByText('3')).toBeInTheDocument();
      
      // Joint filing
      expect(screen.getByText('Yes')).toBeInTheDocument();
      
      // Filing date
      expect(screen.getByText('2026-02-01')).toBeInTheDocument();
      
      // Filing district
      expect(screen.getByText('Southern District of New York')).toBeInTheDocument();
      
      // Created date (formatted)
      expect(screen.getByText('12/31/2025')).toBeInTheDocument();
    });

    it('handles null optional fields gracefully', async () => {
      renderCaseOverview('staff');

      await screen.findByText('Case Details');
      
      expect(screen.getByText('Not specified')).toBeInTheDocument(); // householdSize
      expect(screen.getByText('No')).toBeInTheDocument(); // isJointFiling
      expect(screen.getByText('Not filed')).toBeInTheDocument(); // filingDate
      expect(screen.getByText('Not specified')).toBeInTheDocument(); // filingDistrict
    });

    it('does not show client task list in staff mode', async () => {
      renderCaseOverview('staff');

      await screen.findByText('Case Details');
      
      expect(screen.queryByText('What to do next')).not.toBeInTheDocument();
      expect(screen.queryByText('Upload Documents')).not.toBeInTheDocument();
      expect(screen.queryByText('Complete Questionnaire')).not.toBeInTheDocument();
    });

    it('shows questionnaire progress when available', async () => {
      renderCaseOverview('staff');

      await screen.findByText('Questionnaire Progress');
      expect(screen.getByTestId('progress-bar')).toBeInTheDocument();
    });
  });

  describe('Client Mode', () => {
    it('renders client title', async () => {
      renderCaseOverview('client');

      await screen.findByText('Case Overview');
      expect(screen.getByText('Chapter 7 bankruptcy case')).toBeInTheDocument();
    });

    it('does not show case details card in client mode', async () => {
      renderCaseOverview('client');

      await screen.findByText('Case Overview');
      
      expect(screen.queryByText('Case Details')).not.toBeInTheDocument();
      expect(screen.queryByText('Client')).not.toBeInTheDocument();
      expect(screen.queryByText('Status')).not.toBeInTheDocument();
    });

    it('shows what to do next task list', async () => {
      renderCaseOverview('client');

      await screen.findByText('What to do next');
      
      // Upload documents task
      expect(screen.getByText('Upload Documents')).toBeInTheDocument();
      expect(screen.getByText('Upload required financial documents and supporting papers')).toBeInTheDocument();
      
      // Complete questionnaire task
      expect(screen.getByText('Complete Questionnaire')).toBeInTheDocument();
      expect(screen.getByText('Fill out your financial and personal information')).toBeInTheDocument();
    });

    it('task list has correct navigation links', async () => {
      renderCaseOverview('client');

      await screen.findByText('What to do next');
      
      const documentsLink = screen.getByRole('link', { name: /Upload Documents/i });
      expect(documentsLink).toHaveAttribute('href', '/documents');
      
      const questionnaireLink = screen.getByRole('link', { name: /Complete Questionnaire/i });
      expect(questionnaireLink).toHaveAttribute('href', '/questionnaire');
    });

    it('shows questionnaire progress when available', async () => {
      renderCaseOverview('client');

      await screen.findByText('Questionnaire Progress');
      expect(screen.getByTestId('progress-bar')).toBeInTheDocument();
    });
  });

  describe('Shared Functionality', () => {
    it('renders fallback when no case data', async () => {
      mockedApi.getCase.mockRejectedValue(new Error('Not found'));
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <MemoryRouter>
          <CaseProvider caseId="case-1">
            <CaseOverview mode="staff" />
          </CaseProvider>
        </MemoryRouter>
      );

      // Wait for the provider to finish loading and show error state
      await waitFor(() => {
        expect(screen.getByText('No case data available')).toBeInTheDocument();
      });
      
      consoleError.mockRestore();
    });

    it('does not show questionnaire progress when questionnaire is null', async () => {
      const caseDataNoQuestionnaire = {
        ...mockCaseData,
        questionnaire: null,
      };

      renderCaseOverview('staff', caseDataNoQuestionnaire);

      await screen.findByText('Case Details');
      
      expect(screen.queryByText('Questionnaire Progress')).not.toBeInTheDocument();
      expect(screen.queryByTestId('progress-bar')).not.toBeInTheDocument();
    });

    it('handles case data loading states appropriately', async () => {
      // Test that the component waits for case data
      mockedApi.getCase.mockImplementation(
        () => new Promise(resolve => 
          setTimeout(() => resolve(mockCaseData), 100)
        )
      );

      renderCaseOverview('staff');

      // Initially should not show content while loading
      expect(screen.queryByText('Case Details')).not.toBeInTheDocument();

      // After loading
      await screen.findByText('Case Details');
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
  });
});