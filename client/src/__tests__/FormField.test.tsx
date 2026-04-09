import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormField, YesNoField, TextAreaField } from '@/components/FormField';

describe('FormField', () => {
  it('should render with label and value', () => {
    render(<FormField label="Full Name" value="John Doe" onChange={vi.fn()} />);
    expect(screen.getByText('Full Name')).toBeInTheDocument();
    expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument();
  });

  it('should call onChange when typing', async () => {
    const onChange = vi.fn();
    render(<FormField label="Name" value="" onChange={onChange} />);
    const user = userEvent.setup();
    await user.type(screen.getByRole('textbox'), 'A');
    expect(onChange).toHaveBeenCalledWith('A');
  });

  it('should render with placeholder', () => {
    render(<FormField label="Email" value="" onChange={vi.fn()} placeholder="Enter email" />);
    expect(screen.getByPlaceholderText('Enter email')).toBeInTheDocument();
  });
});

describe('YesNoField', () => {
  it('should render with label and radio buttons', () => {
    render(<YesNoField label="Prior bankruptcy?" value="no" onChange={vi.fn()} />);
    expect(screen.getByText('Prior bankruptcy?')).toBeInTheDocument();
    expect(screen.getByText('Yes')).toBeInTheDocument();
    expect(screen.getByText('No')).toBeInTheDocument();
  });

  it('should have correct radio selected', () => {
    render(<YesNoField label="Test" value="yes" onChange={vi.fn()} />);
    const radios = screen.getAllByRole('radio');
    expect(radios[0]).toBeChecked(); // Yes
    expect(radios[1]).not.toBeChecked(); // No
  });

  it('should call onChange when clicking Yes', async () => {
    const onChange = vi.fn();
    render(<YesNoField label="Test" value="no" onChange={onChange} />);
    const user = userEvent.setup();
    await user.click(screen.getByText('Yes'));
    expect(onChange).toHaveBeenCalledWith('yes');
  });
});

describe('TextAreaField', () => {
  it('should render with label and value', () => {
    render(<TextAreaField label="Details" value="Some details" onChange={vi.fn()} />);
    expect(screen.getByText('Details')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Some details')).toBeInTheDocument();
  });

  it('should call onChange when typing', async () => {
    const onChange = vi.fn();
    render(<TextAreaField label="Notes" value="" onChange={onChange} />);
    const user = userEvent.setup();
    await user.type(screen.getByRole('textbox'), 'X');
    expect(onChange).toHaveBeenCalledWith('X');
  });
});
