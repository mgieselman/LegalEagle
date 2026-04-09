import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from './ui/button';
import { api, type DocumentSummary } from '@/api/client';
import { Upload, Download, Trash2, FileText, AlertCircle } from 'lucide-react';
import { ProcessingStatusBadge } from './ProcessingStatusBadge';
import { DocumentReviewPanel } from './DocumentReviewPanel';

const ALLOWED_EXTENSIONS = ['.pdf', '.csv', '.xlsx', '.txt'];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

interface DocumentsPanelProps {
  caseId: string;
}

export function DocumentsPanel({ caseId }: DocumentsPanelProps) {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  function validateFile(file: File): string | null {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return `File type ${ext} not allowed. Accepted: ${ALLOWED_EXTENSIONS.join(', ')}`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File exceeds 50 MB limit`;
    }
    return null;
  }

  async function uploadFiles(files: File[]) {
    setError(null);
    setUploading(true);
    try {
      for (const file of files) {
        const validationError = validateFile(file);
        if (validationError) {
          setError(validationError);
          continue;
        }
        await api.uploadDocument(caseId, file);
      }
      await loadDocuments();
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

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">Documents</h3>

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
          <button
            type="button"
            className="text-primary underline cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            browse
          </button>
        </p>
        <p className="text-xs text-muted-foreground">
          PDF, CSV, XLSX, TXT — max 50 MB
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.csv,.xlsx,.txt"
          className="hidden"
          onChange={handleFileInput}
        />
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
                  <th className="text-left font-medium p-2 text-muted-foreground">Status</th>
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
                    <td className="p-2">
                      <ProcessingStatusBadge status={doc.processingStatus} />
                    </td>
                    <td className="p-2 text-muted-foreground">{formatSize(doc.fileSizeBytes)}</td>
                    <td className="p-2 text-muted-foreground">{formatDate(doc.createdAt)}</td>
                    <td className="p-2">
                      <div className="flex gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => api.downloadDocument(doc.id, doc.originalFilename)}
                          title="Download"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        {confirmDelete === doc.id ? (
                          <div className="flex gap-1 items-center">
                            <Button variant="destructive" size="sm" onClick={() => handleDelete(doc.id)}>
                              Confirm
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(null)}>
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setConfirmDelete(doc.id)}
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
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <ProcessingStatusBadge status={doc.processingStatus} />
                  <span>{formatSize(doc.fileSizeBytes)}</span>
                  <span>&middot;</span>
                  <span>{formatDate(doc.createdAt)}</span>
                </div>
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
    </div>
  );
}
