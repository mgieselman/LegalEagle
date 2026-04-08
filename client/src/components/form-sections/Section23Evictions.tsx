import { QuestionnaireData, EvictionSuit } from '@/types/questionnaire';
import { YesNoField, TextAreaField } from '@/components/FormField';
import { DynamicTable } from '@/components/DynamicTable';

interface Props {
  data: QuestionnaireData;
  onChange: (path: string, value: any) => void;
}

export function Section23Evictions({ data, onChange }: Props) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Section 23: Evictions</h3>

      <YesNoField
        label="Have you been involved in an eviction suit?"
        value={data.evictionSuit}
        onChange={(v) => onChange('evictionSuit', v)}
      />
      {data.evictionSuit === 'yes' && (
        <DynamicTable<EvictionSuit>
          columns={[
            { key: 'caseName', label: 'Case Name', placeholder: 'Case name' },
            { key: 'caseNo', label: 'Case No.', placeholder: 'Case number' },
            { key: 'courtNameAddress', label: 'Court Name & Address', placeholder: 'Court name and address' },
            { key: 'reason', label: 'Reason', placeholder: 'Reason for eviction' },
            { key: 'result', label: 'Result', placeholder: 'Outcome' },
          ]}
          rows={data.evictionSuits}
          onChange={(rows) => onChange('evictionSuits', rows)}
          createEmpty={() => ({ caseName: '', caseNo: '', courtNameAddress: '', reason: '', result: '' })}
        />
      )}

      <YesNoField
        label="Has a landlord obtained a judgment against you?"
        value={data.landlordJudgment}
        onChange={(v) => onChange('landlordJudgment', v)}
      />
      {data.landlordJudgment === 'yes' && (
        <TextAreaField
          label="Rent payment details"
          value={data.rentPaymentDetails}
          onChange={(v) => onChange('rentPaymentDetails', v)}
        />
      )}

      <YesNoField
        label="Is a landlord planning to evict you?"
        value={data.landlordPlanningEviction}
        onChange={(v) => onChange('landlordPlanningEviction', v)}
      />
      {data.landlordPlanningEviction === 'yes' && (
        <TextAreaField
          label="Eviction details"
          value={data.landlordEvictionDetails}
          onChange={(v) => onChange('landlordEvictionDetails', v)}
        />
      )}
    </div>
  );
}
