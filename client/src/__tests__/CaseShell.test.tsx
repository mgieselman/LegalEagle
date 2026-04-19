import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { CaseShell } from '@/components/case-shell/CaseShell';
import { STAFF_STEPS } from '@/lib/step-configs';

vi.mock('@/context/CaseContext', () => ({
  useCaseContext: () => ({
    questionnaire: { id: 'q1', name: 'Test', data: {}, version: 1 },
    caseData: null,
    isLoading: false,
    error: null,
  }),
}));

vi.mock('@/components/case-shell/ActionBar', () => ({
  ActionBar: () => <div data-testid="action-bar" />,
}));

vi.mock('@/components/case-shell/SegmentedProgressBar', () => ({
  SegmentedProgressBar: () => <div data-testid="progress-bar" />,
}));

function renderShell() {
  return render(
    <MemoryRouter initialEntries={['/staff/case/case-1/intake']}>
      <CaseShell steps={STAFF_STEPS} backTo="/staff/dashboard" backLabel="Back" mode="staff" />
    </MemoryRouter>
  );
}

describe('CaseShell collapsible sidebar', () => {
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

  it('defaults to expanded when no localStorage value is set', () => {
    renderShell();
    const toggle = screen.getByTestId('sidebar-collapse-toggle');
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveAttribute('aria-label', 'Collapse sidebar');
  });

  it('reads collapsed state from localStorage on mount', () => {
    store['caseShellSidebarCollapsed'] = 'true';
    renderShell();
    const toggle = screen.getByTestId('sidebar-collapse-toggle');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveAttribute('aria-label', 'Expand sidebar');
  });

  it('persists toggle state to localStorage', () => {
    renderShell();
    const toggle = screen.getByTestId('sidebar-collapse-toggle');

    act(() => {
      toggle.click();
    });

    expect(window.localStorage.getItem('caseShellSidebarCollapsed')).toBe('true');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    act(() => {
      toggle.click();
    });

    expect(window.localStorage.getItem('caseShellSidebarCollapsed')).toBe('false');
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });
});
