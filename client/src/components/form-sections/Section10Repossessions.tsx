import { QuestionnaireData, RepossessionEntry, ReturnEntry } from '@/types/questionnaire';
import { FormField, YesNoField } from '@/components/FormField';
import { DynamicTable } from '@/components/DynamicTable';

interface Props {
  data: QuestionnaireData;
  onChange: (path: string, value: any) => void;
}

export function Section10Repossessions({ data, onChange }: Props) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Section 10: Repossessions</h3>

      <YesNoField
        label="Has any property been repossessed?"
        value={data.repossessed}
        onChange={(v) => onChange('repossessed', v)}
      />
      {data.repossessed === 'yes' && (
        <DynamicTable<RepossessionEntry>
          columns={[
            { key: 'description', label: 'Description', placeholder: 'Description of property' },
            { key: 'monthYear', label: 'Month/Year', placeholder: 'MM/YYYY' },
            { key: 'whoRepossessed', label: 'Who Repossessed', placeholder: 'Name of creditor' },
            { key: 'value', label: 'Value', placeholder: '$0.00' },
          ]}
          rows={data.repossessions}
          onChange={(rows) => onChange('repossessions', rows)}
          createEmpty={() => ({ description: '', monthYear: '', whoRepossessed: '', value: '' })}
        />
      )}

      <YesNoField
        label="Have you voluntarily returned any property?"
        value={data.voluntaryReturns}
        onChange={(v) => onChange('voluntaryReturns', v)}
      />
      {data.voluntaryReturns === 'yes' && (
        <DynamicTable<ReturnEntry>
          columns={[
            { key: 'description', label: 'Description', placeholder: 'Description of property' },
            { key: 'monthYear', label: 'Month/Year', placeholder: 'MM/YYYY' },
            { key: 'sellerNameAddress', label: 'Seller Name & Address', placeholder: 'Name and address' },
            { key: 'value', label: 'Value', placeholder: '$0.00' },
          ]}
          rows={data.returns}
          onChange={(rows) => onChange('returns', rows)}
          createEmpty={() => ({ description: '', monthYear: '', sellerNameAddress: '', value: '' })}
        />
      )}
    </div>
  );
}
