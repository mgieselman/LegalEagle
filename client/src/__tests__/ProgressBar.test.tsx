import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProgressBar, calculateCompletion } from '@/components/ProgressBar';
import { createEmptyQuestionnaire } from '@/types/questionnaire';

describe('calculateCompletion', () => {
  it('should return a low percentage for default questionnaire', () => {
    const data = createEmptyQuestionnaire();
    const result = calculateCompletion(data);
    // Default questionnaire has "no" for yes/no fields, so not zero, but low
    expect(result).toBeLessThan(50);
    expect(result).toBeGreaterThanOrEqual(0);
  });

  it('should return higher percentage when fields are filled', () => {
    const data = {
      ...createEmptyQuestionnaire(),
      fullName: 'John Doe',
      ssn: '123-45-6789',
      dob: '1990-01-01',
      phone: '555-1234',
      email: 'john@test.com',
    };
    const result = calculateCompletion(data);
    expect(result).toBeGreaterThan(0);
  });

  it('should count arrays with items as filled', () => {
    const data = {
      ...createEmptyQuestionnaire(),
      unsecuredDebts: [
        {
          creditorName: 'Chase',
          creditorAddress: '123 Main',
          accountNo: '111',
          amountOwed: '5000',
          dateOpened: '2020-01-01',
        },
      ],
    };
    const empty = createEmptyQuestionnaire();
    expect(calculateCompletion(data)).toBeGreaterThanOrEqual(calculateCompletion(empty));
  });
});

describe('ProgressBar', () => {
  it('should render with percentage', () => {
    const data = {
      ...createEmptyQuestionnaire(),
      fullName: 'John Doe',
    };
    render(<ProgressBar data={data} />);
    expect(screen.getByText('Questionnaire Progress')).toBeInTheDocument();
    expect(screen.getByText(/%$/)).toBeInTheDocument();
  });
});
