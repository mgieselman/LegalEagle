import { SectionProps } from '@/types/questionnaire';
import { YesNoField, TextAreaField } from '@/components/FormField';

export function Section22CreditCards({ data, onChange }: SectionProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Section 22: Credit Cards</h3>

      <YesNoField
        label="Have you taken any recent cash advances?"
        value={data.recentCashAdvances}
        onChange={(v) => onChange('recentCashAdvances', v)}
      />
      {data.recentCashAdvances === 'yes' && (
        <TextAreaField
          label="Cash advance details"
          value={data.cashAdvanceDetails}
          onChange={(v) => onChange('cashAdvanceDetails', v)}
        />
      )}

      <YesNoField
        label="Are you over your credit limit on any cards?"
        value={data.overCreditLimit}
        onChange={(v) => onChange('overCreditLimit', v)}
      />
      {data.overCreditLimit === 'yes' && (
        <TextAreaField
          label="Over-limit details"
          value={data.overLimitDetails}
          onChange={(v) => onChange('overLimitDetails', v)}
        />
      )}

      <YesNoField
        label="Did you finance any collateral?"
        value={data.financeCollateral}
        onChange={(v) => onChange('financeCollateral', v)}
      />
      {data.financeCollateral === 'yes' && (
        <TextAreaField
          label="Finance collateral details"
          value={data.financeCollateralDetails}
          onChange={(v) => onChange('financeCollateralDetails', v)}
        />
      )}

      <YesNoField
        label="Do you have any payday loans?"
        value={data.paydayLoan}
        onChange={(v) => onChange('paydayLoan', v)}
      />
      {data.paydayLoan === 'yes' && (
        <TextAreaField
          label="Payday loan details"
          value={data.paydayLoanDetails}
          onChange={(v) => onChange('paydayLoanDetails', v)}
        />
      )}
    </div>
  );
}
