import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router';
import { AlertTriangle, CheckCircle, FileSearch, Loader2, RefreshCw } from 'lucide-react';
import { useCaseContext } from '@/context/CaseContext';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SeverityIcon } from '@/components/ui/severity-indicator';
import { api, type ReviewSummary } from '@/api/client';

export function ReviewTab() {
  const { caseId } = useCaseContext();
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getReviewSummary(caseId);
      setSummary(data);
    } catch {
      setError('Failed to load review summary');
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 space-y-6">
        <PageHeader title="Review" subtitle="Review case findings and prepare for filing" />
        <Card className="p-6 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" className="mt-3 gap-1" onClick={fetchSummary}>
            <RefreshCw className="h-4 w-4" /> Retry
          </Button>
        </Card>
      </div>
    );
  }

  if (!summary) return null;

  const totalItems = summary.counts.extraction + summary.counts.validation;

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Review"
        subtitle="Review case findings and prepare for filing"
        actions={
          <Button variant="outline" size="sm" className="gap-1" onClick={fetchSummary}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        }
      />

      {totalItems === 0 ? (
        <Card className="p-8 text-center">
          <CheckCircle className="h-10 w-10 text-green-500 mx-auto mb-3" />
          <h3 className="text-lg font-semibold mb-1">Everything looks good</h3>
          <p className="text-sm text-muted-foreground">
            No documents need review and no validation warnings found.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Extraction Review Queue */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <FileSearch className="h-5 w-5 text-muted-foreground" />
                Extraction Review Queue
              </h3>
              <span className="text-sm text-muted-foreground">
                {summary.counts.extraction} document{summary.counts.extraction !== 1 ? 's' : ''}
              </span>
            </div>
            {summary.extractionQueue.length === 0 ? (
              <p className="text-sm text-muted-foreground">No documents pending review.</p>
            ) : (
              <div className="space-y-2">
                {summary.extractionQueue.map((doc) => (
                  <Link
                    key={doc.id}
                    to={`documents/${doc.id}`}
                    className="flex items-center justify-between p-3 rounded-md border hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <FileSearch className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-sm font-medium">{doc.originalFilename}</p>
                        <p className="text-xs text-muted-foreground">
                          {doc.docClass ?? 'Unclassified'}
                          {doc.classificationConfidence != null && ` (${Math.round(doc.classificationConfidence * 100)}%)`}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`text-xs px-2 py-1 rounded-full font-medium ${
                        doc.processingStatus === 'needs_review'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                          : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                      }`}
                    >
                      {doc.processingStatus === 'needs_review' ? 'Needs Review' : 'Extracted'}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          {/* Validation Warnings */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-muted-foreground" />
                Validation Warnings
              </h3>
              <span className="text-sm text-muted-foreground">
                {summary.counts.validation} warning{summary.counts.validation !== 1 ? 's' : ''}
              </span>
            </div>
            {summary.validationWarnings.length === 0 ? (
              <p className="text-sm text-muted-foreground">No validation warnings.</p>
            ) : (
              <div className="space-y-2">
                {summary.validationWarnings.map((warning) => (
                  <div
                    key={warning.id}
                    className="flex items-start gap-3 p-3 rounded-md border"
                  >
                    <SeverityIcon severity={warning.severity} className="h-4 w-4 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm">{warning.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {warning.validationType.replace(/_/g, ' ')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}