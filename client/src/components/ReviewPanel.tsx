import type { ReviewFinding } from '@/api/client';
import { Button } from './ui/button';
import { SeverityIcon, SEVERITY_STYLES } from './ui/severity-indicator';
import { ArrowRight, PanelRightClose, PanelRightOpen } from 'lucide-react';

interface ReviewPanelProps {
  findings: ReviewFinding[];
  loading: boolean;
  collapsed: boolean;
  onToggle: () => void;
  onFindingClick: (finding: ReviewFinding) => void;
}

const SEVERITY_LABELS: Record<string, string> = {
  error: 'Error',
  warning: 'Warning',
  info: 'Info',
};

export function ReviewPanel({ findings, loading, collapsed, onToggle, onFindingClick }: ReviewPanelProps) {
  const errorCount = findings.filter((f) => f.severity === 'error').length;
  const warningCount = findings.filter((f) => f.severity === 'warning').length;
  const infoCount = findings.filter((f) => f.severity === 'info').length;

  // Collapsed tab on the right edge
  if (collapsed) {
    return (
      <button
        onClick={onToggle}
        className="fixed right-0 top-1/2 -translate-y-1/2 z-50 bg-background border border-r-0 rounded-l-lg shadow-lg px-3 py-5 md:px-2 md:py-4 flex flex-col items-center gap-2 hover:bg-muted/50 transition-colors cursor-pointer"
      >
        <PanelRightOpen className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-medium [writing-mode:vertical-lr] rotate-180">Review</span>
        {findings.length > 0 && (
          <span className="flex flex-col gap-1 mt-1">
            {errorCount > 0 && <SeverityIcon severity="error" className="h-2.5 w-2.5" />}
            {warningCount > 0 && <SeverityIcon severity="warning" className="h-2.5 w-2.5" />}
            {infoCount > 0 && <SeverityIcon severity="info" className="h-2.5 w-2.5" />}
          </span>
        )}
      </button>
    );
  }

  // Expanded panel
  return (
    <div className="fixed inset-0 md:inset-y-0 md:left-auto md:right-0 md:w-[420px] bg-background border-l shadow-lg z-50 flex flex-col transition-transform">
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-lg font-semibold">AI Review Results</h2>
        <Button variant="ghost" size="icon" onClick={onToggle} title="Collapse panel">
          <PanelRightClose className="h-4 w-4" />
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
            const styles = SEVERITY_STYLES[f.severity];
            return (
              <button
                key={i}
                className={`w-full text-left rounded-md border p-3 ${styles.bg} ${styles.border} hover:opacity-80 transition-opacity cursor-pointer`}
                onClick={() => onFindingClick(f)}
              >
                <div className="flex items-start gap-2">
                  <SeverityIcon severity={f.severity} className="h-5 w-5 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <div className={`text-xs font-semibold uppercase ${styles.text}`}>
                      {SEVERITY_LABELS[f.severity]} — {f.section}
                    </div>
                    <p className="text-sm mt-1">{f.message}</p>
                  </div>
                  <ArrowRight className={`h-4 w-4 mt-0.5 shrink-0 ${styles.text} opacity-50`} />
                </div>
              </button>
            );
          })}
      </div>
      {!loading && findings.length > 0 && (
        <div className="p-4 border-t">
          <div className="text-sm text-muted-foreground">
            {errorCount} errors, {warningCount} warnings, {infoCount} info
          </div>
          <p className="text-xs text-muted-foreground mt-1">Click a finding to jump to that section</p>
        </div>
      )}
    </div>
  );
}
