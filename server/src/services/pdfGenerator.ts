import PDFDocument from 'pdfkit';
import { QuestionnaireData, createEmptyQuestionnaire } from '../types/questionnaire';

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const result = { ...target };
  for (const key of Object.keys(target)) {
    if (source && source[key] !== undefined) {
      if (Array.isArray(target[key])) {
        result[key] = source[key];
      } else if (typeof target[key] === 'object' && target[key] !== null && !Array.isArray(target[key])) {
        result[key] = deepMerge(target[key] as Record<string, unknown>, source[key] as Record<string, unknown>);
      } else {
        result[key] = source[key];
      }
    }
  }
  return result;
}

const MARGIN = 50;
const PAGE_WIDTH = 612; // Letter size
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FONT_BODY = 'Helvetica';
const FONT_BOLD = 'Helvetica-Bold';
const SIZE_HEADER = 14;
const SIZE_BODY = 12;
const SIZE_TABLE = 10;
const LINE_HEIGHT = SIZE_BODY * 1.4;
const TABLE_LINE_HEIGHT = SIZE_TABLE * 1.4;

// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------

function isYes(value: string | undefined): boolean {
  return (value || '').toLowerCase() === 'yes';
}

function val(v: string | undefined): string {
  return v || '';
}

function ensureSpace(doc: PDFKit.PDFDocument, needed: number): void {
  const bottom = (doc.page?.height ?? 792) - MARGIN;
  if (doc.y + needed > bottom) {
    doc.addPage();
  }
}

// ---------------------------------------------------------------------------
// Drawing helpers
// ---------------------------------------------------------------------------

function addSectionHeader(
  doc: PDFKit.PDFDocument,
  num: number | string,
  title: string,
): void {
  ensureSpace(doc, 30);
  doc.moveDown(0.5);
  doc
    .font(FONT_BOLD)
    .fontSize(SIZE_HEADER)
    .text(`${num}. ${title}`, MARGIN, doc.y, { underline: true, width: CONTENT_WIDTH });
  doc.moveDown(0.3);
  doc.font(FONT_BODY).fontSize(SIZE_BODY);
}

function addField(
  doc: PDFKit.PDFDocument,
  label: string,
  value: string | undefined,
): void {
  ensureSpace(doc, LINE_HEIGHT);
  doc.font(FONT_BODY).fontSize(SIZE_BODY).text(`${label}: ${val(value)}`, MARGIN, doc.y, { width: CONTENT_WIDTH });
}

function addYesNo(
  doc: PDFKit.PDFDocument,
  label: string,
  value: string | undefined,
): void {
  ensureSpace(doc, LINE_HEIGHT);
  const yes = isYes(value);
  const yesBox = yes ? '[X]' : '[  ]';
  const noBox = yes ? '[  ]' : '[X]';
  doc.font(FONT_BODY).fontSize(SIZE_BODY).text(`${label}: ${yesBox} YES   ${noBox} NO`, MARGIN, doc.y, { width: CONTENT_WIDTH });
}

function addConditionalField(
  doc: PDFKit.PDFDocument,
  yesNoValue: string | undefined,
  label: string,
  detailValue: string | undefined,
): void {
  addYesNo(doc, label, yesNoValue);
  if (isYes(yesNoValue) && detailValue) {
    addField(doc, '  Details', detailValue);
  }
}

function addTable(
  doc: PDFKit.PDFDocument,
  headers: string[],
  rows: string[][],
): void {
  const colCount = headers.length;
  const colWidth = CONTENT_WIDTH / colCount;
  const headerHeight = TABLE_LINE_HEIGHT + 4;
  const rowHeight = TABLE_LINE_HEIGHT + 4;
  const displayRows = rows.length > 0 ? rows : [headers.map(() => '')];
  const totalHeight = headerHeight + displayRows.length * rowHeight + 4;

  ensureSpace(doc, Math.min(totalHeight, 200));

  const startX = MARGIN;
  let y = doc.y;

  // Draw header background
  doc.save();
  doc.rect(startX, y, CONTENT_WIDTH, headerHeight).fillAndStroke('#e0e0e0', '#000000');
  doc.restore();

  // Header text
  doc.font(FONT_BOLD).fontSize(SIZE_TABLE);
  for (let i = 0; i < colCount; i++) {
    doc.fillColor('#000000').text(
      headers[i],
      startX + i * colWidth + 2,
      y + 3,
      { width: colWidth - 4, height: headerHeight, ellipsis: true },
    );
  }

  y += headerHeight;

  // Data rows
  doc.font(FONT_BODY).fontSize(SIZE_TABLE);
  for (const row of displayRows) {
    // Check page break for each row
    const bottom = (doc.page?.height ?? 792) - MARGIN;
    if (y + rowHeight > bottom) {
      doc.addPage();
      y = MARGIN;
    }
    // Row border
    doc.save();
    doc.rect(startX, y, CONTENT_WIDTH, rowHeight).stroke('#000000');
    doc.restore();
    // Cell separators
    for (let i = 1; i < colCount; i++) {
      doc.save();
      doc.moveTo(startX + i * colWidth, y).lineTo(startX + i * colWidth, y + rowHeight).stroke('#000000');
      doc.restore();
    }
    // Cell text
    for (let i = 0; i < colCount; i++) {
      const cellVal = rows.length === 0 && i === 0 ? '(None)' : (row[i] || '');
      doc.fillColor('#000000').text(
        cellVal,
        startX + i * colWidth + 2,
        y + 3,
        { width: colWidth - 4, height: rowHeight, ellipsis: true },
      );
    }
    y += rowHeight;
  }

  doc.y = y + 4;
  doc.x = MARGIN;
}

function addIncomeRow(
  doc: PDFKit.PDFDocument,
  label: string,
  entry: { youAmount: string; youSource: string; spouseAmount: string; spouseSource: string },
): void {
  addField(doc, `${label} - You`, `${val(entry.youAmount)} (${val(entry.youSource)})`);
  addField(doc, `${label} - Spouse`, `${val(entry.spouseAmount)} (${val(entry.spouseSource)})`);
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function generatePdf(rawData: Partial<QuestionnaireData>): Promise<Buffer> {
  const data = deepMerge(
    createEmptyQuestionnaire() as unknown as Record<string, unknown>,
    rawData as unknown as Record<string, unknown>,
  ) as unknown as QuestionnaireData;
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
      bufferPages: true,
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // ---- Title ----
    doc
      .font(FONT_BOLD)
      .fontSize(18)
      .text('BANKRUPTCY QUESTIONNAIRE', MARGIN, MARGIN, { align: 'center', width: CONTENT_WIDTH });
    doc.moveDown(1);
    doc.font(FONT_BODY).fontSize(SIZE_BODY);

    // ================================================================
    // SECTION 1: Name & Residence
    // ================================================================
    addSectionHeader(doc, 1, 'Name & Residence');
    addField(doc, 'Full Name', data.fullName);
    addField(doc, 'Spouse Full Name', data.spouseFullName);
    addField(doc, 'SSN', data.ssn);
    addField(doc, 'Spouse SSN', data.spouseSsn);
    addField(doc, 'Date of Birth', data.dob);
    addField(doc, 'Spouse Date of Birth', data.spouseDob);
    addField(doc, 'Other Names Used', data.otherNames);

    doc.moveDown(0.3);
    doc.font(FONT_BOLD).fontSize(SIZE_BODY).text('Current Address:', MARGIN, doc.y);
    doc.font(FONT_BODY);
    addField(doc, '  Street', data.currentAddress.street);
    addField(doc, '  City', data.currentAddress.city);
    addField(doc, '  County', data.currentAddress.county);
    addField(doc, '  Zip Code', data.currentAddress.zipCode);

    doc.moveDown(0.3);
    addYesNo(doc, 'Leasing/Renting', data.leasing.isLeasing);
    if (isYes(data.leasing.isLeasing)) {
      addField(doc, '  Landlord Name', data.leasing.landlordName);
      addField(doc, '  Landlord Address', data.leasing.landlordAddress);
      addField(doc, '  Lease Terms', data.leasing.leaseTerms);
    }

    addField(doc, 'Phone', data.phone);
    addField(doc, 'Email', data.email);

    doc.moveDown(0.3);
    doc.font(FONT_BOLD).fontSize(SIZE_BODY).text('Prior Addresses:', MARGIN, doc.y);
    doc.font(FONT_BODY);
    addTable(
      doc,
      ['Address', 'Date Moved In', 'Date Moved Out'],
      (data.priorAddresses || []).map(a => [a.address, a.dateMovedIn, a.dateMovedOut]),
    );

    // ================================================================
    // SECTION 2-3: Prior Bankruptcy
    // ================================================================
    addSectionHeader(doc, '2-3', 'Prior Bankruptcy');
    addYesNo(doc, 'Prior Bankruptcy', data.priorBankruptcy);
    addTable(
      doc,
      ['Chapter', 'Date Filed', 'Discharge?', 'Discharge Date', 'Dismissed Date', 'Dismissed Reason'],
      (data.priorBankruptcies || []).map(b => [
        b.chapter, b.dateFiled, b.didGetDischarge, b.dischargeDate, b.dismissedDate, b.dismissedReason,
      ]),
    );
    addConditionalField(doc, data.otherBankruptcyOnHome, 'Other Bankruptcy on Home', data.otherBankruptcyDetails);

    // ================================================================
    // SECTION 4: Occupation & Income
    // ================================================================
    addSectionHeader(doc, 4, 'Occupation & Income');
    addField(doc, 'Usual Type of Work', data.usualTypeOfWork);
    addField(doc, 'Employer Name/Address', data.employerNameAddress);
    addField(doc, 'Job Duration', data.jobDuration);
    addField(doc, 'Spouse Usual Work', data.spouseUsualWork);
    addField(doc, 'Spouse Employer Name/Address', data.spouseEmployerNameAddress);
    addField(doc, 'Spouse Job Duration', data.spouseJobDuration);

    doc.moveDown(0.3);
    doc.font(FONT_BOLD).fontSize(SIZE_BODY).text('Income:', MARGIN, doc.y);
    doc.font(FONT_BODY);
    addIncomeRow(doc, 'This Year', data.incomeThisYear);
    addIncomeRow(doc, 'Last Year', data.incomeLastYear);
    addIncomeRow(doc, 'Year Before Last', data.incomeYearBeforeLast);

    addConditionalField(doc, data.inBusiness, 'In Business', undefined);
    if (isYes(data.inBusiness)) {
      addTable(
        doc,
        ['Dates', 'Business Name', 'Address', 'Others in Business'],
        (data.businessInfo || []).map(b => [b.dates, b.name, b.address, b.othersInBusiness]),
      );
    }

    addConditionalField(doc, data.businessDebts, 'Business Debts', data.businessDebtsDetails);

    addYesNo(doc, 'Owes Employee Wages', data.owesEmployeeWages);
    if (isYes(data.owesEmployeeWages)) {
      addTable(
        doc,
        ['Name', 'Address', 'Dates Worked', 'Amount Owed', 'Work Done'],
        (data.employeesOwed || []).map(e => [e.name, e.address, e.datesWorked, e.amountOwed, e.workDone]),
      );
    }

    addConditionalField(doc, data.receivedMoneyToPurchase, 'Received Money to Purchase', data.receivedMoneyDetails);

    // ================================================================
    // SECTION 4J-Q: Financial Questions
    // ================================================================
    addSectionHeader(doc, '4J', 'Financial Questions');
    addYesNo(doc, 'On Welfare', data.onWelfare);
    addYesNo(doc, 'Family on Welfare', data.familyOnWelfare);
    if (isYes(data.onWelfare) || isYes(data.familyOnWelfare)) {
      addTable(
        doc,
        ['Person', 'Dates', 'Amounts', 'Place'],
        (data.welfareDetails || []).map(w => [w.person, w.dates, w.amounts, w.place]),
      );
    }

    addConditionalField(doc, data.receivedExtraGovMoney, 'Received Extra Gov Money', data.extraGovMoneyDetails);
    addConditionalField(doc, data.vacationTimeDue, 'Vacation Time Due', data.vacationTimeAmount);
    addConditionalField(doc, data.hasIRA, 'Has IRA/Retirement', data.iraDetails);
    addConditionalField(doc, data.tuitionProgram, 'Tuition Program', data.tuitionDetails);
    addConditionalField(doc, data.isTrustBeneficiary, 'Trust Beneficiary', data.trustDetails);
    addConditionalField(doc, data.expectGiftOrInsurance, 'Expect Gift or Insurance', data.giftInsuranceDetails);
    addConditionalField(doc, data.expectInheritance, 'Expect Inheritance', data.inheritanceDetails);
    addConditionalField(doc, data.inheritedAnything, 'Inherited Anything', data.inheritedDetails);

    // ================================================================
    // SECTION 5: Taxes
    // ================================================================
    addSectionHeader(doc, 5, 'Taxes');
    addYesNo(doc, 'Received Refund', data.receivedRefund);
    if (isYes(data.receivedRefund)) {
      addField(doc, '  State Refund', data.refundState);
      addField(doc, '  Federal Refund', data.refundFederal);
    }
    addYesNo(doc, 'Expect Refund', data.expectRefund);
    if (isYes(data.expectRefund)) {
      addField(doc, '  Expected State Refund', data.expectedRefundState);
      addField(doc, '  Expected Federal Refund', data.expectedRefundFederal);
    }
    addYesNo(doc, 'Earned Income Credit', data.earnedIncomeCredit);
    addYesNo(doc, 'Already Filed', data.alreadyFiled);
    addField(doc, 'Expected Refund Date', data.expectedRefundDate);
    addConditionalField(doc, data.someoneInterceptingRefund, 'Someone Intercepting Refund', data.interceptDetails);
    addYesNo(doc, 'Refund Anticipation Loan', data.refundAnticipationLoan);
    addYesNo(doc, 'Other Entitled to Refund', data.otherEntitledToRefund);
    addYesNo(doc, 'Filed Last 7 Years', data.filedLast7Years);
    addYesNo(doc, 'Has Copies Last 4 Years', data.hasCopiesLast4Years);
    addField(doc, 'Missing Copies Years', data.missingCopiesYears);

    addYesNo(doc, 'Owes Federal Taxes', data.owesFederalTaxes);
    if (isYes(data.owesFederalTaxes)) {
      addTable(
        doc,
        ['Entity', 'Address', 'Kind of Tax', 'Years', 'Amount'],
        (data.federalTaxesOwed || []).map(t => [t.entity, t.address, t.kindOfTax, t.years, t.amount]),
      );
    }

    addYesNo(doc, 'Owes State Taxes', data.owesStateTaxes);
    if (isYes(data.owesStateTaxes)) {
      addTable(
        doc,
        ['Entity', 'Address', 'Kind of Tax', 'Years', 'Amount'],
        (data.stateTaxesOwed || []).map(t => [t.entity, t.address, t.kindOfTax, t.years, t.amount]),
      );
    }

    addYesNo(doc, 'Owes Local Taxes', data.owesLocalTaxes);
    if (isYes(data.owesLocalTaxes)) {
      addTable(
        doc,
        ['Entity', 'Address', 'Kind of Tax', 'Years', 'Amount'],
        (data.localTaxesOwed || []).map(t => [t.entity, t.address, t.kindOfTax, t.years, t.amount]),
      );
    }

    addConditionalField(doc, data.owesOtherGovMoney, 'Owes Other Gov Money', data.otherGovMoneyDetails);

    // ================================================================
    // SECTION 6: Debts Repaid
    // ================================================================
    addSectionHeader(doc, 6, 'Debts Repaid');
    doc.font(FONT_BOLD).fontSize(SIZE_BODY).text('Payments Over $600:', MARGIN, doc.y);
    doc.font(FONT_BODY);
    addTable(
      doc,
      ['Creditor Name', 'Creditor Address', 'Relative?', 'Payment Dates', 'Amount'],
      (data.paymentsOver600 || []).map(d => [d.creditorName, d.creditorAddress, d.isRelative, d.paymentDates, d.amount]),
    );
    addConditionalField(doc, data.insiderPayments, 'Insider Payments', data.insiderPaymentDetails);

    addYesNo(doc, 'Has Student Loan', data.hasStudentLoan);
    if (isYes(data.hasStudentLoan) && data.studentLoan) {
      addField(doc, '  Lender', data.studentLoan.lender);
      addField(doc, '  School', data.studentLoan.school);
      addField(doc, '  Did Finish', data.studentLoan.didFinish);
      addField(doc, '  Why Not', data.studentLoan.whyNot);
      addField(doc, '  Collector', data.studentLoan.collector);
      addField(doc, '  Amount Paid', data.studentLoan.amountPaid);
      addYesNo(doc, '  Others Making Payments', data.studentLoan.othersPayments);
      addField(doc, '  Others Amount', data.studentLoan.othersAmount);
    }

    // ================================================================
    // SECTION 7: Suits
    // ================================================================
    addSectionHeader(doc, 7, 'Suits & Legal Proceedings');
    addYesNo(doc, 'Been Sued', data.beenSued);
    if (isYes(data.beenSued)) {
      addTable(
        doc,
        ['Case Name', 'Case No.', 'Court', 'Type', 'Result', 'Amount'],
        (data.lawsuits || []).map(l => [l.caseName, l.caseNo, l.court, l.typeOfCase, l.result, l.amount]),
      );
    }
    addYesNo(doc, 'Suit Resulted in Lien', data.suitResultedInLien);

    addYesNo(doc, 'Has Sued Others', data.hasSuedOthers);
    if (isYes(data.hasSuedOthers)) {
      addTable(
        doc,
        ['Case Name', 'Case No.', 'Court', 'Type', 'Result', 'Amount'],
        (data.suitsFiled || []).map(l => [l.caseName, l.caseNo, l.court, l.typeOfCase, l.result, l.amount]),
      );
    }

    addYesNo(doc, 'Criminal Charges', data.criminalCharges);
    if (isYes(data.criminalCharges)) {
      addTable(
        doc,
        ['Case No.', 'Court Name', 'Charges', 'Result', 'Fines Owed'],
        (data.criminalCases || []).map(c => [c.caseNo, c.courtName, c.charges, c.result, c.finesOwed]),
      );
    }

    addYesNo(doc, 'Administrative Cases', data.adminCases);
    if (isYes(data.adminCases)) {
      addTable(
        doc,
        ['Case Name', 'Case No.', 'Agency Name/Address', 'Type', 'Result'],
        (data.adminCaseEntries || []).map(a => [a.caseName, a.caseNo, a.agencyNameAddress, a.typeOfCase, a.result]),
      );
    }

    addConditionalField(doc, data.possibleLawsuit, 'Possible Lawsuit', data.possibleLawsuitDetails);

    // ================================================================
    // SECTION 8: Garnishment
    // ================================================================
    addSectionHeader(doc, 8, 'Foreclosure & Garnishment');
    addYesNo(doc, 'Foreclosure or Sale', data.foreclosureOrSale);
    if (isYes(data.foreclosureOrSale)) {
      addTable(
        doc,
        ['Property', 'Value', 'Date', 'Creditor Name/Address'],
        (data.foreclosures || []).map(f => [f.property, f.value, f.date, f.creditorNameAddress]),
      );
    }

    addYesNo(doc, 'Garnished', data.garnished);
    if (isYes(data.garnished)) {
      addTable(
        doc,
        ['Creditor Name', 'Creditor Address', 'Amount Taken', 'Dates'],
        (data.garnishments || []).map(g => [g.creditorName, g.creditorAddress, g.amountTaken, g.dates]),
      );
    }

    // ================================================================
    // SECTION 9: Repossessions
    // ================================================================
    addSectionHeader(doc, 9, 'Repossessions');
    addYesNo(doc, 'Repossessed', data.repossessed);
    if (isYes(data.repossessed)) {
      addTable(
        doc,
        ['Description', 'Month/Year', 'Who Repossessed', 'Value'],
        (data.repossessions || []).map(r => [r.description, r.monthYear, r.whoRepossessed, r.value]),
      );
    }

    addYesNo(doc, 'Voluntary Returns', data.voluntaryReturns);
    if (isYes(data.voluntaryReturns)) {
      addTable(
        doc,
        ['Description', 'Month/Year', 'Seller Name/Address', 'Value'],
        (data.returns || []).map(r => [r.description, r.monthYear, r.sellerNameAddress, r.value]),
      );
    }

    // ================================================================
    // SECTION 10: Property Held by Others
    // ================================================================
    addSectionHeader(doc, 10, 'Property Held by Others');
    addYesNo(doc, 'Property Held by Others', data.propertyHeldByOthers);
    if (isYes(data.propertyHeldByOthers)) {
      addTable(
        doc,
        ['Type of Property', 'Value', 'Held By', 'Reason'],
        (data.propertyHeldEntries || []).map(p => [p.typeOfProperty, p.value, p.heldByNameAddress, p.reason]),
      );
    }
    addConditionalField(doc, data.assignedProperty, 'Assigned Property', data.assignedPropertyDetails);
    addConditionalField(doc, data.propertyWithReceiver, 'Property with Receiver', data.propertyReceiverDetails);
    addConditionalField(doc, data.propertyWithPawnbroker, 'Property with Pawnbroker', data.pawnbrokerDetails);

    // ================================================================
    // SECTION 11: Gifts & Transfers
    // ================================================================
    addSectionHeader(doc, 11, 'Gifts & Transfers');
    addYesNo(doc, 'Made Gifts or Transfers', data.madeGiftsOrTransfers);
    if (isYes(data.madeGiftsOrTransfers)) {
      addTable(
        doc,
        ['Recipient', 'Description', 'Month/Year', 'Sale/Gift to Relative'],
        (data.giftsTransfers || []).map(g => [g.recipientName, g.description, g.monthYear, g.saleOrGiftToRelative]),
      );
    }

    addYesNo(doc, 'Used Sale Proceeds', data.usedSaleProceeds);
    if (isYes(data.usedSaleProceeds)) {
      addTable(
        doc,
        ['Description', 'Month/Year', 'Amount Received', 'Amount Used for Home'],
        (data.saleProceeds || []).map(s => [s.description, s.monthYear, s.amountReceived, s.amountUsedForHome]),
      );
    }

    // ================================================================
    // SECTION 12: Losses
    // ================================================================
    addSectionHeader(doc, 12, 'Losses');
    addYesNo(doc, 'Had Losses', data.hadLosses);
    if (isYes(data.hadLosses)) {
      addTable(
        doc,
        ['Cause', 'Value', 'Date'],
        (data.losses || []).map(l => [l.cause, l.value, l.date]),
      );
    }
    addYesNo(doc, 'Insurance Paid Loss', data.insurancePaidLoss);
    if (isYes(data.insurancePaidLoss)) {
      addField(doc, '  Payment Date', data.insurancePaymentDate);
      addField(doc, '  Amount Paid', data.insuranceAmountPaid);
    }

    // ================================================================
    // SECTION 13: Attorneys & Consultants
    // ================================================================
    addSectionHeader(doc, 13, 'Attorneys & Consultants');
    doc.font(FONT_BOLD).fontSize(SIZE_BODY).text('Attorneys:', MARGIN, doc.y);
    doc.font(FONT_BODY);
    addTable(
      doc,
      ['Name', 'Address', 'Date'],
      (data.attorneys || []).map(a => [a.name, a.address, a.date]),
    );
    addField(doc, 'Attorney Reason', data.attorneyReason);
    addField(doc, 'Attorney Amount Paid', data.attorneyAmountPaid);
    addConditionalField(doc, data.promisedPayment, 'Promised Payment', data.promisedPaymentDetails);
    addField(doc, 'Credit Counseling Agency', data.creditCounselingAgency);
    addField(doc, 'Credit Counseling Date', data.creditCounselingDate);
    addConditionalField(doc, data.agencyRepaymentPlan, 'Agency Repayment Plan', data.agencyPlanDetails);
    addField(doc, 'Agency Amount Paid', data.agencyAmountPaid);
    addConditionalField(doc, data.consultedOthers, 'Consulted Others', data.otherConsultantDetails);
    addConditionalField(doc, data.debtsFromRefinancing, 'Debts from Refinancing', data.refinancingDetails);

    // ================================================================
    // SECTION 14: Closed Bank Accounts
    // ================================================================
    addSectionHeader(doc, 14, 'Closed Bank Accounts');
    addYesNo(doc, 'Closed Accounts', data.closedAccounts);
    if (isYes(data.closedAccounts)) {
      addTable(
        doc,
        ['Bank Name/Address', 'Acct No.', 'Type', 'Other Names', 'Date Closed', 'Final Balance'],
        (data.closedAccountEntries || []).map(c => [
          c.bankNameAddress, c.acctNo, c.typeOfAccount, c.otherNames, c.dateClosed, c.finalBalance,
        ]),
      );
    }

    // ================================================================
    // SECTION 15: Safe Deposit Boxes
    // ================================================================
    addSectionHeader(doc, 15, 'Safe Deposit Boxes');
    addYesNo(doc, 'Has Safe Deposit Box', data.hasSafeDepositBox);
    if (isYes(data.hasSafeDepositBox)) {
      addTable(
        doc,
        ['Bank Name/Address', 'Access Persons', 'Contents', 'Date Closed'],
        (data.safeDepositBoxes || []).map(s => [s.bankNameAddress, s.accessPersons, s.contents, s.dateClosed]),
      );
    }

    // ================================================================
    // SECTION 16: Property Held for Others
    // ================================================================
    addSectionHeader(doc, 16, 'Property Held for Others');
    addYesNo(doc, 'Holds Property for Others', data.holdsPropertyForOthers);
    if (isYes(data.holdsPropertyForOthers)) {
      addTable(
        doc,
        ['Type of Property', 'Value', 'Owned By', 'Address', 'Relative?'],
        (data.propertyHeldForOthers || []).map(p => [
          p.typeOfProperty, p.value, p.ownedBy, p.address, p.isRelative,
        ]),
      );
      addField(doc, 'Property Held Address', data.propertyHeldAddress);
    }

    // ================================================================
    // SECTION 17: Leases
    // ================================================================
    addSectionHeader(doc, 17, 'Leases');
    addConditionalField(doc, data.hasAutoLease, 'Has Auto Lease', data.autoLeaseDetails);

    // ================================================================
    // SECTION 18: Cooperatives
    // ================================================================
    addSectionHeader(doc, 18, 'Cooperatives');
    addField(doc, 'Cooperative Details', data.cooperativeDetails);

    // ================================================================
    // SECTION 19: Alimony & Child Support
    // ================================================================
    addSectionHeader(doc, 19, 'Alimony & Child Support');
    addYesNo(doc, 'Previous Marriages', data.previousMarriages);
    addField(doc, 'Former Spouse Name', data.formerSpouseName);
    addYesNo(doc, 'Owed Child Support', data.owedChildSupport);
    if (isYes(data.owedChildSupport)) {
      addField(doc, '  Owed To', data.owedChildSupportWho);
      addField(doc, '  Amount', data.owedChildSupportAmount);
    }
    addYesNo(doc, 'Ordered Child Support', data.orderedChildSupport);
    addYesNo(doc, 'Ordered Alimony', data.orderedAlimony);
    addConditionalField(doc, data.propertySettlement, 'Property Settlement', data.propertySettlementDetails);
    addField(doc, 'Currently Paying', data.currentlyPaying);
    addField(doc, 'Paying To', data.payingTo);
    addField(doc, 'Behind in Payments', data.behindInPayments);
    addField(doc, 'Required to Support', data.requiredToSupport);
    addConditionalField(doc, data.familyCourtHearings, 'Family Court Hearings', data.familyCourtDetails);
    addYesNo(doc, 'Expect Property Settlement', data.expectPropertySettlement);

    // ================================================================
    // SECTION 20: Accidents
    // ================================================================
    addSectionHeader(doc, 20, 'Accidents');
    addYesNo(doc, 'Vehicle Accident', data.vehicleAccident);
    addYesNo(doc, 'Vehicle in Accident', data.vehicleInAccident);
    addYesNo(doc, 'Children Injured Others', data.childrenInjuredOthers);
    addConditionalField(doc, data.lostDriversLicense, 'Lost Drivers License', data.lostLicenseDetails);

    // ================================================================
    // SECTION 21: Cosigners
    // ================================================================
    addSectionHeader(doc, 21, 'Cosigners');
    addYesNo(doc, 'Has Cosigners', data.hasCosigners);
    if (isYes(data.hasCosigners)) {
      addTable(
        doc,
        ['Creditor Name/Address', 'Cosigner Name/Address', 'Debts'],
        (data.cosigners || []).map(c => [c.creditorNameAddress, c.cosignerNameAddress, c.debts]),
      );
    }

    addYesNo(doc, 'Cosigned for Others', data.cosignedForOthers);
    if (isYes(data.cosignedForOthers)) {
      addTable(
        doc,
        ['Creditor Name/Address', 'Date of Debt', 'Amount Owing', 'Person Cosigned For'],
        (data.cosignedDebts || []).map(c => [c.creditorNameAddress, c.dateOfDebt, c.amountOwing, c.personCosignedFor]),
      );
    }

    addYesNo(doc, 'Borrowed for Others', data.borrowedForOthers);
    if (isYes(data.borrowedForOthers)) {
      addTable(
        doc,
        ['Creditor', 'Collection Agent', 'Date', 'Which Spouse', 'For What', 'Current Amount'],
        (data.borrowedForOtherEntries || []).map(b => [
          b.creditorNameAddress, b.collectionAgent, b.dateOfDebt, b.whichSpouseOwes, b.forWhat, b.currentAmount,
        ]),
      );
    }

    if ((data.collateralOnCosigned || []).length > 0) {
      doc.font(FONT_BOLD).fontSize(SIZE_BODY).text('Collateral on Cosigned Debts:', MARGIN, doc.y);
      doc.font(FONT_BODY);
      addTable(
        doc,
        ['Creditor', 'Type of Property', 'Current Value'],
        data.collateralOnCosigned.map(c => [c.creditor, c.typeOfProperty, c.currentValue]),
      );
    }

    // ================================================================
    // SECTION 22: Credit Cards & Finance
    // ================================================================
    addSectionHeader(doc, 22, 'Credit Cards & Finance');
    addConditionalField(doc, data.recentCashAdvances, 'Recent Cash Advances', data.cashAdvanceDetails);
    addConditionalField(doc, data.overCreditLimit, 'Over Credit Limit', data.overLimitDetails);
    addConditionalField(doc, data.financeCollateral, 'Finance Collateral', data.financeCollateralDetails);
    addConditionalField(doc, data.paydayLoan, 'Payday Loan', data.paydayLoanDetails);

    // ================================================================
    // SECTION 23: Evictions
    // ================================================================
    addSectionHeader(doc, 23, 'Evictions');
    addYesNo(doc, 'Eviction Suit', data.evictionSuit);
    if (isYes(data.evictionSuit)) {
      addTable(
        doc,
        ['Case Name', 'Case No.', 'Court Name/Address', 'Reason', 'Result'],
        (data.evictionSuits || []).map(e => [e.caseName, e.caseNo, e.courtNameAddress, e.reason, e.result]),
      );
    }
    addConditionalField(doc, data.landlordJudgment, 'Landlord Judgment', data.rentPaymentDetails);
    addConditionalField(doc, data.landlordPlanningEviction, 'Landlord Planning Eviction', data.landlordEvictionDetails);

    // ================================================================
    // SECTION 24: Secured Debts
    // ================================================================
    addSectionHeader(doc, 24, 'Secured Debts');
    addYesNo(doc, 'Has Secured Debts', data.hasSecuredDebts);
    addYesNo(doc, 'Agreed Creditor Can Take', data.agreedCreditorCanTake);
    addTable(
      doc,
      ['Lender Name', 'Address', 'Account No.', 'Balance', 'Date Opened'],
      (data.securedDebts || []).map(s => [s.lenderName, s.address, s.accountNumber, s.currentBalance, s.dateOpened]),
    );
    addConditionalField(doc, data.securedCollateralElsewhere, 'Collateral Elsewhere', data.securedCollateralLocation);
    addConditionalField(doc, data.disputeSecuredDebts, 'Dispute Secured Debts', data.disputedSecuredDetails);

    // ================================================================
    // SECTION 25: Unsecured Debts
    // ================================================================
    addSectionHeader(doc, 25, 'Unsecured Debts');
    addTable(
      doc,
      ['Creditor Name', 'Creditor Address', 'Account No.', 'Amount Owed', 'Date Opened'],
      (data.unsecuredDebts || []).map(u => [u.creditorName, u.creditorAddress, u.accountNo, u.amountOwed, u.dateOpened]),
    );

    // ================================================================
    // SECTION 26: Asset Listing
    // ================================================================
    addSectionHeader(doc, 26, 'Asset Listing');
    addField(doc, 'Cash on Hand', data.cashOnHand);

    doc.moveDown(0.3);
    doc.font(FONT_BOLD).fontSize(SIZE_BODY).text('Bank Deposits:', MARGIN, doc.y);
    doc.font(FONT_BODY);
    addTable(
      doc,
      ['Bank Name/Address', 'Amount'],
      (data.bankDeposits || []).map(b => [b.bankNameAddress, b.amount]),
    );

    doc.font(FONT_BOLD).fontSize(SIZE_BODY).text('Security Deposits:', MARGIN, doc.y);
    doc.font(FONT_BODY);
    addTable(
      doc,
      ['Person/Company', 'Address', 'Amount'],
      (data.securityDeposits || []).map(s => [s.personOrCompany, s.address, s.amount]),
    );

    doc.font(FONT_BOLD).fontSize(SIZE_BODY).text('Personal Property:', MARGIN, doc.y);
    doc.font(FONT_BODY);
    addTable(
      doc,
      ['Item', 'Approximate Age', 'Value'],
      (data.personalPropertyItems || []).map(p => [p.item, p.approximateAge, p.value]),
    );

    doc.font(FONT_BOLD).fontSize(SIZE_BODY).text('Household Items:', MARGIN, doc.y);
    doc.font(FONT_BODY);
    addTable(
      doc,
      ['Name', 'How Many', 'Year Purchased', 'Value'],
      (data.householdItems || []).map(h => [h.name, h.howMany, h.yearPurchased, h.value]),
    );

    doc.font(FONT_BOLD).fontSize(SIZE_BODY).text('Financed Items:', MARGIN, doc.y);
    doc.font(FONT_BODY);
    addTable(
      doc,
      ['Item', 'Company Name/Address'],
      (data.financedItems || []).map(f => [f.item, f.companyNameAddress]),
    );

    // ================================================================
    // Vehicles
    // ================================================================
    addSectionHeader(doc, '26V', 'Vehicles');
    addTable(
      doc,
      ['Make/Year/Model', 'Lender', 'Loan No.', 'Rate', 'Mileage', 'Condition', 'Value', 'Intention'],
      (data.vehicles || []).map(v => [
        v.makeYearModel, v.lenderName, v.loanNumber, v.percentageRate,
        v.mileage, v.condition, v.approximateValue, v.intention,
      ]),
    );

    // ---- End ----
    doc.moveDown(1);
    doc.font(FONT_BOLD).fontSize(SIZE_BODY).text(
      'END OF QUESTIONNAIRE',
      MARGIN,
      doc.y,
      { align: 'center', width: CONTENT_WIDTH },
    );

    doc.end();
  });
}
