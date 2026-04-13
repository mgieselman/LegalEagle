import { useState } from 'react';
import { useCaseContext } from '@/context/CaseContext';
import { PageHeader } from '@/components/ui/page-header';
import { DocumentsPanel } from '@/components/DocumentsPanel';
import { api } from '@/api/client';

export function DocumentsTab() {
  const { caseId, refetch } = useCaseContext();
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleAutofillAction = async () => {
    const result = await api.autofillAndMerge(caseId);
    if (result.filledFields.length > 0) {
      setToastMessage(
        `Autofilled ${result.filledFields.length} field${result.filledFields.length === 1 ? '' : 's'} into the questionnaire`,
      );
    } else {
      setToastMessage('No new fields to autofill');
    }
    await refetch();
    setTimeout(() => setToastMessage(null), 4000);
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Documents"
        subtitle="Upload and manage case documents"
      />

      {toastMessage && (
        <div className="rounded-md border bg-muted/50 px-4 py-3 text-sm">
          {toastMessage}
        </div>
      )}

      <DocumentsPanel
        caseId={caseId}
        onAutofillAction={handleAutofillAction}
      />
    </div>
  );
}