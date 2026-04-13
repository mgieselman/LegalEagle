import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { TabBar } from '@/components/ui/tab-bar';

// Mock navigation behavior since we can't easily test the actual routing
vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    NavLink: ({ children, to, end, className }: any) => {
      // Mock active state for the first tab (to='')
      const isActive = to === '';
      const computedClassName = typeof className === 'function' 
        ? className({ isActive }) 
        : className;
      return (
        <a 
          href={to} 
          className={computedClassName}
          data-testid={`tab-${to}`}
          data-end={end ? 'true' : 'false'}
        >
          {children}
        </a>
      );
    },
  };
});

describe('TabBar', () => {
  const staffTabs = [
    { label: 'Overview', to: '' },
    { label: 'Documents', to: 'documents' },
    { label: 'Questionnaire', to: 'questionnaire' },
    { label: 'Review', to: 'review' },
  ];

  const clientTabs = [
    { label: 'Overview', to: '' },
    { label: 'Documents', to: 'documents' },
    { label: 'Questionnaire', to: 'questionnaire' },
  ];

  it('renders all tab labels', () => {
    render(<TabBar tabs={staffTabs} />);

    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Documents')).toBeInTheDocument();
    expect(screen.getByText('Questionnaire')).toBeInTheDocument();
    expect(screen.getByText('Review')).toBeInTheDocument();
  });

  it('renders each tab as a NavLink with correct to prop', () => {
    render(<TabBar tabs={staffTabs} />);

    expect(screen.getByTestId('tab-')).toBeInTheDocument(); // Overview tab (to='')
    expect(screen.getByTestId('tab-documents')).toBeInTheDocument();
    expect(screen.getByTestId('tab-questionnaire')).toBeInTheDocument();
    expect(screen.getByTestId('tab-review')).toBeInTheDocument();
  });

  it('sets end prop for index tab (to="")', () => {
    render(<TabBar tabs={staffTabs} />);

    const overviewTab = screen.getByTestId('tab-');
    expect(overviewTab).toHaveAttribute('data-end', 'true');

    const documentsTab = screen.getByTestId('tab-documents');
    expect(documentsTab).toHaveAttribute('data-end', 'false');
  });

  it('applies active styling to the first tab in our mock', () => {
    render(<TabBar tabs={staffTabs} />);

    const overviewTab = screen.getByTestId('tab-');
    expect(overviewTab).toHaveClass('border-primary', 'text-foreground');

    const documentsTab = screen.getByTestId('tab-documents');
    expect(documentsTab).not.toHaveClass('border-primary', 'text-foreground');
  });

  it('renders client tabs without Review tab', () => {
    render(<TabBar tabs={clientTabs} />);

    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Documents')).toBeInTheDocument();
    expect(screen.getByText('Questionnaire')).toBeInTheDocument();
    expect(screen.queryByText('Review')).not.toBeInTheDocument();
  });

  it('applies correct CSS classes for styling', () => {
    render(<TabBar tabs={[{ label: 'Test', to: 'test' }]} />);

    const tab = screen.getByTestId('tab-test');
    expect(tab).toHaveClass(
      'px-4',
      'py-2',
      'text-sm',
      'font-medium',
      'text-muted-foreground',
      'hover:text-foreground',
      'transition-colors',
      'whitespace-nowrap',
      'border-b-2',
      'border-transparent'
    );
  });

  it('renders empty tabs array without errors', () => {
    render(<TabBar tabs={[]} />);
    
    // Should render the nav container but no tabs
    const nav = screen.getByRole('navigation');
    expect(nav).toBeInTheDocument();
    expect(nav.children).toHaveLength(1); // Just the div with flex
  });
});