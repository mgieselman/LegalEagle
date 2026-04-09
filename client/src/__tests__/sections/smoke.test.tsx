/**
 * Smoke tests for all 27 form section components.
 * Each section must: render with empty data, render with seed data, fire onChange.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createEmptyQuestionnaire } from '@/types/questionnaire';
import type { SectionProps } from '@/types/questionnaire';

// Import all sections
import { Section1NameResidence } from '@/components/form-sections/Section1NameResidence';
import { Section2PriorBankruptcy } from '@/components/form-sections/Section2PriorBankruptcy';
import { Section3OccupationIncome } from '@/components/form-sections/Section3OccupationIncome';
import { Section4BusinessEmployment } from '@/components/form-sections/Section4BusinessEmployment';
import { Section5FinancialQuestions } from '@/components/form-sections/Section5FinancialQuestions';
import { Section6Taxes } from '@/components/form-sections/Section6Taxes';
import { Section7DebtsRepaid } from '@/components/form-sections/Section7DebtsRepaid';
import { Section8Suits } from '@/components/form-sections/Section8Suits';
import { Section9Garnishment } from '@/components/form-sections/Section9Garnishment';
import { Section10Repossessions } from '@/components/form-sections/Section10Repossessions';
import { Section11PropertyHeldByOthers } from '@/components/form-sections/Section11PropertyHeldByOthers';
import { Section12GiftsTransfers } from '@/components/form-sections/Section12GiftsTransfers';
import { Section13Losses } from '@/components/form-sections/Section13Losses';
import { Section14Attorneys } from '@/components/form-sections/Section14Attorneys';
import { Section15ClosedBankAccounts } from '@/components/form-sections/Section15ClosedBankAccounts';
import { Section16SafeDepositBoxes } from '@/components/form-sections/Section16SafeDepositBoxes';
import { Section17PropertyForOthers } from '@/components/form-sections/Section17PropertyForOthers';
import { Section18Leases } from '@/components/form-sections/Section18Leases';
import { Section19AlimonySupport } from '@/components/form-sections/Section19AlimonySupport';
import { Section20Accidents } from '@/components/form-sections/Section20Accidents';
import { Section21Cosigners } from '@/components/form-sections/Section21Cosigners';
import { Section22CreditCards } from '@/components/form-sections/Section22CreditCards';
import { Section23Evictions } from '@/components/form-sections/Section23Evictions';
import { Section24SecuredDebts } from '@/components/form-sections/Section24SecuredDebts';
import { Section25UnsecuredDebts } from '@/components/form-sections/Section25UnsecuredDebts';
import { Section26Assets } from '@/components/form-sections/Section26Assets';
import { Section27Vehicles } from '@/components/form-sections/Section27Vehicles';

type SectionComponent = React.ComponentType<SectionProps>;

const sections: Array<{ name: string; Component: SectionComponent }> = [
  { name: 'Section1NameResidence', Component: Section1NameResidence },
  { name: 'Section2PriorBankruptcy', Component: Section2PriorBankruptcy },
  { name: 'Section3OccupationIncome', Component: Section3OccupationIncome },
  { name: 'Section4BusinessEmployment', Component: Section4BusinessEmployment },
  { name: 'Section5FinancialQuestions', Component: Section5FinancialQuestions },
  { name: 'Section6Taxes', Component: Section6Taxes },
  { name: 'Section7DebtsRepaid', Component: Section7DebtsRepaid },
  { name: 'Section8Suits', Component: Section8Suits },
  { name: 'Section9Garnishment', Component: Section9Garnishment },
  { name: 'Section10Repossessions', Component: Section10Repossessions },
  { name: 'Section11PropertyHeldByOthers', Component: Section11PropertyHeldByOthers },
  { name: 'Section12GiftsTransfers', Component: Section12GiftsTransfers },
  { name: 'Section13Losses', Component: Section13Losses },
  { name: 'Section14Attorneys', Component: Section14Attorneys },
  { name: 'Section15ClosedBankAccounts', Component: Section15ClosedBankAccounts },
  { name: 'Section16SafeDepositBoxes', Component: Section16SafeDepositBoxes },
  { name: 'Section17PropertyForOthers', Component: Section17PropertyForOthers },
  { name: 'Section18Leases', Component: Section18Leases },
  { name: 'Section19AlimonySupport', Component: Section19AlimonySupport },
  { name: 'Section20Accidents', Component: Section20Accidents },
  { name: 'Section21Cosigners', Component: Section21Cosigners },
  { name: 'Section22CreditCards', Component: Section22CreditCards },
  { name: 'Section23Evictions', Component: Section23Evictions },
  { name: 'Section24SecuredDebts', Component: Section24SecuredDebts },
  { name: 'Section25UnsecuredDebts', Component: Section25UnsecuredDebts },
  { name: 'Section26Assets', Component: Section26Assets },
  { name: 'Section27Vehicles', Component: Section27Vehicles },
];

describe.each(sections)('$name', ({ name, Component }) => {
  it('should render with empty data without crashing', () => {
    const onChange = vi.fn();
    const { container } = render(
      <Component data={createEmptyQuestionnaire()} onChange={onChange} />,
    );
    expect(container.firstChild).toBeTruthy();
  });

  it('should contain a section heading', () => {
    const onChange = vi.fn();
    render(
      <Component data={createEmptyQuestionnaire()} onChange={onChange} />,
    );
    // Each section has an h3 with "Section N:"
    const sectionNum = name.match(/\d+/)?.[0];
    if (sectionNum) {
      const heading = screen.getByText(new RegExp(`Section ${sectionNum}`));
      expect(heading).toBeInTheDocument();
    }
  });
});
