import type { ReviewFinding } from '@/api/client';

/**
 * Maps fieldHint prefixes to section keys.
 * This is the primary routing mechanism — more reliable than section-name
 * keyword matching because it uses the actual field path from the questionnaire.
 * Order matters: more specific prefixes must come before shorter ones.
 */
const FIELD_HINT_PREFIX_MAP: [string, string][] = [
  // Section 1: Name / Residence
  ['fullName', '1'], ['ssn', '1'], ['dob', '1'], ['email', '1'], ['phone', '1'],
  ['currentAddress', '1'], ['otherNames', '1'],
  ['spouseFullName', '1'], ['spouseSsn', '1'], ['spouseDob', '1'],
  // Section 2: Prior Bankruptcy
  ['priorBankruptcy', '2'], ['otherBankruptcy', '2'],
  // Section 3: Occupation / Income
  ['usualTypeOfWork', '3'], ['employerNameAddress', '3'], ['jobDuration', '3'],
  ['spouseUsualWork', '3'], ['spouseEmployerNameAddress', '3'], ['spouseJobDuration', '3'],
  ['incomeThisYear', '3'], ['incomeLastYear', '3'], ['incomeYearBefore', '3'],
  // Section 4: Business
  ['inBusiness', '4'], ['businessDebts', '4'],
  // Section 5: Financial Questions
  ['onWelfare', '5'], ['familyOnWelfare', '5'], ['hasIRA', '5'], ['iraDetails', '5'],
  ['isTrustBeneficiary', '5'], ['trustDetails', '5'],
  ['expectInheritance', '5'], ['inheritanceDetails', '5'], ['inheritedAnything', '5'],
  ['expectGiftOrInsurance', '5'], ['giftInsuranceDetails', '5'],
  ['expectPropertySettlement', '5'], ['propertySettlementDetails', '5'],
  ['vacationTimeDue', '5'], ['vacationTimeAmount', '5'], ['possibleLawsuit', '5'],
  // Section 6: Taxes
  ['owesFederalTaxes', '6'], ['owesStateTaxes', '6'], ['owesLocalTaxes', '6'],
  ['refundFederal', '6'], ['refundState', '6'], ['receivedRefund', '6'],
  ['expectedRefundFederal', '6'], ['expectedRefundState', '6'],
  ['alreadyFiled', '6'], ['filedLast7Years', '6'], ['hasCopiesLast4Years', '6'],
  ['earnedIncomeCredit', '6'], ['refundAnticipationLoan', '6'],
  // Section 7: Debts Repaid
  ['paymentsOver600', '7'], ['insiderPayments', '7'], ['insiderPaymentDetails', '7'],
  ['hasStudentLoan', '7'], ['studentLoan', '7'],
  // Section 8: Suits
  ['beenSued', '8'], ['hasSuedOthers', '8'], ['lawsuits', '8'],
  ['adminCases', '8'], ['criminalCharges', '8'], ['suitResultedInLien', '8'],
  // Section 9: Garnishment / Foreclosure
  ['garnished', '9'], ['foreclosureOrSale', '9'],
  // Section 10: Repossessions
  ['repossessed', '10'],
  // Section 11: Property Held By Others
  ['propertyHeldByOthers', '11'], ['propertyHeldAddress', '11'],
  // Section 12: Gifts & Transfers
  ['madeGiftsOrTransfers', '12'], ['giftsTransfers', '12'],
  ['usedSaleProceeds', '12'], ['saleProceeds', '12'],
  // Section 13: Losses
  ['hadLosses', '13'], ['losses', '13'], ['insurancePaidLoss', '13'],
  // Section 14: Attorneys / Consultants
  ['attorneyAmountPaid', '14'], ['consultedOthers', '14'], ['creditCounselingAgency', '14'],
  // Section 15: Closed Bank Accounts
  ['closedAccounts', '15'], ['closedAccountEntries', '15'],
  // Section 16: Safe Deposit Boxes
  ['hasSafeDepositBox', '16'],
  // Section 17: Property Held For Others
  ['holdsPropertyForOthers', '17'], ['propertyReceiverDetails', '17'],
  // Section 18: Leases
  ['leasing', '18'], ['hasAutoLease', '18'], ['cooperativeDetails', '18'],
  // Section 19: Alimony / Support
  ['orderedAlimony', '19'], ['orderedChildSupport', '19'], ['previousMarriages', '19'],
  ['owedChildSupport', '19'], ['requiredToSupport', '19'],
  // Section 20: Accidents
  ['vehicleAccident', '20'], ['vehicleInAccident', '20'],
  // Section 21: Cosigners
  ['hasCosigners', '21'], ['cosignedForOthers', '21'], ['borrowedForOthers', '21'],
  // Section 22: Credit Cards / Cash Advances
  ['recentCashAdvances', '22'], ['cashAdvanceDetails', '22'],
  ['overCreditLimit', '22'], ['overLimitDetails', '22'],
  ['financeCollateral', '22'], ['financeCollateralDetails', '22'],
  ['paydayLoan', '22'], ['paydayLoanDetails', '22'],
  ['promisedPayment', '22'], ['promisedPaymentDetails', '22'],
  ['agreedCreditorCanTake', '22'],
  // Section 23: Evictions
  ['evictionSuit', '23'], ['landlordJudgment', '23'], ['landlordPlanningEviction', '23'],
  ['landlordEvictionDetails', '23'],
  // Section 24: Secured Debts
  ['hasSecuredDebts', '24'], ['securedDebts', '24'], ['disputeSecuredDebts', '24'],
  ['securedCollateralElsewhere', '24'],
  // Section 25: Unsecured Debts
  ['unsecuredDebts', '25'],
  // Section 26: Assets
  ['cashOnHand', '26'], ['bankDeposits', '26'], ['securityDeposits', '26'],
  ['personalPropertyItems', '26'], ['householdItems', '26'], ['financedItems', '26'],
  // Section 27: Vehicles
  ['vehicles', '27'],
];

/**
 * Maps a fieldHint dot-notation path to a section key using prefix matching.
 * Returns null if no prefix matches.
 */
function fieldHintToSectionKey(fieldHint: string): string | null {
  for (const [prefix, key] of FIELD_HINT_PREFIX_MAP) {
    if (
      fieldHint === prefix ||
      fieldHint.startsWith(prefix + '[') ||
      fieldHint.startsWith(prefix + '.')
    ) {
      return key;
    }
  }
  return null;
}

/**
 * Maps keywords found in AI review finding section names to form section keys.
 * Used as fallback when fieldHint is absent.
 */
const SECTION_KEYWORD_MAP: Record<string, string> = {
  'name': '1', 'residence': '1', 'personal': '1', 'ssn': '1', 'address': '1',
  'prior bankruptcy': '2', 'bankruptcy': '2',
  'occupation': '3', 'income': '3', 'employment': '3',
  'business': '4',
  'financial': '5', 'welfare': '5', 'ira': '5', 'retirement': '5', 'trust': '5', 'inheritance': '5',
  'tax': '6', 'refund': '6',
  'student loan': '7', 'insider': '7', 'preference': '7', 'debt repaid': '7',
  'suit': '8', 'legal': '8', 'lawsuit': '8', 'criminal': '8',
  'foreclosure': '9', 'garnish': '9',
  'repossess': '10',
  'property held by': '11',
  'gift': '12', 'transfer': '12',
  'loss': '13', 'fire': '13', 'theft': '13', 'gambling': '13',
  'attorney': '14', 'consultant': '14', 'counseling': '14',
  'closed account': '15', 'closed bank': '15', 'bank account': '15',
  'safe deposit': '16',
  'property held for': '17', 'property for other': '17',
  'lease': '18', 'cooperative': '18',
  'alimony': '19', 'child support': '19', 'marriage': '19',
  'accident': '20', 'driver': '20',
  'cosign': '21',
  'credit card': '22', 'cash advance': '22', 'payday': '22',
  'eviction': '23', 'landlord': '23',
  'secured debt': '24',
  'unsecured': '25',
  'asset': '26', 'cash on hand': '26',
  'vehicle': '27', 'car': '27', 'auto': '27',
};

/**
 * Maps an AI review finding's section name to a form section key
 * by matching keywords against known section topics.
 * Used as fallback when fieldHint is absent.
 */
export function sectionNameToKey(sectionName: string): string | null {
  const lower = sectionName.toLowerCase();
  for (const [keyword, key] of Object.entries(SECTION_KEYWORD_MAP)) {
    if (lower.includes(keyword)) return key;
  }
  return null;
}

/**
 * Resolves the section key for a finding.
 * Priority: fieldHint prefix > section name keywords > message keywords.
 */
export function findingToSectionKey(f: ReviewFinding): string | null {
  if (f.fieldHint) {
    const fromHint = fieldHintToSectionKey(f.fieldHint);
    if (fromHint) return fromHint;
  }
  return sectionNameToKey(f.section) || sectionNameToKey(f.message);
}

/**
 * Returns all findings that map to a given section key.
 */
export function findingsForSection(
  key: string,
  findings: ReviewFinding[],
): ReviewFinding[] {
  return findings.filter((f) => findingToSectionKey(f) === key);
}

/**
 * Compute the worst severity among findings that map to a given section key.
 */
export function sectionFindingSeverity(
  key: string,
  findings: ReviewFinding[],
): 'error' | 'warning' | 'info' | null {
  let worst: 'error' | 'warning' | 'info' | null = null;
  for (const f of findings) {
    if (findingToSectionKey(f) === key) {
      if (f.severity === 'error') return 'error';
      if (f.severity === 'warning') worst = worst === 'error' ? 'error' : 'warning';
      if (f.severity === 'info' && !worst) worst = 'info';
    }
  }
  return worst;
}
