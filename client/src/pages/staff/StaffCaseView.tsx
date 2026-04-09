import { useParams, Link } from 'react-router';
import { FormShell } from '@/components/FormShell';
import { ChevronLeft } from 'lucide-react';

export function StaffCaseView() {
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return <p className="p-6 text-destructive">Missing case ID</p>;
  }

  return (
    <div>
      <div className="border-b px-6 py-3">
        <Link
          to="/staff/dashboard"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
      </div>
      <FormShell caseId={id} />
    </div>
  );
}
