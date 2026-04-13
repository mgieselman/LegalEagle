import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router';
import { api, type ClientSummary, type CaseSummary } from '@/api/client';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { DataTable } from '@/components/ui/data-table';
import { ChevronLeft, Plus } from 'lucide-react';

export function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [client, setClient] = useState<ClientSummary | null>(null);
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([api.getClient(id), api.listCases(id)])
      .then(([clientData, clientCases]) => {
        setClient(clientData);
        setCases(clientCases);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load client'))
      .finally(() => setLoading(false));
  }, [id]);

  if (!id) return <p className="p-6 text-destructive">Missing client ID</p>;

  if (loading) {
    return <div className="p-6"><p className="text-muted-foreground">Loading...</p></div>;
  }

  if (error || !client) {
    return <div className="p-6"><p className="text-destructive">{error ?? 'Client not found'}</p></div>;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Back nav */}
      <Link
        to="/staff/clients"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Clients
      </Link>

      {/* Client header */}
      <PageHeader
        title={`${client.firstName} ${client.lastName}`}
        subtitle={[client.email, client.phone, `Added ${new Date(client.createdAt).toLocaleDateString()}`]
          .filter(Boolean)
          .join(' \u00b7 ')}
        actions={
          <Button
            size="sm"
            className="gap-1"
            onClick={() =>
              api.createCase(id)
                .then(({ id: caseId }) => navigate(`/staff/case/${caseId}`))
                .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to create case'))
            }
          >
            <Plus className="h-4 w-4" /> New Case
          </Button>
        }
      />

      {/* Cases */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Cases</h3>
        {cases.length === 0 ? (
          <p className="text-muted-foreground text-sm">No cases yet.</p>
        ) : (
          <DataTable
            columns={[
              {
                header: 'Chapter',
                accessor: (c) => (
                  <Link
                    to={`/staff/case/${c.id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    Ch. {c.chapter}
                  </Link>
                ),
              },
              {
                header: 'Status',
                accessor: (c) => <StatusBadge status={c.status} />,
              },
              {
                header: 'Filing Date',
                accessor: (c) => (
                  <span className="text-muted-foreground">{c.filingDate ?? '—'}</span>
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
            data={cases}
            rowKey={(c) => c.id}
          />
        )}
      </div>
    </div>
  );
}
