import { BankDeposit, SecurityDeposit, PersonalPropertyItem, HouseholdItem, FinancedItem, SectionProps } from '@/types/questionnaire';
import { FormField } from '@/components/FormField';
import { DynamicTable } from '@/components/DynamicTable';

const DEFAULT_HOUSEHOLD_ITEMS: HouseholdItem[] = [
  { name: 'TV', howMany: '', yearPurchased: '', value: '' },
  { name: 'Couch', howMany: '', yearPurchased: '', value: '' },
  { name: 'Desk', howMany: '', yearPurchased: '', value: '' },
  { name: 'Bed', howMany: '', yearPurchased: '', value: '' },
  { name: 'Dining Table', howMany: '', yearPurchased: '', value: '' },
  { name: 'Dresser', howMany: '', yearPurchased: '', value: '' },
  { name: 'Washer', howMany: '', yearPurchased: '', value: '' },
  { name: 'Dryer', howMany: '', yearPurchased: '', value: '' },
  { name: 'Refrigerator', howMany: '', yearPurchased: '', value: '' },
  { name: 'Microwave', howMany: '', yearPurchased: '', value: '' },
];

export function Section26Assets({ data, onChange }: SectionProps) {
  const householdItems = data.householdItems && data.householdItems.length > 0
    ? data.householdItems
    : DEFAULT_HOUSEHOLD_ITEMS;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Section 26: Assets</h3>

      <FormField
        label="Cash on hand"
        value={data.cashOnHand}
        onChange={(v) => onChange('cashOnHand', v)}
        placeholder="$0.00"
      />

      <h4 className="text-md font-medium pt-2">Bank Deposits</h4>
      <DynamicTable<BankDeposit>
        columns={[
          { key: 'bankNameAddress', label: 'Bank Name & Address', placeholder: 'Bank name and address' },
          { key: 'amount', label: 'Amount', placeholder: '$0.00' },
        ]}
        rows={data.bankDeposits}
        onChange={(rows) => onChange('bankDeposits', rows)}
        createEmpty={() => ({ bankNameAddress: '', amount: '' })}
      />

      <h4 className="text-md font-medium pt-2">Security Deposits</h4>
      <DynamicTable<SecurityDeposit>
        columns={[
          { key: 'personOrCompany', label: 'Person or Company', placeholder: 'Name' },
          { key: 'address', label: 'Address', placeholder: 'Address' },
          { key: 'amount', label: 'Amount', placeholder: '$0.00' },
        ]}
        rows={data.securityDeposits}
        onChange={(rows) => onChange('securityDeposits', rows)}
        createEmpty={() => ({ personOrCompany: '', address: '', amount: '' })}
      />

      <h4 className="text-md font-medium pt-2">Personal Property Items</h4>
      <DynamicTable<PersonalPropertyItem>
        columns={[
          { key: 'item', label: 'Item', placeholder: 'Item description' },
          { key: 'approximateAge', label: 'Approximate Age', placeholder: 'e.g. 3 years' },
          { key: 'value', label: 'Value', placeholder: '$0.00' },
        ]}
        rows={data.personalPropertyItems}
        onChange={(rows) => onChange('personalPropertyItems', rows)}
        createEmpty={() => ({ item: '', approximateAge: '', value: '' })}
      />

      <h4 className="text-md font-medium pt-2">Household Items</h4>
      <DynamicTable<HouseholdItem>
        columns={[
          { key: 'name', label: 'Item', placeholder: 'Item name' },
          { key: 'howMany', label: 'How Many', placeholder: '1' },
          { key: 'yearPurchased', label: 'Year Purchased', placeholder: 'YYYY' },
          { key: 'value', label: 'Value', placeholder: '$0.00' },
        ]}
        rows={householdItems}
        onChange={(rows) => onChange('householdItems', rows)}
        createEmpty={() => ({ name: '', howMany: '', yearPurchased: '', value: '' })}
      />

      <h4 className="text-md font-medium pt-2">Financed Items</h4>
      <DynamicTable<FinancedItem>
        columns={[
          { key: 'item', label: 'Item', placeholder: 'Item description' },
          { key: 'companyNameAddress', label: 'Company Name & Address', placeholder: 'Company name and address' },
        ]}
        rows={data.financedItems}
        onChange={(rows) => onChange('financedItems', rows)}
        createEmpty={() => ({ item: '', companyNameAddress: '' })}
      />
    </div>
  );
}
