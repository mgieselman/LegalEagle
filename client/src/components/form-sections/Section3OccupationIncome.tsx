import { QuestionnaireValue, SectionProps } from '@/types/questionnaire';
import { FormField } from '@/components/FormField';

function IncomeRow({
  label,
  prefix,
  entry,
  onChange,
}: {
  label: string;
  prefix: string;
  entry: { youAmount: string; youSource: string; spouseAmount: string; spouseSource: string };
  onChange: (path: string, value: QuestionnaireValue) => void;
}) {
  return (
    <div className="space-y-2">
      <span className="text-sm font-medium md:hidden">{label}</span>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 items-end">
        <span className="text-sm font-medium self-center hidden md:block">{label}</span>
        <FormField label="Your Amount" value={entry.youAmount} onChange={(v) => onChange(`${prefix}.youAmount`, v)} placeholder="$" />
        <FormField label="Your Source" value={entry.youSource} onChange={(v) => onChange(`${prefix}.youSource`, v)} />
        <FormField label="Spouse Amount" value={entry.spouseAmount} onChange={(v) => onChange(`${prefix}.spouseAmount`, v)} placeholder="$" />
        <FormField label="Spouse Source" value={entry.spouseSource} onChange={(v) => onChange(`${prefix}.spouseSource`, v)} />
      </div>
    </div>
  );
}

export function Section3OccupationIncome({ data, onChange }: SectionProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Section 3: Occupation &amp; Income</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="Your Usual Type of Work" value={data.usualTypeOfWork} onChange={(v) => onChange('usualTypeOfWork', v)} />
        <FormField label="Employer Name &amp; Address" value={data.employerNameAddress} onChange={(v) => onChange('employerNameAddress', v)} />
        <FormField label="Spouse Usual Type of Work" value={data.spouseUsualWork} onChange={(v) => onChange('spouseUsualWork', v)} />
        <FormField label="Spouse Employer Name &amp; Address" value={data.spouseEmployerNameAddress} onChange={(v) => onChange('spouseEmployerNameAddress', v)} />
        <FormField label="How Long at Current Job?" value={data.jobDuration} onChange={(v) => onChange('jobDuration', v)} />
        <FormField label="Spouse Job Duration" value={data.spouseJobDuration} onChange={(v) => onChange('spouseJobDuration', v)} />
      </div>

      <div>
        <h4 className="text-sm font-medium mb-2">Income</h4>
        <div className="space-y-3">
          <IncomeRow label="This Year" prefix="incomeThisYear" entry={data.incomeThisYear} onChange={onChange} />
          <IncomeRow label="Last Year" prefix="incomeLastYear" entry={data.incomeLastYear} onChange={onChange} />
          <IncomeRow label="Year Before" prefix="incomeYearBeforeLast" entry={data.incomeYearBeforeLast} onChange={onChange} />
        </div>
      </div>
    </div>
  );
}
