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

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-200 md:hidden ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={onClose}
      />
      {/* Drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 overflow-y-auto border-r bg-background shadow-lg transition-transform duration-200 md:hidden ${open ? 'translate-x-0' : 'pointer-events-none -translate-x-full'}`}
      >
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
