import { DebtRepaid, SectionProps } from '@/types/questionnaire';
import { FormField, YesNoField, TextAreaField, FindingsBanner } from '@/components/FormField';
import { DynamicTable } from '@/components/DynamicTable';

export function Section7DebtsRepaid({ data, onChange, findings }: SectionProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Section 7: Debts Repaid</h3>

      <div>
        <h4 className="text-sm font-medium mb-2">Payments Over $600 in the Last Year</h4>
        <FindingsBanner findings={findings} prefix="paymentsOver600" />
        <DynamicTable<DebtRepaid>
          columns={[
            { key: 'creditorName', label: 'Creditor Name' },
            { key: 'creditorAddress', label: 'Creditor Address' },
            { key: 'isRelative', label: 'Relative?', placeholder: 'Yes/No' },
            { key: 'paymentDates', label: 'Payment Dates' },
            { key: 'amount', label: 'Amount', placeholder: '$' },
          ]}
          rows={data.paymentsOver600}
          onChange={(rows) => onChange('paymentsOver600', rows)}
          createEmpty={() => ({ creditorName: '', creditorAddress: '', isRelative: '', paymentDates: '', amount: '' })}
        />
      </div>

      <YesNoField
        label="Were any of the above payments to insiders (relatives, business partners)?"
        value={data.insiderPayments}
        onChange={(v) => onChange('insiderPayments', v)}
        fieldKey="insiderPayments"
        findings={findings}
      />
      {data.insiderPayments === 'yes' && (
        <TextAreaField label="Insider Payment Details" value={data.insiderPaymentDetails} onChange={(v) => onChange('insiderPaymentDetails', v)} fieldKey="insiderPaymentDetails" findings={findings} />
      )}

      <YesNoField label="Do you have a student loan?" value={data.hasStudentLoan} onChange={(v) => onChange('hasStudentLoan', v)} fieldKey="hasStudentLoan" findings={findings} />
      {data.hasStudentLoan === 'yes' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Lender" value={data.studentLoan?.lender} onChange={(v) => onChange('studentLoan.lender', v)} fieldKey="studentLoan.lender" findings={findings} />
          <FormField label="School" value={data.studentLoan?.school} onChange={(v) => onChange('studentLoan.school', v)} fieldKey="studentLoan.school" findings={findings} />
          <FormField label="Did You Finish?" value={data.studentLoan?.didFinish} onChange={(v) => onChange('studentLoan.didFinish', v)} placeholder="Yes/No" fieldKey="studentLoan.didFinish" findings={findings} />
          <FormField label="If Not, Why?" value={data.studentLoan?.whyNot} onChange={(v) => onChange('studentLoan.whyNot', v)} fieldKey="studentLoan.whyNot" findings={findings} />
          <FormField label="Current Collector" value={data.studentLoan?.collector} onChange={(v) => onChange('studentLoan.collector', v)} fieldKey="studentLoan.collector" findings={findings} />
          <FormField label="Amount Paid So Far" value={data.studentLoan?.amountPaid} onChange={(v) => onChange('studentLoan.amountPaid', v)} placeholder="$" fieldKey="studentLoan.amountPaid" findings={findings} />
          <FormField label="Did Others Make Payments?" value={data.studentLoan?.othersPayments} onChange={(v) => onChange('studentLoan.othersPayments', v)} placeholder="Yes/No" fieldKey="studentLoan.othersPayments" findings={findings} />
          <FormField label="Others' Amount" value={data.studentLoan?.othersAmount} onChange={(v) => onChange('studentLoan.othersAmount', v)} placeholder="$" fieldKey="studentLoan.othersAmount" findings={findings} />
        </div>
      )}
    </div>
  );
}

