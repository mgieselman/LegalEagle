import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { api, type ClientSummary } from '@/api/client';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
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
      <PageHeader
        title="Clients"
        actions={
          <Link to="/staff/clients/new">
            <Button size="sm" className="gap-1">
              <Plus className="h-4 w-4" /> New Client
            </Button>
          </Link>
        }
      />

      <DataTable
        columns={[
          {
            header: 'Name',
            accessor: (c) => (
              <Link
                to={`/staff/clients/${c.id}`}
                className="font-medium text-primary hover:underline"
              >
                {c.firstName} {c.lastName}
              </Link>
            ),
          },
          {
            header: 'Email',
            accessor: (c) => (
              <span className="text-muted-foreground">{c.email ?? '—'}</span>
            ),
          },
          {
            header: 'Phone',
            accessor: (c) => (
              <span className="text-muted-foreground">{c.phone ?? '—'}</span>
            ),
          },
          {
            header: 'Created',
            accessor: (c) => (
              <span className="text-muted-foreground">
                {new Date(c.createdAt).toLocaleDateString()}
              </span>
            ),
          },
        ]}
        data={clients}
        rowKey={(c) => c.id}
        emptyState={
          <EmptyState
            message="No clients yet."
            action={
              <Link to="/staff/clients/new" className="text-primary hover:underline">
                Create one
              </Link>
            }
          />
        }
      />
    </div>
  );
}
