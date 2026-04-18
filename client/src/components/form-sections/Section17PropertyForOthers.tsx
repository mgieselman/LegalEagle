import { PropertyHeldForOther, SectionProps } from '@/types/questionnaire';
import { FormField, YesNoField, FindingsBanner } from '@/components/FormField';
import { DynamicTable } from '@/components/DynamicTable';

export function Section17PropertyForOthers({ data, onChange, findings }: SectionProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Section 17: Property Held for Others</h3>

      <YesNoField
        label="Are you holding property that belongs to someone else?"
        value={data.holdsPropertyForOthers}
        onChange={(v) => onChange('holdsPropertyForOthers', v)}
        fieldKey="holdsPropertyForOthers"
        findings={findings}
      />
      {data.holdsPropertyForOthers === 'yes' && (
        <>
          <FindingsBanner findings={findings} prefix="propertyHeldForOthers" />
          <DynamicTable<PropertyHeldForOther>
            columns={[
              { key: 'typeOfProperty', label: 'Type of Property', placeholder: 'Description' },
              { key: 'value', label: 'Value', placeholder: '$0.00' },
              { key: 'ownedBy', label: 'Owned By', placeholder: 'Owner name' },
              { key: 'address', label: 'Address', placeholder: "Owner's address" },
              { key: 'isRelative', label: 'Is Relative?', placeholder: 'Yes/No' },
            ]}
            rows={data.propertyHeldForOthers}
            onChange={(rows) => onChange('propertyHeldForOthers', rows)}
            createEmpty={() => ({ typeOfProperty: '', value: '', ownedBy: '', address: '', isRelative: '' })}
          />
          <FormField
            label="Address Where Property Is Held"
            value={data.propertyHeldAddress}
            onChange={(v) => onChange('propertyHeldAddress', v)}
            placeholder="Address where property is located"
            fieldKey="propertyHeldAddress"
            findings={findings}
          />
        </>
      )}
    </div>
  );
}
