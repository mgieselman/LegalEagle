import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { api, type CaseSummary } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

const statusColors: Record<string, string> = {
  intake: 'bg-blue-100 text-blue-800',
  documents: 'bg-yellow-100 text-yellow-800',
  review: 'bg-purple-100 text-purple-800',
  ready_to_file: 'bg-green-100 text-green-800',
  filed: 'bg-emerald-100 text-emerald-800',
  discharged: 'bg-gray-100 text-gray-600',
  dismissed: 'bg-red-100 text-red-800',
  closed: 'bg-gray-100 text-gray-600',
};

export function StaffDashboard() {
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    api
      .listCases()
      .then(setCases)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered =
    filter === 'all' ? cases : cases.filter((c) => c.status === filter);

  const statuses = ['all', ...new Set(cases.map((c) => c.status))];

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Loading cases...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Cases</h2>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{cases.length} total</span>
          <Link to="/staff/clients/new">
            <Button size="sm" className="gap-1">
              <Plus className="h-4 w-4" /> New Client
            </Button>
          </Link>
        </div>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        {statuses.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              filter === s
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {s === 'all' ? 'All' : s.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {/* Cases table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 text-sm font-medium">Client</th>
              <th className="text-left p-3 text-sm font-medium">Chapter</th>
              <th className="text-left p-3 text-sm font-medium">Status</th>
              <th className="text-left p-3 text-sm font-medium">Filing Date</th>
              <th className="text-left p-3 text-sm font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className="border-t hover:bg-muted/30">
                <td className="p-3">
                  <Link
                    to={`/staff/case/${c.id}`}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    {c.clientFirstName} {c.clientLastName}
                  </Link>
                </td>
                <td className="p-3 text-sm">Ch. {c.chapter}</td>
                <td className="p-3">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      statusColors[c.status] || 'bg-gray-100'
                    }`}
                  >
                    {c.status.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="p-3 text-sm text-muted-foreground">
                  {c.filingDate || '—'}
                </td>
                <td className="p-3 text-sm text-muted-foreground">
                  {new Date(c.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-muted-foreground py-8">No cases found.</p>
      )}
    </div>
  );
}
