import { ForeclosureEntry, GarnishmentEntry, SectionProps } from '@/types/questionnaire';
import { YesNoField } from '@/components/FormField';
import { DynamicTable } from '@/components/DynamicTable';

export function Section9Garnishment({ data, onChange }: SectionProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Section 9: Garnishment &amp; Foreclosure</h3>

      <YesNoField
        label="Has any property been foreclosed or sold at a tax sale?"
        value={data.foreclosureOrSale}
        onChange={(v) => onChange('foreclosureOrSale', v)}
      />
      {data.foreclosureOrSale === 'yes' && (
        <div>
          <h4 className="text-sm font-medium mb-2">Foreclosures / Tax Sales</h4>
          <DynamicTable<ForeclosureEntry>
            columns={[
              { key: 'property', label: 'Property' },
              { key: 'value', label: 'Value', placeholder: '$' },
              { key: 'date', label: 'Date', type: 'date' },
              { key: 'creditorNameAddress', label: 'Creditor Name & Address' },
            ]}
            rows={data.foreclosures}
            onChange={(rows) => onChange('foreclosures', rows)}
            createEmpty={() => ({ property: '', value: '', date: '', creditorNameAddress: '' })}
          />
        </div>
      )}

      <YesNoField
        label="Have your wages or bank account been garnished?"
        value={data.garnished}
        onChange={(v) => onChange('garnished', v)}
      />
      {data.garnished === 'yes' && (
        <div>
          <h4 className="text-sm font-medium mb-2">Garnishments</h4>
          <DynamicTable<GarnishmentEntry>
            columns={[
              { key: 'creditorName', label: 'Creditor Name' },
              { key: 'creditorAddress', label: 'Creditor Address' },
              { key: 'amountTaken', label: 'Amount Taken', placeholder: '$' },
              { key: 'dates', label: 'Dates' },
            ]}
            rows={data.garnishments}
            onChange={(rows) => onChange('garnishments', rows)}
            createEmpty={() => ({ creditorName: '', creditorAddress: '', amountTaken: '', dates: '' })}
          />
        </div>
      )}
    </div>
  );
}
