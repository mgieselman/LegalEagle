import { SectionProps } from '@/types/questionnaire';
import { YesNoField, TextAreaField } from '@/components/FormField';

export function Section22CreditCards({ data, onChange, findings }: SectionProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Section 22: Credit Cards</h3>

      <YesNoField label="Have you taken any recent cash advances?" value={data.recentCashAdvances} onChange={(v) => onChange('recentCashAdvances', v)} fieldKey="recentCashAdvances" findings={findings} />
      {data.recentCashAdvances === 'yes' && (
        <TextAreaField label="Cash advance details" value={data.cashAdvanceDetails} onChange={(v) => onChange('cashAdvanceDetails', v)} fieldKey="cashAdvanceDetails" findings={findings} />
      )}

      <YesNoField label="Are you over your credit limit on any cards?" value={data.overCreditLimit} onChange={(v) => onChange('overCreditLimit', v)} fieldKey="overCreditLimit" findings={findings} />
      {data.overCreditLimit === 'yes' && (
        <TextAreaField label="Over-limit details" value={data.overLimitDetails} onChange={(v) => onChange('overLimitDetails', v)} fieldKey="overLimitDetails" findings={findings} />
      )}

      <YesNoField label="Did you finance any collateral?" value={data.financeCollateral} onChange={(v) => onChange('financeCollateral', v)} fieldKey="financeCollateral" findings={findings} />
      {data.financeCollateral === 'yes' && (
        <TextAreaField label="Finance collateral details" value={data.financeCollateralDetails} onChange={(v) => onChange('financeCollateralDetails', v)} fieldKey="financeCollateralDetails" findings={findings} />
      )}

      <YesNoField label="Do you have any payday loans?" value={data.paydayLoan} onChange={(v) => onChange('paydayLoan', v)} fieldKey="paydayLoan" findings={findings} />
      {data.paydayLoan === 'yes' && (
        <TextAreaField label="Payday loan details" value={data.paydayLoanDetails} onChange={(v) => onChange('paydayLoanDetails', v)} fieldKey="paydayLoanDetails" findings={findings} />
      )}
    </div>
  );
}
