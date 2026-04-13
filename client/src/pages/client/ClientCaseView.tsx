import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router';
import { FormShell } from '@/components/FormShell';
import { api } from '@/api/client';
import { ChevronLeft } from 'lucide-react';

export function ClientCaseView() {
  const { id } = useParams<{ id: string }>();
  const [caseData, setCaseData] = useState<{ status: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    
    // Fetch case data to determine read-only status
    api.getCase(id)
      .then((data) => setCaseData(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (!id) {
    return <p className="p-6 text-destructive">Missing case ID</p>;
  }

  if (loading) {
    return <p className="p-6 text-muted-foreground">Loading case...</p>;
  }

  const isReadOnly = caseData?.status === 'filed' || 
                     caseData?.status === 'discharged' || 
                     caseData?.status === 'dismissed' || 
                     caseData?.status === 'closed';

  return (
    <div>
      <div className="border-b px-6 py-3">
        <Link
          to="/client/dashboard"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to My Cases
        </Link>
        {isReadOnly && (
          <div className="mt-2 text-sm text-amber-600 bg-amber-50 px-3 py-1 rounded dark:bg-amber-900/20 dark:text-amber-400">
            ⚠️ Your case has been filed and can no longer be edited.
          </div>
        )}
      </div>
      <FormShell caseId={id} mode="client" readOnly={isReadOnly} />
    </div>
  );
}
