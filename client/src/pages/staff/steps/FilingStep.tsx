import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';

export function FilingStep() {
  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Filing"
        subtitle="Track filing status and court information"
      />
      <Card className="p-6">
        <p className="text-sm text-muted-foreground">
          Filing status tracking and court information will be available here.
        </p>
      </Card>
    </div>
  );
}
