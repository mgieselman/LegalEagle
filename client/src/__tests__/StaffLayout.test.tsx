import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { StaffLayout } from '@/layouts/StaffLayout';

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', name: 'James Wilson', role: 'attorney' },
    logout: vi.fn(),
  }),
}));

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={['/staff/dashboard']}>
      <StaffLayout />
    </MemoryRouter>
  );
}

describe('StaffLayout collapsible sidebar', () => {
  let store: Record<string, string> = {};

  beforeEach(() => {
    store = {};
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: (k: string) => (k in store ? store[k] : null),
        setItem: (k: string, v: string) => {
          store[k] = v;
        },
        removeItem: (k: string) => {
          delete store[k];
        },
        clear: () => {
          store = {};
        },
      },
      writable: true,
    });
  });

  it('defaults to expanded — shows brand heading and full Sign out label', () => {
    renderLayout();
    expect(screen.getByRole('heading', { name: 'LegalEagle' })).toBeInTheDocument();
    expect(screen.getByText('James Wilson')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
    const toggle = screen.getByTestId('staff-sidebar-collapse-toggle');
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('hides labels and brand when collapsed, preserving icon-only nav', () => {
    store['staffLayoutSidebarCollapsed'] = 'true';
    renderLayout();
    expect(screen.queryByRole('heading', { name: 'LegalEagle' })).not.toBeInTheDocument();
    expect(screen.queryByText('James Wilson')).not.toBeInTheDocument();

    const dashboard = screen.getByRole('link', { name: 'Dashboard' });
    expect(dashboard).toHaveAttribute('title', 'Dashboard');
    expect(dashboard).toHaveAttribute('href', '/staff/dashboard');

    const signOut = screen.getByRole('button', { name: 'Sign out' });
    expect(signOut).toHaveAttribute('title', 'Sign out');
  });

  it('persists toggle state to localStorage', () => {
    renderLayout();
    const toggle = screen.getByTestId('staff-sidebar-collapse-toggle');

    act(() => {
      toggle.click();
    });
    expect(store['staffLayoutSidebarCollapsed']).toBe('true');
    expect(toggle).toHaveAttribute('aria-label', 'Expand sidebar');

    act(() => {
      toggle.click();
    });
    expect(store['staffLayoutSidebarCollapsed']).toBe('false');
    expect(toggle).toHaveAttribute('aria-label', 'Collapse sidebar');
  });
});
