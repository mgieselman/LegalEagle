import { GiftTransfer, PropertySaleProceeds, SectionProps } from '@/types/questionnaire';
import { YesNoField, FindingsBanner } from '@/components/FormField';
import { DynamicTable } from '@/components/DynamicTable';

export function Section12GiftsTransfers({ data, onChange, findings }: SectionProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Section 12: Gifts &amp; Transfers</h3>

      <YesNoField
        label="Have you made any gifts or transfers of property?"
        value={data.madeGiftsOrTransfers}
        onChange={(v) => onChange('madeGiftsOrTransfers', v)}
        fieldKey="madeGiftsOrTransfers"
        findings={findings}
      />
      {data.madeGiftsOrTransfers === 'yes' && (
        <>
          <FindingsBanner findings={findings} prefix="giftsTransfers" />
          <DynamicTable<GiftTransfer>
            columns={[
              { key: 'recipientName', label: 'Recipient Name', placeholder: 'Name' },
              { key: 'description', label: 'Description', placeholder: 'Description of property' },
              { key: 'monthYear', label: 'Month/Year', placeholder: 'MM/YYYY' },
              { key: 'saleOrGiftToRelative', label: 'Sale or Gift to Relative?', placeholder: 'Sale/Gift' },
            ]}
            rows={data.giftsTransfers}
            onChange={(rows) => onChange('giftsTransfers', rows)}
            createEmpty={() => ({ recipientName: '', description: '', monthYear: '', saleOrGiftToRelative: '' })}
          />
        </>
      )}

      <YesNoField
        label="Have you used proceeds from the sale of property to purchase a home?"
        value={data.usedSaleProceeds}
        onChange={(v) => onChange('usedSaleProceeds', v)}
        fieldKey="usedSaleProceeds"
        findings={findings}
      />
      {data.usedSaleProceeds === 'yes' && (
        <>
          <FindingsBanner findings={findings} prefix="saleProceeds" />
          <DynamicTable<PropertySaleProceeds>
            columns={[
              { key: 'description', label: 'Description', placeholder: 'Description of property sold' },
              { key: 'monthYear', label: 'Month/Year', placeholder: 'MM/YYYY' },
              { key: 'amountReceived', label: 'Amount Received', placeholder: '$0.00' },
              { key: 'amountUsedForHome', label: 'Amount Used for Home', placeholder: '$0.00' },
            ]}
            rows={data.saleProceeds}
            onChange={(rows) => onChange('saleProceeds', rows)}
            createEmpty={() => ({ description: '', monthYear: '', amountReceived: '', amountUsedForHome: '' })}
          />
        </>
      )}
    </div>
  );
}

