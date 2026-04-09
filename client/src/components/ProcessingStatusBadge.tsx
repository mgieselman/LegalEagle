import { Loader2, CheckCircle, AlertTriangle, XCircle, Clock, Eye } from 'lucide-react';

const STATUS_CONFIG: Record<string, { icon: typeof Clock; label: string; className: string }> = {
  uploaded: { icon: Clock, label: 'Uploaded', className: 'text-muted-foreground' },
  classifying: { icon: Loader2, label: 'Classifying...', className: 'text-blue-500 animate-spin' },
  extracting: { icon: Loader2, label: 'Extracting...', className: 'text-blue-500 animate-spin' },
  extracted: { icon: CheckCircle, label: 'Extracted', className: 'text-green-600' },
  needs_review: { icon: AlertTriangle, label: 'Needs Review', className: 'text-amber-500' },
  reviewed: { icon: Eye, label: 'Reviewed', className: 'text-green-700' },
  failed: { icon: XCircle, label: 'Failed', className: 'text-red-500' },
};

interface ProcessingStatusBadgeProps {
  status: string;
}

export function ProcessingStatusBadge({ status }: ProcessingStatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.uploaded;
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${config.className}`}>
      <Icon className="h-3.5 w-3.5" />
      {config.label}
    </span>
  );
}
