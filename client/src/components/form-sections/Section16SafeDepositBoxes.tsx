import { SafeDepositBox, SectionProps } from '@/types/questionnaire';
import { YesNoField } from '@/components/FormField';
import { DynamicTable } from '@/components/DynamicTable';

export function Section16SafeDepositBoxes({ data, onChange }: SectionProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Section 16: Safe Deposit Boxes</h3>

      <YesNoField
        label="Do you have or have you had a safe deposit box?"
        value={data.hasSafeDepositBox}
        onChange={(v) => onChange('hasSafeDepositBox', v)}
      />
      {data.hasSafeDepositBox === 'yes' && (
        <DynamicTable<SafeDepositBox>
          columns={[
            { key: 'bankNameAddress', label: 'Bank Name & Address', placeholder: 'Bank name and address' },
            { key: 'accessPersons', label: 'Persons with Access', placeholder: 'Names' },
            { key: 'contents', label: 'Contents', placeholder: 'Description of contents' },
            { key: 'dateClosed', label: 'Date Closed', placeholder: 'MM/YYYY or current' },
          ]}
          rows={data.safeDepositBoxes}
          onChange={(rows) => onChange('safeDepositBoxes', rows)}
          createEmpty={() => ({ bankNameAddress: '', accessPersons: '', contents: '', dateClosed: '' })}
        />
      )}
    </div>
  );
}
