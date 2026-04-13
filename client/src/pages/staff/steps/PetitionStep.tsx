import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';

export function PetitionStep() {
  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Petition Generation"
        subtitle="Generate and review bankruptcy petition forms"
      />
      <Card className="p-6">
        <p className="text-sm text-muted-foreground">
          Generated petition forms and attorney sign-off will be available here.
        </p>
      </Card>
    </div>
  );
}
