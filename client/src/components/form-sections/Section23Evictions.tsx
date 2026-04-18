import { EvictionSuit, SectionProps } from '@/types/questionnaire';
import { YesNoField, TextAreaField, FindingsBanner } from '@/components/FormField';
import { DynamicTable } from '@/components/DynamicTable';

export function Section23Evictions({ data, onChange, findings }: SectionProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Section 23: Evictions</h3>

      <YesNoField label="Have you been involved in an eviction suit?" value={data.evictionSuit} onChange={(v) => onChange('evictionSuit', v)} fieldKey="evictionSuit" findings={findings} />
      {data.evictionSuit === 'yes' && (
        <>
          <FindingsBanner findings={findings} prefix="evictionSuits" />
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
        </>
      )}

      <YesNoField label="Has a landlord obtained a judgment against you?" value={data.landlordJudgment} onChange={(v) => onChange('landlordJudgment', v)} fieldKey="landlordJudgment" findings={findings} />
      {data.landlordJudgment === 'yes' && (
        <TextAreaField label="Rent payment details" value={data.rentPaymentDetails} onChange={(v) => onChange('rentPaymentDetails', v)} fieldKey="rentPaymentDetails" findings={findings} />
      )}

      <YesNoField label="Is a landlord planning to evict you?" value={data.landlordPlanningEviction} onChange={(v) => onChange('landlordPlanningEviction', v)} fieldKey="landlordPlanningEviction" findings={findings} />
      {data.landlordPlanningEviction === 'yes' && (
        <TextAreaField label="Eviction details" value={data.landlordEvictionDetails} onChange={(v) => onChange('landlordEvictionDetails', v)} fieldKey="landlordEvictionDetails" findings={findings} />
      )}
    </div>
  );
}

