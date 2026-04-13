import type { QuestionnaireData } from '@/types/questionnaire';
import { calculateOverallCompletion } from '@/lib/completion';

/**
 * Calculate questionnaire completion percentage.
 * Delegates to shared completion utility.
 */
export function calculateCompletion(data: QuestionnaireData): number {
  return calculateOverallCompletion(data);
}

interface ProgressBarProps {
  data: QuestionnaireData;
}

export function ProgressBar({ data }: ProgressBarProps) {
  const percent = calculateCompletion(data);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Questionnaire Progress</span>
        <span className="font-medium">{percent}%</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
