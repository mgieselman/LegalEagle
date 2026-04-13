import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { SeverityIcon, ConfidenceScore } from './ui/severity-indicator';
import { api, type ExtractionResultSummary, type ValidationResultSummary } from '@/api/client';
import { ProcessingStatusBadge } from './ProcessingStatusBadge';
import { CheckCircle, Edit3, X, AlertTriangle } from 'lucide-react';

interface DocumentReviewPanelProps {
  documentId: string;
  docClass: string | null;
  processingStatus: string;
  onClose: () => void;
  onUpdated: () => void;
}

const DOC_CLASS_LABELS: Record<string, string> = {
  paystub: 'Paystub',
  bank_statement_checking: 'Bank Statement (Checking)',
  bank_statement_savings: 'Bank Statement (Savings)',
  tax_return: 'Tax Return',
  w2: 'W-2',
  '1099': '1099',
  credit_card_statement: 'Credit Card Statement',
  ira_statement: 'IRA Statement',
  '401k_statement': '401(k) Statement',
  payroll_export: 'Payroll Export',
  other: 'Other',
  unclassified: 'Unclassified',
};

export function DocumentReviewPanel({ documentId, docClass, processingStatus, onClose, onUpdated }: DocumentReviewPanelProps) {
  const [extraction, setExtraction] = useState<ExtractionResultSummary | null>(null);
  const [validations, setValidations] = useState<ValidationResultSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [ext, vals] = await Promise.all([
          api.getExtraction(documentId).catch(() => null),
          api.getValidations(documentId).catch(() => []),
        ]);
        setExtraction(ext);
        setValidations(vals);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [documentId]);

  async function handleAccept() {
    setAccepting(true);
    try {
      await api.acceptExtraction(documentId);
      onUpdated();
    } finally {
      setAccepting(false);
    }
  }

  async function handleDismissValidation(id: string) {
    await api.dismissValidation(documentId, id);
    setValidations((prev) => prev.map((v) => v.id === id ? { ...v, isDismissed: true } : v));
  }

  if (loading) {
    return (
      <div className="border rounded-lg p-4 space-y-3">
        <div className="flex justify-between items-center">
          <h4 className="font-medium">Document Details</h4>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
        <p className="text-sm text-muted-foreground animate-pulse">Loading...</p>
      </div>
    );
  }

  const activeValidations = validations.filter((v) => !v.isDismissed);
  const extractedData = extraction?.extractedData?.data ?? {};
  const fieldConfidences = extraction?.extractedData?.fieldConfidences ?? {};
  const warnings = extraction?.extractedData?.warnings ?? [];

  return (
    <div className="border rounded-lg p-4 space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="font-medium">Document Details</h4>
        <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
      </div>

      {/* Classification + Status */}
      <div className="flex flex-wrap gap-2 items-center text-sm">
        <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-medium">
          {DOC_CLASS_LABELS[docClass ?? ''] ?? docClass ?? 'Unknown'}
        </span>
        <ProcessingStatusBadge status={processingStatus} />
        {extraction?.confidenceScore != null && (
          <span className="text-xs font-medium">
            <ConfidenceScore score={extraction.confidenceScore} /> confidence
          </span>
        )}
      </div>

      {/* Extraction warnings */}
      {warnings.length > 0 && (
        <div className="space-y-1">
          {warnings.map((w, i) => (
            <p key={i} className="text-xs text-amber-600 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 shrink-0" />
              {w}
            </p>
          ))}
        </div>
      )}

      {/* Extracted data fields */}
      {Object.keys(extractedData).length > 0 && (
        <div className="space-y-1">
          <h5 className="text-sm font-medium">Extracted Data</h5>
          <div className="grid grid-cols-1 gap-1 text-sm">
            {Object.entries(extractedData).map(([key, value]) => {
              if (key === 'transactions' || key === 'other_deductions') return null; // skip arrays
              const confidence = fieldConfidences[key];
              const lowConfidence = confidence !== undefined && confidence < 0.8;
              return (
                <div
                  key={key}
                  className={`flex justify-between py-1 px-2 rounded ${lowConfidence ? 'bg-amber-50' : ''}`}
                >
                  <span className="text-muted-foreground">{key.replace(/_/g, ' ')}</span>
                  <span className="font-mono">
                    {typeof value === 'number' ? `$${value.toLocaleString()}` : String(value ?? '—')}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Validation warnings */}
      {activeValidations.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-sm font-medium">Validation Warnings</h5>
          {activeValidations.map((v) => (
            <div key={v.id} className="flex items-start gap-2 text-xs bg-muted/30 rounded p-2">
              <SeverityIcon severity={v.severity} className="h-4 w-4 shrink-0" />
              <span className="flex-1">{v.message}</span>
              <button
                className="text-muted-foreground hover:text-foreground underline shrink-0"
                onClick={() => handleDismissValidation(v.id)}
              >
                dismiss
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      {processingStatus === 'needs_review' && extraction && (
        <div className="flex gap-2 pt-2 border-t">
          <Button size="sm" onClick={handleAccept} disabled={accepting}>
            <CheckCircle className="h-4 w-4 mr-1" />
            {accepting ? 'Accepting...' : 'Accept'}
          </Button>
          <Button size="sm" variant="outline" disabled>
            <Edit3 className="h-4 w-4 mr-1" />
            Edit (coming soon)
          </Button>
        </div>
      )}

      {processingStatus === 'extracted' && extraction && (
        <div className="flex gap-2 pt-2 border-t">
          <p className="text-xs text-green-600 flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            Auto-accepted (high confidence)
          </p>
        </div>
      )}
    </div>
  );
}
