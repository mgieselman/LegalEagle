import { QuestionnaireData, DebtRepaid } from '@/types/questionnaire';
import { FormField, YesNoField, TextAreaField } from '@/components/FormField';
import { DynamicTable } from '@/components/DynamicTable';

interface Props {
  data: QuestionnaireData;
  onChange: (path: string, value: any) => void;
}

export function Section7DebtsRepaid({ data, onChange }: Props) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Section 7: Debts Repaid</h3>

      <div>
        <h4 className="text-sm font-medium mb-2">Payments Over $600 in the Last Year</h4>
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
      />
      {data.insiderPayments === 'yes' && (
        <TextAreaField label="Insider Payment Details" value={data.insiderPaymentDetails} onChange={(v) => onChange('insiderPaymentDetails', v)} />
      )}

      <YesNoField label="Do you have a student loan?" value={data.hasStudentLoan} onChange={(v) => onChange('hasStudentLoan', v)} />
      {data.hasStudentLoan === 'yes' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Lender" value={data.studentLoan.lender} onChange={(v) => onChange('studentLoan.lender', v)} />
          <FormField label="School" value={data.studentLoan.school} onChange={(v) => onChange('studentLoan.school', v)} />
          <FormField label="Did You Finish?" value={data.studentLoan.didFinish} onChange={(v) => onChange('studentLoan.didFinish', v)} placeholder="Yes/No" />
          <FormField label="If Not, Why?" value={data.studentLoan.whyNot} onChange={(v) => onChange('studentLoan.whyNot', v)} />
          <FormField label="Current Collector" value={data.studentLoan.collector} onChange={(v) => onChange('studentLoan.collector', v)} />
          <FormField label="Amount Paid So Far" value={data.studentLoan.amountPaid} onChange={(v) => onChange('studentLoan.amountPaid', v)} placeholder="$" />
          <FormField label="Did Others Make Payments?" value={data.studentLoan.othersPayments} onChange={(v) => onChange('studentLoan.othersPayments', v)} placeholder="Yes/No" />
          <FormField label="Others' Amount" value={data.studentLoan.othersAmount} onChange={(v) => onChange('studentLoan.othersAmount', v)} placeholder="$" />
        </div>
      )}
    </div>
  );
}
