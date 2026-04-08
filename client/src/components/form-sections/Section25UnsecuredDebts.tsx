import { QuestionnaireData, UnsecuredDebt } from '@/types/questionnaire';
import { DynamicTable } from '@/components/DynamicTable';

interface Props {
  data: QuestionnaireData;
  onChange: (path: string, value: any) => void;
}

export function Section25UnsecuredDebts({ data, onChange }: Props) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Section 25: Unsecured Debts</h3>

      <p className="text-sm text-muted-foreground">
        List all unsecured debts (credit cards, medical bills, personal loans, etc.)
      </p>

      <DynamicTable<UnsecuredDebt>
        columns={[
          { key: 'creditorName', label: 'Creditor Name', placeholder: 'Creditor name' },
          { key: 'creditorAddress', label: 'Creditor Address', placeholder: 'Address' },
          { key: 'accountNo', label: 'Account No.', placeholder: 'Account #' },
          { key: 'amountOwed', label: 'Amount Owed', placeholder: '$0.00' },
          { key: 'dateOpened', label: 'Date Opened', placeholder: 'MM/YYYY' },
        ]}
        rows={data.unsecuredDebts}
        onChange={(rows) => onChange('unsecuredDebts', rows)}
        createEmpty={() => ({ creditorName: '', creditorAddress: '', accountNo: '', amountOwed: '', dateOpened: '' })}
      />
    </div>
  );
}
