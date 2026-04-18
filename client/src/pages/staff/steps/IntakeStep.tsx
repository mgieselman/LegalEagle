import { useCaseContext } from '@/context/CaseContext';
import { useQuestionnaireContext } from '@/context/QuestionnaireContext';
import { SectionAccordion } from '@/components/case-shell/SectionAccordion';
import { ALL_SECTIONS } from '@/lib/section-registry';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { ProgressBar } from '@/components/ProgressBar';
import { Loader2 } from 'lucide-react';

export function IntakeStep() {
  const { caseData, isLoading } = useCaseContext();
  const { data, handleChange, readOnly, findings } = useQuestionnaireContext();

  if (isLoading || !caseData) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Intake Questionnaire"
        subtitle="Review and complete all questionnaire sections"
      />

      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <span className="font-medium">
            {caseData.clientFirstName} {caseData.clientLastName}
          </span>
          <span className="text-muted-foreground">Chapter {caseData.chapter}</span>
          <StatusBadge status={caseData.status} />
          {caseData.filingDate && (
            <span className="text-muted-foreground">
              Filing: {new Date(caseData.filingDate).toLocaleDateString('en-US')}
            </span>
          )}
          {caseData.householdSize != null && (
            <span className="text-muted-foreground">
              Household: {caseData.householdSize}
            </span>
          )}
        </div>
        <ProgressBar data={data} />
      </Card>

      <SectionAccordion
        sections={ALL_SECTIONS}
        data={data}
        onChange={handleChange}
        readOnly={readOnly}
        findings={findings}
      />
    </div>
  );
}
