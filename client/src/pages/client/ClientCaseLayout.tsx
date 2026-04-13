import { useParams, Link, Outlet } from 'react-router';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { CaseProvider, useCaseContext } from '@/context/CaseContext';
import { TabBar } from '@/components/ui/tab-bar';

export function ClientCaseLayout() {
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return <p className="p-6 text-destructive">Missing case ID</p>;
  }

  return (
    <CaseProvider caseId={id} clientMode={true}>
      <div>
        {/* Back link */}
        <div className="border-b px-6 py-3">
          <Link
            to="/client/dashboard"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to My Cases
          </Link>
        </div>
        {/* Tab bar */}
        <TabBar tabs={[
          { label: 'Overview', to: '' },
          { label: 'Documents', to: 'documents' },
          { label: 'Questionnaire', to: 'questionnaire' },
        ]} />
        {/* Content area with loading state */}
        <CaseContent />
      </div>
    </CaseProvider>
  );
}

function CaseContent() {
  const { isLoading, error } = useCaseContext();

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading case data...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="text-center">
          <p className="text-destructive">Error: {error}</p>
          <p className="text-sm text-muted-foreground mt-2">Please try refreshing the page.</p>
        </div>
      </div>
    );
  }

  return <Outlet />;
}