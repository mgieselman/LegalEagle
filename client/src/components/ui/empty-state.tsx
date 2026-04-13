import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  message: string;
  action?: ReactNode;
  className?: string;
}

/**
 * Centered empty-state message shown when a list or table has no data.
 * Optionally includes an action link/button below the message.
 */
export function EmptyState({ message, action, className }: EmptyStateProps) {
  return (
    <p className={cn('text-center text-muted-foreground py-8', className)}>
      {message}
      {action && <> {action}</>}
    </p>
  );
}
