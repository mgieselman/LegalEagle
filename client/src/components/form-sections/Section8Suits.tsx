import { LawsuitEntry, CriminalCase, AdminCase, SectionProps } from '@/types/questionnaire';
import { YesNoField, TextAreaField, FindingsBanner } from '@/components/FormField';
import { DynamicTable } from '@/components/DynamicTable';

const lawsuitColumns = [
  { key: 'caseName', label: 'Case Name' },
  { key: 'caseNo', label: 'Case No.' },
  { key: 'court', label: 'Court' },
  { key: 'typeOfCase', label: 'Type of Case' },
  { key: 'result', label: 'Result' },
  { key: 'amount', label: 'Amount', placeholder: '$' },
];

const createEmptyLawsuit = (): LawsuitEntry => ({
  caseName: '', caseNo: '', court: '', typeOfCase: '', result: '', amount: '',
});

export function Section8Suits({ data, onChange, findings }: SectionProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Section 8: Suits &amp; Legal Actions</h3>

      <YesNoField label="Have you been sued?" value={data.beenSued} onChange={(v) => onChange('beenSued', v)} fieldKey="beenSued" findings={findings} />
      {data.beenSued === 'yes' && (
        <div>
          <h4 className="text-sm font-medium mb-2">Lawsuits Against You</h4>
          <FindingsBanner findings={findings} prefix="lawsuits" />
          <DynamicTable<LawsuitEntry>
            columns={lawsuitColumns}
            rows={data.lawsuits}
            onChange={(rows) => onChange('lawsuits', rows)}
            createEmpty={createEmptyLawsuit}
          />
        </div>
      )}

      <YesNoField label="Did any suit result in a lien on your property?" value={data.suitResultedInLien} onChange={(v) => onChange('suitResultedInLien', v)} fieldKey="suitResultedInLien" findings={findings} />

      <YesNoField label="Have you sued others?" value={data.hasSuedOthers} onChange={(v) => onChange('hasSuedOthers', v)} fieldKey="hasSuedOthers" findings={findings} />
      {data.hasSuedOthers === 'yes' && (
        <div>
          <h4 className="text-sm font-medium mb-2">Suits You Filed</h4>
          <FindingsBanner findings={findings} prefix="suitsFiled" />
          <DynamicTable<LawsuitEntry>
            columns={lawsuitColumns}
            rows={data.suitsFiled}
            onChange={(rows) => onChange('suitsFiled', rows)}
            createEmpty={createEmptyLawsuit}
          />
        </div>
      )}

      <YesNoField label="Have you been charged with a crime?" value={data.criminalCharges} onChange={(v) => onChange('criminalCharges', v)} fieldKey="criminalCharges" findings={findings} />
      {data.criminalCharges === 'yes' && (
        <div>
          <h4 className="text-sm font-medium mb-2">Criminal Cases</h4>
          <FindingsBanner findings={findings} prefix="criminalCases" />
          <DynamicTable<CriminalCase>
            columns={[
              { key: 'caseNo', label: 'Case No.' },
              { key: 'courtName', label: 'Court Name' },
              { key: 'charges', label: 'Charges' },
              { key: 'result', label: 'Result' },
              { key: 'finesOwed', label: 'Fines Owed', placeholder: '$' },
            ]}
            rows={data.criminalCases}
            onChange={(rows) => onChange('criminalCases', rows)}
            createEmpty={() => ({ caseNo: '', courtName: '', charges: '', result: '', finesOwed: '' })}
          />
        </div>
      )}

      <YesNoField label="Any administrative cases (tax court, workers comp, etc.)?" value={data.adminCases} onChange={(v) => onChange('adminCases', v)} fieldKey="adminCases" findings={findings} />
      {data.adminCases === 'yes' && (
        <div>
          <h4 className="text-sm font-medium mb-2">Administrative Cases</h4>
          <FindingsBanner findings={findings} prefix="adminCaseEntries" />
          <DynamicTable<AdminCase>
            columns={[
              { key: 'caseName', label: 'Case Name' },
              { key: 'caseNo', label: 'Case No.' },
              { key: 'agencyNameAddress', label: 'Agency Name & Address' },
              { key: 'typeOfCase', label: 'Type of Case' },
              { key: 'result', label: 'Result' },
            ]}
            rows={data.adminCaseEntries}
            onChange={(rows) => onChange('adminCaseEntries', rows)}
            createEmpty={() => ({ caseName: '', caseNo: '', agencyNameAddress: '', typeOfCase: '', result: '' })}
          />
        </div>
      )}

      <YesNoField label="Do you have a possible lawsuit you could file?" value={data.possibleLawsuit} onChange={(v) => onChange('possibleLawsuit', v)} fieldKey="possibleLawsuit" findings={findings} />
      {data.possibleLawsuit === 'yes' && (
        <TextAreaField label="Details" value={data.possibleLawsuitDetails} onChange={(v) => onChange('possibleLawsuitDetails', v)} fieldKey="possibleLawsuitDetails" findings={findings} />
      )}
    </div>
  );
}
