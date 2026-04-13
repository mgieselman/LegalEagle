import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { FormField, YesNoField, TextAreaField } from '@/components/FormField';
import { FormShell } from '@/components/FormShell';
import { StaffCaseView } from '@/pages/staff/StaffCaseView';
import { ClientCaseView } from '@/pages/client/ClientCaseView';
import { api } from '@/api/client';

// Mock the API module
vi.mock('@/api/client', () => ({
  api: {
    getCase: vi.fn(),
    getForm: vi.fn(),
    updateForm: vi.fn(),
    listAIReview: vi.fn(),
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
};

const mockPendingCase = {
  id: 'case-2',
  status: 'pending',
  caseNumber: null,
  clientFirstName: 'Jane',
  clientLastName: 'Smith',
  chapter: '13',
  filedAt: null,
};

const mockFormData = {
  id: 'form-1',
  name: 'test-form',
  data: {
    fullName: 'John Doe',
    income: '50000',
    married: 'yes',
    notes: 'Additional information',
  },
  version: 1,
  metadata: { autofillSources: {} },
};

describe('Read-only Lock After Filing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getForm).mockResolvedValue(mockFormData);
    vi.mocked(api.listAIReview).mockResolvedValue([]);
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
        expect(label).toHaveClass('cursor-not-allowed', 'opacity-60');
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
      
      // Try to type - should not call onChange
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

      // Should indicate read-only state (either through styling or explicit indicator)
      const input = screen.getByDisplayValue('John Doe');
      expect(input).toHaveClass('opacity-60');
    });
  });

  describe('FormShell Read-only Mode', () => {
    it('should render all fields as read-only when readOnly prop is true', async () => {
      render(<FormShell caseId="case-1" readOnly={true} />);

      await waitFor(() => {
        expect(api.getForm).toHaveBeenCalled();
      });

      await waitFor(() => {
        const inputs = screen.getAllByRole('textbox');
        inputs.forEach(input => {
          expect(input).toHaveAttribute('readOnly');
          expect(input).toBeDisabled();
        });
      });
    });

    it('should not trigger auto-save in read-only mode', async () => {
      const { useAutoSave } = require('@/hooks/useAutoSave');
      
      render(<FormShell caseId="case-1" readOnly={true} />);

      await waitFor(() => {
        expect(api.getForm).toHaveBeenCalled();
      });

      // useAutoSave should be called with readOnly=true
      expect(useAutoSave).toHaveBeenCalledWith(
        expect.any(Object), // data
        expect.any(String), // id
        expect.any(Number), // version
        expect.any(String), // formName
        true, // readOnly
        expect.any(Object) // options
      );
    });

    it('should display read-only notification banner', async () => {
      render(<FormShell caseId="case-1" readOnly={true} />);

      await waitFor(() => {
        expect(screen.getByText(/read.?only|cannot be edited|filed/i)).toBeInTheDocument();
      });
    });

    it('should hide save controls in read-only mode', async () => {
      render(<FormShell caseId="case-1" readOnly={true} />);

      await waitFor(() => {
        expect(api.getForm).toHaveBeenCalled();
      });

      // Save buttons or auto-save indicators should not be visible
      expect(screen.queryByText(/save|saving/i)).not.toBeInTheDocument();
    });
  });

  describe('StaffCaseView Read-only Logic', () => {
    it('should set readOnly=true for filed cases', async () => {
      vi.mocked(api.getCase).mockResolvedValue(mockFiledCase);

      render(
        <MemoryRouter initialEntries={['/staff/case/case-1']}>
          <StaffCaseView />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(api.getCase).toHaveBeenCalledWith('case-1');
      });

      // Should display read-only notification
      await waitFor(() => {
        expect(screen.getByText(/case has been filed.*cannot be edited/i)).toBeInTheDocument();
      });
    });

    it('should set readOnly=false for pending cases', async () => {
      vi.mocked(api.getCase).mockResolvedValue(mockPendingCase);

      render(
        <MemoryRouter initialEntries={['/staff/case/case-2']}>
          <StaffCaseView />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(api.getCase).toHaveBeenCalledWith('case-2');
      });

      // Should not display read-only notification
      expect(screen.queryByText(/cannot be edited|read.?only/i)).not.toBeInTheDocument();
    });

    it('should display case filing information for filed cases', async () => {
      vi.mocked(api.getCase).mockResolvedValue(mockFiledCase);

      render(
        <MemoryRouter initialEntries={['/staff/case/case-1']}>
          <StaffCaseView />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('24-12345')).toBeInTheDocument(); // Case number
        expect(screen.getByText(/jan.*15.*2024/i)).toBeInTheDocument(); // Filed date
      });
    });
  });

  describe('ClientCaseView Read-only Logic', () => {
    it('should set readOnly=true for filed cases in client view', async () => {
      vi.mocked(api.getCase).mockResolvedValue(mockFiledCase);

      render(
        <MemoryRouter initialEntries={['/client/case/case-1']}>
          <ClientCaseView />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(api.getCase).toHaveBeenCalledWith('case-1');
      });

      // Should display read-only notification for client
      await waitFor(() => {
        expect(screen.getByText(/case has been filed.*cannot be edited/i)).toBeInTheDocument();
      });
    });

    it('should set readOnly=false for pending cases in client view', async () => {
      vi.mocked(api.getCase).mockResolvedValue(mockPendingCase);

      render(
        <MemoryRouter initialEntries={['/client/case/case-2']}>
          <ClientCaseView />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(api.getCase).toHaveBeenCalledWith('case-2');
      });

      // Should allow editing for pending cases
      expect(screen.queryByText(/cannot be edited|read.?only/i)).not.toBeInTheDocument();
    });
  });

  describe('Additional Case Status Handling', () => {
    it('should handle "preparing" status as editable', async () => {
      const preparingCase = { ...mockPendingCase, status: 'preparing' };
      vi.mocked(api.getCase).mockResolvedValue(preparingCase);

      render(
        <MemoryRouter initialEntries={['/staff/case/case-2']}>
          <StaffCaseView />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(api.getCase).toHaveBeenCalled();
      });

      expect(screen.queryByText(/cannot be edited|read.?only/i)).not.toBeInTheDocument();
    });

    it('should handle "reviewing" status as editable', async () => {
      const reviewingCase = { ...mockPendingCase, status: 'reviewing' };
      vi.mocked(api.getCase).mockResolvedValue(reviewingCase);

      render(
        <MemoryRouter initialEntries={['/staff/case/case-2']}>
          <StaffCaseView />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(api.getCase).toHaveBeenCalled();
      });

      expect(screen.queryByText(/cannot be edited|read.?only/i)).not.toBeInTheDocument();
    });

    it('should handle "dismissed" status as read-only', async () => {
      const dismissedCase = { ...mockFiledCase, status: 'dismissed' };
      vi.mocked(api.getCase).mockResolvedValue(dismissedCase);

      render(
        <MemoryRouter initialEntries={['/staff/case/case-1']}>
          <StaffCaseView />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(api.getCase).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(screen.getByText(/cannot be edited|read.?only/i)).toBeInTheDocument();
      });
    });

    it('should handle "closed" status as read-only', async () => {
      const closedCase = { ...mockFiledCase, status: 'closed' };
      vi.mocked(api.getCase).mockResolvedValue(closedCase);

      render(
        <MemoryRouter initialEntries={['/staff/case/case-1']}>
          <StaffCaseView />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(api.getCase).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(screen.getByText(/cannot be edited|read.?only/i)).toBeInTheDocument();
      });
    });
  });

  describe('Read-only State Inheritance', () => {
    it('should pass readOnly prop through FormShell to form sections', async () => {
      render(<FormShell caseId="case-1" readOnly={true} />);

      await waitFor(() => {
        expect(api.getForm).toHaveBeenCalled();
      });

      // All form fields should inherit read-only state
      await waitFor(() => {
        const allInputs = screen.getAllByRole('textbox');
        const allRadios = screen.getAllByRole('radio');
        
        [...allInputs, ...allRadios].forEach(element => {
          expect(element).toBeDisabled();
        });
      });
    });

    it('should handle mixed field types in read-only mode', async () => {
      render(<FormShell caseId="case-1" readOnly={true} />);

      await waitFor(() => {
        expect(api.getForm).toHaveBeenCalled();
      });

      await waitFor(() => {
        // Text inputs should be read-only
        const textInputs = screen.getAllByRole('textbox');
        textInputs.forEach(input => {
          expect(input).toHaveAttribute('readOnly');
        });

        // Radio buttons should be disabled  
        const radioInputs = screen.getAllByRole('radio');
        radioInputs.forEach(radio => {
          expect(radio).toBeDisabled();
        });

        // Textareas should be read-only
        const textareas = screen.getAllByRole('textbox').filter(el => el.tagName === 'TEXTAREA');
        textareas.forEach(textarea => {
          expect(textarea).toHaveAttribute('readOnly');
        });
      });
    });
  });

  describe('User Experience in Read-only Mode', () => {
    it('should provide clear visual feedback for read-only state', async () => {
      render(<FormShell caseId="case-1" readOnly={true} />);

      await waitFor(() => {
        expect(api.getForm).toHaveBeenCalled();
      });

      await waitFor(() => {
        const inputs = screen.getAllByRole('textbox');
        inputs.forEach(input => {
          expect(input).toHaveClass('opacity-60');
        });
      });
    });

    it('should display helpful message explaining why form is read-only', async () => {
      vi.mocked(api.getCase).mockResolvedValue(mockFiledCase);

      render(
        <MemoryRouter initialEntries={['/staff/case/case-1']}>
          <StaffCaseView />
        </MemoryRouter>
      );

      await waitFor(() => {
        // Should explain that form is read-only because case is filed
        expect(screen.getByText(/case has been filed.*court.*cannot be edited/i)).toBeInTheDocument();
      });
    });

    it('should maintain form navigation in read-only mode', async () => {
      render(<FormShell caseId="case-1" readOnly={true} />);

      await waitFor(() => {
        expect(api.getForm).toHaveBeenCalled();
      });

      // Tab navigation should still work between sections
      const tabButtons = screen.getAllByRole('tab');
      expect(tabButtons.length).toBeGreaterThan(0);
      
      tabButtons.forEach(tab => {
        expect(tab).not.toBeDisabled();
      });
    });

    it('should hide action buttons that would modify data', async () => {
      render(<FormShell caseId="case-1" readOnly={true} />);

      await waitFor(() => {
        expect(api.getForm).toHaveBeenCalled();
      });

      // Should not show save, submit, or other modification buttons
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /save|submit|update|delete/i })).not.toBeInTheDocument();
      });
    });
  });
});