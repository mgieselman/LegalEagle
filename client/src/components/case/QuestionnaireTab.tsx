import { FormShell } from '@/components/FormShell';
import { useCaseContext } from '@/context/CaseContext';

interface QuestionnaireTabProps {
  mode: 'staff' | 'client';
}

export function QuestionnaireTab({ mode }: QuestionnaireTabProps) {
  const { caseId, questionnaire } = useCaseContext();

  return (
    <FormShell
      caseId={caseId}
      mode={mode}
      questionnaireData={questionnaire || undefined}
    />
  );
}