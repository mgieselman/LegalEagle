import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StepSidebar } from './StepSidebar';
import type { StepConfig } from '@/lib/step-configs';
import type { QuestionnaireData } from '@/types/questionnaire';

interface MobileSidebarProps {
  steps: StepConfig[];
  activeStepKey: string;
  data: QuestionnaireData | null;
  open: boolean;
  onClose: () => void;
}

export function MobileSidebar({ steps, activeStepKey, data, open, onClose }: MobileSidebarProps) {
  const location = useLocation();

  // Auto-close on route change
  useEffect(() => {
    if (open) {
      onClose();
    }
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 md:hidden"
        onClick={onClose}
      />
      {/* Drawer */}
      <div className="fixed inset-y-0 left-0 w-64 bg-background border-r shadow-lg z-50 md:hidden overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="text-sm font-semibold">Navigation</span>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <StepSidebar
          steps={steps}
          activeStepKey={activeStepKey}
          data={data}
          onNavigate={onClose}
        />
      </div>
    </>
  );
}
