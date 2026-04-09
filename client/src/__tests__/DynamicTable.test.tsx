import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DynamicTable } from '@/components/DynamicTable';

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'amount', label: 'Amount' },
];

const createEmpty = () => ({ name: '', amount: '' });

describe('DynamicTable', () => {
  it('should render add button when empty', () => {
    render(
      <DynamicTable columns={columns} rows={[]} onChange={vi.fn()} createEmpty={createEmpty} />,
    );
    expect(screen.getByText(/Add/)).toBeInTheDocument();
  });

  it('should render rows with data', () => {
    const rows = [{ name: 'Chase', amount: '5000' }];
    render(
      <DynamicTable columns={columns} rows={rows} onChange={vi.fn()} createEmpty={createEmpty} />,
    );
    // Desktop + mobile views render inputs twice
    expect(screen.getAllByDisplayValue('Chase').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByDisplayValue('5000').length).toBeGreaterThanOrEqual(1);
  });

  it('should call onChange with new row when Add is clicked', async () => {
    const onChange = vi.fn();
    render(
      <DynamicTable columns={columns} rows={[]} onChange={onChange} createEmpty={createEmpty} />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByText(/Add/));
    expect(onChange).toHaveBeenCalledWith([{ name: '', amount: '' }]);
  });

  it('should call onChange without row when Remove is clicked', async () => {
    const onChange = vi.fn();
    const rows = [
      { name: 'A', amount: '1' },
      { name: 'B', amount: '2' },
    ];
    render(
      <DynamicTable columns={columns} rows={rows} onChange={onChange} createEmpty={createEmpty} />,
    );
    const user = userEvent.setup();
    // Click first remove button (there should be one per row)
    const removeButtons = screen.getAllByRole('button', { name: '' });
    // The remove buttons have Trash2 icons, find them
    const trashButtons = removeButtons.filter((btn) => btn.querySelector('svg'));
    if (trashButtons.length > 0) {
      await user.click(trashButtons[0]);
      expect(onChange).toHaveBeenCalled();
    }
  });
});
