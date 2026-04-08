import type { ReviewFinding } from '@/api/client';
import { Button } from './ui/button';
import { X, AlertTriangle, AlertCircle, Info } from 'lucide-react';

interface ReviewPanelProps {
  findings: ReviewFinding[];
  loading: boolean;
  onClose: () => void;
}

const severityConfig = {
  error: { icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50 border-red-200', label: 'Error' },
  warning: { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', label: 'Warning' },
  info: { icon: Info, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200', label: 'Info' },
};

export function ReviewPanel({ findings, loading, onClose }: ReviewPanelProps) {
  return (
    <div className="fixed inset-y-0 right-0 w-[420px] bg-background border-l shadow-lg z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-lg font-semibold">AI Review Results</h2>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            <span className="ml-3 text-muted-foreground">Analyzing questionnaire...</span>
          </div>
        )}
        {!loading && findings.length === 0 && (
          <p className="text-muted-foreground text-center py-8">No findings to display.</p>
        )}
        {!loading &&
          findings.map((f, i) => {
            const config = severityConfig[f.severity];
            const Icon = config.icon;
            return (
              <div key={i} className={`rounded-md border p-3 ${config.bg}`}>
                <div className="flex items-start gap-2">
                  <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${config.color}`} />
                  <div>
                    <div className={`text-xs font-semibold uppercase ${config.color}`}>
                      {config.label} — {f.section}
                    </div>
                    <p className="text-sm mt-1">{f.message}</p>
                  </div>
                </div>
              </div>
            );
          })}
      </div>
      {!loading && findings.length > 0 && (
        <div className="p-4 border-t text-sm text-muted-foreground">
          {findings.filter((f) => f.severity === 'error').length} errors,{' '}
          {findings.filter((f) => f.severity === 'warning').length} warnings,{' '}
          {findings.filter((f) => f.severity === 'info').length} info
        </div>
      )}
    </div>
  );
}
