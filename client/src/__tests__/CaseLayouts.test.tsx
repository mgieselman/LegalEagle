import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { StaffCaseLayout } from '@/pages/staff/StaffCaseLayout';
import { ClientCaseLayout } from '@/pages/client/ClientCaseLayout';

// Mock the API client
vi.mock('@/api/client', () => ({
  api: {
    getCase: vi.fn(),
    clientGetCase: vi.fn(),
  },
}));

// Mock react-router to control params
vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    useParams: vi.fn(),
    Outlet: () => <div data-testid="outlet">Outlet Content</div>,
    Link: ({ children, to, className }: { children: React.ReactNode; to: string; className?: string }) => (
      <a href={to} className={className} data-testid="back-link">
        {children}
      </a>
    ),
    NavLink: ({ children, to, end, className }: { children: React.ReactNode; to: string; end?: boolean; className?: string | ((params: { isActive: boolean }) => string) }) => {
      const isActive = to === '';
      const computedClassName = typeof className === 'function' 
        ? className({ isActive }) 
        : className;
      return (
        <a 
          href={to} 
          className={computedClassName}
          data-testid={`tab-${to || 'overview'}`}
          data-end={end ? 'true' : 'false'}
        >
          {children}
        </a>
      );
    },
  };
});

import { api } from '@/api/client';
import { useParams } from 'react-router';

const mockedApi = vi.mocked(api);
const mockedUseParams = vi.mocked(useParams);

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

describe('Case Layouts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.getCase.mockResolvedValue(mockCaseData);
    mockedApi.clientGetCase.mockResolvedValue(mockCaseData);
  });

  describe('StaffCaseLayout', () => {
    beforeEach(() => {
      mockedUseParams.mockReturnValue({ id: 'case-1' });
    });

    it('renders back link to staff dashboard', () => {
      render(
        <MemoryRouter>
          <StaffCaseLayout />
        </MemoryRouter>
      );

      const backLink = screen.getByTestId('back-link');
      expect(backLink).toHaveTextContent('Back to Dashboard');
      expect(backLink).toHaveAttribute('href', '/staff/dashboard');
    });

    it('renders tab bar with all 4 staff tabs', () => {
      render(
        <MemoryRouter>
          <StaffCaseLayout />
        </MemoryRouter>
      );

      expect(screen.getByTestId('tab-overview')).toHaveTextContent('Overview');
      expect(screen.getByTestId('tab-documents')).toHaveTextContent('Documents');
      expect(screen.getByTestId('tab-questionnaire')).toHaveTextContent('Questionnaire');
      expect(screen.getByTestId('tab-review')).toHaveTextContent('Review');
    });

    it('sets end prop for overview tab', () => {
      render(
        <MemoryRouter>
          <StaffCaseLayout />
        </MemoryRouter>
      );

      const overviewTab = screen.getByTestId('tab-overview');
      expect(overviewTab).toHaveAttribute('data-end', 'true');

      const documentsTab = screen.getByTestId('tab-documents');
      expect(documentsTab).toHaveAttribute('data-end', 'false');
    });

    it('shows loading state while case loads', () => {
      mockedApi.getCase.mockImplementation(() => new Promise(() => {})); // Never resolves

      render(
        <MemoryRouter>
          <StaffCaseLayout />
        </MemoryRouter>
      );

      expect(screen.getByText('Loading case data...')).toBeInTheDocument();
      expect(screen.queryByTestId('outlet')).not.toBeInTheDocument();
    });

    it('shows error state on fetch failure', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockedApi.getCase.mockRejectedValue(new Error('API Error'));

      render(
        <MemoryRouter>
          <StaffCaseLayout />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Error: Failed to load case data')).toBeInTheDocument();
      });

      expect(screen.getByText('Please try refreshing the page.')).toBeInTheDocument();
      expect(screen.queryByTestId('outlet')).not.toBeInTheDocument();
      consoleError.mockRestore();
    });

    it('renders outlet when case loads successfully', async () => {
      render(
        <MemoryRouter>
          <StaffCaseLayout />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('outlet')).toBeInTheDocument();
      });

      expect(screen.queryByText('Loading case data...')).not.toBeInTheDocument();
    });

    it('calls getCase with correct case ID', () => {
      render(
        <MemoryRouter>
          <StaffCaseLayout />
        </MemoryRouter>
      );

      expect(mockedApi.getCase).toHaveBeenCalledWith('case-1');
      expect(mockedApi.clientGetCase).not.toHaveBeenCalled();
    });

    it('renders error when case ID is missing', () => {
      mockedUseParams.mockReturnValue({});

      render(
        <MemoryRouter>
          <StaffCaseLayout />
        </MemoryRouter>
      );

      expect(screen.getByText('Missing case ID')).toBeInTheDocument();
      expect(mockedApi.getCase).not.toHaveBeenCalled();
    });

    it('renders error when case ID is undefined', () => {
      mockedUseParams.mockReturnValue({ id: undefined });

      render(
        <MemoryRouter>
          <StaffCaseLayout />
        </MemoryRouter>
      );

      expect(screen.getByText('Missing case ID')).toBeInTheDocument();
      expect(mockedApi.getCase).not.toHaveBeenCalled();
    });
  });

  describe('ClientCaseLayout', () => {
    beforeEach(() => {
      mockedUseParams.mockReturnValue({ id: 'case-1' });
    });

    it('renders back link to client dashboard', () => {
      render(
        <MemoryRouter>
          <ClientCaseLayout />
        </MemoryRouter>
      );

      const backLink = screen.getByTestId('back-link');
      expect(backLink).toHaveTextContent('Back to My Cases');
      expect(backLink).toHaveAttribute('href', '/client/dashboard');
    });

    it('renders tab bar with only 3 client tabs (no Review)', () => {
      render(
        <MemoryRouter>
          <ClientCaseLayout />
        </MemoryRouter>
      );

      expect(screen.getByTestId('tab-overview')).toHaveTextContent('Overview');
      expect(screen.getByTestId('tab-documents')).toHaveTextContent('Documents');
      expect(screen.getByTestId('tab-questionnaire')).toHaveTextContent('Questionnaire');
      expect(screen.queryByText('Review')).not.toBeInTheDocument();
    });

    it('shows loading state while case loads', () => {
      mockedApi.clientGetCase.mockImplementation(() => new Promise(() => {}));

      render(
        <MemoryRouter>
          <ClientCaseLayout />
        </MemoryRouter>
      );

      expect(screen.getByText('Loading case data...')).toBeInTheDocument();
      expect(screen.queryByTestId('outlet')).not.toBeInTheDocument();
    });

    it('shows error state on fetch failure', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockedApi.clientGetCase.mockRejectedValue(new Error('API Error'));

      render(
        <MemoryRouter>
          <ClientCaseLayout />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Error: Failed to load case data')).toBeInTheDocument();
      });

      consoleError.mockRestore();
    });

    it('renders outlet when case loads successfully', async () => {
      render(
        <MemoryRouter>
          <ClientCaseLayout />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('outlet')).toBeInTheDocument();
      });

      expect(screen.queryByText('Loading case data...')).not.toBeInTheDocument();
    });

    it('calls clientGetCase with correct case ID', () => {
      render(
        <MemoryRouter>
          <ClientCaseLayout />
        </MemoryRouter>
      );

      expect(mockedApi.clientGetCase).toHaveBeenCalledWith('case-1');
      expect(mockedApi.getCase).not.toHaveBeenCalled();
    });

    it('renders error when case ID is missing', () => {
      mockedUseParams.mockReturnValue({});

      render(
        <MemoryRouter>
          <ClientCaseLayout />
        </MemoryRouter>
      );

      expect(screen.getByText('Missing case ID')).toBeInTheDocument();
      expect(mockedApi.clientGetCase).not.toHaveBeenCalled();
    });
  });

  describe('Shared Behavior', () => {
    it('both layouts use CaseProvider with appropriate clientMode', () => {
      // We can't directly test the CaseProvider props, but we can verify
      // the API calls show the correct mode is being used
      
      mockedUseParams.mockReturnValue({ id: 'case-1' });

      const { unmount } = render(
        <MemoryRouter>
          <StaffCaseLayout />
        </MemoryRouter>
      );

      expect(mockedApi.getCase).toHaveBeenCalledWith('case-1');
      expect(mockedApi.clientGetCase).not.toHaveBeenCalled();

      unmount();
      vi.clearAllMocks();

      render(
        <MemoryRouter>
          <ClientCaseLayout />
        </MemoryRouter>
      );

      expect(mockedApi.clientGetCase).toHaveBeenCalledWith('case-1');
      expect(mockedApi.getCase).not.toHaveBeenCalled();
    });

    it('both layouts have consistent structure', () => {
      mockedUseParams.mockReturnValue({ id: 'case-1' });

      const { unmount: unmountStaff } = render(
        <MemoryRouter>
          <StaffCaseLayout />
        </MemoryRouter>
      );

      // Both should have back link, tab bar
      expect(screen.getByTestId('back-link')).toBeInTheDocument();
      expect(screen.getByTestId('tab-overview')).toBeInTheDocument();

      unmountStaff();

      render(
        <MemoryRouter>
          <ClientCaseLayout />
        </MemoryRouter>
      );

      expect(screen.getByTestId('back-link')).toBeInTheDocument();
      expect(screen.getByTestId('tab-overview')).toBeInTheDocument();
    });
  });
});