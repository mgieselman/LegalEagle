import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { CreateClient } from '@/pages/staff/CreateClient';

// Mock api
vi.mock('@/api/client', () => ({
  api: {
    createClient: vi.fn(),
  },
}));

import { api } from '@/api/client';
const mockedApi = vi.mocked(api);

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function renderCreateClient() {
  return render(
    <MemoryRouter>
      <CreateClient />
    </MemoryRouter>,
  );
}

describe('CreateClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the form', () => {
    renderCreateClient();
    expect(screen.getByLabelText('First Name *')).toBeInTheDocument();
    expect(screen.getByLabelText('Last Name *')).toBeInTheDocument();
    expect(screen.getByText('Create Client & Case')).toBeInTheDocument();
  });

  it('should submit and navigate to new case', async () => {
    mockedApi.createClient.mockResolvedValue({ id: 'new-client', caseId: 'new-case' });

    renderCreateClient();
    const user = userEvent.setup();

    await act(async () => {
      await user.type(screen.getByLabelText('First Name *'), 'Jane');
      await user.type(screen.getByLabelText('Last Name *'), 'Smith');
      await user.click(screen.getByText('Create Client & Case'));
    });

    await waitFor(() => {
      expect(mockedApi.createClient).toHaveBeenCalledWith({
        firstName: 'Jane',
        lastName: 'Smith',
        email: '',
        phone: '',
        chapter: '7',
      });
      expect(mockNavigate).toHaveBeenCalledWith('/staff/case/new-case');
    });
  });

  it('should show error on failure', async () => {
    mockedApi.createClient.mockRejectedValue(new Error('Server error'));

    renderCreateClient();
    const user = userEvent.setup();

    await act(async () => {
      await user.type(screen.getByLabelText('First Name *'), 'Jane');
      await user.type(screen.getByLabelText('Last Name *'), 'Smith');
      await user.click(screen.getByText('Create Client & Case'));
    });

    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeInTheDocument();
    });
  });
});
