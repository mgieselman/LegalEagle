import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router';
import { FormField, YesNoField, TextAreaField } from '@/components/FormField';
import { StaffCaseView } from '@/pages/staff/StaffCaseView';
import { ClientCaseView } from '@/pages/client/ClientCaseView';
import { api } from '@/api/client';

// Mock the API module
vi.mock('@/api/client', () => ({
  api: {
    getCase: vi.fn(),
    clientGetCase: vi.fn(),
    getForm: vi.fn(),
    updateForm: vi.fn(),
    listAIReview: vi.fn(),
    listForms: vi.fn(),
    createForm: vi.fn(),
    reviewForm: vi.fn(),
    downloadForm: vi.fn(),
  },
}));

// Mock useAutoSave hook
vi.mock('@/hooks/useAutoSave', () => ({
  useAutoSave: vi.fn(() => ({
    status: 'idle',
    errorMessage: null,
    lastSavedAt: null,
    forceSave: vi.fn(),
  })),
}));

const mockFiledCase = {
  id: 'case-1',
  status: 'filed',
  caseNumber: '24-12345',
  clientFirstName: 'John',
  clientLastName: 'Doe',
  chapter: '7',
  filedAt: '2024-01-15T10:00:00Z',
  questionnaire: {
    id: 'form-1',
    name: 'test-form',
    data: {
      fullName: 'John Doe',
      income: '50000',
    },
  },
};

const mockPendingCase = {
  id: 'case-2',
  status: 'pending',
  caseNumber: null,
  clientFirstName: 'Jane',
  clientLastName: 'Smith',
  chapter: '13',
  filedAt: null,
  questionnaire: {
    id: 'form-2',
    name: 'test-form-2',
    data: {
      fullName: 'Jane Smith',
      income: '40000',
    },
  },
};

describe('Read-only Lock After Filing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.listForms).mockResolvedValue([]);
    // ClientCaseView renders FormShell with mode="client", which calls api.clientGetCase
    vi.mocked(api.clientGetCase).mockResolvedValue({ questionnaire: null });
  });

  describe('FormField Components Read-only Behavior', () => {
    it('should render FormField as read-only when readOnly prop is true', () => {
      render(
        <FormField
          label="Full Name"
          value="John Doe"
          onChange={vi.fn()}
          readOnly={true}
        />
      );

      const input = screen.getByDisplayValue('John Doe');
      expect(input).toHaveAttribute('readOnly');
      expect(input).toBeDisabled();
      expect(input).toHaveClass('opacity-60', 'cursor-not-allowed');
    });

    it('should render YesNoField as read-only when readOnly prop is true', () => {
      render(
        <YesNoField
          label="Married?"
          value="yes"
          onChange={vi.fn()}
          readOnly={true}
        />
      );

      const yesRadio = screen.getByRole('radio', { name: /yes/i });
      const noRadio = screen.getByRole('radio', { name: /no/i });

      expect(yesRadio).toBeDisabled();
      expect(noRadio).toBeDisabled();

      // Labels should have read-only styling
      const labels = screen.getAllByText(/yes|no/i).map(el => el.closest('label'));
      labels.forEach(label => {
        if (label) {
          expect(label).toHaveClass('cursor-not-allowed', 'opacity-60');
        }
      });
    });

    it('should render TextAreaField as read-only when readOnly prop is true', () => {
      render(
        <TextAreaField
          label="Additional Information"
          value="Some notes here"
          onChange={vi.fn()}
          readOnly={true}
        />
      );

      const textarea = screen.getByDisplayValue('Some notes here');
      expect(textarea).toHaveAttribute('readOnly');
      expect(textarea).toBeDisabled();
      expect(textarea).toHaveClass('opacity-60', 'cursor-not-allowed');
    });

    it('should prevent user interaction when read-only', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();

      render(
        <FormField
          label="Full Name"
          value="John Doe"
          onChange={onChange}
          readOnly={true}
        />
      );

      const input = screen.getByDisplayValue('John Doe');

      // Try to type - should not call onChange (input is disabled)
      await user.type(input, 'Additional Text');
      expect(onChange).not.toHaveBeenCalled();
    });

    it('should prevent radio button changes when YesNoField is read-only', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();

      render(
        <YesNoField
          label="Married?"
          value="yes"
          onChange={onChange}
          readOnly={true}
        />
      );

      const noRadio = screen.getByRole('radio', { name: /no/i });

      // Try to click - should not call onChange
      await user.click(noRadio);
      expect(onChange).not.toHaveBeenCalled();
    });

    it('should display read-only indicator or message', () => {
      render(
        <FormField
          label="Full Name"
          value="John Doe"
          onChange={vi.fn()}
          readOnly={true}
        />
      );

      // Should indicate read-only state through styling
      const input = screen.getByDisplayValue('John Doe');
      expect(input).toHaveClass('opacity-60');
    });
  });

  describe('StaffCaseView Read-only Logic', () => {
    it('should set readOnly=true for filed cases', async () => {
      vi.mocked(api.getCase).mockResolvedValue(mockFiledCase);

      render(
        <MemoryRouter initialEntries={['/staff/case/case-1']}>
          <Routes>
            <Route path="/staff/case/:id" element={<StaffCaseView />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(api.getCase).toHaveBeenCalledWith('case-1');
      });

      // StaffCaseView shows: "This case is read-only because it has been filed."
      await waitFor(() => {
        expect(screen.getByText(/This case is read-only/i)).toBeInTheDocument();
      });
    });

    it('should set readOnly=false for pending cases', async () => {
      vi.mocked(api.getCase).mockResolvedValue(mockPendingCase);

      render(
        <MemoryRouter initialEntries={['/staff/case/case-2']}>
          <Routes>
            <Route path="/staff/case/:id" element={<StaffCaseView />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(api.getCase).toHaveBeenCalledWith('case-2');
      });

      // Should not display read-only notification banner
      expect(screen.queryByText(/This case is read-only/i)).not.toBeInTheDocument();
    });

    it('should handle "preparing" status as editable', async () => {
      const preparingCase = { ...mockPendingCase, status: 'preparing' };
      vi.mocked(api.getCase).mockResolvedValue(preparingCase);

      render(
        <MemoryRouter initialEntries={['/staff/case/case-2']}>
          <Routes>
            <Route path="/staff/case/:id" element={<StaffCaseView />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(api.getCase).toHaveBeenCalled();
      });

      expect(screen.queryByText(/This case is read-only/i)).not.toBeInTheDocument();
    });

    it('should handle "reviewing" status as editable', async () => {
      const reviewingCase = { ...mockPendingCase, status: 'reviewing' };
      vi.mocked(api.getCase).mockResolvedValue(reviewingCase);

      render(
        <MemoryRouter initialEntries={['/staff/case/case-2']}>
          <Routes>
            <Route path="/staff/case/:id" element={<StaffCaseView />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(api.getCase).toHaveBeenCalled();
      });

      expect(screen.queryByText(/This case is read-only/i)).not.toBeInTheDocument();
    });

    it('should handle "dismissed" status as read-only', async () => {
      const dismissedCase = { ...mockFiledCase, status: 'dismissed' };
      vi.mocked(api.getCase).mockResolvedValue(dismissedCase);

      render(
        <MemoryRouter initialEntries={['/staff/case/case-1']}>
          <Routes>
            <Route path="/staff/case/:id" element={<StaffCaseView />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(api.getCase).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(screen.getByText(/This case is read-only/i)).toBeInTheDocument();
      });
    });

    it('should handle "closed" status as read-only', async () => {
      const closedCase = { ...mockFiledCase, status: 'closed' };
      vi.mocked(api.getCase).mockResolvedValue(closedCase);

      render(
        <MemoryRouter initialEntries={['/staff/case/case-1']}>
          <Routes>
            <Route path="/staff/case/:id" element={<StaffCaseView />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(api.getCase).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(screen.getByText(/This case is read-only/i)).toBeInTheDocument();
      });
    });
  });

  describe('ClientCaseView Read-only Logic', () => {
    it('should set readOnly=true for filed cases in client view', async () => {
      vi.mocked(api.getCase).mockResolvedValue(mockFiledCase);
      // FormShell with mode="client" calls clientGetCase for questionnaire data
      vi.mocked(api.clientGetCase).mockResolvedValue(mockFiledCase);

      render(
        <MemoryRouter initialEntries={['/client/case/case-1']}>
          <Routes>
            <Route path="/client/case/:id" element={<ClientCaseView />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(api.getCase).toHaveBeenCalledWith('case-1');
      });

      // ClientCaseView shows: "Your case has been filed and can no longer be edited."
      await waitFor(() => {
        expect(screen.getByText(/has been filed/i)).toBeInTheDocument();
      });
    });

    it('should set readOnly=false for pending cases in client view', async () => {
      vi.mocked(api.getCase).mockResolvedValue(mockPendingCase);
      vi.mocked(api.clientGetCase).mockResolvedValue(mockPendingCase);

      render(
        <MemoryRouter initialEntries={['/client/case/case-2']}>
          <Routes>
            <Route path="/client/case/:id" element={<ClientCaseView />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(api.getCase).toHaveBeenCalledWith('case-2');
      });

      // Should allow editing for pending cases (no read-only banner)
      expect(screen.queryByText(/can no longer be edited/i)).not.toBeInTheDocument();
    });
  });
});
