import { PriorBankruptcy, SectionProps } from '@/types/questionnaire';
import { YesNoField, TextAreaField, FindingsBanner } from '@/components/FormField';
import { DynamicTable } from '@/components/DynamicTable';

export function Section2PriorBankruptcy({ data, onChange, findings }: SectionProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Section 2: Prior Bankruptcy</h3>

      <YesNoField
        label="Have you ever filed bankruptcy before?"
        value={data.priorBankruptcy}
        onChange={(v) => onChange('priorBankruptcy', v)}
        fieldKey="priorBankruptcy"
        findings={findings}
      />

      {data.priorBankruptcy === 'yes' && (
        <div>
          <h4 className="text-sm font-medium mb-2">Prior Bankruptcies</h4>
          <FindingsBanner findings={findings} prefix="priorBankruptcies" />
          <DynamicTable<PriorBankruptcy>
            columns={[
              { key: 'chapter', label: 'Chapter', placeholder: 'e.g. 7, 13' },
              { key: 'dateFiled', label: 'Date Filed', type: 'date' },
              { key: 'didGetDischarge', label: 'Discharged?', placeholder: 'Yes/No' },
              { key: 'dischargeDate', label: 'Discharge Date', type: 'date' },
              { key: 'dismissedDate', label: 'Dismissed Date', type: 'date' },
              { key: 'dismissedReason', label: 'Dismissal Reason' },
            ]}
            rows={data.priorBankruptcies}
            onChange={(rows) => onChange('priorBankruptcies', rows)}
            createEmpty={() => ({ chapter: '', dateFiled: '', didGetDischarge: '', dischargeDate: '', dismissedDate: '', dismissedReason: '' })}
          />
        </div>
      )}

      <YesNoField
        label="Has anyone else filed bankruptcy on your home?"
        value={data.otherBankruptcyOnHome}
        onChange={(v) => onChange('otherBankruptcyOnHome', v)}
        fieldKey="otherBankruptcyOnHome"
        findings={findings}
      />

      {data.otherBankruptcyOnHome === 'yes' && (
        <TextAreaField
          label="Details"
          value={data.otherBankruptcyDetails}
          onChange={(v) => onChange('otherBankruptcyDetails', v)}
          fieldKey="otherBankruptcyDetails"
          findings={findings}
        />
      )}
    </div>
  );
}
