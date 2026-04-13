import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import { ChevronLeft, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCaseContext } from '@/context/CaseContext';
import { SectionNavProvider } from '@/context/SectionNavContext';
import { SegmentedProgressBar } from './SegmentedProgressBar';
import { StepSidebar } from './StepSidebar';
import { MobileSidebar } from './MobileSidebar';
import { ActionBar } from './ActionBar';
import type { StepConfig } from '@/lib/step-configs';
import type { QuestionnaireData } from '@/types/questionnaire';

interface CaseShellProps {
  steps: StepConfig[];
  backTo: string;
  backLabel: string;
  mode: 'staff' | 'client';
}

export function CaseShell({ steps, backTo, backLabel, mode }: CaseShellProps) {
  const { questionnaire, isLoading, error } = useCaseContext();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  // Derive active step from current URL
  const pathSegments = location.pathname.split('/');
  // URL pattern: /{role}/case/{id}/{stepKey}
  const activeStepKey = pathSegments[4] || steps[0].key;

  const questionnaireData = questionnaire?.data as QuestionnaireData | null ?? null;

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[200px]">
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="h-4 w-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
          Loading case data...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <p className="text-destructive">Error: {error}</p>
        <p className="text-sm text-muted-foreground mt-2">Please try refreshing the page.</p>
      </div>
    );
  }

  return (
    <SectionNavProvider>
      <div className="flex flex-col h-full min-h-0">
        {/* Top bar: back link + progress bar */}
        <div className="border-b bg-background">
          <div className="px-4 py-3 flex items-center gap-4">
            {/* Mobile hamburger */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden shrink-0"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-4 w-4" />
            </Button>

            {/* Back link */}
            <Link
              to={backTo}
              className="hidden md:inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground shrink-0"
            >
              <ChevronLeft className="h-4 w-4" />
              {backLabel}
            </Link>

            {/* Progress bar */}
            <div className="flex-1 max-w-2xl">
              <SegmentedProgressBar
                steps={steps}
                activeStepKey={activeStepKey}
                data={questionnaireData}
              />
            </div>

            {/* Action buttons (save, download, review) */}
            <ActionBar mode={mode} activeStepKey={activeStepKey} />
          </div>
        </div>

        {/* Main layout: sidebar + content */}
        <div className="flex flex-1 min-h-0">
          {/* Desktop sidebar */}
          <div className="hidden md:block w-64 border-r bg-muted/10 overflow-y-auto shrink-0">
            <StepSidebar
              steps={steps}
              activeStepKey={activeStepKey}
              data={questionnaireData}
            />
          </div>

          {/* Content area */}
          <div className="flex-1 overflow-y-auto">
            <Outlet />
          </div>
        </div>

        {/* Mobile sidebar drawer */}
        <MobileSidebar
          steps={steps}
          activeStepKey={activeStepKey}
          data={questionnaireData}
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
        />
      </div>
    </SectionNavProvider>
  );
}
