import './env';
import { createForm, listForms } from './services/db';
import { v4 as uuidv4 } from 'uuid';

const seedData = {
  // Section 1: Name & Residence
  fullName: 'Robert James Martinez',
  spouseFullName: 'Linda Marie Martinez',
  ssn: '412-58-9203',
  spouseSsn: '519-73-4186',
  dob: '1978-11-03',
  spouseDob: '1981-04-17',
  otherNames: 'Bobby Martinez',
  currentAddress: {
    street: '2847 Maple Drive, Apt 4B',
    city: 'Hartford',
    county: 'Hartford',
    zipCode: '06103',
  },
  leasing: {
    isLeasing: 'yes',
    landlordName: 'Riverside Property Management',
    landlordAddress: '100 Commerce St, Hartford CT 06103',
    leaseTerms: 'Monthly, lease began January 2023',
  },
  phone: '860-555-0147',
  email: 'rmartinez78@gmail.com',
  priorAddresses: [
    { address: '519 Elm Street, New Britain CT 06051', dateMovedIn: '2019-03', dateMovedOut: '2022-12' },
    { address: '88 Park Ave, West Hartford CT 06119', dateMovedIn: '2015-06', dateMovedOut: '2019-02' },
  ],

  // Section 2-3: Prior Bankruptcy
  priorBankruptcy: 'no',
  priorBankruptcies: [],
  otherBankruptcyOnHome: 'no',
  otherBankruptcyDetails: '',

  // Section 4: Occupation & Income
  usualTypeOfWork: 'Auto Mechanic',
  employerNameAddress: 'Precision Auto Repair, 340 Franklin Ave, Hartford CT 06114',
  spouseUsualWork: 'Home Health Aide',
  spouseEmployerNameAddress: 'ComfortCare Home Health, 75 Pearl St, Hartford CT 06103',
  jobDuration: '4 years',
  spouseJobDuration: '2 years',
  incomeThisYear: { youAmount: '52000', youSource: 'Precision Auto Repair', spouseAmount: '31000', spouseSource: 'ComfortCare Home Health' },
  incomeLastYear: { youAmount: '49500', youSource: 'Precision Auto Repair', spouseAmount: '29000', spouseSource: 'ComfortCare Home Health' },
  incomeYearBeforeLast: { youAmount: '47000', youSource: 'Precision Auto Repair', spouseAmount: '27500', spouseSource: 'ComfortCare Home Health' },
  inBusiness: 'no',
  businessInfo: [],
  businessDebts: 'no',
  businessDebtsDetails: '',
  owesEmployeeWages: 'no',
  employeesOwed: [],
  receivedMoneyToPurchase: 'no',
  receivedMoneyDetails: '',

  // Section 4J-Q: Financial Questions
  onWelfare: 'no',
  familyOnWelfare: 'no',
  welfareDetails: [],
  receivedExtraGovMoney: 'no',
  extraGovMoneyDetails: '',
  vacationTimeDue: 'yes',
  vacationTimeAmount: '$1,200 accrued PTO',
  hasIRA: 'yes',
  iraDetails: 'Traditional IRA at Fidelity, balance approximately $18,500',
  tuitionProgram: 'no',
  tuitionDetails: '',
  isTrustBeneficiary: 'no',
  trustDetails: '',
  expectGiftOrInsurance: 'no',
  giftInsuranceDetails: '',
  expectInheritance: 'no',
  inheritanceDetails: '',
  inheritedAnything: 'no',
  inheritedDetails: '',

  // Section 5: Taxes
  receivedRefund: 'yes',
  refundState: '380',
  refundFederal: '2100',
  expectRefund: 'no',
  expectedRefundState: '',
  expectedRefundFederal: '',
  earnedIncomeCredit: 'no',
  alreadyFiled: 'yes',
  expectedRefundDate: '',
  someoneInterceptingRefund: 'no',
  interceptDetails: '',
  refundAnticipationLoan: 'no',
  otherEntitledToRefund: 'no',
  filedLast7Years: 'yes',
  hasCopiesLast4Years: 'yes',
  missingCopiesYears: '',
  owesFederalTaxes: 'no',
  federalTaxesOwed: [],
  owesStateTaxes: 'no',
  stateTaxesOwed: [],
  owesLocalTaxes: 'no',
  localTaxesOwed: [],
  owesOtherGovMoney: 'no',
  otherGovMoneyDetails: '',

  // Section 6: Debts Repaid — FRAUD FLAG: large payment to relative
  paymentsOver600: [
    { creditorName: 'Maria Martinez (Mother)', creditorAddress: '45 Oak Hill Rd, New Britain CT 06051', isRelative: 'yes', paymentDates: '2026-01-15', amount: '8500' },
    { creditorName: 'Hartford Hospital', creditorAddress: '80 Seymour St, Hartford CT 06102', isRelative: 'no', paymentDates: '2025-12-01', amount: '1200' },
  ],
  insiderPayments: 'yes',
  insiderPaymentDetails: 'Repaid $8,500 loan to mother in January 2026',
  hasStudentLoan: 'no',
  studentLoan: { lender: '', school: '', didFinish: '', whyNot: '', collector: '', amountPaid: '', othersPayments: 'no', othersAmount: '' },

  // Section 7: Suits
  beenSued: 'yes',
  lawsuits: [
    { caseName: 'Capital One v. Martinez', caseNo: 'CV-2025-4821', court: 'Hartford Superior Court', typeOfCase: 'Credit card collection', result: 'Pending', amount: '12,400' },
  ],
  suitResultedInLien: 'no',
  hasSuedOthers: 'no',
  suitsFiled: [],
  criminalCharges: 'no',
  criminalCases: [],
  adminCases: 'no',
  adminCaseEntries: [],
  possibleLawsuit: 'no',
  possibleLawsuitDetails: '',

  // Section 8: Garnishment
  foreclosureOrSale: 'no',
  foreclosures: [],
  garnished: 'yes',
  garnishments: [
    { creditorName: 'Capital One', creditorAddress: 'PO Box 30285, Salt Lake City UT 84130', amountTaken: '3,200', dates: 'Sept 2025 - Present' },
  ],

  // Section 9: Repossessions
  repossessed: 'no',
  repossessions: [],
  voluntaryReturns: 'no',
  returns: [],

  // Section 10: Property Held by Others
  propertyHeldByOthers: 'no',
  propertyHeldEntries: [],
  assignedProperty: 'no',
  assignedPropertyDetails: '',
  propertyWithReceiver: 'no',
  propertyReceiverDetails: '',
  propertyWithPawnbroker: 'no',
  pawnbrokerDetails: '',

  // Section 11: Gifts & Transfers — FRAUD FLAG: large gift to relative before filing
  madeGiftsOrTransfers: 'yes',
  giftsTransfers: [
    { recipientName: 'Carlos Martinez (Brother)', description: '2018 Honda Accord', monthYear: '2025-11', saleOrGiftToRelative: 'yes' },
    { recipientName: 'Maria Martinez (Mother)', description: 'Cash', monthYear: '2025-10', saleOrGiftToRelative: 'yes' },
  ],
  usedSaleProceeds: 'no',
  saleProceeds: [],

  // Section 12: Losses
  hadLosses: 'no',
  losses: [],
  insurancePaidLoss: 'no',
  insurancePaymentDate: '',
  insuranceAmountPaid: '',

  // Section 13: Attorneys & Consultants
  attorneys: [
    { name: 'Sarah Chen, Esq.', address: '200 Trumbull St, Suite 400, Hartford CT 06103', date: '2026-02-15' },
  ],
  attorneyReason: 'Bankruptcy filing assistance',
  attorneyAmountPaid: '1500',
  promisedPayment: 'yes',
  promisedPaymentDetails: 'Agreed to pay remaining $350 before filing',
  creditCounselingAgency: 'Money Management International',
  creditCounselingDate: '2026-02-20',
  agencyRepaymentPlan: 'no',
  agencyPlanDetails: '',
  agencyAmountPaid: '35',
  consultedOthers: 'no',
  otherConsultantDetails: '',
  debtsFromRefinancing: 'no',
  refinancingDetails: '',

  // Section 14: Closed Bank Accounts — FRAUD FLAG: account closed recently
  closedAccounts: 'yes',
  closedAccountEntries: [
    { bankNameAddress: 'Webster Bank, 145 Bank St, Waterbury CT', acctNo: 'xxxx-4829', typeOfAccount: 'Savings', otherNames: '', dateClosed: '2025-12-15', finalBalance: '4,200' },
  ],

  // Section 15: Safe Deposit Boxes
  hasSafeDepositBox: 'no',
  safeDepositBoxes: [],

  // Section 16: Property Held for Others
  holdsPropertyForOthers: 'no',
  propertyHeldForOthers: [],
  propertyHeldAddress: '',

  // Section 17: Leases
  hasAutoLease: 'no',
  autoLeaseDetails: '',

  // Section 18: Cooperatives
  cooperativeDetails: '',

  // Section 19: Alimony & Child Support
  previousMarriages: 'no',
  formerSpouseName: '',
  owedChildSupport: 'no',
  owedChildSupportWho: '',
  owedChildSupportAmount: '',
  orderedChildSupport: 'no',
  orderedAlimony: 'no',
  propertySettlement: 'no',
  propertySettlementDetails: '',
  currentlyPaying: '',
  payingTo: '',
  behindInPayments: '',
  requiredToSupport: '',
  familyCourtHearings: 'no',
  familyCourtDetails: '',
  expectPropertySettlement: 'no',

  // Section 20: Accidents
  vehicleAccident: 'yes',
  vehicleInAccident: 'yes',
  childrenInjuredOthers: 'no',
  lostDriversLicense: 'no',
  lostLicenseDetails: '',

  // Section 21: Cosigners
  hasCosigners: 'no',
  cosigners: [],
  cosignedForOthers: 'no',
  cosignedDebts: [],
  borrowedForOthers: 'no',
  borrowedForOtherEntries: [],
  collateralOnCosigned: [],

  // Section 22: Credit Cards & Finance — FRAUD FLAG: recent cash advances
  recentCashAdvances: 'yes',
  cashAdvanceDetails: 'Took $1,800 cash advance on Discover card on February 1, 2026',
  overCreditLimit: 'yes',
  overLimitDetails: 'Discover card $500 over limit, Chase Visa $200 over limit',
  financeCollateral: 'no',
  financeCollateralDetails: '',
  paydayLoan: 'yes',
  paydayLoanDetails: 'LoanMax, $800 due March 15 2026, 390% APR',

  // Section 23: Evictions
  evictionSuit: 'no',
  evictionSuits: [],
  landlordJudgment: 'no',
  rentPaymentDetails: '',
  landlordPlanningEviction: 'no',
  landlordEvictionDetails: '',

  // Section 24: Secured Debts
  hasSecuredDebts: 'no',
  agreedCreditorCanTake: 'no',
  securedDebts: [],
  securedCollateralElsewhere: 'no',
  securedCollateralLocation: '',
  disputeSecuredDebts: 'no',
  disputedSecuredDetails: '',

  // Section 25: Unsecured Debts
  unsecuredDebts: [
    { creditorName: 'Capital One', creditorAddress: 'PO Box 30285, Salt Lake City UT 84130', accountNo: '4147-xxxx-xxxx-8821', amountOwed: '12400', dateOpened: '2018-05-01' },
    { creditorName: 'Discover Financial', creditorAddress: 'PO Box 30943, Salt Lake City UT 84130', accountNo: '6011-xxxx-xxxx-3349', amountOwed: '9800', dateOpened: '2019-08-15' },
    { creditorName: 'Chase Bank', creditorAddress: 'PO Box 15298, Wilmington DE 19850', accountNo: '4888-xxxx-xxxx-5512', amountOwed: '7600', dateOpened: '2017-03-01' },
    { creditorName: 'Synchrony Bank (Care Credit)', creditorAddress: 'PO Box 960061, Orlando FL 32896', accountNo: '6019-xxxx-xxxx-7744', amountOwed: '4200', dateOpened: '2021-11-20' },
    { creditorName: 'Hartford Hospital', creditorAddress: '80 Seymour St, Hartford CT 06102', accountNo: 'MED-20240319', amountOwed: '14500', dateOpened: '2024-03-19' },
    { creditorName: 'CT Orthopaedic Specialists', creditorAddress: '263 Farmington Ave, Hartford CT 06105', accountNo: 'ORT-88412', amountOwed: '3800', dateOpened: '2024-04-02' },
    { creditorName: 'Midland Credit Management', creditorAddress: 'PO Box 60578, San Diego CA 92166', accountNo: 'MCM-4419283', amountOwed: '2900', dateOpened: '2020-06-01' },
    { creditorName: 'LoanMax Title Loans', creditorAddress: '1922 Main St, Hartford CT 06120', accountNo: 'LM-CT-28491', amountOwed: '800', dateOpened: '2026-01-10' },
  ],

  // Section 26: Asset Listing — FRAUD FLAG: vehicle severely undervalued, low cash
  cashOnHand: '35',
  bankDeposits: [
    { bankNameAddress: 'Bank of America, 777 Main St, Hartford CT 06103', amount: '420' },
  ],
  securityDeposits: [
    { personOrCompany: 'Riverside Property Management', address: '100 Commerce St, Hartford CT 06103', amount: '1400' },
    { personOrCompany: 'Eversource Energy', address: 'PO Box 270, Hartford CT 06141', amount: '200' },
  ],
  personalPropertyItems: [
    { item: 'Wedding ring set (his & hers)', approximateAge: '12 years', value: '400' },
    { item: 'Tools (mechanic set, Snap-On)', approximateAge: '8 years', value: '800' },
    { item: 'Clothing and personal effects', approximateAge: 'Various', value: '300' },
  ],
  householdItems: [
    { name: 'TV (55" Samsung)', howMany: '1', yearPurchased: '2022', value: '150' },
    { name: 'Couch', howMany: '1', yearPurchased: '2020', value: '100' },
    { name: 'Bed/Mattress', howMany: '2', yearPurchased: '2021', value: '200' },
    { name: 'Dining Table & Chairs', howMany: '1', yearPurchased: '2019', value: '75' },
    { name: 'Refrigerator', howMany: '1', yearPurchased: '2018', value: '100' },
    { name: 'Washer/Dryer', howMany: '1', yearPurchased: '2020', value: '150' },
    { name: 'Computer (Dell laptop)', howMany: '1', yearPurchased: '2023', value: '250' },
    { name: 'Dresser', howMany: '2', yearPurchased: '2019', value: '50' },
    { name: 'Microwave', howMany: '1', yearPurchased: '2021', value: '30' },
    { name: 'Dishes/Cookware', howMany: '', yearPurchased: '', value: '50' },
  ],
  financedItems: [],

  // Vehicles — FRAUD FLAG: 2019 Honda CR-V valued at only $800
  vehicles: [
    {
      lenderName: 'Honda Financial Services',
      lenderAddress: 'PO Box 650903, Dallas TX 75265',
      loanNumber: 'HFS-7742901',
      percentageRate: '5.9',
      yearPurchased: '2019',
      makeYearModel: '2019 Honda CR-V EX',
      mileage: '68000',
      condition: 'Good',
      approximateValue: '800',
      intention: 'retain',
    },
    {
      lenderName: '',
      lenderAddress: '',
      loanNumber: '',
      percentageRate: '',
      yearPurchased: '2014',
      makeYearModel: '2014 Toyota Corolla',
      mileage: '142000',
      condition: 'Fair',
      approximateValue: '4500',
      intention: 'retain',
    },
  ],
};

// Run seed
const existing = listForms();
if (existing.length > 0) {
  console.log(`Database already has ${existing.length} form(s). Skipping seed.`);
  console.log('To re-seed, delete the database file first.');
} else {
  const id = uuidv4();
  createForm(id, 'Robert James Martinez', JSON.stringify(seedData));
  console.log(`Seeded form: ${id} (Robert James Martinez)`);
  console.log('Fraud flags included:');
  console.log('  - 2019 Honda CR-V EX valued at $800 (should be ~$22,000)');
  console.log('  - $8,500 payment to mother (insider preference)');
  console.log('  - Car gifted to brother 4 months before filing');
  console.log('  - Cash given to mother 5 months before filing');
  console.log('  - $1,800 cash advance 5 weeks before filing');
  console.log('  - Savings account closed with $4,200 balance');
  console.log('  - Payday loan at 390% APR');
  console.log('  - Only $35 cash on hand with $83k household income');
}

process.exit(0);
