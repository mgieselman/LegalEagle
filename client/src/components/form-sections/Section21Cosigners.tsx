import { QuestionnaireData, CosignerEntry, CosignedDebt, BorrowedForOther, CollateralOnCosigned } from '@/types/questionnaire';
import { YesNoField } from '@/components/FormField';
import { DynamicTable } from '@/components/DynamicTable';

interface Props {
  data: QuestionnaireData;
  onChange: (path: string, value: any) => void;
}

export function Section21Cosigners({ data, onChange }: Props) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Section 21: Cosigners</h3>

      <YesNoField
        label="Has anyone cosigned for you?"
        value={data.hasCosigners}
        onChange={(v) => onChange('hasCosigners', v)}
      />
      {data.hasCosigners === 'yes' && (
        <DynamicTable<CosignerEntry>
          columns={[
            { key: 'creditorNameAddress', label: 'Creditor Name & Address', placeholder: 'Name and address' },
            { key: 'cosignerNameAddress', label: 'Cosigner Name & Address', placeholder: 'Name and address' },
            { key: 'debts', label: 'Debts', placeholder: 'Description of debts' },
          ]}
          rows={data.cosigners}
          onChange={(rows) => onChange('cosigners', rows)}
          createEmpty={() => ({ creditorNameAddress: '', cosignerNameAddress: '', debts: '' })}
        />
      )}

      <YesNoField
        label="Have you cosigned for others?"
        value={data.cosignedForOthers}
        onChange={(v) => onChange('cosignedForOthers', v)}
      />
      {data.cosignedForOthers === 'yes' && (
        <DynamicTable<CosignedDebt>
          columns={[
            { key: 'creditorNameAddress', label: 'Creditor Name & Address', placeholder: 'Name and address' },
            { key: 'dateOfDebt', label: 'Date of Debt', placeholder: 'MM/YYYY' },
            { key: 'amountOwing', label: 'Amount Owing', placeholder: '$0.00' },
            { key: 'personCosignedFor', label: 'Person Cosigned For', placeholder: 'Name' },
          ]}
          rows={data.cosignedDebts}
          onChange={(rows) => onChange('cosignedDebts', rows)}
          createEmpty={() => ({ creditorNameAddress: '', dateOfDebt: '', amountOwing: '', personCosignedFor: '' })}
        />
      )}

      <YesNoField
        label="Have you borrowed money for others?"
        value={data.borrowedForOthers}
        onChange={(v) => onChange('borrowedForOthers', v)}
      />
      {data.borrowedForOthers === 'yes' && (
        <DynamicTable<BorrowedForOther>
          columns={[
            { key: 'creditorNameAddress', label: 'Creditor Name & Address', placeholder: 'Name and address' },
            { key: 'collectionAgent', label: 'Collection Agent', placeholder: 'Agent name' },
            { key: 'dateOfDebt', label: 'Date of Debt', placeholder: 'MM/YYYY' },
            { key: 'whichSpouseOwes', label: 'Which Spouse Owes', placeholder: 'Husband/Wife/Both' },
            { key: 'forWhat', label: 'For What', placeholder: 'Purpose' },
            { key: 'currentAmount', label: 'Current Amount', placeholder: '$0.00' },
          ]}
          rows={data.borrowedForOtherEntries}
          onChange={(rows) => onChange('borrowedForOtherEntries', rows)}
          createEmpty={() => ({ creditorNameAddress: '', collectionAgent: '', dateOfDebt: '', whichSpouseOwes: '', forWhat: '', currentAmount: '' })}
        />
      )}

      <h4 className="text-md font-medium pt-2">Collateral on Cosigned Debts</h4>
      <DynamicTable<CollateralOnCosigned>
        columns={[
          { key: 'creditor', label: 'Creditor', placeholder: 'Creditor name' },
          { key: 'typeOfProperty', label: 'Type of Property', placeholder: 'Property type' },
          { key: 'currentValue', label: 'Current Value', placeholder: '$0.00' },
        ]}
        rows={data.collateralOnCosigned}
        onChange={(rows) => onChange('collateralOnCosigned', rows)}
        createEmpty={() => ({ creditor: '', typeOfProperty: '', currentValue: '' })}
      />
    </div>
  );
}
