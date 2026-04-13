import type { QuestionnaireData } from '@/types/questionnaire';
import type { StepConfig, SidebarSection } from '@/lib/step-configs';

/**
 * Maps each FormShell section number to the top-level QuestionnaireData keys it owns.
 * Used for per-section and per-step completion calculations.
 */
export const SECTION_FIELD_MAP: Record<string, (keyof QuestionnaireData)[]> = {
  // Section 1: Name & Residence
  '1': [
    'fullName', 'spouseFullName', 'ssn', 'spouseSsn', 'dob', 'spouseDob',
    'otherNames', 'currentAddress', 'leasing', 'phone', 'email', 'priorAddresses',
  ],
  // Section 2: Prior Bankruptcy
  '2': [
    'priorBankruptcy', 'priorBankruptcies', 'otherBankruptcyOnHome', 'otherBankruptcyDetails',
  ],
  // Section 3: Occupation & Income
  '3': [
    'usualTypeOfWork', 'employerNameAddress', 'spouseUsualWork', 'spouseEmployerNameAddress',
    'jobDuration', 'spouseJobDuration', 'incomeThisYear', 'incomeLastYear', 'incomeYearBeforeLast',
  ],
  // Section 4: Business & Employment
  '4': [
    'inBusiness', 'businessInfo', 'businessDebts', 'businessDebtsDetails',
    'owesEmployeeWages', 'employeesOwed', 'receivedMoneyToPurchase', 'receivedMoneyDetails',
  ],
  // Section 5: Financial Questions
  '5': [
    'onWelfare', 'familyOnWelfare', 'welfareDetails', 'receivedExtraGovMoney', 'extraGovMoneyDetails',
    'vacationTimeDue', 'vacationTimeAmount', 'hasIRA', 'iraDetails', 'tuitionProgram', 'tuitionDetails',
    'isTrustBeneficiary', 'trustDetails', 'expectGiftOrInsurance', 'giftInsuranceDetails',
    'expectInheritance', 'inheritanceDetails', 'inheritedAnything', 'inheritedDetails',
  ],
  // Section 6: Taxes
  '6': [
    'receivedRefund', 'refundState', 'refundFederal', 'expectRefund', 'expectedRefundState',
    'expectedRefundFederal', 'earnedIncomeCredit', 'alreadyFiled', 'expectedRefundDate',
    'someoneInterceptingRefund', 'interceptDetails', 'refundAnticipationLoan', 'otherEntitledToRefund',
    'filedLast7Years', 'hasCopiesLast4Years', 'missingCopiesYears',
    'owesFederalTaxes', 'federalTaxesOwed', 'owesStateTaxes', 'stateTaxesOwed',
    'owesLocalTaxes', 'localTaxesOwed', 'owesOtherGovMoney', 'otherGovMoneyDetails',
  ],
  // Section 7: Debts Repaid
  '7': [
    'paymentsOver600', 'insiderPayments', 'insiderPaymentDetails',
    'hasStudentLoan', 'studentLoan',
  ],
  // Section 8: Suits
  '8': [
    'beenSued', 'lawsuits', 'suitResultedInLien', 'hasSuedOthers', 'suitsFiled',
    'criminalCharges', 'criminalCases', 'adminCases', 'adminCaseEntries',
    'possibleLawsuit', 'possibleLawsuitDetails',
  ],
  // Section 9: Garnishment & Sheriff's Sale
  '9': [
    'foreclosureOrSale', 'foreclosures', 'garnished', 'garnishments',
  ],
  // Section 10: Repossessions & Returns
  '10': [
    'repossessed', 'repossessions', 'voluntaryReturns', 'returns',
  ],
  // Section 11: Property Held by Others
  '11': [
    'propertyHeldByOthers', 'propertyHeldEntries', 'assignedProperty', 'assignedPropertyDetails',
    'propertyWithReceiver', 'propertyReceiverDetails', 'propertyWithPawnbroker', 'pawnbrokerDetails',
  ],
  // Section 12: Gifts & Transfers
  '12': [
    'madeGiftsOrTransfers', 'giftsTransfers', 'usedSaleProceeds', 'saleProceeds',
  ],
  // Section 13: Losses
  '13': [
    'hadLosses', 'losses', 'insurancePaidLoss', 'insurancePaymentDate', 'insuranceAmountPaid',
  ],
  // Section 14: Attorneys & Consultants
  '14': [
    'attorneys', 'attorneyReason', 'attorneyAmountPaid', 'promisedPayment', 'promisedPaymentDetails',
    'creditCounselingAgency', 'creditCounselingDate', 'agencyRepaymentPlan', 'agencyPlanDetails',
    'agencyAmountPaid', 'consultedOthers', 'otherConsultantDetails',
    'debtsFromRefinancing', 'refinancingDetails',
  ],
  // Section 15: Closed Bank Accounts
  '15': ['closedAccounts', 'closedAccountEntries'],
  // Section 16: Safe Deposit Boxes
  '16': ['hasSafeDepositBox', 'safeDepositBoxes'],
  // Section 17: Property Held for Others
  '17': ['holdsPropertyForOthers', 'propertyHeldForOthers', 'propertyHeldAddress'],
  // Section 18: Leases & Cooperatives
  '18': ['hasAutoLease', 'autoLeaseDetails', 'cooperativeDetails'],
  // Section 19: Alimony, Child Support & Property Settlements
  '19': [
    'previousMarriages', 'formerSpouseName', 'owedChildSupport', 'owedChildSupportWho',
    'owedChildSupportAmount', 'orderedChildSupport', 'orderedAlimony',
    'propertySettlement', 'propertySettlementDetails', 'currentlyPaying', 'payingTo',
    'behindInPayments', 'requiredToSupport', 'familyCourtHearings', 'familyCourtDetails',
    'expectPropertySettlement',
  ],
  // Section 20: Accidents & Driver's License
  '20': [
    'vehicleAccident', 'vehicleInAccident', 'childrenInjuredOthers',
    'lostDriversLicense', 'lostLicenseDetails',
  ],
  // Section 21: Cosigners & Debts for Others
  '21': [
    'hasCosigners', 'cosigners', 'cosignedForOthers', 'cosignedDebts',
    'borrowedForOthers', 'borrowedForOtherEntries', 'collateralOnCosigned',
  ],
  // Section 22: Credit Cards & Finance Company Debts
  '22': [
    'recentCashAdvances', 'cashAdvanceDetails', 'overCreditLimit', 'overLimitDetails',
    'financeCollateral', 'financeCollateralDetails', 'paydayLoan', 'paydayLoanDetails',
  ],
  // Section 23: Evictions
  '23': [
    'evictionSuit', 'evictionSuits', 'landlordJudgment', 'rentPaymentDetails',
    'landlordPlanningEviction', 'landlordEvictionDetails',
  ],
  // Section 24: Secured Debts
  '24': [
    'hasSecuredDebts', 'agreedCreditorCanTake', 'securedDebts',
    'securedCollateralElsewhere', 'securedCollateralLocation',
    'disputeSecuredDebts', 'disputedSecuredDetails',
  ],
  // Section 25: Unsecured Debts
  '25': ['unsecuredDebts'],
  // Section 26: Asset Listing
  '26': [
    'cashOnHand', 'bankDeposits', 'securityDeposits',
    'personalPropertyItems', 'householdItems', 'financedItems',
  ],
  // Section 27: Vehicles
  '27': ['vehicles'],
};

/** Count filled vs total fields in a value (recursive for nested objects). */
function countFields(val: unknown): { filled: number; total: number } {
  if (typeof val === 'string') {
    return { total: 1, filled: val.trim() !== '' ? 1 : 0 };
  }
  if (Array.isArray(val)) {
    return { total: 1, filled: val.length > 0 ? 1 : 0 };
  }
  if (typeof val === 'object' && val !== null) {
    let filled = 0;
    let total = 0;
    for (const v of Object.values(val)) {
      const counts = countFields(v);
      filled += counts.filled;
      total += counts.total;
    }
    return { filled, total };
  }
  return { filled: 0, total: 0 };
}

/** Calculate completion percentage (0-100) for a single questionnaire section. */
export function calculateSectionCompletion(data: QuestionnaireData, sectionKey: string): number {
  const fields = SECTION_FIELD_MAP[sectionKey];
  if (!fields) return 0;

  let filled = 0;
  let total = 0;

  for (const fieldKey of fields) {
    const val = data[fieldKey];
    const counts = countFields(val);
    filled += counts.filled;
    total += counts.total;
  }

  if (total === 0) return 0;
  return Math.round((filled / total) * 100);
}

/** Calculate aggregate completion percentage across multiple sections. */
export function calculateStepCompletion(data: QuestionnaireData, sectionKeys: string[]): number {
  let filled = 0;
  let total = 0;

  for (const sectionKey of sectionKeys) {
    const fields = SECTION_FIELD_MAP[sectionKey];
    if (!fields) continue;

    for (const fieldKey of fields) {
      const val = data[fieldKey];
      const counts = countFields(val);
      filled += counts.filled;
      total += counts.total;
    }
  }

  if (total === 0) return 0;
  return Math.round((filled / total) * 100);
}

/** Get the completion status for a section. */
export type SectionStatus = 'complete' | 'in-progress' | 'not-started';

export function getSectionStatus(data: QuestionnaireData, sectionKey: string): SectionStatus {
  const pct = calculateSectionCompletion(data, sectionKey);
  if (pct === 100) return 'complete';
  if (pct > 0) return 'in-progress';
  return 'not-started';
}

/** Calculate overall completion across the entire questionnaire (replaces ProgressBar logic). */
export function calculateOverallCompletion(data: QuestionnaireData): number {
  const allSectionKeys = Object.keys(SECTION_FIELD_MAP);
  return calculateStepCompletion(data, allSectionKeys);
}

/** Get the completion status for a step (used by SegmentedProgressBar and StepSidebar). */
export function getStepStatus(step: StepConfig, data: QuestionnaireData | null): SectionStatus {
  if (step.completionSource === 'questionnaire' && step.sectionKeys && data) {
    const pct = calculateStepCompletion(data, step.sectionKeys);
    if (pct === 100) return 'complete';
    if (pct > 0) return 'in-progress';
    return 'not-started';
  }
  // For non-questionnaire steps, we can't determine completion from questionnaire data
  return 'not-started';
}

/** Get the completion status for a sidebar sub-section. */
export function getSubSectionStatus(section: SidebarSection, data: QuestionnaireData | null): SectionStatus {
  if (!data) return 'not-started';
  const pct = calculateStepCompletion(data, section.sectionKeys);
  if (pct === 100) return 'complete';
  if (pct > 0) return 'in-progress';
  return 'not-started';
}
