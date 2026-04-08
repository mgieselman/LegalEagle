import { QuestionnaireData, BusinessInfo, EmployeeOwed } from '@/types/questionnaire';
import { YesNoField, TextAreaField } from '@/components/FormField';
import { DynamicTable } from '@/components/DynamicTable';

interface Props {
  data: QuestionnaireData;
  onChange: (path: string, value: any) => void;
}

export function Section4BusinessEmployment({ data, onChange }: Props) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Section 4: Business &amp; Employment</h3>

      <YesNoField
        label="Have you been in business in the last 6 years?"
        value={data.inBusiness}
        onChange={(v) => onChange('inBusiness', v)}
      />

      {data.inBusiness === 'yes' && (
        <div>
          <h4 className="text-sm font-medium mb-2">Business Information</h4>
          <DynamicTable<BusinessInfo>
            columns={[
              { key: 'name', label: 'Business Name' },
              { key: 'address', label: 'Address' },
              { key: 'dates', label: 'Dates' },
              { key: 'othersInBusiness', label: 'Others in Business' },
            ]}
            rows={data.businessInfo}
            onChange={(rows) => onChange('businessInfo', rows)}
            createEmpty={() => ({ name: '', address: '', dates: '', othersInBusiness: '' })}
          />
        </div>
      )}

      <YesNoField
        label="Does the business owe any debts?"
        value={data.businessDebts}
        onChange={(v) => onChange('businessDebts', v)}
      />

      {data.businessDebts === 'yes' && (
        <TextAreaField
          label="Business Debt Details"
          value={data.businessDebtsDetails}
          onChange={(v) => onChange('businessDebtsDetails', v)}
        />
      )}

      <YesNoField
        label="Do you owe any employees wages?"
        value={data.owesEmployeeWages}
        onChange={(v) => onChange('owesEmployeeWages', v)}
      />

      {data.owesEmployeeWages === 'yes' && (
        <div>
          <h4 className="text-sm font-medium mb-2">Employees Owed</h4>
          <DynamicTable<EmployeeOwed>
            columns={[
              { key: 'name', label: 'Name' },
              { key: 'address', label: 'Address' },
              { key: 'datesWorked', label: 'Dates Worked' },
              { key: 'amountOwed', label: 'Amount Owed', placeholder: '$' },
              { key: 'workDone', label: 'Work Done' },
            ]}
            rows={data.employeesOwed}
            onChange={(rows) => onChange('employeesOwed', rows)}
            createEmpty={() => ({ name: '', address: '', datesWorked: '', amountOwed: '', workDone: '' })}
          />
        </div>
      )}

      <YesNoField
        label="Have you received money to purchase goods/services not yet delivered?"
        value={data.receivedMoneyToPurchase}
        onChange={(v) => onChange('receivedMoneyToPurchase', v)}
      />

      {data.receivedMoneyToPurchase === 'yes' && (
        <TextAreaField
          label="Details"
          value={data.receivedMoneyDetails}
          onChange={(v) => onChange('receivedMoneyDetails', v)}
        />
      )}
    </div>
  );
}
