import { useState, useEffect, useCallback } from 'react';
import { Button } from './ui/button';
import { api, type DocumentSummary, type AutofillPatch, type QualityIssue } from '@/api/client';
import { Upload, Download, Trash2, FileText, AlertCircle, Wand2, Play, Loader2 } from 'lucide-react';
import { ProcessingStatusBadge } from './ProcessingStatusBadge';
import { docClassLabel } from '@/lib/docClass';
import { DocumentReviewPanel } from './DocumentReviewPanel';

const ALLOWED_EXTENSIONS = ['.pdf', '.csv', '.xlsx', '.txt', '.jpg', '.jpeg', '.png', '.heic', '.webp'];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US');
}

function formatEta(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
}

interface ProcessingProgress {
  total: number;
  completed: number;
  currentFilename: string;
  startTime: number;
}

function ProcessingModal({ progress }: { progress: ProcessingProgress }) {
  const { total, completed, currentFilename, startTime } = progress;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  
  // Track elapsed time via state + interval to avoid impure Date.now() calls during render
  const [elapsed, setElapsed] = useState(() => Date.now() - startTime);
  useEffect(() => {
    const updateElapsed = () => setElapsed(Date.now() - startTime);
    updateElapsed(); // Initial update
    const id = setInterval(updateElapsed, 1000);
    return () => clearInterval(id);
  }, [startTime, completed]);

  let etaText = '';
  if (completed > 0 && elapsed > 0) {
    const avgMs = elapsed / completed;
    const remainingMs = (total - completed) * avgMs;
    etaText = formatEta(remainingMs);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full mx-4 space-y-5">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 text-primary animate-spin shrink-0" />
          <h2 className="text-lg font-semibold">Processing Documents</h2>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{completed} of {total} documents</span>
            <span>{pct}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {currentFilename && (
          <p className="text-sm text-muted-foreground truncate">
            <span className="font-medium text-foreground">Current: </span>
            {currentFilename}
          </p>
        )}

        {etaText && completed < total && (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Estimated time remaining: </span>
            {etaText}
          </p>
        )}

        {completed === total && (
          <p className="text-sm text-green-600 font-medium">All documents processed. Finishing up…</p>
        )}

        <p className="text-xs text-muted-foreground">
          Please keep this tab open. Do not navigate away while processing.
        </p>
      </div>
    </div>
  );
}

interface DocumentsPanelProps {
  caseId: string;
  onAutofill?: (patch: AutofillPatch) => void;
  /** When provided, replaces internal autofill logic entirely. Caller handles API + merge. */
  onAutofillAction?: () => Promise<void>;
}

export function DocumentsPanel({ caseId, onAutofill, onAutofillAction }: DocumentsPanelProps) {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [uploading, setUploading] = useState(false);
  const [autofilling, setAutofilling] = useState(false);
  const [processingProgress, setProcessingProgress] = useState<ProcessingProgress | null>(null);
  const [processingDocId, setProcessingDocId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  const loadDocuments = useCallback(async () => {
    try {
      const docs = await api.listDocuments(caseId);
      setDocuments(docs);
    } catch {
      setError('Failed to load documents');
    }
  }, [caseId]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  // Block navigation while processing
  useEffect(() => {
    if (!processingProgress) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [processingProgress]);

  // Tick every second while processing so the ETA countdown updates live
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!processingProgress) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [processingProgress]);

  function validateFile(file: File): { isValid: boolean; issue?: QualityIssue } {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    
    // Check file extension
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return {
        isValid: false,
        issue: {
          type: 'unsupported_format',
          message: `File type ${ext} not supported. Use: ${ALLOWED_EXTENSIONS.join(', ')}`,
          severity: 'error',
          canRetry: false,
        }
      };
    }
    
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return {
        isValid: false,
        issue: {
          type: 'oversized',
          message: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum 50 MB allowed.`,
          severity: 'error',
          canRetry: false,
        }
      };
    }
    
    // Check for potential duplicate filename (warning, not blocking)
    const isDuplicate = documents.some(d => d.originalFilename === file.name);
    if (isDuplicate) {
      return {
        isValid: true, // Allow upload but warn
        issue: {
          type: 'duplicate',
          message: `A file named "${file.name}" already exists. Upload anyway?`,
          severity: 'warning',
          canRetry: false,
        }
      };
    }
    
    return { isValid: true };
  }

  async function uploadFiles(files: File[]) {
    setError(null);
    setUploading(true);
    const errors: string[] = [];
    
    try {
      for (const file of files) {
        const validation = validateFile(file);
        if (!validation.isValid) {
          errors.push(`${file.name}: ${validation.issue?.message}`);
          continue;
        }
        
        try {
          await api.uploadDocument(caseId, file);
        } catch (err) {
          if (err instanceof Error && err.message.includes('Duplicate file')) {
            errors.push(`${file.name}: File already uploaded (SHA-256 duplicate)`);
          } else {
            errors.push(`${file.name}: ${err instanceof Error ? err.message : 'Upload failed'}`);
          }
        }
      }
      
      await loadDocuments();
      
      if (errors.length > 0) {
        setError(`Upload issues:\n${errors.join('\n')}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) uploadFiles(files);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) uploadFiles(files);
    // Reset input so same file can be re-selected
    e.target.value = '';
  }

  async function handleDelete(id: string) {
    try {
      await api.deleteDocument(id);
      setConfirmDelete(null);
      await loadDocuments();
    } catch {
      setError('Failed to delete document');
    }
  }

  async function handleAutofill() {
    if (!onAutofill && !onAutofillAction) return;
    setAutofilling(true);
    setError(null);
    try {
      if (onAutofillAction) {
        await onAutofillAction();
      } else if (onAutofill) {
        const patch = await api.autofillForm(caseId);
        onAutofill(patch);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Autofill failed');
    } finally {
      setAutofilling(false);
    }
  }

  async function handleProcessAll() {
    const uploadedDocs = documents.filter((d) => d.processingStatus === 'uploaded');
    if (uploadedDocs.length === 0) return;

    setError(null);
    setProcessingProgress({
      total: uploadedDocs.length,
      completed: 0,
      currentFilename: uploadedDocs[0].originalFilename,
      startTime: Date.now(),
    });

    for (let i = 0; i < uploadedDocs.length; i++) {
      const doc = uploadedDocs[i];
      setProcessingProgress((prev) =>
        prev ? { ...prev, currentFilename: doc.originalFilename } : null,
      );
      try {
        await api.processDocument(doc.id);
      } catch {
        // continue processing remaining docs even if one fails
      }
      setProcessingProgress((prev) =>
        prev ? { ...prev, completed: i + 1 } : null,
      );
    }

    setProcessingProgress(null);
    await loadDocuments();
  }

  async function handleProcessOne(docId: string) {
    setProcessingDocId(docId);
    setError(null);
    try {
      await api.processDocument(docId);
      await loadDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Processing failed');
    } finally {
      setProcessingDocId(null);
    }
  }

  const hasUploadedDocs = documents.some((d) => d.processingStatus === 'uploaded');
  const hasProcessedDocs = documents.some(
    (d) => d.processingStatus === 'extracted' || d.processingStatus === 'needs_review',
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Documents</h3>
        <div className="flex gap-2">
          {hasUploadedDocs && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleProcessAll}
              disabled={processingProgress !== null}
              className="gap-2"
            >
              <Play className="h-4 w-4" />
              Process Documents
            </Button>
          )}
          {(onAutofill || onAutofillAction) && hasProcessedDocs && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleAutofill}
              disabled={autofilling}
              className="gap-2"
            >
              <Wand2 className="h-4 w-4" />
              {autofilling ? 'Autofilling...' : 'Autofill Form'}
            </Button>
          )}
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragEnter={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
        }`}
      >
        <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground mb-1">
          Drag and drop files here, or{' '}
          <label className="text-primary underline cursor-pointer">
            browse
            <input
              type="file"
              multiple
              accept=".pdf,.csv,.xlsx,.txt,.jpg,.jpeg,.png,.heic,.webp,image/*"
              className="sr-only"
              onChange={handleFileInput}
            />
          </label>
        </p>
        <p className="text-xs text-muted-foreground">
          PDF, CSV, XLSX, TXT, JPG, PNG, HEIC, WebP — max 50 MB
        </p>
      </div>

      {uploading && (
        <p className="text-sm text-muted-foreground animate-pulse">Uploading...</p>
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded p-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
          <button type="button" className="ml-auto text-xs underline" onClick={() => setError(null)}>
            dismiss
          </button>
        </div>
      )}

      {/* Document list */}
      {documents.length === 0 && !uploading ? (
        <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left font-medium p-2 text-muted-foreground">File</th>
                  <th className="text-left font-medium p-2 text-muted-foreground">Type</th>
                  <th className="text-left font-medium p-2 text-muted-foreground">Status</th>
                  <th className="text-left font-medium p-2 text-muted-foreground">Quality</th>
                  <th className="text-left font-medium p-2 text-muted-foreground">Size</th>
                  <th className="text-left font-medium p-2 text-muted-foreground">Uploaded</th>
                  <th className="w-24" />
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr
                    key={doc.id}
                    className={`border-b cursor-pointer hover:bg-muted/30 transition-colors ${selectedDocId === doc.id ? 'bg-muted/50' : ''}`}
                    onClick={() => setSelectedDocId(selectedDocId === doc.id ? null : doc.id)}
                  >
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="truncate max-w-xs">{doc.originalFilename}</span>
                      </div>
                    </td>
                    <td className="p-2 text-muted-foreground">{docClassLabel(doc.docClass)}</td>
                    <td className="p-2">
                      <ProcessingStatusBadge status={doc.processingStatus} />
                    </td>
                    <td className="p-2">
                      {doc.qualityIssues && doc.qualityIssues.length > 0 ? (
                        <div className="space-y-1">
                          {doc.qualityIssues.map((issue, idx) => (
                            <div
                              key={idx}
                              className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
                                issue.severity === 'error'
                                  ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                              }`}
                              title={issue.message}
                            >
                              <AlertCircle className="h-3 w-3" />
                              {issue.type.replace(/_/g, ' ')}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    <td className="p-2 text-muted-foreground">{formatSize(doc.fileSizeBytes)}</td>
                    <td className="p-2 text-muted-foreground">{formatDate(doc.createdAt)}</td>
                    <td className="p-2">
                      <div className="flex gap-1 justify-end">
                        {doc.processingStatus === 'uploaded' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => { e.stopPropagation(); handleProcessOne(doc.id); }}
                            disabled={processingDocId === doc.id}
                            title="Process"
                          >
                            {processingDocId === doc.id
                              ? <Loader2 className="h-4 w-4 animate-spin" />
                              : <Play className="h-4 w-4" />}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => { e.stopPropagation(); api.downloadDocument(doc.id, doc.originalFilename); }}
                          title="Download"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        {confirmDelete === doc.id ? (
                          <div className="flex gap-1 items-center">
                            <Button variant="destructive" size="sm" onClick={(e) => { e.stopPropagation(); handleDelete(doc.id); }}>
                              Confirm
                            </Button>
                            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setConfirmDelete(null); }}>
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => { e.stopPropagation(); setConfirmDelete(doc.id); }}
                            title="Delete"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card layout */}
          <div className="md:hidden space-y-2">
            {documents.map((doc) => (
              <div key={doc.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm truncate">{doc.originalFilename}</span>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {doc.processingStatus === 'uploaded' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleProcessOne(doc.id)}
                        disabled={processingDocId === doc.id}
                        title="Process"
                      >
                        {processingDocId === doc.id
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <Play className="h-4 w-4" />}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => api.downloadDocument(doc.id, doc.originalFilename)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    {confirmDelete === doc.id ? (
                      <div className="flex gap-1">
                        <Button variant="destructive" size="sm" onClick={() => handleDelete(doc.id)}>
                          Yes
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(null)}>
                          No
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setConfirmDelete(doc.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                  <ProcessingStatusBadge status={doc.processingStatus} />
                  <span>{docClassLabel(doc.docClass)}</span>
                  <span>&middot;</span>
                  <span>{formatSize(doc.fileSizeBytes)}</span>
                  <span>&middot;</span>
                  <span>{formatDate(doc.createdAt)}</span>
                </div>
                {doc.qualityIssues && doc.qualityIssues.length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {doc.qualityIssues.map((issue, idx) => (
                      <div
                        key={idx}
                        className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
                          issue.severity === 'error'
                            ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                        }`}
                        title={issue.message}
                      >
                        <AlertCircle className="h-3 w-3" />
                        {issue.type.replace(/_/g, ' ')}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Review panel for selected document */}
      {selectedDocId && (() => {
        const doc = documents.find((d) => d.id === selectedDocId);
        if (!doc) return null;
        return (
          <DocumentReviewPanel
            documentId={selectedDocId}
            docClass={doc.docClass}
            processingStatus={doc.processingStatus}
            onClose={() => setSelectedDocId(null)}
            onUpdated={() => { setSelectedDocId(null); loadDocuments(); }}
          />
        );
      })()}

      {/* Blocking processing modal */}
      {processingProgress && <ProcessingModal progress={processingProgress} />}
    </div>
  );
}
