import { SectionProps } from '@/types/questionnaire';
import { FormField, YesNoField, TextAreaField } from '@/components/FormField';

export function Section19AlimonySupport({ data, onChange, findings }: SectionProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Section 19: Alimony &amp; Support</h3>

      <YesNoField label="Have you had any previous marriages?" value={data.previousMarriages} onChange={(v) => onChange('previousMarriages', v)} fieldKey="previousMarriages" findings={findings} />
      {data.previousMarriages === 'yes' && (
        <FormField label="Former spouse's name" value={data.formerSpouseName} onChange={(v) => onChange('formerSpouseName', v)} placeholder="Full name of former spouse" fieldKey="formerSpouseName" findings={findings} />
      )}

      <YesNoField label="Is child support owed to you?" value={data.owedChildSupport} onChange={(v) => onChange('owedChildSupport', v)} fieldKey="owedChildSupport" findings={findings} />
      {data.owedChildSupport === 'yes' && (
        <div className="space-y-2 ml-4">
          <FormField label="Who owes child support?" value={data.owedChildSupportWho} onChange={(v) => onChange('owedChildSupportWho', v)} placeholder="Name of person who owes" fieldKey="owedChildSupportWho" findings={findings} />
          <FormField label="Amount owed" value={data.owedChildSupportAmount} onChange={(v) => onChange('owedChildSupportAmount', v)} placeholder="$0.00" fieldKey="owedChildSupportAmount" findings={findings} />
        </div>
      )}

      <YesNoField label="Have you been ordered to pay child support?" value={data.orderedChildSupport} onChange={(v) => onChange('orderedChildSupport', v)} fieldKey="orderedChildSupport" findings={findings} />

      <YesNoField label="Have you been ordered to pay alimony?" value={data.orderedAlimony} onChange={(v) => onChange('orderedAlimony', v)} fieldKey="orderedAlimony" findings={findings} />

      <YesNoField label="Is there a property settlement?" value={data.propertySettlement} onChange={(v) => onChange('propertySettlement', v)} fieldKey="propertySettlement" findings={findings} />
      {data.propertySettlement === 'yes' && (
        <TextAreaField label="Property settlement details" value={data.propertySettlementDetails} onChange={(v) => onChange('propertySettlementDetails', v)} fieldKey="propertySettlementDetails" findings={findings} />
      )}

      <FormField label="Currently paying (amount)" value={data.currentlyPaying} onChange={(v) => onChange('currentlyPaying', v)} placeholder="$0.00" fieldKey="currentlyPaying" findings={findings} />

      <FormField label="Paying to" value={data.payingTo} onChange={(v) => onChange('payingTo', v)} placeholder="Name of recipient" fieldKey="payingTo" findings={findings} />

      <FormField label="Are you behind in payments? If so, how much?" value={data.behindInPayments} onChange={(v) => onChange('behindInPayments', v)} placeholder="Amount behind or N/A" fieldKey="behindInPayments" findings={findings} />

      <FormField label="Are you required to support anyone other than yourself?" value={data.requiredToSupport} onChange={(v) => onChange('requiredToSupport', v)} placeholder="Names and relationship" fieldKey="requiredToSupport" findings={findings} />

      <YesNoField label="Are there any family court hearings pending?" value={data.familyCourtHearings} onChange={(v) => onChange('familyCourtHearings', v)} fieldKey="familyCourtHearings" findings={findings} />
      {data.familyCourtHearings === 'yes' && (
        <TextAreaField label="Family court hearing details" value={data.familyCourtDetails} onChange={(v) => onChange('familyCourtDetails', v)} fieldKey="familyCourtDetails" findings={findings} />
      )}

      <YesNoField label="Do you expect to receive a property settlement?" value={data.expectPropertySettlement} onChange={(v) => onChange('expectPropertySettlement', v)} fieldKey="expectPropertySettlement" findings={findings} />
    </div>
  );
}
