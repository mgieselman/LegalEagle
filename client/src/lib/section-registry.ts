import type { FC } from 'react';
import type { SectionProps } from '@/types/questionnaire';

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

export interface SectionDefinition {
  key: string;
  title: string;
  Component: FC<SectionProps>;
}

export const ALL_SECTIONS: SectionDefinition[] = [
  { key: '1', title: '1. Name & Residence Information', Component: Section1NameResidence },
  { key: '2', title: '2. Prior Bankruptcy', Component: Section2PriorBankruptcy },
  { key: '3', title: '3. Occupation & Income', Component: Section3OccupationIncome },
  { key: '4', title: '4. Business & Employment', Component: Section4BusinessEmployment },
  { key: '5', title: '5. Financial Questions', Component: Section5FinancialQuestions },
  { key: '6', title: '6. Taxes', Component: Section6Taxes },
  { key: '7', title: '7. Debts Repaid', Component: Section7DebtsRepaid },
  { key: '8', title: '8. Suits', Component: Section8Suits },
  { key: '9', title: '9. Garnishment & Sheriff\'s Sale', Component: Section9Garnishment },
  { key: '10', title: '10. Repossessions & Returns', Component: Section10Repossessions },
  { key: '11', title: '11. Property Held by Others', Component: Section11PropertyHeldByOthers },
  { key: '12', title: '12. Gifts & Transfers', Component: Section12GiftsTransfers },
  { key: '13', title: '13. Losses', Component: Section13Losses },
  { key: '14', title: '14. Attorneys & Consultants', Component: Section14Attorneys },
  { key: '15', title: '15. Closed Bank Accounts', Component: Section15ClosedBankAccounts },
  { key: '16', title: '16. Safe Deposit Boxes', Component: Section16SafeDepositBoxes },
  { key: '17', title: '17. Property Held for Others', Component: Section17PropertyForOthers },
  { key: '18', title: '18. Leases & Cooperatives', Component: Section18Leases },
  { key: '19', title: '19. Alimony, Child Support & Property Settlements', Component: Section19AlimonySupport },
  { key: '20', title: '20. Accidents & Driver\'s License', Component: Section20Accidents },
  { key: '21', title: '21. Cosigners & Debts for Others', Component: Section21Cosigners },
  { key: '22', title: '22. Credit Cards & Finance Company Debts', Component: Section22CreditCards },
  { key: '23', title: '23. Evictions', Component: Section23Evictions },
  { key: '24', title: '24. Secured Debts', Component: Section24SecuredDebts },
  { key: '25', title: '25. Unsecured Debts', Component: Section25UnsecuredDebts },
  { key: '26', title: '26. Asset Listing', Component: Section26Assets },
  { key: '27', title: '27. Vehicles', Component: Section27Vehicles },
];

/**
 * Filter ALL_SECTIONS to only those whose key is in the given array.
 * Preserves the order from ALL_SECTIONS (not the order of keys).
 */
export function getSectionsForKeys(keys: string[]): SectionDefinition[] {
  const keySet = new Set(keys);
  return ALL_SECTIONS.filter((s) => keySet.has(s.key));
}
