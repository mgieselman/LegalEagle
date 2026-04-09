import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { api, type ClientSummary } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export function ClientList() {
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .listClients()
      .then(setClients)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Loading clients...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Clients</h2>
        <Link to="/staff/clients/new">
          <Button size="sm" className="gap-1">
            <Plus className="h-4 w-4" /> New Client
          </Button>
        </Link>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 text-sm font-medium">Name</th>
              <th className="text-left p-3 text-sm font-medium">Email</th>
              <th className="text-left p-3 text-sm font-medium">Phone</th>
              <th className="text-left p-3 text-sm font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.id} className="border-t hover:bg-muted/30">
                <td className="p-3 text-sm font-medium">
                  {c.firstName} {c.lastName}
                </td>
                <td className="p-3 text-sm text-muted-foreground">{c.email || '—'}</td>
                <td className="p-3 text-sm text-muted-foreground">{c.phone || '—'}</td>
                <td className="p-3 text-sm text-muted-foreground">
                  {new Date(c.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {clients.length === 0 && (
        <p className="text-center text-muted-foreground py-8">
          No clients yet.{' '}
          <Link to="/staff/clients/new" className="text-primary hover:underline">
            Create one
          </Link>
        </p>
      )}
    </div>
  );
}
