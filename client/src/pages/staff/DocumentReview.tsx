import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SeverityIcon, ConfidenceScore } from '@/components/ui/severity-indicator';
import { ProcessingStatusBadge } from '@/components/ProcessingStatusBadge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api, type DocumentSummary, type ExtractionResultSummary, type ValidationResultSummary } from '@/api/client';
import { z } from 'zod/v4';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Save,
  Loader2,
  AlertTriangle,
  FileText,
  Image as ImageIcon,
} from 'lucide-react';

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

export function DocumentReview() {
  const { id: caseId, docId } = useParams<{ id: string; docId: string }>();
  const navigate = useNavigate();

  const [document, setDocument] = useState<DocumentSummary | null>(null);
  const [extraction, setExtraction] = useState<ExtractionResultSummary | null>(null);
  const [validations, setValidations] = useState<ValidationResultSummary[]>([]);
  const [allDocs, setAllDocs] = useState<DocumentSummary[]>([]);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editedData, setEditedData] = useState<Record<string, unknown>>({});
  const [correctionNotes, setCorrectionNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Load document data
  const loadDocument = useCallback(async () => {
    if (!caseId || !docId) return;
    setLoading(true);
    setError(null);

    try {
      const [docs, ext, vals] = await Promise.all([
        api.listDocuments(caseId),
        api.getExtraction(docId).catch(() => null),
        api.getValidations(docId).catch(() => []),
      ]);

      const doc = docs.find((d) => d.id === docId);
      if (!doc) {
        setError('Document not found');
        setLoading(false);
        return;
      }

      setDocument(doc);
      setAllDocs(docs);
      setExtraction(ext);
      setValidations(vals);
      setEditedData(ext?.extractedData?.data ?? {});
      setCorrectionNotes('');

      // Load blob for preview
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const blobRes = await fetch(`/api/documents/${docId}/download`, { headers });
      if (blobRes.ok) {
        const blob = await blobRes.blob();
        setBlobUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(blob);
        });
      }
    } catch {
      setError('Failed to load document');
    } finally {
      setLoading(false);
    }
  }, [caseId, docId]);

  useEffect(() => {
    loadDocument();
    return () => {
      setBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, [loadDocument]);

  // Review queue navigation
  const reviewQueue = useMemo(
    () => allDocs.filter((d) => d.processingStatus === 'needs_review' || d.processingStatus === 'extracted'),
    [allDocs],
  );

  const currentIndex = useMemo(
    () => reviewQueue.findIndex((d) => d.id === docId),
    [reviewQueue, docId],
  );

  const prevDoc = currentIndex > 0 ? reviewQueue[currentIndex - 1] : null;
  const nextDoc = currentIndex < reviewQueue.length - 1 ? reviewQueue[currentIndex + 1] : null;

  function navigateToDoc(id: string) {
    navigate(`/staff/case/${caseId}/documents/${id}`, { replace: true });
  }

  // Accept extraction as-is
  async function handleAccept() {
    if (!docId) return;
    setSaving(true);
    try {
      await api.acceptExtraction(docId);
      if (nextDoc) {
        navigateToDoc(nextDoc.id);
      } else {
        navigate(`/staff/case/${caseId}/documents`);
      }
    } catch {
      setError('Failed to accept extraction');
    } finally {
      setSaving(false);
    }
  }

  // Accept with corrections
  async function handleCorrect() {
    if (!docId) return;
    setSaving(true);
    try {
      await api.correctExtraction(docId, editedData, correctionNotes);
      if (nextDoc) {
        navigateToDoc(nextDoc.id);
      } else {
        navigate(`/staff/case/${caseId}/documents`);
      }
    } catch {
      setError('Failed to save corrections');
    } finally {
      setSaving(false);
    }
  }

  // Dismiss validation warning
  async function handleDismissValidation(validationId: string) {
    if (!docId) return;
    await api.dismissValidation(docId, validationId);
    setValidations((prev) => prev.map((v) => (v.id === validationId ? { ...v, isDismissed: true } : v)));
  }

  // Validation schema for field updates
  const fieldValueSchema = z.union([z.string(), z.number()]);

  // Update a field value in edited data
  function updateField(key: string, value: string | number) {
    // Validate input value
    const validation = fieldValueSchema.safeParse(value);
    if (!validation.success) {
      console.warn('Invalid field value:', validation.error);
      return;
    }
    
    // Sanitize key to prevent prototype pollution
    if (key.includes('__proto__') || key.includes('constructor') || key.includes('prototype')) {
      console.warn('Invalid field key:', key);
      return;
    }
    
    setEditedData((prev) => ({ ...prev, [key]: validation.data }));
  }

  const fieldConfidences = extraction?.extractedData?.fieldConfidences ?? {};
  const warnings = extraction?.extractedData?.warnings ?? [];
  const activeValidations = validations.filter((v) => !v.isDismissed);
  const isPdf = document?.mimeType === 'application/pdf';
  const isImage = document?.mimeType?.startsWith('image/');

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-[calc(100vh-200px)]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error && !document) {
    return (
      <div className="p-6 space-y-4">
        <Link to={`/staff/case/${caseId}/documents`} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Back to Documents
        </Link>
        <Card className="p-6 text-center text-destructive">{error}</Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to={`/staff/case/${caseId}/documents`}
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <ArrowLeft className="h-4 w-4" /> Documents
          </Link>
          <span className="text-muted-foreground">/</span>
          <h2 className="text-lg font-semibold">{document?.originalFilename}</h2>
        </div>

        {/* Queue navigation */}
        {reviewQueue.length > 1 && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">
              {currentIndex + 1} of {reviewQueue.length} to review
            </span>
            <Button
              variant="outline"
              size="icon"
              disabled={!prevDoc}
              onClick={() => prevDoc && navigateToDoc(prevDoc.id)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              disabled={!nextDoc}
              onClick={() => nextDoc && navigateToDoc(nextDoc.id)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Classification + Status bar */}
      <div className="flex flex-wrap gap-2 items-center text-sm">
        <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-medium">
          {DOC_CLASS_LABELS[document?.docClass ?? ''] ?? document?.docClass ?? 'Unknown'}
        </span>
        {document && <ProcessingStatusBadge status={document.processingStatus} />}
        {extraction?.confidenceScore != null && (
          <span className="text-xs font-medium">
            <ConfidenceScore score={extraction.confidenceScore} /> confidence
          </span>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Split view — document left, extraction right */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-h-[60vh]">
        {/* Left: Document viewer */}
        <Card className="p-0 overflow-hidden flex flex-col">
          <div className="p-3 border-b bg-muted/30 text-sm font-medium flex items-center gap-2">
            {isPdf ? <FileText className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
            Original Document
          </div>
          <div className="flex-1 min-h-[400px]">
            {blobUrl && isPdf && (
              <iframe
                src={blobUrl}
                className="w-full h-full border-0"
                title={document?.originalFilename ?? 'Document'}
              />
            )}
            {blobUrl && isImage && (
              <div className="p-4 flex items-center justify-center h-full bg-muted/10">
                <img
                  src={blobUrl}
                  alt={document?.originalFilename ?? 'Document'}
                  className="max-w-full max-h-full object-contain"
                />
              </div>
            )}
            {!blobUrl && (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                Preview not available
              </div>
            )}
          </div>
        </Card>

        {/* Right: Extraction data */}
        <Card className="p-0 overflow-hidden flex flex-col">
          <div className="p-3 border-b bg-muted/30 text-sm font-medium">
            Extracted Data
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
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

            {/* Editable fields */}
            {Object.keys(editedData).length > 0 ? (
              <div className="space-y-3">
                {Object.entries(editedData).map(([key, value]) => {
                  // Skip complex arrays for now (transactions, etc.)
                  if (Array.isArray(value)) return null;
                  if (typeof value === 'object' && value !== null) return null;

                  const confidence = fieldConfidences[key];
                  const lowConfidence = confidence !== undefined && confidence < 0.8;

                  return (
                    <div key={key} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Label className="text-xs capitalize">{key.replace(/_/g, ' ')}</Label>
                        {confidence !== undefined && (
                          <span className="text-xs">
                            <ConfidenceScore score={confidence} />
                          </span>
                        )}
                      </div>
                      <Input
                        value={String(value ?? '')}
                        onChange={(e) => updateField(key, e.target.value)}
                        className={lowConfidence ? 'border-amber-400' : ''}
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No extracted data available</p>
            )}

            {/* Validation warnings */}
            {activeValidations.length > 0 && (
              <div className="space-y-2 pt-4 border-t">
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

            {/* Correction notes */}
            <div className="space-y-1 pt-4 border-t">
              <Label className="text-xs">Review Notes (optional)</Label>
              <Input
                value={correctionNotes}
                onChange={(e) => setCorrectionNotes(e.target.value)}
                placeholder="Notes about corrections made..."
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="p-3 border-t bg-muted/10 flex gap-2">
            <Button onClick={handleAccept} disabled={saving}>
              <CheckCircle className="h-4 w-4 mr-1" />
              {saving ? 'Saving...' : 'Accept'}
            </Button>
            <Button variant="outline" onClick={handleCorrect} disabled={saving}>
              <Save className="h-4 w-4 mr-1" />
              Accept with Corrections
            </Button>
            <Button
              variant="ghost"
              onClick={() => navigate(`/staff/case/${caseId}/documents`)}
              className="ml-auto"
            >
              Back
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
