import { useAuth } from '@/context/AuthContext';

export function AdminSettings() {
  const { user } = useAuth();

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold">Settings</h2>

      <div className="border rounded-lg p-4 space-y-4">
        <h3 className="font-medium">Current User</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <span className="text-muted-foreground">Name:</span>
          <span>{user?.name}</span>
          <span className="text-muted-foreground">Email:</span>
          <span>{user?.email}</span>
          <span className="text-muted-foreground">Role:</span>
          <span className="capitalize">{user?.role}</span>
        </div>
      </div>

      <div className="border rounded-lg p-4 space-y-4">
        <h3 className="font-medium">User Management</h3>
        <p className="text-sm text-muted-foreground">
          User invitation and management will be available in a future update.
        </p>
      </div>

      <div className="border rounded-lg p-4 space-y-4">
        <h3 className="font-medium">Firm Settings</h3>
        <p className="text-sm text-muted-foreground">
          Firm name, address, and billing settings will be available in a future update.
        </p>
      </div>
    </div>
  );
}
