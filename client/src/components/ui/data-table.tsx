import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface Column<T> {
  header: ReactNode;
  headerKey: string;
  accessor: (row: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyState?: ReactNode;
  className?: string;
}

/**
 * Standard data table with consistent header/row styling.
 * Wraps content in a bordered, rounded container with hover rows.
 *
 * Usage:
 *   <DataTable
 *     columns={[
 *       { header: 'Name', accessor: (r) => r.name },
 *       { header: 'Status', accessor: (r) => <StatusBadge status={r.status} /> },
 *     ]}
 *     data={items}
 *     rowKey={(r) => r.id}
 *   />
 */
export function DataTable<T>({
  columns,
  data,
  rowKey,
  onRowClick,
  emptyState,
  className,
}: DataTableProps<T>) {
  if (data.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  return (
    <div className={cn('border rounded-lg overflow-hidden', className)}>
      <table className="w-full">
        <thead className="bg-muted/50">
          <tr>
            {columns.map((col) => (
              <th
                key={col.headerKey}
                className={cn(
                  'text-left p-3 text-sm font-medium',
                  col.className,
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr
              key={rowKey(row)}
              className={cn(
                'border-t hover:bg-muted/30',
                onRowClick && 'cursor-pointer',
              )}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map((col) => (
                <td
                  key={col.headerKey}
                  className={cn('p-3 text-sm', col.className)}
                >
                  {col.accessor(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
