import { ConsultantEntry, SectionProps } from '@/types/questionnaire';
import { FormField, YesNoField, TextAreaField, FindingsBanner } from '@/components/FormField';
import { DynamicTable } from '@/components/DynamicTable';

export function Section14Attorneys({ data, onChange, findings }: SectionProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Section 14: Attorneys &amp; Consultants</h3>

      <h4 className="text-sm font-medium">Attorneys Consulted</h4>
      <FindingsBanner findings={findings} prefix="attorneys" />
      <DynamicTable<ConsultantEntry>
        columns={[
          { key: 'name', label: 'Name', placeholder: 'Attorney name' },
          { key: 'address', label: 'Address', placeholder: 'Address' },
          { key: 'date', label: 'Date', placeholder: 'MM/YYYY' },
        ]}
        rows={data.attorneys}
        onChange={(rows) => onChange('attorneys', rows)}
        createEmpty={() => ({ name: '', address: '', date: '' })}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          label="Reason for Consulting Attorney"
          value={data.attorneyReason}
          onChange={(v) => onChange('attorneyReason', v)}
          fieldKey="attorneyReason"
          findings={findings}
        />
        <FormField
          label="Amount Paid"
          value={data.attorneyAmountPaid}
          onChange={(v) => onChange('attorneyAmountPaid', v)}
          placeholder="$0.00"
          fieldKey="attorneyAmountPaid"
          findings={findings}
        />
      </div>

      <YesNoField
        label="Have you promised any further payment?"
        value={data.promisedPayment}
        onChange={(v) => onChange('promisedPayment', v)}
        fieldKey="promisedPayment"
        findings={findings}
      />
      {data.promisedPayment === 'yes' && (
        <TextAreaField
          label="Promised Payment Details"
          value={data.promisedPaymentDetails}
          onChange={(v) => onChange('promisedPaymentDetails', v)}
          fieldKey="promisedPaymentDetails"
          findings={findings}
        />
      )}

      <h4 className="text-sm font-medium mt-4">Credit Counseling</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          label="Credit Counseling Agency"
          value={data.creditCounselingAgency}
          onChange={(v) => onChange('creditCounselingAgency', v)}
          placeholder="Agency name"
          fieldKey="creditCounselingAgency"
          findings={findings}
        />
        <FormField
          label="Date of Counseling"
          value={data.creditCounselingDate}
          onChange={(v) => onChange('creditCounselingDate', v)}
          placeholder="MM/DD/YYYY"
          fieldKey="creditCounselingDate"
          findings={findings}
        />
      </div>

      <YesNoField
        label="Did the agency set up a repayment plan?"
        value={data.agencyRepaymentPlan}
        onChange={(v) => onChange('agencyRepaymentPlan', v)}
        fieldKey="agencyRepaymentPlan"
        findings={findings}
      />
      {data.agencyRepaymentPlan === 'yes' && (
        <TextAreaField
          label="Repayment Plan Details"
          value={data.agencyPlanDetails}
          onChange={(v) => onChange('agencyPlanDetails', v)}
          fieldKey="agencyPlanDetails"
          findings={findings}
        />
      )}
      <FormField
        label="Amount Paid to Agency"
        value={data.agencyAmountPaid}
        onChange={(v) => onChange('agencyAmountPaid', v)}
        placeholder="$0.00"
        fieldKey="agencyAmountPaid"
        findings={findings}
      />

      <h4 className="text-sm font-medium mt-4">Other Consultants</h4>
      <YesNoField
        label="Have you consulted anyone else about your financial problems?"
        value={data.consultedOthers}
        onChange={(v) => onChange('consultedOthers', v)}
        fieldKey="consultedOthers"
        findings={findings}
      />
      {data.consultedOthers === 'yes' && (
        <TextAreaField
          label="Other Consultant Details"
          value={data.otherConsultantDetails}
          onChange={(v) => onChange('otherConsultantDetails', v)}
          fieldKey="otherConsultantDetails"
          findings={findings}
        />
      )}

      <YesNoField
        label="Do any of your debts result from refinancing?"
        value={data.debtsFromRefinancing}
        onChange={(v) => onChange('debtsFromRefinancing', v)}
        fieldKey="debtsFromRefinancing"
        findings={findings}
      />
      {data.debtsFromRefinancing === 'yes' && (
        <TextAreaField
          label="Refinancing Details"
          value={data.refinancingDetails}
          onChange={(v) => onChange('refinancingDetails', v)}
          fieldKey="refinancingDetails"
          findings={findings}
        />
      )}
    </div>
  );
}

