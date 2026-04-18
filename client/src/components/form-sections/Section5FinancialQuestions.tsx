import { WelfareEntry, SectionProps } from '@/types/questionnaire';
import { FormField, YesNoField, TextAreaField, FindingsBanner } from '@/components/FormField';
import { DynamicTable } from '@/components/DynamicTable';

export function Section5FinancialQuestions({ data, onChange, findings }: SectionProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Section 5: Financial Questions</h3>

      <YesNoField label="Are you on welfare?" value={data.onWelfare} onChange={(v) => onChange('onWelfare', v)} fieldKey="onWelfare" findings={findings} />

      <YesNoField label="Is anyone in your family on welfare?" value={data.familyOnWelfare} onChange={(v) => onChange('familyOnWelfare', v)} fieldKey="familyOnWelfare" findings={findings} />

      {(data.onWelfare === 'yes' || data.familyOnWelfare === 'yes') && (
        <div>
          <h4 className="text-sm font-medium mb-2">Welfare Details</h4>
          <FindingsBanner findings={findings} prefix="welfareDetails" />
          <DynamicTable<WelfareEntry>
            columns={[
              { key: 'person', label: 'Person' },
              { key: 'dates', label: 'Dates' },
              { key: 'amounts', label: 'Amounts', placeholder: '$' },
              { key: 'place', label: 'Place / Agency' },
            ]}
            rows={data.welfareDetails}
            onChange={(rows) => onChange('welfareDetails', rows)}
            createEmpty={() => ({ person: '', dates: '', amounts: '', place: '' })}
          />
        </div>
      )}

      <YesNoField
        label="Have you received any extra government money (stimulus, EITC advances, etc.)?"
        value={data.receivedExtraGovMoney}
        onChange={(v) => onChange('receivedExtraGovMoney', v)}
        fieldKey="receivedExtraGovMoney"
        findings={findings}
      />
      {data.receivedExtraGovMoney === 'yes' && (
        <TextAreaField label="Details" value={data.extraGovMoneyDetails} onChange={(v) => onChange('extraGovMoneyDetails', v)} fieldKey="extraGovMoneyDetails" findings={findings} />
      )}

      <YesNoField label="Do you have vacation time or sick pay due?" value={data.vacationTimeDue} onChange={(v) => onChange('vacationTimeDue', v)} fieldKey="vacationTimeDue" findings={findings} />
      {data.vacationTimeDue === 'yes' && (
        <FormField label="Estimated Amount" value={data.vacationTimeAmount} onChange={(v) => onChange('vacationTimeAmount', v)} placeholder="$" fieldKey="vacationTimeAmount" findings={findings} />
      )}

      <YesNoField label="Do you have an IRA, 401(k), or other retirement account?" value={data.hasIRA} onChange={(v) => onChange('hasIRA', v)} fieldKey="hasIRA" findings={findings} />
      {data.hasIRA === 'yes' && (
        <TextAreaField label="Details (type, institution, balance)" value={data.iraDetails} onChange={(v) => onChange('iraDetails', v)} fieldKey="iraDetails" findings={findings} />
      )}

      <YesNoField label="Do you have a tuition savings program (529, etc.)?" value={data.tuitionProgram} onChange={(v) => onChange('tuitionProgram', v)} fieldKey="tuitionProgram" findings={findings} />
      {data.tuitionProgram === 'yes' && (
        <TextAreaField label="Details" value={data.tuitionDetails} onChange={(v) => onChange('tuitionDetails', v)} fieldKey="tuitionDetails" findings={findings} />
      )}

      <YesNoField label="Are you a beneficiary of a trust?" value={data.isTrustBeneficiary} onChange={(v) => onChange('isTrustBeneficiary', v)} fieldKey="isTrustBeneficiary" findings={findings} />
      {data.isTrustBeneficiary === 'yes' && (
        <TextAreaField label="Trust Details" value={data.trustDetails} onChange={(v) => onChange('trustDetails', v)} fieldKey="trustDetails" findings={findings} />
      )}

      <YesNoField label="Do you expect to receive a gift or insurance payment?" value={data.expectGiftOrInsurance} onChange={(v) => onChange('expectGiftOrInsurance', v)} fieldKey="expectGiftOrInsurance" findings={findings} />
      {data.expectGiftOrInsurance === 'yes' && (
        <TextAreaField label="Details" value={data.giftInsuranceDetails} onChange={(v) => onChange('giftInsuranceDetails', v)} fieldKey="giftInsuranceDetails" findings={findings} />
      )}

      <YesNoField label="Do you expect an inheritance?" value={data.expectInheritance} onChange={(v) => onChange('expectInheritance', v)} fieldKey="expectInheritance" findings={findings} />
      {data.expectInheritance === 'yes' && (
        <TextAreaField label="Inheritance Details" value={data.inheritanceDetails} onChange={(v) => onChange('inheritanceDetails', v)} fieldKey="inheritanceDetails" findings={findings} />
      )}

      <YesNoField label="Have you inherited anything in the last 180 days?" value={data.inheritedAnything} onChange={(v) => onChange('inheritedAnything', v)} fieldKey="inheritedAnything" findings={findings} />
      {data.inheritedAnything === 'yes' && (
        <TextAreaField label="Details" value={data.inheritedDetails} onChange={(v) => onChange('inheritedDetails', v)} fieldKey="inheritedDetails" findings={findings} />
      )}
    </div>
  );
}
