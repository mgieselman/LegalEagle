import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from '@/context/AuthContext';

// Mock the API client
vi.mock('@/api/client', () => ({
  api: {
    getMe: vi.fn(),
    login: vi.fn(),
  },
  setToken: vi.fn(),
  clearToken: vi.fn(),
}));

import { api, setToken, clearToken } from '@/api/client';

const mockedApi = vi.mocked(api);
const mockedSetToken = vi.mocked(setToken);
const mockedClearToken = vi.mocked(clearToken);

function TestConsumer() {
  const { user, isAuthenticated, isLoading, login, logout } = useAuth();
  return (
    <div>
      <p data-testid="loading">{String(isLoading)}</p>
      <p data-testid="authenticated">{String(isAuthenticated)}</p>
      <p data-testid="user-name">{user?.name ?? 'none'}</p>
      <p data-testid="user-role">{user?.role ?? 'none'}</p>
      <button onClick={() => login('test@test.com')}>Login</button>
      <button onClick={logout}>Logout</button>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Token storage is mocked via setToken/clearToken
  });

  it('should show loading initially then resolve to authenticated when getMe succeeds', async () => {
    mockedApi.getMe.mockResolvedValue({
      userId: 'u1',
      lawFirmId: 'f1',
      role: 'admin',
      name: 'Test Admin',
      email: 'admin@test.com',
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    // Initially loading
    expect(screen.getByTestId('loading').textContent).toBe('true');

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    expect(screen.getByTestId('authenticated').textContent).toBe('true');
    expect(screen.getByTestId('user-name').textContent).toBe('Test Admin');
  });

  it('should show unauthenticated when getMe fails', async () => {
    mockedApi.getMe.mockRejectedValue(new Error('Unauthorized'));

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    expect(screen.getByTestId('authenticated').textContent).toBe('false');
    expect(screen.getByTestId('user-name').textContent).toBe('none');
  });

  it('should login and store token', async () => {
    mockedApi.getMe.mockRejectedValue(new Error('No session'));
    mockedApi.login.mockResolvedValue({
      token: 'dev-u1',
      user: {
        userId: 'u1',
        lawFirmId: 'f1',
        role: 'attorney',
        name: 'Test Attorney',
        email: 'attorney@test.com',
      },
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    const user = userEvent.setup();
    await act(async () => {
      await user.click(screen.getByText('Login'));
    });

    expect(mockedSetToken).toHaveBeenCalledWith('dev-u1');
    expect(screen.getByTestId('authenticated').textContent).toBe('true');
    expect(screen.getByTestId('user-name').textContent).toBe('Test Attorney');
  });

  it('should logout and clear token', async () => {
    mockedApi.getMe.mockResolvedValue({
      userId: 'u1',
      lawFirmId: 'f1',
      role: 'admin',
      name: 'Admin',
      email: 'a@test.com',
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('true');
    });

    const user = userEvent.setup();
    await act(async () => {
      await user.click(screen.getByText('Logout'));
    });

    expect(mockedClearToken).toHaveBeenCalled();
    expect(screen.getByTestId('authenticated').textContent).toBe('false');
  });
});
