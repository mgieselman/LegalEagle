import { useParams } from 'react-router';
import { CaseProvider, useCaseContext } from '@/context/CaseContext';
import { QuestionnaireProvider } from '@/context/QuestionnaireContext';
import { CaseShell } from '@/components/case-shell';
import { CLIENT_STEPS } from '@/lib/step-configs';

export function ClientCaseShell() {
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return <p className="p-6 text-destructive">Missing case ID</p>;
  }

  return (
    <CaseProvider caseId={id} clientMode={true}>
      <ClientCaseShellInner />
    </CaseProvider>
  );
}

function ClientCaseShellInner() {
  const { caseId, caseData, questionnaire } = useCaseContext();

  const isReadOnly = caseData?.status === 'filed' ||
    caseData?.status === 'discharged' ||
    caseData?.status === 'dismissed' ||
    caseData?.status === 'closed';

  return (
    <QuestionnaireProvider
      caseId={caseId}
      mode="client"
      questionnaireData={questionnaire ?? undefined}
      readOnly={isReadOnly}
    >
      <CaseShell
        steps={CLIENT_STEPS}
        backTo="/client/dashboard"
        backLabel="Back to My Cases"
        mode="client"
      />
    </QuestionnaireProvider>
  );
}
