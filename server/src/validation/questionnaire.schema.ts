import { z } from 'zod/v4';

// Sub-type schemas — every field is a string (dates as YYYY-MM-DD, amounts as string)

export const priorAddressSchema = z.object({
  address: z.string(),
  dateMovedIn: z.string(),
  dateMovedOut: z.string(),
});

export const priorBankruptcySchema = z.object({
  chapter: z.string(),
  dateFiled: z.string(),
  didGetDischarge: z.string(),
  dischargeDate: z.string(),
  dismissedDate: z.string(),
  dismissedReason: z.string(),
});

export const incomeEntrySchema = z.object({
  youAmount: z.string(),
  youSource: z.string(),
  spouseAmount: z.string(),
  spouseSource: z.string(),
});

export const businessInfoSchema = z.object({
  dates: z.string(),
  name: z.string(),
  address: z.string(),
  othersInBusiness: z.string(),
});

export const employeeOwedSchema = z.object({
  name: z.string(),
  address: z.string(),
  datesWorked: z.string(),
  amountOwed: z.string(),
  workDone: z.string(),
});

export const welfareEntrySchema = z.object({
  person: z.string(),
  dates: z.string(),
  amounts: z.string(),
  place: z.string(),
});

export const taxOwedSchema = z.object({
  entity: z.string(),
  address: z.string(),
  kindOfTax: z.string(),
  years: z.string(),
  amount: z.string(),
});

export const debtRepaidSchema = z.object({
  creditorName: z.string(),
  creditorAddress: z.string(),
  isRelative: z.string(),
  paymentDates: z.string(),
  amount: z.string(),
});

export const studentLoanSchema = z.object({
  lender: z.string(),
  school: z.string(),
  didFinish: z.string(),
  whyNot: z.string(),
  collector: z.string(),
  amountPaid: z.string(),
  othersPayments: z.string(),
  othersAmount: z.string(),
});

export const lawsuitEntrySchema = z.object({
  caseName: z.string(),
  caseNo: z.string(),
  court: z.string(),
  typeOfCase: z.string(),
  result: z.string(),
  amount: z.string(),
});

export const criminalCaseSchema = z.object({
  caseNo: z.string(),
  courtName: z.string(),
  charges: z.string(),
  result: z.string(),
  finesOwed: z.string(),
});

export const adminCaseSchema = z.object({
  caseName: z.string(),
  caseNo: z.string(),
  agencyNameAddress: z.string(),
  typeOfCase: z.string(),
  result: z.string(),
});

export const foreclosureEntrySchema = z.object({
  property: z.string(),
  value: z.string(),
  date: z.string(),
  creditorNameAddress: z.string(),
});

export const garnishmentEntrySchema = z.object({
  creditorName: z.string(),
  creditorAddress: z.string(),
  amountTaken: z.string(),
  dates: z.string(),
});

export const repossessionEntrySchema = z.object({
  description: z.string(),
  monthYear: z.string(),
  whoRepossessed: z.string(),
  value: z.string(),
});

export const returnEntrySchema = z.object({
  description: z.string(),
  monthYear: z.string(),
  sellerNameAddress: z.string(),
  value: z.string(),
});

export const propertyHeldByOtherSchema = z.object({
  typeOfProperty: z.string(),
  value: z.string(),
  heldByNameAddress: z.string(),
  reason: z.string(),
});

export const giftTransferSchema = z.object({
  recipientName: z.string(),
  description: z.string(),
  monthYear: z.string(),
  saleOrGiftToRelative: z.string(),
});

export const propertySaleProceedsSchema = z.object({
  description: z.string(),
  monthYear: z.string(),
  amountReceived: z.string(),
  amountUsedForHome: z.string(),
});

export const lossEntrySchema = z.object({
  cause: z.string(),
  value: z.string(),
  date: z.string(),
});

export const consultantEntrySchema = z.object({
  name: z.string(),
  address: z.string(),
  date: z.string(),
});

export const closedBankAccountSchema = z.object({
  bankNameAddress: z.string(),
  acctNo: z.string(),
  typeOfAccount: z.string(),
  otherNames: z.string(),
  dateClosed: z.string(),
  finalBalance: z.string(),
});

export const safeDepositBoxSchema = z.object({
  bankNameAddress: z.string(),
  accessPersons: z.string(),
  contents: z.string(),
  dateClosed: z.string(),
});

export const propertyHeldForOtherSchema = z.object({
  typeOfProperty: z.string(),
  value: z.string(),
  ownedBy: z.string(),
  address: z.string(),
  isRelative: z.string(),
});

export const cosignerEntrySchema = z.object({
  creditorNameAddress: z.string(),
  cosignerNameAddress: z.string(),
  debts: z.string(),
});

export const cosignedDebtSchema = z.object({
  creditorNameAddress: z.string(),
  dateOfDebt: z.string(),
  amountOwing: z.string(),
  personCosignedFor: z.string(),
});

export const borrowedForOtherSchema = z.object({
  creditorNameAddress: z.string(),
  collectionAgent: z.string(),
  dateOfDebt: z.string(),
  whichSpouseOwes: z.string(),
  forWhat: z.string(),
  currentAmount: z.string(),
});

export const collateralOnCosignedSchema = z.object({
  creditor: z.string(),
  typeOfProperty: z.string(),
  currentValue: z.string(),
});

export const evictionSuitSchema = z.object({
  caseName: z.string(),
  caseNo: z.string(),
  courtNameAddress: z.string(),
  reason: z.string(),
  result: z.string(),
});

export const securedDebtSchema = z.object({
  lenderName: z.string(),
  address: z.string(),
  accountNumber: z.string(),
  currentBalance: z.string(),
  dateOpened: z.string(),
});

export const unsecuredDebtSchema = z.object({
  creditorName: z.string(),
  creditorAddress: z.string(),
  accountNo: z.string(),
  amountOwed: z.string(),
  dateOpened: z.string(),
});

export const personalPropertyItemSchema = z.object({
  item: z.string(),
  approximateAge: z.string(),
  value: z.string(),
});

export const householdItemSchema = z.object({
  name: z.string(),
  howMany: z.string(),
  yearPurchased: z.string(),
  value: z.string(),
});

export const vehicleEntrySchema = z.object({
  lenderName: z.string(),
  lenderAddress: z.string(),
  loanNumber: z.string(),
  percentageRate: z.string(),
  yearPurchased: z.string(),
  makeYearModel: z.string(),
  mileage: z.string(),
  condition: z.string(),
  approximateValue: z.string(),
  intention: z.string(),
});

export const bankDepositSchema = z.object({
  bankNameAddress: z.string(),
  amount: z.string(),
});

export const securityDepositSchema = z.object({
  personOrCompany: z.string(),
  address: z.string(),
  amount: z.string(),
});

export const financedItemSchema = z.object({
  item: z.string(),
  companyNameAddress: z.string(),
});

// Main QuestionnaireData schema
export const questionnaireDataSchema = z.object({
  // Section 1: Name & Residence
  fullName: z.string(),
  spouseFullName: z.string(),
  ssn: z.string(),
  spouseSsn: z.string(),
  dob: z.string(),
  spouseDob: z.string(),
  otherNames: z.string(),
  currentAddress: z.object({
    street: z.string(),
    city: z.string(),
    county: z.string(),
    zipCode: z.string(),
  }),
  leasing: z.object({
    isLeasing: z.string(),
    landlordName: z.string(),
    landlordAddress: z.string(),
    leaseTerms: z.string(),
  }),
  phone: z.string(),
  email: z.string(),
  priorAddresses: z.array(priorAddressSchema),

  // Section 2-3: Prior Bankruptcy
  priorBankruptcy: z.string(),
  priorBankruptcies: z.array(priorBankruptcySchema),
  otherBankruptcyOnHome: z.string(),
  otherBankruptcyDetails: z.string(),

  // Section 4: Occupation & Income
  usualTypeOfWork: z.string(),
  employerNameAddress: z.string(),
  spouseUsualWork: z.string(),
  spouseEmployerNameAddress: z.string(),
  jobDuration: z.string(),
  spouseJobDuration: z.string(),
  incomeThisYear: incomeEntrySchema,
  incomeLastYear: incomeEntrySchema,
  incomeYearBeforeLast: incomeEntrySchema,
  inBusiness: z.string(),
  businessInfo: z.array(businessInfoSchema),
  businessDebts: z.string(),
  businessDebtsDetails: z.string(),
  owesEmployeeWages: z.string(),
  employeesOwed: z.array(employeeOwedSchema),
  receivedMoneyToPurchase: z.string(),
  receivedMoneyDetails: z.string(),

  // Section 4J-O: Financial questions
  onWelfare: z.string(),
  familyOnWelfare: z.string(),
  welfareDetails: z.array(welfareEntrySchema),
  receivedExtraGovMoney: z.string(),
  extraGovMoneyDetails: z.string(),
  vacationTimeDue: z.string(),
  vacationTimeAmount: z.string(),
  hasIRA: z.string(),
  iraDetails: z.string(),
  tuitionProgram: z.string(),
  tuitionDetails: z.string(),
  isTrustBeneficiary: z.string(),
  trustDetails: z.string(),
  expectGiftOrInsurance: z.string(),
  giftInsuranceDetails: z.string(),
  expectInheritance: z.string(),
  inheritanceDetails: z.string(),
  inheritedAnything: z.string(),
  inheritedDetails: z.string(),

  // Section 5: Taxes
  receivedRefund: z.string(),
  refundState: z.string(),
  refundFederal: z.string(),
  expectRefund: z.string(),
  expectedRefundState: z.string(),
  expectedRefundFederal: z.string(),
  earnedIncomeCredit: z.string(),
  alreadyFiled: z.string(),
  expectedRefundDate: z.string(),
  someoneInterceptingRefund: z.string(),
  interceptDetails: z.string(),
  refundAnticipationLoan: z.string(),
  otherEntitledToRefund: z.string(),
  filedLast7Years: z.string(),
  hasCopiesLast4Years: z.string(),
  missingCopiesYears: z.string(),
  owesFederalTaxes: z.string(),
  federalTaxesOwed: z.array(taxOwedSchema),
  owesStateTaxes: z.string(),
  stateTaxesOwed: z.array(taxOwedSchema),
  owesLocalTaxes: z.string(),
  localTaxesOwed: z.array(taxOwedSchema),
  owesOtherGovMoney: z.string(),
  otherGovMoneyDetails: z.string(),

  // Section 6: Debts Repaid
  paymentsOver600: z.array(debtRepaidSchema),
  insiderPayments: z.string(),
  insiderPaymentDetails: z.string(),
  hasStudentLoan: z.string(),
  studentLoan: studentLoanSchema,

  // Section 7: Suits
  beenSued: z.string(),
  lawsuits: z.array(lawsuitEntrySchema),
  suitResultedInLien: z.string(),
  hasSuedOthers: z.string(),
  suitsFiled: z.array(lawsuitEntrySchema),
  criminalCharges: z.string(),
  criminalCases: z.array(criminalCaseSchema),
  adminCases: z.string(),
  adminCaseEntries: z.array(adminCaseSchema),
  possibleLawsuit: z.string(),
  possibleLawsuitDetails: z.string(),

  // Section 8: Garnishment
  foreclosureOrSale: z.string(),
  foreclosures: z.array(foreclosureEntrySchema),
  garnished: z.string(),
  garnishments: z.array(garnishmentEntrySchema),

  // Section 9: Repossessions
  repossessed: z.string(),
  repossessions: z.array(repossessionEntrySchema),
  voluntaryReturns: z.string(),
  returns: z.array(returnEntrySchema),

  // Section 10: Property Held by Others
  propertyHeldByOthers: z.string(),
  propertyHeldEntries: z.array(propertyHeldByOtherSchema),
  assignedProperty: z.string(),
  assignedPropertyDetails: z.string(),
  propertyWithReceiver: z.string(),
  propertyReceiverDetails: z.string(),
  propertyWithPawnbroker: z.string(),
  pawnbrokerDetails: z.string(),

  // Section 11: Gifts & Transfers
  madeGiftsOrTransfers: z.string(),
  giftsTransfers: z.array(giftTransferSchema),
  usedSaleProceeds: z.string(),
  saleProceeds: z.array(propertySaleProceedsSchema),

  // Section 12: Losses
  hadLosses: z.string(),
  losses: z.array(lossEntrySchema),
  insurancePaidLoss: z.string(),
  insurancePaymentDate: z.string(),
  insuranceAmountPaid: z.string(),

  // Section 13: Attorneys & Consultants
  attorneys: z.array(consultantEntrySchema),
  attorneyReason: z.string(),
  attorneyAmountPaid: z.string(),
  promisedPayment: z.string(),
  promisedPaymentDetails: z.string(),
  creditCounselingAgency: z.string(),
  creditCounselingDate: z.string(),
  agencyRepaymentPlan: z.string(),
  agencyPlanDetails: z.string(),
  agencyAmountPaid: z.string(),
  consultedOthers: z.string(),
  otherConsultantDetails: z.string(),
  debtsFromRefinancing: z.string(),
  refinancingDetails: z.string(),

  // Section 14: Closed Bank Accounts
  closedAccounts: z.string(),
  closedAccountEntries: z.array(closedBankAccountSchema),

  // Section 15: Safe Deposit Boxes
  hasSafeDepositBox: z.string(),
  safeDepositBoxes: z.array(safeDepositBoxSchema),

  // Section 16: Property Held for Others
  holdsPropertyForOthers: z.string(),
  propertyHeldForOthers: z.array(propertyHeldForOtherSchema),
  propertyHeldAddress: z.string(),

  // Section 17: Leases
  hasAutoLease: z.string(),
  autoLeaseDetails: z.string(),

  // Section 18: Cooperatives
  cooperativeDetails: z.string(),

  // Section 19: Alimony & Child Support
  previousMarriages: z.string(),
  formerSpouseName: z.string(),
  owedChildSupport: z.string(),
  owedChildSupportWho: z.string(),
  owedChildSupportAmount: z.string(),
  orderedChildSupport: z.string(),
  orderedAlimony: z.string(),
  propertySettlement: z.string(),
  propertySettlementDetails: z.string(),
  currentlyPaying: z.string(),
  payingTo: z.string(),
  behindInPayments: z.string(),
  requiredToSupport: z.string(),
  familyCourtHearings: z.string(),
  familyCourtDetails: z.string(),
  expectPropertySettlement: z.string(),

  // Section 20: Accidents
  vehicleAccident: z.string(),
  vehicleInAccident: z.string(),
  childrenInjuredOthers: z.string(),
  lostDriversLicense: z.string(),
  lostLicenseDetails: z.string(),

  // Section 21: Cosigners
  hasCosigners: z.string(),
  cosigners: z.array(cosignerEntrySchema),
  cosignedForOthers: z.string(),
  cosignedDebts: z.array(cosignedDebtSchema),
  borrowedForOthers: z.string(),
  borrowedForOtherEntries: z.array(borrowedForOtherSchema),
  collateralOnCosigned: z.array(collateralOnCosignedSchema),

  // Section 22: Credit Cards & Finance
  recentCashAdvances: z.string(),
  cashAdvanceDetails: z.string(),
  overCreditLimit: z.string(),
  overLimitDetails: z.string(),
  financeCollateral: z.string(),
  financeCollateralDetails: z.string(),
  paydayLoan: z.string(),
  paydayLoanDetails: z.string(),

  // Section 23: Evictions
  evictionSuit: z.string(),
  evictionSuits: z.array(evictionSuitSchema),
  landlordJudgment: z.string(),
  rentPaymentDetails: z.string(),
  landlordPlanningEviction: z.string(),
  landlordEvictionDetails: z.string(),

  // Section 24: Secured Debts
  hasSecuredDebts: z.string(),
  agreedCreditorCanTake: z.string(),
  securedDebts: z.array(securedDebtSchema),
  securedCollateralElsewhere: z.string(),
  securedCollateralLocation: z.string(),
  disputeSecuredDebts: z.string(),
  disputedSecuredDetails: z.string(),

  // Section 25: Unsecured Debts
  unsecuredDebts: z.array(unsecuredDebtSchema),

  // Section 26: Asset Listing
  cashOnHand: z.string(),
  bankDeposits: z.array(bankDepositSchema),
  securityDeposits: z.array(securityDepositSchema),
  personalPropertyItems: z.array(personalPropertyItemSchema),
  householdItems: z.array(householdItemSchema),
  financedItems: z.array(financedItemSchema),

  // Vehicles
  vehicles: z.array(vehicleEntrySchema),
});

export type ValidatedQuestionnaireData = z.infer<typeof questionnaireDataSchema>;
