import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { StepSidebar } from '@/components/case-shell/StepSidebar';
import { SectionNavProvider } from '@/context/SectionNavContext';
import { STAFF_STEPS } from '@/lib/step-configs';

vi.mock('@/context/CaseContext', () => ({
  useCaseContext: () => ({
    questionnaire: null,
    caseData: null,
    isLoading: false,
    error: null,
  }),
}));

function renderSidebar(collapsed: boolean) {
  return render(
    <MemoryRouter>
      <SectionNavProvider>
        <StepSidebar
          steps={STAFF_STEPS}
          activeStepKey="intake"
          data={null}
          collapsed={collapsed}
        />
      </SectionNavProvider>
    </MemoryRouter>
  );
}

describe('StepSidebar collapsed mode', () => {
  it('hides step labels when collapsed', () => {
    renderSidebar(true);
    expect(screen.queryByText('Intake')).not.toBeInTheDocument();
    expect(screen.queryByText('Documents')).not.toBeInTheDocument();
  });

  it('renders one icon link per step when collapsed, with tooltip label', () => {
    renderSidebar(true);
    const intakeLink = screen.getByRole('link', { name: 'Intake' });
    expect(intakeLink).toHaveAttribute('title', 'Intake');
    expect(intakeLink).toHaveAttribute('href', '/intake');
    // All staff steps rendered
    for (const step of STAFF_STEPS) {
      expect(screen.getByRole('link', { name: step.label })).toBeInTheDocument();
    }
  });

  it('does not render sub-sections when collapsed (even for active expandable step)', () => {
    renderSidebar(true);
    // Intake step has sub-sections (Name & Residence etc.) — should not appear in rail
    expect(screen.queryByText('Name & Residence')).not.toBeInTheDocument();
  });

  it('shows labels and sub-sections when not collapsed', () => {
    renderSidebar(false);
    expect(screen.getByText('Intake')).toBeInTheDocument();
    // Active step is intake — its sub-sections should be auto-expanded
    expect(screen.getByText('Name & Residence')).toBeInTheDocument();
  });

  it('marks active step with ring styling when collapsed', () => {
    renderSidebar(true);
    const intakeLink = screen.getByRole('link', { name: 'Intake' });
    expect(intakeLink.className).toMatch(/ring-primary/);
  });
});
