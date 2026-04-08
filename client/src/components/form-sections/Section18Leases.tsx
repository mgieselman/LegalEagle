import { QuestionnaireData } from '@/types/questionnaire';
import { YesNoField, TextAreaField } from '@/components/FormField';

interface Props {
  data: QuestionnaireData;
  onChange: (path: string, value: any) => void;
}

export function Section18Leases({ data, onChange }: Props) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Section 18: Leases &amp; Cooperatives</h3>

      <h4 className="text-sm font-medium">Auto Leases</h4>
      <YesNoField
        label="Do you have any auto leases?"
        value={data.hasAutoLease}
        onChange={(v) => onChange('hasAutoLease', v)}
      />
      {data.hasAutoLease === 'yes' && (
        <TextAreaField
          label="Auto Lease Details"
          value={data.autoLeaseDetails}
          onChange={(v) => onChange('autoLeaseDetails', v)}
          rows={3}
        />
      )}

      <h4 className="text-sm font-medium mt-4">Cooperatives</h4>
      <TextAreaField
        label="Cooperative Details"
        value={data.cooperativeDetails}
        onChange={(v) => onChange('cooperativeDetails', v)}
        rows={3}
      />
    </div>
  );
}
