import { TaxOwed, SectionProps } from '@/types/questionnaire';
import { FormField, YesNoField, TextAreaField } from '@/components/FormField';
import { DynamicTable } from '@/components/DynamicTable';

const taxColumns = [
  { key: 'entity', label: 'Entity' },
  { key: 'address', label: 'Address' },
  { key: 'kindOfTax', label: 'Kind of Tax' },
  { key: 'years', label: 'Years' },
  { key: 'amount', label: 'Amount', placeholder: '$' },
];

const createEmptyTax = (): TaxOwed => ({ entity: '', address: '', kindOfTax: '', years: '', amount: '' });

export function Section6Taxes({ data, onChange }: SectionProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Section 6: Taxes</h3>

      <YesNoField label="Did you receive a tax refund this year?" value={data.receivedRefund} onChange={(v) => onChange('receivedRefund', v)} />
      {data.receivedRefund === 'yes' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="State Refund Amount" value={data.refundState} onChange={(v) => onChange('refundState', v)} placeholder="$" />
          <FormField label="Federal Refund Amount" value={data.refundFederal} onChange={(v) => onChange('refundFederal', v)} placeholder="$" />
        </div>
      )}

      <YesNoField label="Do you expect a tax refund?" value={data.expectRefund} onChange={(v) => onChange('expectRefund', v)} />
      {data.expectRefund === 'yes' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField label="Expected State Refund" value={data.expectedRefundState} onChange={(v) => onChange('expectedRefundState', v)} placeholder="$" />
          <FormField label="Expected Federal Refund" value={data.expectedRefundFederal} onChange={(v) => onChange('expectedRefundFederal', v)} placeholder="$" />
          <FormField label="Expected Refund Date" value={data.expectedRefundDate} onChange={(v) => onChange('expectedRefundDate', v)} type="date" />
        </div>
      )}

      <YesNoField label="Did you claim Earned Income Credit?" value={data.earnedIncomeCredit} onChange={(v) => onChange('earnedIncomeCredit', v)} />

      <YesNoField label="Have you already filed your taxes?" value={data.alreadyFiled} onChange={(v) => onChange('alreadyFiled', v)} />

      <YesNoField label="Is someone intercepting your refund?" value={data.someoneInterceptingRefund} onChange={(v) => onChange('someoneInterceptingRefund', v)} />
      {data.someoneInterceptingRefund === 'yes' && (
        <TextAreaField label="Intercept Details" value={data.interceptDetails} onChange={(v) => onChange('interceptDetails', v)} />
      )}

      <YesNoField label="Did you take a refund anticipation loan?" value={data.refundAnticipationLoan} onChange={(v) => onChange('refundAnticipationLoan', v)} />

      <YesNoField label="Is anyone else entitled to your refund?" value={data.otherEntitledToRefund} onChange={(v) => onChange('otherEntitledToRefund', v)} />

      <YesNoField label="Have you filed tax returns for the last 7 years?" value={data.filedLast7Years} onChange={(v) => onChange('filedLast7Years', v)} />

      <YesNoField label="Do you have copies of returns for the last 4 years?" value={data.hasCopiesLast4Years} onChange={(v) => onChange('hasCopiesLast4Years', v)} />
      {data.hasCopiesLast4Years === 'no' && (
        <FormField label="Which years are missing?" value={data.missingCopiesYears} onChange={(v) => onChange('missingCopiesYears', v)} />
      )}

      <YesNoField label="Do you owe federal taxes?" value={data.owesFederalTaxes} onChange={(v) => onChange('owesFederalTaxes', v)} />
      {data.owesFederalTaxes === 'yes' && (
        <DynamicTable<TaxOwed>
          columns={taxColumns}
          rows={data.federalTaxesOwed}
          onChange={(rows) => onChange('federalTaxesOwed', rows)}
          createEmpty={createEmptyTax}
        />
      )}

      <YesNoField label="Do you owe state taxes?" value={data.owesStateTaxes} onChange={(v) => onChange('owesStateTaxes', v)} />
      {data.owesStateTaxes === 'yes' && (
        <DynamicTable<TaxOwed>
          columns={taxColumns}
          rows={data.stateTaxesOwed}
          onChange={(rows) => onChange('stateTaxesOwed', rows)}
          createEmpty={createEmptyTax}
        />
      )}

      <YesNoField label="Do you owe local taxes?" value={data.owesLocalTaxes} onChange={(v) => onChange('owesLocalTaxes', v)} />
      {data.owesLocalTaxes === 'yes' && (
        <DynamicTable<TaxOwed>
          columns={taxColumns}
          rows={data.localTaxesOwed}
          onChange={(rows) => onChange('localTaxesOwed', rows)}
          createEmpty={createEmptyTax}
        />
      )}

      <YesNoField label="Do you owe other money to the government?" value={data.owesOtherGovMoney} onChange={(v) => onChange('owesOtherGovMoney', v)} />
      {data.owesOtherGovMoney === 'yes' && (
        <TextAreaField label="Details" value={data.otherGovMoneyDetails} onChange={(v) => onChange('otherGovMoneyDetails', v)} />
      )}
    </div>
  );
}
