import { ClosedBankAccount, SectionProps } from '@/types/questionnaire';
import { YesNoField, FindingsBanner } from '@/components/FormField';
import { DynamicTable } from '@/components/DynamicTable';

export function Section15ClosedBankAccounts({ data, onChange, findings }: SectionProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Section 15: Closed Bank Accounts</h3>

      <YesNoField
        label="Have you closed any bank accounts in the last year?"
        value={data.closedAccounts}
        onChange={(v) => onChange('closedAccounts', v)}
        fieldKey="closedAccounts"
        findings={findings}
      />
      {data.closedAccounts === 'yes' && (
        <>
          <FindingsBanner findings={findings} prefix="closedAccountEntries" />
          <DynamicTable<ClosedBankAccount>
          columns={[
            { key: 'bankNameAddress', label: 'Bank Name & Address', placeholder: 'Bank name and address' },
            { key: 'acctNo', label: 'Account No.', placeholder: 'Account number' },
            { key: 'typeOfAccount', label: 'Type of Account', placeholder: 'Checking, savings, etc.' },
            { key: 'otherNames', label: 'Other Names on Account', placeholder: 'Names' },
            { key: 'dateClosed', label: 'Date Closed', placeholder: 'MM/YYYY' },
            { key: 'finalBalance', label: 'Final Balance', placeholder: '$0.00' },
          ]}
          rows={data.closedAccountEntries}
          onChange={(rows) => onChange('closedAccountEntries', rows)}
          createEmpty={() => ({ bankNameAddress: '', acctNo: '', typeOfAccount: '', otherNames: '', dateClosed: '', finalBalance: '' })}
          />
        </>
      )}
    </div>
  );
}
