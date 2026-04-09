import { SecuredDebt, SectionProps } from '@/types/questionnaire';
import { YesNoField, TextAreaField } from '@/components/FormField';
import { DynamicTable } from '@/components/DynamicTable';

export function Section24SecuredDebts({ data, onChange }: SectionProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Section 24: Secured Debts</h3>

      <YesNoField
        label="Do you have any secured debts?"
        value={data.hasSecuredDebts}
        onChange={(v) => onChange('hasSecuredDebts', v)}
      />

      <YesNoField
        label="Have you agreed that a creditor can take property if you don't pay?"
        value={data.agreedCreditorCanTake}
        onChange={(v) => onChange('agreedCreditorCanTake', v)}
      />

      <DynamicTable<SecuredDebt>
        columns={[
          { key: 'lenderName', label: 'Lender Name', placeholder: 'Lender name' },
          { key: 'address', label: 'Address', placeholder: 'Lender address' },
          { key: 'accountNumber', label: 'Account Number', placeholder: 'Account #' },
          { key: 'currentBalance', label: 'Current Balance', placeholder: '$0.00' },
          { key: 'dateOpened', label: 'Date Opened', placeholder: 'MM/YYYY' },
        ]}
        rows={data.securedDebts}
        onChange={(rows) => onChange('securedDebts', rows)}
        createEmpty={() => ({ lenderName: '', address: '', accountNumber: '', currentBalance: '', dateOpened: '' })}
      />

      <YesNoField
        label="Is collateral for any secured debt located elsewhere?"
        value={data.securedCollateralElsewhere}
        onChange={(v) => onChange('securedCollateralElsewhere', v)}
      />
      {data.securedCollateralElsewhere === 'yes' && (
        <TextAreaField
          label="Location of collateral"
          value={data.securedCollateralLocation}
          onChange={(v) => onChange('securedCollateralLocation', v)}
        />
      )}

      <YesNoField
        label="Do you dispute any secured debts?"
        value={data.disputeSecuredDebts}
        onChange={(v) => onChange('disputeSecuredDebts', v)}
      />
      {data.disputeSecuredDebts === 'yes' && (
        <TextAreaField
          label="Disputed secured debt details"
          value={data.disputedSecuredDetails}
          onChange={(v) => onChange('disputedSecuredDetails', v)}
        />
      )}
    </div>
  );
}
