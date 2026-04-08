import { QuestionnaireData } from '@/types/questionnaire';
import { FormField, YesNoField, TextAreaField } from '@/components/FormField';

interface Props {
  data: QuestionnaireData;
  onChange: (path: string, value: any) => void;
}

export function Section19AlimonySupport({ data, onChange }: Props) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Section 19: Alimony &amp; Support</h3>

      <YesNoField
        label="Have you had any previous marriages?"
        value={data.previousMarriages}
        onChange={(v) => onChange('previousMarriages', v)}
      />
      {data.previousMarriages === 'yes' && (
        <FormField
          label="Former spouse's name"
          value={data.formerSpouseName}
          onChange={(v) => onChange('formerSpouseName', v)}
          placeholder="Full name of former spouse"
        />
      )}

      <YesNoField
        label="Is child support owed to you?"
        value={data.owedChildSupport}
        onChange={(v) => onChange('owedChildSupport', v)}
      />
      {data.owedChildSupport === 'yes' && (
        <div className="space-y-2 ml-4">
          <FormField
            label="Who owes child support?"
            value={data.owedChildSupportWho}
            onChange={(v) => onChange('owedChildSupportWho', v)}
            placeholder="Name of person who owes"
          />
          <FormField
            label="Amount owed"
            value={data.owedChildSupportAmount}
            onChange={(v) => onChange('owedChildSupportAmount', v)}
            placeholder="$0.00"
          />
        </div>
      )}

      <YesNoField
        label="Have you been ordered to pay child support?"
        value={data.orderedChildSupport}
        onChange={(v) => onChange('orderedChildSupport', v)}
      />

      <YesNoField
        label="Have you been ordered to pay alimony?"
        value={data.orderedAlimony}
        onChange={(v) => onChange('orderedAlimony', v)}
      />

      <YesNoField
        label="Is there a property settlement?"
        value={data.propertySettlement}
        onChange={(v) => onChange('propertySettlement', v)}
      />
      {data.propertySettlement === 'yes' && (
        <TextAreaField
          label="Property settlement details"
          value={data.propertySettlementDetails}
          onChange={(v) => onChange('propertySettlementDetails', v)}
        />
      )}

      <FormField
        label="Currently paying (amount)"
        value={data.currentlyPaying}
        onChange={(v) => onChange('currentlyPaying', v)}
        placeholder="$0.00"
      />

      <FormField
        label="Paying to"
        value={data.payingTo}
        onChange={(v) => onChange('payingTo', v)}
        placeholder="Name of recipient"
      />

      <FormField
        label="Are you behind in payments? If so, how much?"
        value={data.behindInPayments}
        onChange={(v) => onChange('behindInPayments', v)}
        placeholder="Amount behind or N/A"
      />

      <FormField
        label="Are you required to support anyone other than yourself?"
        value={data.requiredToSupport}
        onChange={(v) => onChange('requiredToSupport', v)}
        placeholder="Names and relationship"
      />

      <YesNoField
        label="Are there any family court hearings pending?"
        value={data.familyCourtHearings}
        onChange={(v) => onChange('familyCourtHearings', v)}
      />
      {data.familyCourtHearings === 'yes' && (
        <TextAreaField
          label="Family court hearing details"
          value={data.familyCourtDetails}
          onChange={(v) => onChange('familyCourtDetails', v)}
        />
      )}

      <YesNoField
        label="Do you expect to receive a property settlement?"
        value={data.expectPropertySettlement}
        onChange={(v) => onChange('expectPropertySettlement', v)}
      />
    </div>
  );
}
