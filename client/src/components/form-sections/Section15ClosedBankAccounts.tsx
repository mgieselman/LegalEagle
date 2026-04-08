import { QuestionnaireData, ClosedBankAccount } from '@/types/questionnaire';
import { YesNoField } from '@/components/FormField';
import { DynamicTable } from '@/components/DynamicTable';

interface Props {
  data: QuestionnaireData;
  onChange: (path: string, value: any) => void;
}

export function Section15ClosedBankAccounts({ data, onChange }: Props) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Section 15: Closed Bank Accounts</h3>

      <YesNoField
        label="Have you closed any bank accounts in the last year?"
        value={data.closedAccounts}
        onChange={(v) => onChange('closedAccounts', v)}
      />
      {data.closedAccounts === 'yes' && (
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
      )}
    </div>
  );
}
