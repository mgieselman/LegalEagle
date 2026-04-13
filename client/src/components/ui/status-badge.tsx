import type { CaseStatus } from '@/api/client';
import { cn } from '@/lib/utils';

/**
 * Case status → color mapping. Single source of truth.
 */
const STATUS_STYLES: Record<CaseStatus, string> = {
  intake: 'bg-blue-100 text-blue-800',
  documents: 'bg-yellow-100 text-yellow-800',
  review: 'bg-purple-100 text-purple-800',
  ready_to_file: 'bg-green-100 text-green-800',
  filed: 'bg-emerald-100 text-emerald-800',
  discharged: 'bg-gray-100 text-gray-600',
  dismissed: 'bg-red-100 text-red-800',
  closed: 'bg-gray-100 text-gray-600',
};

interface StatusBadgeProps {
  status: CaseStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'px-2 py-0.5 rounded-full text-xs font-medium',
        STATUS_STYLES[status],
        className,
      )}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}
