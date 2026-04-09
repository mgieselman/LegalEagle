import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import { AuthProvider } from '@/context/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';

// Mock the API client
vi.mock('@/api/client', () => ({
  api: {
    getMe: vi.fn(),
    login: vi.fn(),
    listCases: vi.fn(),
    getCase: vi.fn(),
  },
  setToken: vi.fn(),
  clearToken: vi.fn(),
}));

import { api } from '@/api/client';

const mockedApi = vi.mocked(api);

function TestApp({ initialPath = '/' }: { initialPath?: string }) {
  return (
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<p>Login Page</p>} />
          <Route
            path="/staff/dashboard"
            element={
              <ProtectedRoute>
                <p>Staff Dashboard</p>
              </ProtectedRoute>
            }
          />
          <Route
            path="/staff/case/:id"
            element={
              <ProtectedRoute>
                <p>Case View</p>
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('Router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Token storage is mocked via setToken/clearToken
  });

  it('should redirect to login when not authenticated', async () => {
    mockedApi.getMe.mockRejectedValue(new Error('Unauthorized'));

    render(<TestApp initialPath="/staff/dashboard" />);

    await waitFor(() => {
      expect(screen.getByText('Login Page')).toBeInTheDocument();
    });
  });

  it('should show staff dashboard when authenticated', async () => {
    mockedApi.getMe.mockResolvedValue({
      userId: 'u1',
      lawFirmId: 'f1',
      role: 'admin',
      name: 'Admin',
      email: 'a@test.com',
    });

    render(<TestApp initialPath="/staff/dashboard" />);

    await waitFor(() => {
      expect(screen.getByText('Staff Dashboard')).toBeInTheDocument();
    });
  });

  it('should show case view when authenticated and navigating to case', async () => {
    mockedApi.getMe.mockResolvedValue({
      userId: 'u1',
      lawFirmId: 'f1',
      role: 'admin',
      name: 'Admin',
      email: 'a@test.com',
    });

    render(<TestApp initialPath="/staff/case/case-001" />);

    await waitFor(() => {
      expect(screen.getByText('Case View')).toBeInTheDocument();
    });
  });
});
