import { LossEntry, SectionProps } from '@/types/questionnaire';
import { FormField, YesNoField, FindingsBanner } from '@/components/FormField';
import { DynamicTable } from '@/components/DynamicTable';

export function Section13Losses({ data, onChange, findings }: SectionProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Section 13: Losses</h3>

      <YesNoField
        label="Have you had any losses from fire, theft, or gambling?"
        value={data.hadLosses}
        onChange={(v) => onChange('hadLosses', v)}
        fieldKey="hadLosses"
        findings={findings}
      />
      {data.hadLosses === 'yes' && (
        <>
          <FindingsBanner findings={findings} prefix="losses" />
          <DynamicTable<LossEntry>
            columns={[
              { key: 'cause', label: 'Cause', placeholder: 'Fire, theft, gambling, etc.' },
              { key: 'value', label: 'Value', placeholder: '$0.00' },
              { key: 'date', label: 'Date', placeholder: 'MM/YYYY' },
            ]}
            rows={data.losses}
            onChange={(rows) => onChange('losses', rows)}
            createEmpty={() => ({ cause: '', value: '', date: '' })}
          />
        </>
      )}

      <YesNoField
        label="Did insurance pay for any loss?"
        value={data.insurancePaidLoss}
        onChange={(v) => onChange('insurancePaidLoss', v)}
        fieldKey="insurancePaidLoss"
        findings={findings}
      />
      {data.insurancePaidLoss === 'yes' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            label="Insurance Payment Date"
            value={data.insurancePaymentDate}
            onChange={(v) => onChange('insurancePaymentDate', v)}
            placeholder="MM/YYYY"
            fieldKey="insurancePaymentDate"
            findings={findings}
          />
          <FormField
            label="Insurance Amount Paid"
            value={data.insuranceAmountPaid}
            onChange={(v) => onChange('insuranceAmountPaid', v)}
            placeholder="$0.00"
            fieldKey="insuranceAmountPaid"
            findings={findings}
          />
        </div>
      )}
    </div>
  );
}

