/**
 * QuestionnaireMapper — pure function, no DB or I/O.
 *
 * Takes typed extraction results (loaded from the extraction_results table)
 * and maps them to a partial questionnaire patch that can be applied to
 * a QuestionnaireData form.
 */
import type {
  ExtractionData,
  PaystubData,
  BankStatementData,
  W2Data,
  TaxReturnData,
  CreditCardData,
  MortgageData,
  VehicleLoanData,
  VehicleTitleData,
  CollectionLetterData,
  LegalDocumentData,
  RetirementAccountData,
  SocialSecurityData,
  SocialSecurityCardData,
  ProfitLossData,
  BrokerageStatementData,
  Tax1099Data,
  IdDocumentData,
} from '../extraction/schemas';
import type {
  QuestionnaireData,
  BankDeposit,
  UnsecuredDebt,
  SecuredDebt,
  VehicleEntry,
  LawsuitEntry,
  GarnishmentEntry,
  ForeclosureEntry,
  BusinessInfo,
} from '../../types/questionnaire';

export interface AutofillSource {
  documentId: string;
  docClass: string;
  confidence: number;
}

export interface AutofillPatch {
  fields: Partial<QuestionnaireData>;
  sources: Record<string, AutofillSource>;
}

export interface ExtractionInput {
  documentId: string;
  docClass: string | null;
  data: ExtractionData;
  fieldConfidences: Record<string, number>;
  belongsTo: string | null;  // 'debtor' | 'spouse' | null from documents table
}

const MIN_CONFIDENCE = 0.7;

function conf(fieldConfidences: Record<string, number>, field: string): number {
  return fieldConfidences[field] ?? 0;
}

function isSpouse(belongsTo: string | null): boolean {
  return belongsTo === 'spouse';
}

/**
 * Build an autofill patch from a set of extraction results.
 *
 * Rules:
 * - Only maps fields with confidence >= 0.7
 * - On conflict (same target path from multiple sources), highest confidence wins
 * - For bankDeposits, each bank statement appends a new entry
 * - Returns the full patch; the caller decides whether to skip non-empty form fields
 */
export function buildAutofillPatch(extractions: ExtractionInput[]): AutofillPatch {
  const fields: Partial<QuestionnaireData> = {};
  const sources: Record<string, AutofillSource> = {};
  // Map from dedup key → most-recent entry. When the same account appears in multiple
  // statement documents, only the entry with the latest statement_period_end is kept.
  const bankDepositMap = new Map<string, { bankNameAddress: string; amount: string; statementPeriodEnd: string }>();

  // Accumulate array fields across all extractions
  const pendingUnsecuredDebts: UnsecuredDebt[] = [];
  const pendingSecuredDebts: SecuredDebt[] = [];
  const pendingVehicles: VehicleEntry[] = [];
  const pendingLawsuits: LawsuitEntry[] = [];
  const pendingGarnishments: GarnishmentEntry[] = [];
  const pendingForeclosures: ForeclosureEntry[] = [];
  const pendingBusinessInfo: BusinessInfo[] = [];

  // Track pending scalar mappings with confidence so higher confidence wins conflicts
  const pending: Array<{
    path: string;
    value: unknown;
    confidence: number;
    source: AutofillSource;
  }> = [];

  for (const extraction of extractions) {
    const { documentId, docClass, data, fieldConfidences, belongsTo } = extraction;
    if (!docClass) continue;

    const src: AutofillSource = {
      documentId,
      docClass,
      confidence: 0,  // set per-field below
    };

    if (docClass === 'payStub.us') {
      const d = data as PaystubData;

      if (d.employee_name && conf(fieldConfidences, 'employee_name') >= MIN_CONFIDENCE) {
        const c = conf(fieldConfidences, 'employee_name');
        const path = isSpouse(belongsTo) ? 'spouseFullName' : 'fullName';
        pending.push({ path, value: d.employee_name, confidence: c, source: { ...src, confidence: c } });
      }

      if (d.employer_name && conf(fieldConfidences, 'employer_name') >= MIN_CONFIDENCE) {
        const c = conf(fieldConfidences, 'employer_name');
        const path = isSpouse(belongsTo) ? 'spouseEmployerNameAddress' : 'employerNameAddress';
        pending.push({ path, value: d.employer_name, confidence: c, source: { ...src, confidence: c } });
      }

      if (d.gross_pay != null && conf(fieldConfidences, 'gross_pay') >= MIN_CONFIDENCE) {
        const c = conf(fieldConfidences, 'gross_pay');
        const path = isSpouse(belongsTo)
          ? 'incomeThisYear.spouseAmount'
          : 'incomeThisYear.youAmount';
        pending.push({ path, value: String(d.gross_pay), confidence: c, source: { ...src, confidence: c } });
      }
    }

    if (docClass === 'tax.us.w2') {
      const d = data as W2Data;

      if (d.employee_name && conf(fieldConfidences, 'employee_name') >= MIN_CONFIDENCE) {
        const c = conf(fieldConfidences, 'employee_name');
        const path = isSpouse(belongsTo) ? 'spouseFullName' : 'fullName';
        pending.push({ path, value: d.employee_name, confidence: c, source: { ...src, confidence: c } });
      }

      if (d.employer_name && conf(fieldConfidences, 'employer_name') >= MIN_CONFIDENCE) {
        const c = conf(fieldConfidences, 'employer_name');
        const path = isSpouse(belongsTo) ? 'spouseEmployerNameAddress' : 'employerNameAddress';
        pending.push({ path, value: d.employer_name, confidence: c, source: { ...src, confidence: c } });
      }

      if (d.wages != null && conf(fieldConfidences, 'wages') >= MIN_CONFIDENCE) {
        const c = conf(fieldConfidences, 'wages');
        const path = isSpouse(belongsTo)
          ? 'incomeThisYear.spouseAmount'
          : 'incomeThisYear.youAmount';
        pending.push({ path, value: String(d.wages), confidence: c, source: { ...src, confidence: c } });
      }
    }

    if (docClass === 'bankStatement.us.checking' || docClass === 'bankStatement.us.savings') {
      const d = data as BankStatementData;

      const hasInstitution = d.institution_name && conf(fieldConfidences, 'institution_name') >= MIN_CONFIDENCE;
      const hasBalance = d.ending_balance != null && conf(fieldConfidences, 'ending_balance') >= MIN_CONFIDENCE;

      if (hasInstitution || hasBalance) {
        const nameParts: string[] = [];
        if (d.institution_name) nameParts.push(d.institution_name);
        if (d.account_number_last4) nameParts.push(`(****${d.account_number_last4})`);

        // Dedup key: institution + last4. Falls back to a unique key when last4 is absent
        // so accounts without a number are still included (just not deduplicated).
        const dedupKey = d.account_number_last4
          ? `${d.institution_name ?? ''}|${d.account_number_last4}`
          : `__no_acct__|${documentId}`;

        const existing = bankDepositMap.get(dedupKey);
        const periodEnd = d.statement_period_end ?? '';
        if (!existing || periodEnd >= existing.statementPeriodEnd) {
          bankDepositMap.set(dedupKey, {
            bankNameAddress: nameParts.join(' ') || '',
            amount: d.ending_balance != null ? String(d.ending_balance) : '',
            statementPeriodEnd: periodEnd,
          });
        }
      }
    }

    // ---- ID Document (Driver's License / State ID) ----
    if (docClass === 'idDocument') {
      const d = data as IdDocumentData;

      if (d.full_name && conf(fieldConfidences, 'full_name') >= MIN_CONFIDENCE) {
        const c = conf(fieldConfidences, 'full_name');
        const path = isSpouse(belongsTo) ? 'spouseFullName' : 'fullName';
        pending.push({ path, value: d.full_name, confidence: c, source: { ...src, confidence: c } });
      }

      if (d.date_of_birth && conf(fieldConfidences, 'date_of_birth') >= MIN_CONFIDENCE) {
        const c = conf(fieldConfidences, 'date_of_birth');
        const path = isSpouse(belongsTo) ? 'spouseDob' : 'dob';
        pending.push({ path, value: d.date_of_birth, confidence: c, source: { ...src, confidence: c } });
      }

      if (d.address && conf(fieldConfidences, 'address') >= MIN_CONFIDENCE && !isSpouse(belongsTo)) {
        // Only map address for the debtor (primary person), not spouse
        const c = conf(fieldConfidences, 'address');
        pending.push({ path: 'currentAddress.street', value: d.address, confidence: c, source: { ...src, confidence: c } });
      }
    }

    // ---- Social Security Card ----
    if (docClass === 'social_security_card') {
      const d = data as SocialSecurityCardData;

      // Only fill name if we have high confidence — this supplements but doesn't overwrite
      if (d.full_name && conf(fieldConfidences, 'full_name') >= MIN_CONFIDENCE) {
        const c = conf(fieldConfidences, 'full_name');
        const path = isSpouse(belongsTo) ? 'spouseFullName' : 'fullName';
        pending.push({ path, value: d.full_name, confidence: c, source: { ...src, confidence: c } });
      }
    }

    // ---- Tax Return (1040) ----
    if (docClass === 'tax.us.1040') {
      const d = data as TaxReturnData;
      const currentYear = new Date().getFullYear();
      const taxYear = d.tax_year ? parseInt(d.tax_year, 10) : null;

      if (d.filing_status && conf(fieldConfidences, 'filing_status') >= MIN_CONFIDENCE) {
        const c = conf(fieldConfidences, 'filing_status');
        pending.push({ path: 'filingStatus', value: d.filing_status, confidence: c, source: { ...src, confidence: c } });
      }

      if (d.adjusted_gross_income != null && conf(fieldConfidences, 'adjusted_gross_income') >= MIN_CONFIDENCE) {
        const c = conf(fieldConfidences, 'adjusted_gross_income');
        // Route to this year vs. last year based on tax_year relative to current filing year.
        // Tax returns are always for the prior year, so treat the two most-recent tax years
        // (currentYear-1 and currentYear-2) as "this year" income and older as "last year".
        const isThisYear = taxYear != null && taxYear >= currentYear - 2;
        const baseIncomePath = isThisYear ? 'incomeThisYear' : 'incomeLastYear';
        const incomePath = isSpouse(belongsTo)
          ? `${baseIncomePath}.spouseAmount`
          : `${baseIncomePath}.youAmount`;
        pending.push({ path: incomePath, value: String(d.adjusted_gross_income), confidence: c, source: { ...src, confidence: c } });
      }

      if (d.refund_amount != null && conf(fieldConfidences, 'refund_amount') >= MIN_CONFIDENCE) {
        const c = conf(fieldConfidences, 'refund_amount');
        // Distinguish federal vs. state by return_type
        const refundPath = d.return_type === 'state' ? 'refundState' : 'refundFederal';
        pending.push({ path: refundPath, value: String(d.refund_amount), confidence: c, source: { ...src, confidence: c } });
      }

      if (d.amount_owed != null && d.amount_owed > 0 && conf(fieldConfidences, 'amount_owed') >= MIN_CONFIDENCE) {
        const c = conf(fieldConfidences, 'amount_owed');
        const owesPath = d.return_type === 'state' ? 'owesStateTaxes' : 'owesFederalTaxes';
        pending.push({ path: owesPath, value: 'yes', confidence: c, source: { ...src, confidence: c } });
      }
    }

    // ---- 1099 Forms ----
    if (docClass === 'tax.us.1099') {
      const d = data as Tax1099Data;

      if (d.total_amount != null && conf(fieldConfidences, 'total_amount') >= MIN_CONFIDENCE) {
        const c = conf(fieldConfidences, 'total_amount');
        // Route income to the appropriate field based on form variant
        const variant = (d.form_variant ?? '').toUpperCase();
        let incomePath: string;
        if (variant.includes('SSA') || variant.includes('1099-SSA')) {
          // Social Security benefit — same as social_security_letter
          incomePath = isSpouse(belongsTo) ? 'incomeThisYear.spouseAmount' : 'incomeThisYear.youAmount';
        } else {
          // All other 1099 variants map to this year income
          incomePath = isSpouse(belongsTo) ? 'incomeThisYear.spouseAmount' : 'incomeThisYear.youAmount';
        }
        pending.push({ path: incomePath, value: String(d.total_amount), confidence: c, source: { ...src, confidence: c } });
      }
    }

    // ---- Credit Card Statement ----
    if (docClass === 'creditCard') {
      const d = data as CreditCardData;

      const hasIssuer = d.issuer && conf(fieldConfidences, 'issuer') >= MIN_CONFIDENCE;
      const hasBalance = d.ending_balance != null && conf(fieldConfidences, 'ending_balance') >= MIN_CONFIDENCE;

      if (hasIssuer || hasBalance) {
        const debt: UnsecuredDebt = {
          creditorName: d.issuer ?? '',
          creditorAddress: '',
          accountNo: d.account_number_last4 ? `****${d.account_number_last4}` : '',
          amountOwed: d.ending_balance != null ? String(d.ending_balance) : '',
          dateOpened: '',
        };
        pendingUnsecuredDebts.push(debt);
      }
    }

    // ---- Mortgage Statement ----
    if (docClass === 'mortgage.us') {
      const d = data as MortgageData;

      const hasLender = d.lender_name && conf(fieldConfidences, 'lender_name') >= MIN_CONFIDENCE;
      const hasBalance = d.current_balance != null && conf(fieldConfidences, 'current_balance') >= MIN_CONFIDENCE;

      if (hasLender || hasBalance) {
        const debt: SecuredDebt = {
          lenderName: d.lender_name ?? '',
          address: d.lender_address ?? '',
          accountNumber: d.loan_number ?? '',
          currentBalance: d.current_balance != null ? String(d.current_balance) : '',
          dateOpened: '',
        };
        pendingSecuredDebts.push(debt);
      }

      // Map the property address as a scalar field (first mortgage wins via confidence)
      if (d.property_address && conf(fieldConfidences, 'property_address') >= MIN_CONFIDENCE) {
        const c = conf(fieldConfidences, 'property_address');
        pending.push({ path: 'currentAddress.street', value: d.property_address, confidence: c, source: { ...src, confidence: c } });
      }
    }

    // ---- Vehicle Loan Statement ----
    if (docClass === 'vehicle_loan_statement') {
      const d = data as VehicleLoanData;

      const hasLender = d.lender_name && conf(fieldConfidences, 'lender_name') >= MIN_CONFIDENCE;
      const hasBalance = d.current_balance != null && conf(fieldConfidences, 'current_balance') >= MIN_CONFIDENCE;

      if (hasLender || hasBalance) {
        // Append to vehicles array
        const vehicle: VehicleEntry = {
          lenderName: d.lender_name ?? '',
          lenderAddress: d.lender_address ?? '',
          loanNumber: d.account_number_last4 ? `****${d.account_number_last4}` : '',
          percentageRate: d.interest_rate != null ? String(d.interest_rate) : '',
          yearPurchased: d.loan_origination_date ? d.loan_origination_date.slice(0, 4) : '',
          makeYearModel: d.vehicle_description ?? '',
          mileage: '',
          condition: '',
          approximateValue: '',
          intention: 'retain',
        };
        pendingVehicles.push(vehicle);

        // Also append to secured debts
        const debt: SecuredDebt = {
          lenderName: d.lender_name ?? '',
          address: d.lender_address ?? '',
          accountNumber: d.account_number_last4 ? `****${d.account_number_last4}` : '',
          currentBalance: d.current_balance != null ? String(d.current_balance) : '',
          dateOpened: '',
        };
        pendingSecuredDebts.push(debt);
      }
    }

    // ---- Vehicle Title ----
    if (docClass === 'vehicle_title') {
      const d = data as VehicleTitleData;

      const hasVehicleInfo = (d.year || d.make || d.model) &&
        (conf(fieldConfidences, 'year') >= MIN_CONFIDENCE ||
         conf(fieldConfidences, 'make') >= MIN_CONFIDENCE ||
         conf(fieldConfidences, 'model') >= MIN_CONFIDENCE);

      if (hasVehicleInfo) {
        const makeYearModel = [d.year, d.make, d.model].filter(Boolean).join(' ');
        const vehicle: VehicleEntry = {
          lenderName: '',
          lenderAddress: '',
          loanNumber: d.vin ?? '',
          percentageRate: '',
          yearPurchased: d.year ?? '',
          makeYearModel,
          mileage: d.odometer_miles != null ? String(d.odometer_miles) : '',
          condition: '',
          approximateValue: '',
          intention: 'retain',
        };
        pendingVehicles.push(vehicle);
      }
    }

    // ---- Collection Letter ----
    if (docClass === 'collection_letter') {
      const d = data as CollectionLetterData;

      const hasAgency = d.collection_agency_name && conf(fieldConfidences, 'collection_agency_name') >= MIN_CONFIDENCE;
      const hasClaimed = d.amount_claimed != null && conf(fieldConfidences, 'amount_claimed') >= MIN_CONFIDENCE;

      if (hasAgency || hasClaimed) {
        const debt: UnsecuredDebt = {
          creditorName: d.collection_agency_name ?? '',
          creditorAddress: d.collection_agency_address ?? '',
          accountNo: d.account_number_last4 ? `****${d.account_number_last4}` : '',
          amountOwed: d.amount_claimed != null ? String(d.amount_claimed) : '',
          dateOpened: '',
        };
        pendingUnsecuredDebts.push(debt);
      }

      // If collection letter references a lawsuit, flag beenSued
      if (d.references_lawsuit && conf(fieldConfidences, 'references_lawsuit') >= MIN_CONFIDENCE) {
        const c = conf(fieldConfidences, 'references_lawsuit');
        pending.push({ path: 'beenSued', value: 'yes', confidence: c, source: { ...src, confidence: c } });
      }
    }

    // ---- Legal Document ----
    if (docClass === 'legal_document') {
      const d = data as LegalDocumentData;
      const c = Math.max(
        conf(fieldConfidences, 'document_type'),
        conf(fieldConfidences, 'plaintiff_name'),
      );

      if (c >= MIN_CONFIDENCE) {
        if (d.document_type === 'summons' || d.document_type === 'complaint' || d.document_type === 'judgment') {
          pending.push({ path: 'beenSued', value: 'yes', confidence: c, source: { ...src, confidence: c } });

          const lawsuit: LawsuitEntry = {
            caseName: d.plaintiff_name ?? '',
            caseNo: d.case_number ?? '',
            court: d.court_name ?? '',
            typeOfCase: d.case_type ?? d.document_type,
            result: d.document_type === 'judgment' ? `Judgment: $${d.judgment_amount ?? 0}` : '',
            amount: d.amount_claimed != null ? String(d.amount_claimed) : '',
          };
          pendingLawsuits.push(lawsuit);
        }

        if (d.document_type === 'garnishment_order') {
          pending.push({ path: 'garnished', value: 'yes', confidence: c, source: { ...src, confidence: c } });

          const garnishment: GarnishmentEntry = {
            creditorName: d.plaintiff_name ?? '',
            creditorAddress: d.court_address ?? '',
            amountTaken: d.garnishment_amount != null ? String(d.garnishment_amount) : '',
            dates: d.filing_date ?? '',
          };
          pendingGarnishments.push(garnishment);
        }

        if (d.document_type === 'foreclosure_notice') {
          pending.push({ path: 'foreclosureOrSale', value: 'yes', confidence: c, source: { ...src, confidence: c } });

          const foreclosure: ForeclosureEntry = {
            property: d.property_address ?? '',
            value: '',
            date: d.filing_date ?? '',
            creditorNameAddress: d.plaintiff_name ?? '',
          };
          pendingForeclosures.push(foreclosure);
        }
      }
    }

    // ---- Retirement Account / IRA / 401k (all share the same schema) ----
    if (
      docClass === 'retirement_account' ||
      docClass === 'ira_statement' ||
      docClass === '401k_statement'
    ) {
      const d = data as RetirementAccountData;

      const hasInstitution = d.institution_name && conf(fieldConfidences, 'institution_name') >= MIN_CONFIDENCE;
      const hasBalance = d.ending_balance != null && conf(fieldConfidences, 'ending_balance') >= MIN_CONFIDENCE;

      if (hasInstitution || hasBalance) {
        const c = Math.max(
          conf(fieldConfidences, 'institution_name'),
          conf(fieldConfidences, 'ending_balance'),
        );
        // Flag that a retirement account exists
        pending.push({ path: 'hasIRA', value: 'yes', confidence: c, source: { ...src, confidence: c } });

        // Build a description for the iraDetails text field
        const parts: string[] = [];
        if (d.institution_name) parts.push(d.institution_name);
        if (d.account_type) parts.push(`(${d.account_type})`);
        if (d.ending_balance != null) parts.push(`Balance: $${d.ending_balance}`);
        if (d.account_number_last4) parts.push(`****${d.account_number_last4}`);

        pending.push({
          path: 'iraDetails',
          value: parts.join(' '),
          confidence: c,
          source: { ...src, confidence: c },
        });
      }
    }

    // ---- Social Security Letter ----
    if (docClass === 'social_security_letter') {
      const d = data as SocialSecurityData;

      if (d.monthly_benefit != null && conf(fieldConfidences, 'monthly_benefit') >= MIN_CONFIDENCE) {
        const c = conf(fieldConfidences, 'monthly_benefit');
        // Monthly SS benefit → Schedule I income. Route via incomeThisYear source field.
        const incomePath = isSpouse(belongsTo) ? 'incomeThisYear.spouseAmount' : 'incomeThisYear.youAmount';
        const sourceLabel = isSpouse(belongsTo) ? 'incomeThisYear.spouseSource' : 'incomeThisYear.youSource';
        pending.push({ path: incomePath, value: String(d.monthly_benefit), confidence: c, source: { ...src, confidence: c } });
        pending.push({ path: sourceLabel, value: 'Social Security', confidence: c, source: { ...src, confidence: c } });
      }
    }

    // ---- Profit & Loss Statement ----
    if (docClass === 'profit_loss_statement') {
      const d = data as ProfitLossData;

      const hasBusiness = d.business_name && conf(fieldConfidences, 'business_name') >= MIN_CONFIDENCE;
      const hasRevenue = d.gross_revenue != null && conf(fieldConfidences, 'gross_revenue') >= MIN_CONFIDENCE;

      if (hasBusiness || hasRevenue) {
        const c = Math.max(
          conf(fieldConfidences, 'business_name'),
          conf(fieldConfidences, 'gross_revenue'),
        );
        // Flag self-employment
        pending.push({ path: 'inBusiness', value: 'yes', confidence: c, source: { ...src, confidence: c } });

        const bizEntry: BusinessInfo = {
          name: d.business_name ?? '',
          dates: [d.period_start, d.period_end].filter(Boolean).join(' – '),
          address: '',
          othersInBusiness: 'no',
        };
        pendingBusinessInfo.push(bizEntry);

        // Net profit → self-employment income
        if (d.net_profit != null && conf(fieldConfidences, 'net_profit') >= MIN_CONFIDENCE) {
          const netC = conf(fieldConfidences, 'net_profit');
          const incomePath = isSpouse(belongsTo) ? 'incomeThisYear.spouseAmount' : 'incomeThisYear.youAmount';
          pending.push({ path: incomePath, value: String(d.net_profit), confidence: netC, source: { ...src, confidence: netC } });
        }
      }
    }

    // ---- Brokerage Statement ----
    if (docClass === 'brokerage_statement') {
      const d = data as BrokerageStatementData;

      const hasInstitution = d.institution_name && conf(fieldConfidences, 'institution_name') >= MIN_CONFIDENCE;
      const hasValue = d.ending_value != null && conf(fieldConfidences, 'ending_value') >= MIN_CONFIDENCE;

      if (hasInstitution || hasValue) {
        // Brokerage accounts are non-retirement financial assets.
        // Map to bankDeposits as the closest matching field (investment accounts at brokerages).
        const nameParts: string[] = [];
        if (d.institution_name) nameParts.push(d.institution_name);
        if (d.account_number_last4) nameParts.push(`(****${d.account_number_last4})`);

        const dedupKey = d.account_number_last4
          ? `brokerage|${d.institution_name ?? ''}|${d.account_number_last4}`
          : `brokerage|__no_acct__|${documentId}`;

        const existing = bankDepositMap.get(dedupKey);
        const periodEnd = d.statement_period_end ?? '';
        if (!existing || periodEnd >= existing.statementPeriodEnd) {
          bankDepositMap.set(dedupKey, {
            bankNameAddress: nameParts.join(' ') || '',
            amount: d.ending_value != null ? String(d.ending_value) : '',
            statementPeriodEnd: periodEnd,
          });
        }
      }
    }
  }

  // Resolve conflicts: highest confidence wins for each path
  const resolved = new Map<string, { value: unknown; confidence: number; source: AutofillSource }>();
  for (const item of pending) {
    const existing = resolved.get(item.path);
    if (!existing || item.confidence > existing.confidence) {
      resolved.set(item.path, { value: item.value, confidence: item.confidence, source: item.source });
    }
  }

  // Apply scalar fields (top-level and nested via dot-path)
  for (const [path, { value, source }] of resolved.entries()) {
    applyDotPath(fields, path, value);
    sources[path] = source;
  }

  // Apply bank deposits — one entry per unique account (deduped by institution+last4)
  if (bankDepositMap.size > 0) {
    // Collect institutions that have at least one properly-identified account (with last4).
    // No-last4 fallback entries for those institutions are dropped since they're almost
    // certainly the same accounts with a failed extraction month.
    const institutionsWithLast4 = new Set<string>();
    for (const key of bankDepositMap.keys()) {
      if (!key.startsWith('__no_acct__') && !key.startsWith('brokerage|__no_acct__')) {
        const institution = key.split('|')[0] === 'brokerage'
          ? key.split('|')[1]
          : key.split('|')[0];
        institutionsWithLast4.add(institution);
      }
    }

    fields.bankDeposits = Array.from(bankDepositMap.entries())
      .filter(([key, entry]) => {
        if (!key.startsWith('__no_acct__') && !key.startsWith('brokerage|__no_acct__')) return true;
        // Drop no-last4 entries when we already have identified accounts for that institution
        const institution = entry.bankNameAddress.split(' (****')[0];
        return !institutionsWithLast4.has(institution);
      })
      .map(([, { bankNameAddress, amount }]) => ({ bankNameAddress, amount } satisfies BankDeposit));
    sources['bankDeposits'] = {
      documentId: 'multiple',
      docClass: 'bank_statement',
      confidence: 1,
    };
  }

  // Apply array fields (append semantics — no dedup across doc types)
  if (pendingUnsecuredDebts.length > 0) {
    fields.unsecuredDebts = pendingUnsecuredDebts;
    sources['unsecuredDebts'] = { documentId: 'multiple', docClass: 'multiple', confidence: 1 };
  }

  if (pendingSecuredDebts.length > 0) {
    fields.securedDebts = pendingSecuredDebts;
    sources['securedDebts'] = { documentId: 'multiple', docClass: 'multiple', confidence: 1 };
  }

  if (pendingVehicles.length > 0) {
    fields.vehicles = pendingVehicles;
    sources['vehicles'] = { documentId: 'multiple', docClass: 'multiple', confidence: 1 };
  }

  if (pendingLawsuits.length > 0) {
    fields.lawsuits = pendingLawsuits;
    sources['lawsuits'] = { documentId: 'multiple', docClass: 'multiple', confidence: 1 };
  }

  if (pendingGarnishments.length > 0) {
    fields.garnishments = pendingGarnishments;
    sources['garnishments'] = { documentId: 'multiple', docClass: 'multiple', confidence: 1 };
  }

  if (pendingForeclosures.length > 0) {
    fields.foreclosures = pendingForeclosures;
    sources['foreclosures'] = { documentId: 'multiple', docClass: 'multiple', confidence: 1 };
  }

  if (pendingBusinessInfo.length > 0) {
    fields.businessInfo = pendingBusinessInfo;
    sources['businessInfo'] = { documentId: 'multiple', docClass: 'multiple', confidence: 1 };
  }

  return { fields, sources };
}

/**
 * Apply a value at a dot-path into an object (one level of nesting supported).
 * e.g. applyDotPath(obj, 'incomeThisYear.youAmount', '5000')
 *      → obj.incomeThisYear = { ...obj.incomeThisYear, youAmount: '5000' }
 */
function applyDotPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const dot = path.indexOf('.');
  if (dot === -1) {
    obj[path] = value;
  } else {
    const key = path.slice(0, dot);
    const rest = path.slice(dot + 1);
    if (typeof obj[key] !== 'object' || obj[key] === null) {
      obj[key] = {};
    }
    applyDotPath(obj[key] as Record<string, unknown>, rest, value);
  }
}
