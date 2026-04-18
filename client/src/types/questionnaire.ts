export interface AutofillSource {
  documentId: string;
  docClass: string;
  confidence: number;
}

export interface QuestionnaireMetadata {
  autofillSources: Record<string, AutofillSource>; // field path -> source
}

export interface PriorAddress {
  address: string;
  dateMovedIn: string;
  dateMovedOut: string;
}

export interface PriorBankruptcy {
  chapter: string;
  dateFiled: string;
  didGetDischarge: string;
  dischargeDate: string;
  dismissedDate: string;
  dismissedReason: string;
}

export interface IncomeEntry {
  youAmount: string;
  youSource: string;
  spouseAmount: string;
  spouseSource: string;
}

export interface BusinessInfo {
  dates: string;
  name: string;
  address: string;
  othersInBusiness: string;
}

export interface EmployeeOwed {
  name: string;
  address: string;
  datesWorked: string;
  amountOwed: string;
  workDone: string;
}

export interface WelfareEntry {
  person: string;
  dates: string;
  amounts: string;
  place: string;
}

export interface TaxOwed {
  entity: string;
  address: string;
  kindOfTax: string;
  years: string;
  amount: string;
}

export interface DebtRepaid {
  creditorName: string;
  creditorAddress: string;
  isRelative: string;
  paymentDates: string;
  amount: string;
}

export interface StudentLoan {
  lender: string;
  school: string;
  didFinish: string;
  whyNot: string;
  collector: string;
  amountPaid: string;
  othersPayments: string;
  othersAmount: string;
}

export interface LawsuitEntry {
  caseName: string;
  caseNo: string;
  court: string;
  typeOfCase: string;
  result: string;
  amount: string;
}

export interface CriminalCase {
  caseNo: string;
  courtName: string;
  charges: string;
  result: string;
  finesOwed: string;
}

export interface AdminCase {
  caseName: string;
  caseNo: string;
  agencyNameAddress: string;
  typeOfCase: string;
  result: string;
}

export interface ForeclosureEntry {
  property: string;
  value: string;
  date: string;
  creditorNameAddress: string;
}

export interface GarnishmentEntry {
  creditorName: string;
  creditorAddress: string;
  amountTaken: string;
  dates: string;
}

export interface RepossessionEntry {
  description: string;
  monthYear: string;
  whoRepossessed: string;
  value: string;
}

export interface ReturnEntry {
  description: string;
  monthYear: string;
  sellerNameAddress: string;
  value: string;
}

export interface PropertyHeldByOther {
  typeOfProperty: string;
  value: string;
  heldByNameAddress: string;
  reason: string;
}

export interface GiftTransfer {
  recipientName: string;
  description: string;
  monthYear: string;
  saleOrGiftToRelative: string;
}

export interface PropertySaleProceeds {
  description: string;
  monthYear: string;
  amountReceived: string;
  amountUsedForHome: string;
}

export interface LossEntry {
  cause: string;
  value: string;
  date: string;
}

export interface ConsultantEntry {
  name: string;
  address: string;
  date: string;
}

export interface ClosedBankAccount {
  bankNameAddress: string;
  acctNo: string;
  typeOfAccount: string;
  otherNames: string;
  dateClosed: string;
  finalBalance: string;
}

export interface SafeDepositBox {
  bankNameAddress: string;
  accessPersons: string;
  contents: string;
  dateClosed: string;
}

export interface PropertyHeldForOther {
  typeOfProperty: string;
  value: string;
  ownedBy: string;
  address: string;
  isRelative: string;
}

export interface CosignerEntry {
  creditorNameAddress: string;
  cosignerNameAddress: string;
  debts: string;
}

export interface CosignedDebt {
  creditorNameAddress: string;
  dateOfDebt: string;
  amountOwing: string;
  personCosignedFor: string;
}

export interface BorrowedForOther {
  creditorNameAddress: string;
  collectionAgent: string;
  dateOfDebt: string;
  whichSpouseOwes: string;
  forWhat: string;
  currentAmount: string;
}

export interface CollateralOnCosigned {
  creditor: string;
  typeOfProperty: string;
  currentValue: string;
}

export interface EvictionSuit {
  caseName: string;
  caseNo: string;
  courtNameAddress: string;
  reason: string;
  result: string;
}

export interface SecuredDebt {
  lenderName: string;
  address: string;
  accountNumber: string;
  currentBalance: string;
  dateOpened: string;
}

export interface UnsecuredDebt {
  creditorName: string;
  creditorAddress: string;
  accountNo: string;
  amountOwed: string;
  dateOpened: string;
}

export interface PersonalPropertyItem {
  item: string;
  approximateAge: string;
  value: string;
}

export interface HouseholdItem {
  name: string;
  howMany: string;
  yearPurchased: string;
  value: string;
}

export interface VehicleEntry {
  lenderName: string;
  lenderAddress: string;
  loanNumber: string;
  percentageRate: string;
  yearPurchased: string;
  makeYearModel: string;
  mileage: string;
  condition: string;
  approximateValue: string;
  intention: string; // "retain" | "reaffirm" | "surrender" | "redeem"
}

export interface BankDeposit {
  bankNameAddress: string;
  amount: string;
}

export interface SecurityDeposit {
  personOrCompany: string;
  address: string;
  amount: string;
}

export interface FinancedItem {
  item: string;
  companyNameAddress: string;
}

export interface QuestionnaireData {
  // Section 1: Name & Residence
  fullName: string;
  spouseFullName: string;
  ssn: string;
  spouseSsn: string;
  dob: string;
  spouseDob: string;
  otherNames: string;
  currentAddress: {
    street: string;
    city: string;
    county: string;
    zipCode: string;
  };
  leasing: {
    isLeasing: string;
    landlordName: string;
    landlordAddress: string;
    leaseTerms: string;
  };
  phone: string;
  email: string;
  priorAddresses: PriorAddress[];

  // Section 2-3: Prior Bankruptcy
  priorBankruptcy: string;
  priorBankruptcies: PriorBankruptcy[];
  otherBankruptcyOnHome: string;
  otherBankruptcyDetails: string;

  // Section 4: Occupation & Income
  usualTypeOfWork: string;
  employerNameAddress: string;
  spouseUsualWork: string;
  spouseEmployerNameAddress: string;
  jobDuration: string;
  spouseJobDuration: string;
  incomeThisYear: IncomeEntry;
  incomeLastYear: IncomeEntry;
  incomeYearBeforeLast: IncomeEntry;
  inBusiness: string;
  businessInfo: BusinessInfo[];
  businessDebts: string;
  businessDebtsDetails: string;
  owesEmployeeWages: string;
  employeesOwed: EmployeeOwed[];
  receivedMoneyToPurchase: string;
  receivedMoneyDetails: string;

  // Section 4J-O: Financial questions
  onWelfare: string;
  familyOnWelfare: string;
  welfareDetails: WelfareEntry[];
  receivedExtraGovMoney: string;
  extraGovMoneyDetails: string;
  vacationTimeDue: string;
  vacationTimeAmount: string;
  hasIRA: string;
  iraDetails: string;
  tuitionProgram: string;
  tuitionDetails: string;
  isTrustBeneficiary: string;
  trustDetails: string;
  expectGiftOrInsurance: string;
  giftInsuranceDetails: string;
  expectInheritance: string;
  inheritanceDetails: string;
  inheritedAnything: string;
  inheritedDetails: string;

  // Section 5: Taxes
  receivedRefund: string;
  refundState: string;
  refundFederal: string;
  expectRefund: string;
  expectedRefundState: string;
  expectedRefundFederal: string;
  earnedIncomeCredit: string;
  alreadyFiled: string;
  expectedRefundDate: string;
  someoneInterceptingRefund: string;
  interceptDetails: string;
  refundAnticipationLoan: string;
  otherEntitledToRefund: string;
  filedLast7Years: string;
  hasCopiesLast4Years: string;
  missingCopiesYears: string;
  owesFederalTaxes: string;
  federalTaxesOwed: TaxOwed[];
  owesStateTaxes: string;
  stateTaxesOwed: TaxOwed[];
  owesLocalTaxes: string;
  localTaxesOwed: TaxOwed[];
  owesOtherGovMoney: string;
  otherGovMoneyDetails: string;

  // Section 6: Debts Repaid
  paymentsOver600: DebtRepaid[];
  insiderPayments: string;
  insiderPaymentDetails: string;
  hasStudentLoan: string;
  studentLoan: StudentLoan;

  // Section 7: Suits
  beenSued: string;
  lawsuits: LawsuitEntry[];
  suitResultedInLien: string;
  hasSuedOthers: string;
  suitsFiled: LawsuitEntry[];
  criminalCharges: string;
  criminalCases: CriminalCase[];
  adminCases: string;
  adminCaseEntries: AdminCase[];
  possibleLawsuit: string;
  possibleLawsuitDetails: string;

  // Section 8: Garnishment
  foreclosureOrSale: string;
  foreclosures: ForeclosureEntry[];
  garnished: string;
  garnishments: GarnishmentEntry[];

  // Section 9: Repossessions
  repossessed: string;
  repossessions: RepossessionEntry[];
  voluntaryReturns: string;
  returns: ReturnEntry[];

  // Section 10: Property Held by Others
  propertyHeldByOthers: string;
  propertyHeldEntries: PropertyHeldByOther[];
  assignedProperty: string;
  assignedPropertyDetails: string;
  propertyWithReceiver: string;
  propertyReceiverDetails: string;
  propertyWithPawnbroker: string;
  pawnbrokerDetails: string;

  // Section 11: Gifts & Transfers
  madeGiftsOrTransfers: string;
  giftsTransfers: GiftTransfer[];
  usedSaleProceeds: string;
  saleProceeds: PropertySaleProceeds[];

  // Section 12: Losses
  hadLosses: string;
  losses: LossEntry[];
  insurancePaidLoss: string;
  insurancePaymentDate: string;
  insuranceAmountPaid: string;

  // Section 13: Attorneys & Consultants
  attorneys: ConsultantEntry[];
  attorneyReason: string;
  attorneyAmountPaid: string;
  promisedPayment: string;
  promisedPaymentDetails: string;
  creditCounselingAgency: string;
  creditCounselingDate: string;
  agencyRepaymentPlan: string;
  agencyPlanDetails: string;
  agencyAmountPaid: string;
  consultedOthers: string;
  otherConsultantDetails: string;
  debtsFromRefinancing: string;
  refinancingDetails: string;

  // Section 14: Closed Bank Accounts
  closedAccounts: string;
  closedAccountEntries: ClosedBankAccount[];

  // Section 15: Safe Deposit Boxes
  hasSafeDepositBox: string;
  safeDepositBoxes: SafeDepositBox[];

  // Section 16: Property Held for Others
  holdsPropertyForOthers: string;
  propertyHeldForOthers: PropertyHeldForOther[];
  propertyHeldAddress: string;

  // Section 17: Leases
  hasAutoLease: string;
  autoLeaseDetails: string;

  // Section 18: Cooperatives
  cooperativeDetails: string;

  // Section 19: Alimony & Child Support
  previousMarriages: string;
  formerSpouseName: string;
  owedChildSupport: string;
  owedChildSupportWho: string;
  owedChildSupportAmount: string;
  orderedChildSupport: string;
  orderedAlimony: string;
  propertySettlement: string;
  propertySettlementDetails: string;
  currentlyPaying: string;
  payingTo: string;
  behindInPayments: string;
  requiredToSupport: string;
  familyCourtHearings: string;
  familyCourtDetails: string;
  expectPropertySettlement: string;

  // Section 20: Accidents
  vehicleAccident: string;
  vehicleInAccident: string;
  childrenInjuredOthers: string;
  lostDriversLicense: string;
  lostLicenseDetails: string;

  // Section 21: Cosigners
  hasCosigners: string;
  cosigners: CosignerEntry[];
  cosignedForOthers: string;
  cosignedDebts: CosignedDebt[];
  borrowedForOthers: string;
  borrowedForOtherEntries: BorrowedForOther[];
  collateralOnCosigned: CollateralOnCosigned[];

  // Section 22: Credit Cards & Finance
  recentCashAdvances: string;
  cashAdvanceDetails: string;
  overCreditLimit: string;
  overLimitDetails: string;
  financeCollateral: string;
  financeCollateralDetails: string;
  paydayLoan: string;
  paydayLoanDetails: string;

  // Section 23: Evictions
  evictionSuit: string;
  evictionSuits: EvictionSuit[];
  landlordJudgment: string;
  rentPaymentDetails: string;
  landlordPlanningEviction: string;
  landlordEvictionDetails: string;

  // Section 24: Secured Debts (non-RE/vehicle)
  hasSecuredDebts: string;
  agreedCreditorCanTake: string;
  securedDebts: SecuredDebt[];
  securedCollateralElsewhere: string;
  securedCollateralLocation: string;
  disputeSecuredDebts: string;
  disputedSecuredDetails: string;

  // Section 25: Unsecured Debts
  unsecuredDebts: UnsecuredDebt[];

  // Section 26: Asset Listing
  cashOnHand: string;
  bankDeposits: BankDeposit[];
  securityDeposits: SecurityDeposit[];
  personalPropertyItems: PersonalPropertyItem[];
  householdItems: HouseholdItem[];
  financedItems: FinancedItem[];

  // Vehicles
  vehicles: VehicleEntry[];
}

/** Union of all value types that can appear in QuestionnaireData fields */
export type QuestionnaireValue =
  | string
  | string[]
  | Record<string, string>
  | Record<string, string>[]
  | PriorAddress[]
  | PriorBankruptcy[]
  | IncomeEntry
  | BusinessInfo[]
  | TaxOwed[]
  | DebtRepaid[]
  | StudentLoan[]
  | LawsuitEntry[]
  | CriminalCase[]
  | AdministrativeCase[]
  | ForeclosureEntry[]
  | GarnishmentEntry[]
  | RepossessionEntry[]
  | ReturnedProperty[]
  | PropertyHeldByOthers[]
  | PropertyAssignment[]
  | GiftTransfer[]
  | PropertySaleForHome[]
  | LossEntry[]
  | AttorneyConsulted[]
  | ClosedBankAccount[]
  | PropertyForOthers[]
  | CosignedDebt[]
  | BorrowedForOthers[]
  | CollateralProperty[]
  | UnsecuredDebt[]
  | BankDeposit[]
  | SecurityDeposit[]
  | PersonalPropertyItem[]
  | HouseholdItem[]
  | FinancedItem[]
  | VehicleEntry[];

/** Standard props for all form section components */
export interface SectionProps {
  data: QuestionnaireData;
  onChange: (path: string, value: QuestionnaireValue) => void;
  readOnly?: boolean;
  /** AI review findings scoped to this section. Passed down from FormShell. */
  findings?: import('@/api/client').ReviewFinding[];
}

export function createEmptyQuestionnaire(): QuestionnaireData {
  return {
    fullName: '', spouseFullName: '', ssn: '', spouseSsn: '',
    dob: '', spouseDob: '', otherNames: '',
    currentAddress: { street: '', city: '', county: '', zipCode: '' },
    leasing: { isLeasing: '', landlordName: '', landlordAddress: '', leaseTerms: '' },
    phone: '', email: '', priorAddresses: [],
    priorBankruptcy: 'no', priorBankruptcies: [],
    otherBankruptcyOnHome: 'no', otherBankruptcyDetails: '',
    usualTypeOfWork: '', employerNameAddress: '',
    spouseUsualWork: '', spouseEmployerNameAddress: '',
    jobDuration: '', spouseJobDuration: '',
    incomeThisYear: { youAmount: '', youSource: '', spouseAmount: '', spouseSource: '' },
    incomeLastYear: { youAmount: '', youSource: '', spouseAmount: '', spouseSource: '' },
    incomeYearBeforeLast: { youAmount: '', youSource: '', spouseAmount: '', spouseSource: '' },
    inBusiness: 'no', businessInfo: [],
    businessDebts: 'no', businessDebtsDetails: '',
    owesEmployeeWages: 'no', employeesOwed: [],
    receivedMoneyToPurchase: 'no', receivedMoneyDetails: '',
    onWelfare: 'no', familyOnWelfare: 'no', welfareDetails: [],
    receivedExtraGovMoney: 'no', extraGovMoneyDetails: '',
    vacationTimeDue: 'no', vacationTimeAmount: '',
    hasIRA: 'no', iraDetails: '',
    tuitionProgram: 'no', tuitionDetails: '',
    isTrustBeneficiary: 'no', trustDetails: '',
    expectGiftOrInsurance: 'no', giftInsuranceDetails: '',
    expectInheritance: 'no', inheritanceDetails: '',
    inheritedAnything: 'no', inheritedDetails: '',
    receivedRefund: 'no', refundState: '', refundFederal: '',
    expectRefund: 'no', expectedRefundState: '', expectedRefundFederal: '',
    earnedIncomeCredit: 'no', alreadyFiled: 'no', expectedRefundDate: '',
    someoneInterceptingRefund: 'no', interceptDetails: '',
    refundAnticipationLoan: 'no', otherEntitledToRefund: 'no',
    filedLast7Years: 'yes', hasCopiesLast4Years: 'yes', missingCopiesYears: '',
    owesFederalTaxes: 'no', federalTaxesOwed: [],
    owesStateTaxes: 'no', stateTaxesOwed: [],
    owesLocalTaxes: 'no', localTaxesOwed: [],
    owesOtherGovMoney: 'no', otherGovMoneyDetails: '',
    paymentsOver600: [], insiderPayments: 'no', insiderPaymentDetails: '',
    hasStudentLoan: 'no',
    studentLoan: { lender: '', school: '', didFinish: '', whyNot: '', collector: '', amountPaid: '', othersPayments: 'no', othersAmount: '' },
    beenSued: 'no', lawsuits: [], suitResultedInLien: 'no',
    hasSuedOthers: 'no', suitsFiled: [],
    criminalCharges: 'no', criminalCases: [],
    adminCases: 'no', adminCaseEntries: [],
    possibleLawsuit: 'no', possibleLawsuitDetails: '',
    foreclosureOrSale: 'no', foreclosures: [],
    garnished: 'no', garnishments: [],
    repossessed: 'no', repossessions: [],
    voluntaryReturns: 'no', returns: [],
    propertyHeldByOthers: 'no', propertyHeldEntries: [],
    assignedProperty: 'no', assignedPropertyDetails: '',
    propertyWithReceiver: 'no', propertyReceiverDetails: '',
    propertyWithPawnbroker: 'no', pawnbrokerDetails: '',
    madeGiftsOrTransfers: 'no', giftsTransfers: [],
    usedSaleProceeds: 'no', saleProceeds: [],
    hadLosses: 'no', losses: [],
    insurancePaidLoss: 'no', insurancePaymentDate: '', insuranceAmountPaid: '',
    attorneys: [], attorneyReason: '', attorneyAmountPaid: '',
    promisedPayment: 'no', promisedPaymentDetails: '',
    creditCounselingAgency: '', creditCounselingDate: '',
    agencyRepaymentPlan: 'no', agencyPlanDetails: '', agencyAmountPaid: '',
    consultedOthers: 'no', otherConsultantDetails: '',
    debtsFromRefinancing: 'no', refinancingDetails: '',
    closedAccounts: 'no', closedAccountEntries: [],
    hasSafeDepositBox: 'no', safeDepositBoxes: [],
    holdsPropertyForOthers: 'no', propertyHeldForOthers: [], propertyHeldAddress: '',
    hasAutoLease: 'no', autoLeaseDetails: '',
    cooperativeDetails: '',
    previousMarriages: 'no', formerSpouseName: '',
    owedChildSupport: 'no', owedChildSupportWho: '', owedChildSupportAmount: '',
    orderedChildSupport: 'no', orderedAlimony: 'no',
    propertySettlement: 'no', propertySettlementDetails: '',
    currentlyPaying: '', payingTo: '', behindInPayments: '',
    requiredToSupport: '', familyCourtHearings: 'no', familyCourtDetails: '',
    expectPropertySettlement: 'no',
    vehicleAccident: 'no', vehicleInAccident: 'no',
    childrenInjuredOthers: 'no', lostDriversLicense: 'no', lostLicenseDetails: '',
    hasCosigners: 'no', cosigners: [],
    cosignedForOthers: 'no', cosignedDebts: [],
    borrowedForOthers: 'no', borrowedForOtherEntries: [],
    collateralOnCosigned: [],
    recentCashAdvances: 'no', cashAdvanceDetails: '',
    overCreditLimit: 'no', overLimitDetails: '',
    financeCollateral: 'no', financeCollateralDetails: '',
    paydayLoan: 'no', paydayLoanDetails: '',
    evictionSuit: 'no', evictionSuits: [],
    landlordJudgment: 'no', rentPaymentDetails: '',
    landlordPlanningEviction: 'no', landlordEvictionDetails: '',
    hasSecuredDebts: 'no', agreedCreditorCanTake: 'no', securedDebts: [],
    securedCollateralElsewhere: 'no', securedCollateralLocation: '',
    disputeSecuredDebts: 'no', disputedSecuredDetails: '',
    unsecuredDebts: [],
    cashOnHand: '', bankDeposits: [], securityDeposits: [],
    personalPropertyItems: [], householdItems: [],
    financedItems: [],
    vehicles: [],
  };
}
