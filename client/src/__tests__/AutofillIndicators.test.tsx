import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormField, YesNoField, TextAreaField } from '@/components/FormField';

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

      // The badge renders text "Auto-filled"
      expect(screen.getByText('Auto-filled')).toBeInTheDocument();
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

    it('should display confidence and docClass in title attribute', () => {
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

      const badge = screen.getByText('Auto-filled');
      expect(badge).toHaveAttribute('title', expect.stringContaining('paystub'));
      expect(badge).toHaveAttribute('title', expect.stringContaining('85%'));
    });

    it('should call onChange when user edits the field', async () => {
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

      // Type a character - onChange fires with each keystroke
      await user.type(input, 'X');

      // onChange should have been called (value appended because prop doesn't change)
      expect(onChange).toHaveBeenCalledWith('ACME CorpX');
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

  describe('YesNoField Component', () => {
    it('should render radio buttons for yes and no', () => {
      render(
        <YesNoField
          label="Married?"
          value="yes"
          onChange={vi.fn()}
        />
      );

      expect(screen.getByText('Yes')).toBeInTheDocument();
      expect(screen.getByText('No')).toBeInTheDocument();
    });

    it('should call onChange when selection changes', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(
        <YesNoField
          label="Married?"
          value="yes"
          onChange={onChange}
        />
      );

      const noRadio = screen.getByLabelText('No');
      await user.click(noRadio);
      expect(onChange).toHaveBeenCalledWith('no');
    });

    it('should be disabled when readOnly', () => {
      render(
        <YesNoField
          label="Married?"
          value="yes"
          onChange={vi.fn()}
          readOnly={true}
        />
      );

      const radios = screen.getAllByRole('radio');
      radios.forEach(radio => {
        expect(radio).toBeDisabled();
      });
    });
  });

  describe('TextAreaField Component', () => {
    it('should render textarea with value', () => {
      render(
        <TextAreaField
          label="Additional Income"
          value="Freelance consulting"
          onChange={vi.fn()}
        />
      );

      const textarea = screen.getByDisplayValue('Freelance consulting');
      expect(textarea).toBeInTheDocument();
      expect(textarea.tagName).toBe('TEXTAREA');
    });

    it('should call onChange on text input', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(
        <TextAreaField
          label="Notes"
          value=""
          onChange={onChange}
        />
      );

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'test');
      expect(onChange).toHaveBeenCalled();
    });

    it('should be disabled when readOnly', () => {
      render(
        <TextAreaField
          label="Additional Income"
          value="Freelance consulting"
          onChange={vi.fn()}
          readOnly={true}
        />
      );

      const textarea = screen.getByDisplayValue('Freelance consulting');
      expect(textarea).toBeDisabled();
      expect(textarea).toHaveClass('opacity-60', 'cursor-not-allowed');
    });
  });
});
