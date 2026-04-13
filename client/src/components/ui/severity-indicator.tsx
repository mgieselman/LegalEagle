import { AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

export type Severity = 'error' | 'warning' | 'info';

export const SEVERITY_STYLES: Record<
  Severity,
  { icon: typeof AlertCircle; bg: string; border: string; text: string }
> = {
  error: {
    icon: AlertCircle,
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-600',
  },
  warning: {
    icon: AlertTriangle,
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-600',
  },
  info: {
    icon: Info,
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-600',
  },
};

interface SeverityIndicatorProps {
  severity: Severity;
  className?: string;
}

/**
 * Colored severity icon (error/warning/info). Use inline with text.
 */
export function SeverityIcon({ severity, className }: SeverityIndicatorProps) {
  const config = SEVERITY_STYLES[severity];
  const Icon = config.icon;
  return <Icon className={cn('h-4 w-4', config.text, className)} />;
}

interface SeverityCardProps extends SeverityIndicatorProps {
  children: React.ReactNode;
}

/**
 * Colored card container for severity-coded content (review findings, validation warnings).
 * Background and border color match the severity level.
 */
export function SeverityCard({
  severity,
  className,
  children,
}: SeverityCardProps) {
  const config = SEVERITY_STYLES[severity];
  return (
    <div
      className={cn(
        'rounded-md border p-3',
        config.bg,
        config.border,
        className,
      )}
    >
      {children}
    </div>
  );
}

interface ConfidenceScoreProps {
  score: number;
  className?: string;
}

/**
 * Color-coded confidence score display.
 * Green >= 0.9, amber 0.7-0.89, red < 0.7.
 */
export function ConfidenceScore({ score, className }: ConfidenceScoreProps) {
  const color =
    score >= 0.9
      ? 'text-green-600'
      : score >= 0.7
        ? 'text-amber-600'
        : 'text-red-600';

  return (
    <span className={cn('text-xs font-medium', color, className)}>
      {(score * 100).toFixed(0)}%
    </span>
  );
}
