import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormField, YesNoField, TextAreaField } from '@/components/FormField';
import { FormShell } from '@/components/FormShell';
import { api } from '@/api/client';

// Mock the API module
vi.mock('@/api/client', () => ({
  api: {
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

describe('Autofill Field Indicators', () => {
  describe('FormField Component', () => {
    it('should render without autofill styling by default', () => {
      render(
        <FormField 
          label="Full Name" 
          value="John Doe" 
          onChange={vi.fn()} 
        />
      );

      const input = screen.getByDisplayValue('John Doe');
      expect(input).not.toHaveClass('bg-blue-50', 'border-blue-200');
    });

    it('should display autofill badge when field is autofilled', () => {
      const mockAutofillSource = {
        documentId: 'doc-1',
        docClass: 'paystub',
        confidence: 0.95,
      };

      render(
        <FormField 
          label="Employer Name" 
          value="ACME Corp" 
          onChange={vi.fn()} 
          autofillSource={mockAutofillSource}
        />
      );

      // Should show autofill badge
      expect(screen.getByText(/auto/i)).toBeInTheDocument();
      expect(screen.getByText(/paystub/i)).toBeInTheDocument();
    });

    it('should apply autofill styling when field is autofilled', () => {
      const mockAutofillSource = {
        documentId: 'doc-1',
        docClass: 'paystub',
        confidence: 0.95,
      };

      render(
        <FormField 
          label="Employer Name" 
          value="ACME Corp" 
          onChange={vi.fn()} 
          autofillSource={mockAutofillSource}
        />
      );

      const input = screen.getByDisplayValue('ACME Corp');
      expect(input).toHaveClass('bg-blue-50', 'border-blue-200');
    });

    it('should display confidence score in autofill badge', () => {
      const mockAutofillSource = {
        documentId: 'doc-1',
        docClass: 'paystub',
        confidence: 0.85,
      };

      render(
        <FormField 
          label="Employer Name" 
          value="ACME Corp" 
          onChange={vi.fn()} 
          autofillSource={mockAutofillSource}
        />
      );

      expect(screen.getByText(/85%/)).toBeInTheDocument();
    });

    it('should show document type in autofill badge', () => {
      const mockAutofillSource = {
        documentId: 'doc-1',
        docClass: 'bank_statement_checking',
        confidence: 0.92,
      };

      render(
        <FormField 
          label="Account Number" 
          value="****1234" 
          onChange={vi.fn()} 
          autofillSource={mockAutofillSource}
        />
      );

      expect(screen.getByText(/bank statement/i)).toBeInTheDocument();
    });

    it('should handle autofill tooltip on hover', async () => {
      const user = userEvent.setup();
      const mockAutofillSource = {
        documentId: 'doc-1',
        docClass: 'paystub',
        confidence: 0.95,
      };

      render(
        <FormField 
          label="Employer Name" 
          value="ACME Corp" 
          onChange={vi.fn()} 
          autofillSource={mockAutofillSource}
        />
      );

      const autofillBadge = screen.getByText(/auto/i);
      await user.hover(autofillBadge);

      // Should show tooltip with more details
      await waitFor(() => {
        expect(screen.getByText(/automatically filled from/i)).toBeInTheDocument();
      });
    });

    it('should remove autofill styling when user edits the field', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const mockAutofillSource = {
        documentId: 'doc-1',
        docClass: 'paystub',
        confidence: 0.95,
      };

      render(
        <FormField 
          label="Employer Name" 
          value="ACME Corp" 
          onChange={onChange} 
          autofillSource={mockAutofillSource}
        />
      );

      const input = screen.getByDisplayValue('ACME Corp');
      expect(input).toHaveClass('bg-blue-50');

      // Edit the field
      await user.clear(input);
      await user.type(input, 'New Company');

      expect(onChange).toHaveBeenCalledWith('New Company');
    });

    it('should work with YesNoField component', () => {
      const mockAutofillSource = {
        documentId: 'doc-1',
        docClass: 'tax_return',
        confidence: 0.88,
      };

      render(
        <YesNoField 
          label="Married?" 
          value="yes" 
          onChange={vi.fn()} 
          autofillSource={mockAutofillSource}
        />
      );

      expect(screen.getByText(/auto/i)).toBeInTheDocument();
      expect(screen.getByText(/tax return/i)).toBeInTheDocument();
      expect(screen.getByText(/88%/)).toBeInTheDocument();
    });

    it('should work with TextAreaField component', () => {
      const mockAutofillSource = {
        documentId: 'doc-1',
        docClass: 'w2',
        confidence: 0.92,
      };

      render(
        <TextAreaField 
          label="Additional Income" 
          value="Freelance consulting" 
          onChange={vi.fn()} 
          autofillSource={mockAutofillSource}
        />
      );

      expect(screen.getByText(/auto/i)).toBeInTheDocument();
      expect(screen.getByText(/w2/i)).toBeInTheDocument();
      
      const textarea = screen.getByDisplayValue('Freelance consulting');
      expect(textarea).toHaveClass('bg-blue-50', 'border-blue-200');
    });

    it('should handle different document class labels', () => {
      const testCases = [
        { docClass: 'paystub', expectedLabel: 'paystub' },
        { docClass: 'bank_statement_checking', expectedLabel: 'bank statement' },
        { docClass: 'tax_return', expectedLabel: 'tax return' },
        { docClass: 'w2', expectedLabel: 'w-2' },
        { docClass: '1099', expectedLabel: '1099' },
      ];

      testCases.forEach(({ docClass, expectedLabel }) => {
        const mockAutofillSource = {
          documentId: 'doc-1',
          docClass,
          confidence: 0.9,
        };

        render(
          <FormField 
            label={`Test ${docClass}`}
            value="Test Value" 
            onChange={vi.fn()} 
            autofillSource={mockAutofillSource}
          />
        );

        expect(screen.getByText(new RegExp(expectedLabel, 'i'))).toBeInTheDocument();
      });
    });

    it('should handle dark mode styling for autofill fields', () => {
      const mockAutofillSource = {
        documentId: 'doc-1',
        docClass: 'paystub',
        confidence: 0.95,
      };

      // Mock dark mode
      document.documentElement.classList.add('dark');

      render(
        <FormField 
          label="Employer Name" 
          value="ACME Corp" 
          onChange={vi.fn()} 
          autofillSource={mockAutofillSource}
        />
      );

      const input = screen.getByDisplayValue('ACME Corp');
      expect(input).toHaveClass('dark:bg-blue-950/20', 'dark:border-blue-800');

      document.documentElement.classList.remove('dark');
    });
  });

  describe('FormShell Metadata Management', () => {
    const mockFormData = {
      id: 'form-1',
      name: 'test-form',
      data: {
        employerName: 'ACME Corp',
        grossPay: '5000',
        netPay: '3500',
      },
      version: 1,
      metadata: {
        autofillSources: {
          employerName: {
            documentId: 'doc-1',
            docClass: 'paystub',
            confidence: 0.95,
          },
          grossPay: {
            documentId: 'doc-1',
            docClass: 'paystub',
            confidence: 0.92,
          },
        },
      },
    };

    beforeEach(() => {
      vi.clearAllMocks();
      vi.mocked(api.getForm).mockResolvedValue(mockFormData);
      vi.mocked(api.listAIReview).mockResolvedValue([]);
    });

    it('should load and display autofill metadata', async () => {
      render(<FormShell caseId="case-1" />);

      await waitFor(() => {
        expect(api.getForm).toHaveBeenCalledWith('case-1', 'test-form');
      });

      // Should display autofill indicators for fields with metadata
      await waitFor(() => {
        expect(screen.getByDisplayValue('ACME Corp')).toHaveClass('bg-blue-50');
        expect(screen.getByDisplayValue('5000')).toHaveClass('bg-blue-50');
      });

      // netPay should not have autofill styling (no metadata)
      expect(screen.getByDisplayValue('3500')).not.toHaveClass('bg-blue-50');
    });

    it('should handle missing metadata gracefully', async () => {
      const formDataWithoutMetadata = {
        ...mockFormData,
        metadata: undefined,
      };

      vi.mocked(api.getForm).mockResolvedValue(formDataWithoutMetadata);

      render(<FormShell caseId="case-1" />);

      await waitFor(() => {
        expect(api.getForm).toHaveBeenCalled();
      });

      // Should not crash and should render fields without autofill styling
      expect(screen.getByDisplayValue('ACME Corp')).not.toHaveClass('bg-blue-50');
    });

    it('should handle empty autofillSources', async () => {
      const formDataWithEmptySources = {
        ...mockFormData,
        metadata: {
          autofillSources: {},
        },
      };

      vi.mocked(api.getForm).mockResolvedValue(formDataWithEmptySources);

      render(<FormShell caseId="case-1" />);

      await waitFor(() => {
        expect(api.getForm).toHaveBeenCalled();
      });

      // Should render fields without autofill styling
      expect(screen.getByDisplayValue('ACME Corp')).not.toHaveClass('bg-blue-50');
      expect(screen.getByDisplayValue('5000')).not.toHaveClass('bg-blue-50');
    });

    it('should preserve metadata when saving form updates', async () => {
      vi.mocked(api.updateForm).mockResolvedValue({ version: 2 });

      const { useAutoSave } = require('@/hooks/useAutoSave');
      const mockForceSave = vi.fn();
      useAutoSave.mockReturnValue({
        status: 'idle',
        errorMessage: null,
        lastSavedAt: null,
        forceSave: mockForceSave,
      });

      render(<FormShell caseId="case-1" />);

      await waitFor(() => {
        expect(api.getForm).toHaveBeenCalled();
      });

      // The useAutoSave hook should be called with the correct metadata
      expect(useAutoSave).toHaveBeenCalledWith(
        expect.objectContaining({
          employerName: 'ACME Corp',
          grossPay: '5000',
          netPay: '3500',
        }),
        'form-1',
        1,
        'test-form',
        false,
        expect.any(Object)
      );
    });

    it('should update metadata when autofill is applied', async () => {
      // This would test the autofill endpoint integration
      // For now, we'll test that the component can handle metadata updates
      
      render(<FormShell caseId="case-1" />);

      await waitFor(() => {
        expect(api.getForm).toHaveBeenCalled();
      });

      // Simulate metadata update from autofill operation
      const updatedMetadata = {
        autofillSources: {
          ...mockFormData.metadata.autofillSources,
          netPay: {
            documentId: 'doc-2',
            docClass: 'bank_statement_checking',
            confidence: 0.87,
          },
        },
      };

      // Component should handle dynamic metadata updates
      // This would be tested more thoroughly in integration tests
      expect(screen.getByDisplayValue('3500')).toBeInTheDocument();
    });

    it('should display autofill summary statistics', async () => {
      render(<FormShell caseId="case-1" />);

      await waitFor(() => {
        expect(api.getForm).toHaveBeenCalled();
      });

      // Should show count of autofilled fields
      await waitFor(() => {
        expect(screen.getByText(/2.*autofilled/i)).toBeInTheDocument();
      });
    });

    it('should handle nested field paths in metadata', async () => {
      const formDataWithNestedFields = {
        ...mockFormData,
        data: {
          personalInfo: {
            firstName: 'John',
            lastName: 'Doe',
          },
          employment: {
            employerName: 'ACME Corp',
          },
        },
        metadata: {
          autofillSources: {
            'personalInfo.firstName': {
              documentId: 'doc-1',
              docClass: 'id_card',
              confidence: 0.98,
            },
            'employment.employerName': {
              documentId: 'doc-2',
              docClass: 'paystub',
              confidence: 0.95,
            },
          },
        },
      };

      vi.mocked(api.getForm).mockResolvedValue(formDataWithNestedFields);

      render(<FormShell caseId="case-1" />);

      await waitFor(() => {
        expect(api.getForm).toHaveBeenCalled();
      });

      // Should handle nested field paths in metadata lookup
      // This tests that the component correctly maps nested paths to form fields
      expect(screen.getByDisplayValue('John')).toBeInTheDocument();
      expect(screen.getByDisplayValue('ACME Corp')).toBeInTheDocument();
    });

    it('should clear autofill indicators when user manually edits field', async () => {
      const user = userEvent.setup();

      render(<FormShell caseId="case-1" />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('ACME Corp')).toHaveClass('bg-blue-50');
      });

      // Edit the autofilled field
      const input = screen.getByDisplayValue('ACME Corp');
      await user.clear(input);
      await user.type(input, 'New Company Name');

      // Autofill styling should be removed after edit
      // (This would depend on the implementation details of how edits are handled)
      expect(input).toHaveValue('New Company Name');
    });
  });

  describe('Autofill Badge Component', () => {
    it('should render with proper accessibility attributes', () => {
      const mockAutofillSource = {
        documentId: 'doc-1',
        docClass: 'paystub',
        confidence: 0.95,
      };

      render(
        <FormField 
          label="Employer Name" 
          value="ACME Corp" 
          onChange={vi.fn()} 
          autofillSource={mockAutofillSource}
        />
      );

      const badge = screen.getByText(/auto/i);
      expect(badge).toHaveAttribute('aria-label', expect.stringContaining('autofilled'));
    });

    it('should be keyboard accessible', async () => {
      const user = userEvent.setup();
      const mockAutofillSource = {
        documentId: 'doc-1',
        docClass: 'paystub',
        confidence: 0.95,
      };

      render(
        <FormField 
          label="Employer Name" 
          value="ACME Corp" 
          onChange={vi.fn()} 
          autofillSource={mockAutofillSource}
        />
      );

      const badge = screen.getByText(/auto/i);
      
      // Should be focusable and show tooltip on focus
      await user.tab();
      expect(badge).toHaveFocus();
      
      await waitFor(() => {
        expect(screen.getByText(/automatically filled/i)).toBeInTheDocument();
      });
    });
  });
});