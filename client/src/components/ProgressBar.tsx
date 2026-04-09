import type { QuestionnaireData } from '@/types/questionnaire';

/**
 * Calculate questionnaire completion percentage.
 * Counts non-empty string fields and non-empty arrays.
 */
export function calculateCompletion(data: QuestionnaireData): number {
  let filled = 0;
  let total = 0;

  function countValue(val: unknown): void {
    if (typeof val === 'string') {
      total++;
      if (val.trim() !== '') filled++;
    } else if (Array.isArray(val)) {
      total++;
      if (val.length > 0) filled++;
    } else if (typeof val === 'object' && val !== null) {
      for (const v of Object.values(val)) {
        countValue(v);
      }
    }
  }

  countValue(data);
  if (total === 0) return 0;
  return Math.round((filled / total) * 100);
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
