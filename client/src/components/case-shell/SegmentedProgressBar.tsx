import { cn } from '@/lib/utils';
import { getStepStatus } from '@/lib/completion';
import type { StepConfig } from '@/lib/step-configs';
import type { QuestionnaireData } from '@/types/questionnaire';

interface SegmentedProgressBarProps {
  steps: StepConfig[];
  activeStepKey: string;
  data: QuestionnaireData | null;
}

export function SegmentedProgressBar({ steps, activeStepKey, data }: SegmentedProgressBarProps) {
  // Compute once before the loop instead of calling findIndex inside each iteration
  const firstIncompleteIndex = steps.findIndex((s) => getStepStatus(s, data) !== 'complete');

  return (
    <div className="flex items-end w-full gap-1">
      {steps.map((step, i) => {
        const status = getStepStatus(step, data);
        const isActive = step.key === activeStepKey;
        const isFirstIncomplete = i === firstIncompleteIndex;

        return (
          <div key={step.key} className="flex-1 flex flex-col items-center gap-1">
            {/* Label — desktop: always show, mobile: only current or first incomplete */}
            <span
              className={cn(
                'text-xs text-center leading-tight truncate max-w-full',
                isActive ? 'font-semibold text-foreground' : 'text-muted-foreground',
                // Mobile: hide labels except active/first-incomplete
                isActive || isFirstIncomplete ? '' : 'hidden md:block',
              )}
            >
              {step.label}
            </span>
            {/* Segment bar */}
            <div
              className={cn(
                'w-full rounded-full transition-colors',
                isActive ? 'h-2' : 'h-1.5',
                status === 'complete' && 'bg-primary',
                status === 'in-progress' && 'bg-primary/50',
                status === 'not-started' && 'bg-muted-foreground/20',
              )}
            />
          </div>
        );
      })}
    </div>
  );
}
