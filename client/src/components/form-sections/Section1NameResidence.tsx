import { PriorAddress, SectionProps } from '@/types/questionnaire';
import { FormField, YesNoField } from '@/components/FormField';
import { DynamicTable } from '@/components/DynamicTable';

export function Section1NameResidence({ data, onChange }: SectionProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Section 1: Name &amp; Residence</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="Full Name" value={data.fullName} onChange={(v) => onChange('fullName', v)} />
        <FormField label="Spouse Full Name" value={data.spouseFullName} onChange={(v) => onChange('spouseFullName', v)} />
        <FormField label="SSN" value={data.ssn} onChange={(v) => onChange('ssn', v)} placeholder="XXX-XX-XXXX" />
        <FormField label="Spouse SSN" value={data.spouseSsn} onChange={(v) => onChange('spouseSsn', v)} placeholder="XXX-XX-XXXX" />
        <FormField label="Date of Birth" value={data.dob} onChange={(v) => onChange('dob', v)} type="date" />
        <FormField label="Spouse Date of Birth" value={data.spouseDob} onChange={(v) => onChange('spouseDob', v)} type="date" />
      </div>

      <FormField label="Other Names Used" value={data.otherNames} onChange={(v) => onChange('otherNames', v)} />

      <div>
        <h4 className="text-sm font-medium mb-2">Current Address</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Street" value={data.currentAddress?.street} onChange={(v) => onChange('currentAddress.street', v)} />
          <FormField label="City" value={data.currentAddress?.city} onChange={(v) => onChange('currentAddress.city', v)} />
          <FormField label="County" value={data.currentAddress?.county} onChange={(v) => onChange('currentAddress.county', v)} />
          <FormField label="Zip Code" value={data.currentAddress?.zipCode} onChange={(v) => onChange('currentAddress.zipCode', v)} />
        </div>
      </div>

      <div>
        <h4 className="text-sm font-medium mb-2">Leasing Information</h4>
        <YesNoField label="Are you leasing?" value={data.leasing?.isLeasing} onChange={(v) => onChange('leasing.isLeasing', v)} />
        {data.leasing?.isLeasing === 'yes' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
            <FormField label="Landlord Name" value={data.leasing?.landlordName} onChange={(v) => onChange('leasing.landlordName', v)} />
            <FormField label="Landlord Address" value={data.leasing?.landlordAddress} onChange={(v) => onChange('leasing.landlordAddress', v)} />
            <FormField label="Lease Terms" value={data.leasing?.leaseTerms} onChange={(v) => onChange('leasing.leaseTerms', v)} className="md:col-span-2" />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="Phone" value={data.phone} onChange={(v) => onChange('phone', v)} type="tel" />
        <FormField label="Email" value={data.email} onChange={(v) => onChange('email', v)} type="email" />
      </div>

      <div>
        <h4 className="text-sm font-medium mb-2">Prior Addresses</h4>
        <DynamicTable<PriorAddress>
          columns={[
            { key: 'address', label: 'Address', placeholder: 'Full address' },
            { key: 'dateMovedIn', label: 'Date Moved In', type: 'date' },
            { key: 'dateMovedOut', label: 'Date Moved Out', type: 'date' },
          ]}
          rows={data.priorAddresses}
          onChange={(rows) => onChange('priorAddresses', rows)}
          createEmpty={() => ({ address: '', dateMovedIn: '', dateMovedOut: '' })}
        />
      </div>
    </div>
  );
}
