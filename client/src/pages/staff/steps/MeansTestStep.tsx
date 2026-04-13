import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';

export function MeansTestStep() {
  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Means Test"
        subtitle="Chapter 7 eligibility analysis"
      />
      <Card className="p-6">
        <p className="text-sm text-muted-foreground">
          Means test calculation and analysis will be available here.
        </p>
      </Card>
    </div>
  );
}
