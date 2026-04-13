import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router';
import { api, type CaseSummary } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { Plus, ChevronUp, ChevronDown, Search } from 'lucide-react';

export function StaffDashboard() {
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  useEffect(() => {
    api
      .listCases(undefined, ['progress', 'attention'])
      .then(setCases)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const statuses = ['all', ...new Set(cases.map((c) => c.status))];

  // Filter and search cases
  const filteredCases = useMemo(() => {
    let result = cases;
    
    // Filter by status
    if (filter !== 'all') {
      result = result.filter(c => c.status === filter);
    }
    
    // Search by client name
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(c => 
        `${c.clientFirstName} ${c.clientLastName}`.toLowerCase().includes(query)
      );
    }
    
    return result;
  }, [cases, filter, searchQuery]);

  // Sort cases
  const sortedCases = useMemo(() => {
    if (!sortConfig) return filteredCases;
    
    return [...filteredCases].sort((a, b) => {
      let aVal: string | number, bVal: string | number;
      
      switch (sortConfig.key) {
        case 'client':
          aVal = `${a.clientFirstName} ${a.clientLastName}`.toLowerCase();
          bVal = `${b.clientFirstName} ${b.clientLastName}`.toLowerCase();
          break;
        case 'chapter':
          aVal = parseInt(a.chapter);
          bVal = parseInt(b.chapter);
          break;
        case 'status':
          aVal = a.status;
          bVal = b.status;
          break;
        case 'filingDate':
          aVal = a.filedAt ? new Date(a.filedAt).getTime() : 0;
          bVal = b.filedAt ? new Date(b.filedAt).getTime() : 0;
          break;
        case 'created':
          aVal = new Date(a.createdAt).getTime();
          bVal = new Date(b.createdAt).getTime();
          break;
        case 'progress':
          // Sort by sections progress (18/27 -> 18)
          aVal = a.progress ? parseInt(a.progress.sections.split('/')[0]) : 0;
          bVal = b.progress ? parseInt(b.progress.sections.split('/')[0]) : 0;
          break;
        case 'attention':
          aVal = a.attention?.count ?? 0;
          bVal = b.attention?.count ?? 0;
          break;
        default:
          aVal = 0;
          bVal = 0;
      }
      
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredCases, sortConfig]);

  const handleSort = (key: string) => {
    setSortConfig(current => ({
      key,
      direction: current?.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const SortableHeader = ({ children, sortKey }: { children: React.ReactNode; sortKey: string }) => {
    const isActive = sortConfig?.key === sortKey;
    return (
      <button
        onClick={() => handleSort(sortKey)}
        className="flex items-center gap-1 font-medium text-left hover:text-foreground w-full"
      >
        {children}
        {isActive ? (
          sortConfig?.direction === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
        ) : (
          <div className="h-3 w-3" /> // Placeholder for alignment
        )}
      </button>
    );
  };

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Loading cases...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Cases"
        actions={
          <>
            <span className="text-sm text-muted-foreground">{cases.length} total</span>
            <Link to="/staff/clients/new">
              <Button size="sm" className="gap-1">
                <Plus className="h-4 w-4" /> New Client
              </Button>
            </Link>
          </>
        }
      />

      <div className="space-y-4">
        {/* Search input */}
        <div className="max-w-md relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by client name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            aria-label="Search cases by client name"
          />
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
      </div>

      {/* Cases table */}
      <DataTable
        columns={[
          {
            header: <SortableHeader sortKey="client">Client</SortableHeader>,
            headerKey: 'client',
            accessor: (c) => (
              <Link
                to={`/staff/case/${c.id}`}
                className="font-medium text-primary hover:underline"
              >
                {c.clientFirstName} {c.clientLastName}
              </Link>
            ),
          },
          {
            header: <SortableHeader sortKey="chapter">Chapter</SortableHeader>,
            headerKey: 'chapter',
            accessor: (c) => `Ch. ${c.chapter}`,
          },
          {
            header: <SortableHeader sortKey="status">Status</SortableHeader>,
            headerKey: 'status',
            accessor: (c) => <StatusBadge status={c.status} />,
          },
          {
            header: <SortableHeader sortKey="progress">Progress</SortableHeader>,
            headerKey: 'progress',
            accessor: (c) => (
              <div className="text-xs space-y-1">
                <div className="text-muted-foreground">docs: {c.progress?.docs ?? '—'}</div>
                <div className="text-muted-foreground">sections: {c.progress?.sections ?? '—'}</div>
              </div>
            ),
          },
          {
            header: <SortableHeader sortKey="attention">Attention</SortableHeader>,
            headerKey: 'attention',
            accessor: (c) => {
              const count = c.attention?.count ?? 0;
              const hasErrors = c.attention?.hasErrors ?? false;
              return count > 0 ? (
                <span 
                  className={`px-2 py-1 rounded-full text-xs font-medium ${
                    hasErrors 
                      ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                  }`}
                >
                  {count}
                </span>
              ) : (
                <span className="text-muted-foreground text-xs">—</span>
              );
            },
          },
          {
            header: <SortableHeader sortKey="filingDate">Filing Date</SortableHeader>,
            headerKey: 'filingDate',
            accessor: (c) => (
              <span className="text-muted-foreground">
                {c.filedAt ? new Date(c.filedAt).toLocaleDateString() : '—'}
              </span>
            ),
          },
          {
            header: <SortableHeader sortKey="created">Created</SortableHeader>,
            headerKey: 'created',
            accessor: (c) => (
              <span className="text-muted-foreground">
                {new Date(c.createdAt).toLocaleDateString()}
              </span>
            ),
          },
        ]}
        data={sortedCases}
        rowKey={(c) => c.id}
        emptyState={
          <EmptyState 
            message={
              searchQuery ? 
                `No cases found for "${searchQuery}".` :
                filter !== 'all' ?
                  `No ${filter.replace(/_/g, ' ')} cases found.` :
                  'No cases found.'
            } 
          />
        }
      />
    </div>
  );
}
