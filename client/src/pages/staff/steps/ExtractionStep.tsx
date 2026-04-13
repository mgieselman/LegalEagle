import { useCaseContext } from '@/context/CaseContext';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

export function ExtractionStep() {
  const { isLoading } = useCaseContext();

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Extraction Review"
        subtitle="Review extracted data from uploaded documents"
      />
      <Card className="p-6">
        <p className="text-sm text-muted-foreground">
          Document extraction review will be available here. Navigate to the Documents step to
          process and review individual document extractions.
        </p>
      </Card>
    </div>
  );
}
