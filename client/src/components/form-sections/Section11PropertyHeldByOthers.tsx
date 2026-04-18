import { PropertyHeldByOther, SectionProps } from '@/types/questionnaire';
import { YesNoField, TextAreaField, FindingsBanner } from '@/components/FormField';
import { DynamicTable } from '@/components/DynamicTable';

export function Section11PropertyHeldByOthers({ data, onChange, findings }: SectionProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Section 11: Property Held by Others</h3>

      <YesNoField
        label="Is any of your property held by someone else?"
        value={data.propertyHeldByOthers}
        onChange={(v) => onChange('propertyHeldByOthers', v)}
        fieldKey="propertyHeldByOthers"
        findings={findings}
      />
      {data.propertyHeldByOthers === 'yes' && (
        <>
          <FindingsBanner findings={findings} prefix="propertyHeldEntries" />
          <DynamicTable<PropertyHeldByOther>
            columns={[
              { key: 'typeOfProperty', label: 'Type of Property', placeholder: 'Description' },
              { key: 'value', label: 'Value', placeholder: '$0.00' },
              { key: 'heldByNameAddress', label: 'Held By (Name & Address)', placeholder: 'Name and address' },
              { key: 'reason', label: 'Reason', placeholder: 'Reason held' },
            ]}
            rows={data.propertyHeldEntries}
            onChange={(rows) => onChange('propertyHeldEntries', rows)}
            createEmpty={() => ({ typeOfProperty: '', value: '', heldByNameAddress: '', reason: '' })}
          />
        </>
      )}

      <YesNoField
        label="Have you assigned any property for the benefit of creditors?"
        value={data.assignedProperty}
        onChange={(v) => onChange('assignedProperty', v)}
        fieldKey="assignedProperty"
        findings={findings}
      />
      {data.assignedProperty === 'yes' && (
        <TextAreaField
          label="Assignment Details"
          value={data.assignedPropertyDetails}
          onChange={(v) => onChange('assignedPropertyDetails', v)}
          fieldKey="assignedPropertyDetails"
          findings={findings}
        />
      )}

      <YesNoField
        label="Is any of your property in the hands of a receiver, trustee, or other court officer?"
        value={data.propertyWithReceiver}
        onChange={(v) => onChange('propertyWithReceiver', v)}
        fieldKey="propertyWithReceiver"
        findings={findings}
      />
      {data.propertyWithReceiver === 'yes' && (
        <TextAreaField
          label="Receiver/Trustee Details"
          value={data.propertyReceiverDetails}
          onChange={(v) => onChange('propertyReceiverDetails', v)}
          fieldKey="propertyReceiverDetails"
          findings={findings}
        />
      )}

      <YesNoField
        label="Is any of your property pledged to a pawnbroker?"
        value={data.propertyWithPawnbroker}
        onChange={(v) => onChange('propertyWithPawnbroker', v)}
        fieldKey="propertyWithPawnbroker"
        findings={findings}
      />
      {data.propertyWithPawnbroker === 'yes' && (
        <TextAreaField
          label="Pawnbroker Details"
          value={data.pawnbrokerDetails}
          onChange={(v) => onChange('pawnbrokerDetails', v)}
          fieldKey="pawnbrokerDetails"
          findings={findings}
        />
      )}
    </div>
  );
}

