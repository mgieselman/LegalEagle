import { User, Briefcase, CreditCard, Home, Check, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuestionnaireContext } from '@/context/QuestionnaireContext';
import { calculateStepCompletion, calculateOverallCompletion } from '@/lib/completion';
import { QUESTIONNAIRE_GROUPS } from '@/lib/step-configs';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import type { LucideIcon } from 'lucide-react';

const GROUP_ICONS: Record<string, LucideIcon> = {
  'Personal Info': User,
  'Income & Employment': Briefcase,
  'Debts & Liabilities': CreditCard,
  'Assets & Property': Home,
};

export function ClientReviewStep() {
  const { data } = useQuestionnaireContext();

  const overallCompletion = calculateOverallCompletion(data);
  const isComplete = overallCompletion === 100;

  const groupResults = QUESTIONNAIRE_GROUPS.map((group) => ({
    label: group.label,
    icon: GROUP_ICONS[group.label] ?? User,
    completion: calculateStepCompletion(data, group.sectionKeys),
  }));

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Review Your Application"
        subtitle="Review your progress before submitting. All sections should be complete."
      />

      <Card className={cn('flex items-center gap-4', isComplete ? 'bg-green-50' : 'bg-amber-50')}>
        {isComplete ? (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100">
            <Check className="h-5 w-5 text-green-600" />
          </div>
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100">
            <AlertCircle className="h-5 w-5 text-amber-600" />
          </div>
        )}
        <div>
          <p className="text-sm font-medium">
            Overall Completion: {overallCompletion}%
          </p>
          <p className="text-sm text-muted-foreground">
            {isComplete
              ? 'All sections are complete. You may submit your application.'
              : 'Some sections still need information. Please review and complete them.'}
          </p>
        </div>
      </Card>

      <div className="space-y-2">
        {groupResults.map((group) => {
          const Icon = group.icon;
          const pct = group.completion;
          const isGroupComplete = pct === 100;

          return (
            <div
              key={group.label}
              className="flex items-center gap-3 rounded-lg border px-4 py-3"
            >
              <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="text-sm font-medium flex-1">{group.label}</span>

              <div className="flex items-center gap-2">
                <div className="h-2 w-24 rounded-full bg-muted">
                  <div
                    className={cn(
                      'h-2 rounded-full transition-all',
                      isGroupComplete ? 'bg-green-500' : 'bg-amber-500',
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span
                  className={cn(
                    'text-xs font-medium tabular-nums w-8 text-right',
                    isGroupComplete ? 'text-green-600' : 'text-amber-600',
                  )}
                >
                  {pct}%
                </span>
                {isGroupComplete ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
