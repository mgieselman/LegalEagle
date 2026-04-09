import { PropertyHeldByOther, SectionProps } from '@/types/questionnaire';
import { YesNoField, TextAreaField } from '@/components/FormField';
import { DynamicTable } from '@/components/DynamicTable';

export function Section11PropertyHeldByOthers({ data, onChange }: SectionProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Section 11: Property Held by Others</h3>

      <YesNoField
        label="Is any of your property held by someone else?"
        value={data.propertyHeldByOthers}
        onChange={(v) => onChange('propertyHeldByOthers', v)}
      />
      {data.propertyHeldByOthers === 'yes' && (
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
      )}

      <YesNoField
        label="Have you assigned any property for the benefit of creditors?"
        value={data.assignedProperty}
        onChange={(v) => onChange('assignedProperty', v)}
      />
      {data.assignedProperty === 'yes' && (
        <TextAreaField
          label="Assignment Details"
          value={data.assignedPropertyDetails}
          onChange={(v) => onChange('assignedPropertyDetails', v)}
        />
      )}

      <YesNoField
        label="Is any of your property in the hands of a receiver, trustee, or other court officer?"
        value={data.propertyWithReceiver}
        onChange={(v) => onChange('propertyWithReceiver', v)}
      />
      {data.propertyWithReceiver === 'yes' && (
        <TextAreaField
          label="Receiver/Trustee Details"
          value={data.propertyReceiverDetails}
          onChange={(v) => onChange('propertyReceiverDetails', v)}
        />
      )}

      <YesNoField
        label="Is any of your property pledged to a pawnbroker?"
        value={data.propertyWithPawnbroker}
        onChange={(v) => onChange('propertyWithPawnbroker', v)}
      />
      {data.propertyWithPawnbroker === 'yes' && (
        <TextAreaField
          label="Pawnbroker Details"
          value={data.pawnbrokerDetails}
          onChange={(v) => onChange('pawnbrokerDetails', v)}
        />
      )}
    </div>
  );
}
