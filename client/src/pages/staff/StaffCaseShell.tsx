import { useParams } from 'react-router';
import { CaseProvider, useCaseContext } from '@/context/CaseContext';
import { QuestionnaireProvider } from '@/context/QuestionnaireContext';
import { CaseShell } from '@/components/case-shell';
import { STAFF_STEPS } from '@/lib/step-configs';

export function StaffCaseShell() {
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return <p className="p-6 text-destructive">Missing case ID</p>;
  }

  return (
    <CaseProvider caseId={id} clientMode={false}>
      <StaffCaseShellInner />
    </CaseProvider>
  );
}

function StaffCaseShellInner() {
  const { caseId, caseData, questionnaire } = useCaseContext();

  const isReadOnly = caseData?.status === 'filed' ||
    caseData?.status === 'discharged' ||
    caseData?.status === 'dismissed' ||
    caseData?.status === 'closed';

  return (
    <QuestionnaireProvider
      caseId={caseId}
      mode="staff"
      questionnaireData={questionnaire ?? undefined}
      readOnly={isReadOnly}
    >
      <CaseShell
        steps={STAFF_STEPS}
        backTo="/staff/dashboard"
        backLabel="Back to Dashboard"
        mode="staff"
      />
    </QuestionnaireProvider>
  );
}
