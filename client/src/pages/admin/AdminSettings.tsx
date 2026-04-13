import { useAuth } from '@/context/AuthContext';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardHeader } from '@/components/ui/card';

export function AdminSettings() {
  const { user } = useAuth();

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Settings" />

      <Card>
        <CardHeader title="Current User" />
        <div className="grid grid-cols-2 gap-2 text-sm">
          <span className="text-muted-foreground">Name:</span>
          <span>{user?.name}</span>
          <span className="text-muted-foreground">Email:</span>
          <span>{user?.email}</span>
          <span className="text-muted-foreground">Role:</span>
          <span className="capitalize">{user?.role}</span>
        </div>
      </Card>

      <Card>
        <CardHeader title="User Management" />
        <p className="text-sm text-muted-foreground">
          User invitation and management will be available in a future update.
        </p>
      </Card>

      <Card>
        <CardHeader title="Firm Settings" />
        <p className="text-sm text-muted-foreground">
          Firm name, address, and billing settings will be available in a future update.
        </p>
      </Card>
    </div>
  );
}
