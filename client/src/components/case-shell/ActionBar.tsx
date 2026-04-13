import { useQuestionnaireContext } from '@/context/QuestionnaireContext';
import { Button } from '@/components/ui/button';
import { AutoSaveIndicator } from '@/components/ui/auto-save-indicator';
import { Save, Download, Search } from 'lucide-react';

interface ActionBarProps {
  mode: 'staff' | 'client';
  activeStepKey: string;
}

/** Steps that involve questionnaire editing and should show save controls */
const QUESTIONNAIRE_STEPS = new Set([
  'personal', 'income-employment', 'debts', 'assets', 'intake',
]);

export function ActionBar({ mode, activeStepKey }: ActionBarProps) {
  const q = useQuestionnaireContext();
  const showControls = QUESTIONNAIRE_STEPS.has(activeStepKey);

  if (!showControls) return null;

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={q.handleSave}
        disabled={q.saving || q.readOnly}
        className="gap-1"
        title={q.readOnly ? 'Form is read-only (case has been filed)' : undefined}
      >
        <Save className="h-4 w-4" />
        <span className="hidden md:inline">
          {q.saving ? 'Saving...' : q.readOnly ? 'Read-only' : 'Save'}
        </span>
      </Button>

      {/* Auto-save status */}
      {q.currentFormId && (
        <div className="hidden md:flex">
          <AutoSaveIndicator status={q.autoSave.status} />
        </div>
      )}

      {mode === 'staff' && (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={q.handleDownload}
            disabled={!q.currentFormId}
            className="gap-1"
          >
            <Download className="h-4 w-4" />
            <span className="hidden md:inline">Download</span>
          </Button>
          <Button
            size="sm"
            onClick={q.handleReview}
            disabled={q.reviewing}
            className="gap-1"
          >
            <Search className="h-4 w-4" />
            <span className="hidden md:inline">
              {q.reviewing ? 'Reviewing...' : 'Review'}
            </span>
          </Button>
        </>
      )}
    </div>
  );
}
