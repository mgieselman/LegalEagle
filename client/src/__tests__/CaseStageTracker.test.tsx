import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CaseStageTracker, getCurrentStageIndex } from '@/components/CaseStageTracker';
import type { CaseData } from '@/context/CaseContext';

function makeCaseData(overrides: Partial<CaseData> = {}): CaseData {
  return {
    id: 'case-1',
    clientId: 'client-1',
    clientFirstName: 'John',
    clientLastName: 'Doe',
    chapter: '7',
    status: 'intake',
    filingDate: null,
    filingDistrict: null,
    householdSize: 2,
    isJointFiling: false,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('getCurrentStageIndex', () => {
  it('returns 0 for intake status', () => {
    expect(getCurrentStageIndex(makeCaseData({ status: 'intake' }))).toBe(0);
  });

  it('returns 1 for documents status', () => {
    expect(getCurrentStageIndex(makeCaseData({ status: 'documents' }))).toBe(1);
  });

  it('returns 4 for review status', () => {
    expect(getCurrentStageIndex(makeCaseData({ status: 'review' }))).toBe(4);
  });

  it('returns 4 for ready_to_file status', () => {
    expect(getCurrentStageIndex(makeCaseData({ status: 'ready_to_file' }))).toBe(4);
  });

  it('returns 5 for filed status', () => {
    expect(getCurrentStageIndex(makeCaseData({ status: 'filed' }))).toBe(5);
  });

  it('returns 8 for discharged status', () => {
    expect(getCurrentStageIndex(makeCaseData({ status: 'discharged' }))).toBe(8);
  });

  it('returns -1 for dismissed status', () => {
    expect(getCurrentStageIndex(makeCaseData({ status: 'dismissed' }))).toBe(-1);
  });

  it('returns -1 for closed status', () => {
    expect(getCurrentStageIndex(makeCaseData({ status: 'closed' }))).toBe(-1);
  });
});

describe('CaseStageTracker', () => {
  it('renders all 9 stage labels', () => {
    render(<CaseStageTracker caseData={makeCaseData()} />);
    
    const labels = [
      'Intake', 'Documentation', 'Questionnaire', 'Credit Counseling',
      'Review', 'Filed', 'Debtor Education', 'Hearing', 'Discharged',
    ];
    for (const label of labels) {
      // Each label appears in both desktop and mobile views
      expect(screen.getAllByText(label).length).toBeGreaterThanOrEqual(1);
    }
  });

  it('shows dismissed message for dismissed case', () => {
    render(<CaseStageTracker caseData={makeCaseData({ status: 'dismissed' })} />);
    expect(screen.getByText('Case dismissed')).toBeInTheDocument();
  });

  it('shows closed message for closed case', () => {
    render(<CaseStageTracker caseData={makeCaseData({ status: 'closed' })} />);
    expect(screen.getByText('Case closed')).toBeInTheDocument();
  });

  it('renders check icons for completed stages', () => {
    const { container } = render(
      <CaseStageTracker caseData={makeCaseData({ status: 'review' })} />
    );
    // Review is stage index 4, so stages 0-4 should be complete (5 check icons visible)
    // Each stage has both desktop and mobile versions
    const primaryBgs = container.querySelectorAll('.bg-primary');
    expect(primaryBgs.length).toBeGreaterThanOrEqual(5);
  });
});
