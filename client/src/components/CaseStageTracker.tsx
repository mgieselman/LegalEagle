import { Check } from 'lucide-react';
import type { CaseData } from '@/context/CaseContext';

export type CaseStage =
  | 'intake'
  | 'documentation'
  | 'questionnaire'
  | 'credit_counseling'
  | 'review'
  | 'filed'
  | 'debtor_education'
  | 'hearing'
  | 'discharged';

interface StageDefinition {
  key: CaseStage;
  label: string;
}

const stages: StageDefinition[] = [
  { key: 'intake', label: 'Intake' },
  { key: 'documentation', label: 'Documentation' },
  { key: 'questionnaire', label: 'Questionnaire' },
  { key: 'credit_counseling', label: 'Credit Counseling' },
  { key: 'review', label: 'Review' },
  { key: 'filed', label: 'Filed' },
  { key: 'debtor_education', label: 'Debtor Education' },
  { key: 'hearing', label: 'Hearing' },
  { key: 'discharged', label: 'Discharged' },
];

/**
 * Map case status to the current pipeline stage index.
 * Returns the index of the last *completed* stage (0-based).
 */
export function getCurrentStageIndex(caseData: CaseData): number {
  switch (caseData.status) {
    case 'intake':
      return 0; // intake complete
    case 'documents':
      return 1; // documentation stage
    case 'review':
      return 4; // review stage
    case 'ready_to_file':
      return 4; // review complete
    case 'filed':
      return 5; // filed
    case 'discharged':
      return 8; // last stage
    case 'dismissed':
    case 'closed':
      return -1; // special states — no progression
    default:
      return 0;
  }
}

interface CaseStageTrackerProps {
  caseData: CaseData;
}

export function CaseStageTracker({ caseData }: CaseStageTrackerProps) {
  const currentIndex = getCurrentStageIndex(caseData);
  const isDismissedOrClosed = caseData.status === 'dismissed' || caseData.status === 'closed';

  return (
    <div className="w-full">
      {/* Desktop: horizontal stepper */}
      <div className="hidden md:flex items-center justify-between w-full">
        {stages.map((stage, i) => {
          const isComplete = !isDismissedOrClosed && i <= currentIndex;
          const isCurrent = !isDismissedOrClosed && i === currentIndex;

          return (
            <div key={stage.key} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <div
                  className={`
                    flex items-center justify-center w-8 h-8 rounded-full text-xs font-semibold border-2 transition-colors
                    ${isComplete
                      ? 'bg-primary border-primary text-primary-foreground'
                      : 'bg-background border-muted-foreground/30 text-muted-foreground'}
                    ${isCurrent ? 'ring-2 ring-primary/30 ring-offset-2' : ''}
                  `}
                >
                  {isComplete ? <Check className="h-4 w-4" /> : i + 1}
                </div>
                <span
                  className={`mt-1.5 text-xs text-center leading-tight max-w-[80px] ${
                    isCurrent ? 'font-semibold text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  {stage.label}
                </span>
              </div>
              {i < stages.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-1 mt-[-18px] ${
                    !isDismissedOrClosed && i < currentIndex ? 'bg-primary' : 'bg-muted-foreground/20'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile: vertical list */}
      <div className="md:hidden space-y-2">
        {stages.map((stage, i) => {
          const isComplete = !isDismissedOrClosed && i <= currentIndex;
          const isCurrent = !isDismissedOrClosed && i === currentIndex;

          return (
            <div key={stage.key} className="flex items-center gap-3">
              <div
                className={`
                  flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold border-2 shrink-0
                  ${isComplete
                    ? 'bg-primary border-primary text-primary-foreground'
                    : 'bg-background border-muted-foreground/30 text-muted-foreground'}
                  ${isCurrent ? 'ring-2 ring-primary/30 ring-offset-1' : ''}
                `}
              >
                {isComplete ? <Check className="h-3 w-3" /> : i + 1}
              </div>
              <span
                className={`text-sm ${
                  isCurrent ? 'font-semibold text-foreground' : 'text-muted-foreground'
                }`}
              >
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>

      {isDismissedOrClosed && (
        <p className="text-sm text-muted-foreground mt-2">
          Case {caseData.status === 'dismissed' ? 'dismissed' : 'closed'}
        </p>
      )}
    </div>
  );
}
