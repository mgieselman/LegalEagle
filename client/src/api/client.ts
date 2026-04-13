const BASE = '/api';

/** Get the stored auth token */
function getToken(): string | null {
  return localStorage.getItem('auth_token');
}

/** Store auth token */
export function setToken(token: string): void {
  localStorage.setItem('auth_token', token);
}

/** Clear auth token */
export function clearToken(): void {
  localStorage.removeItem('auth_token');
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      ...headers,
      ...(options?.headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

import type { QuestionnaireData, QuestionnaireMetadata } from '../types/questionnaire';

// ---- Types ----

export interface AuthUser {
  userId: string;
  lawFirmId: string;
  role: 'paralegal' | 'attorney' | 'admin';
  name: string;
  email: string;
}

export interface AuthClient {
  clientId: string;
  lawFirmId: string;
  role: 'client';
  name: string;
  email: string;
}

export type AuthIdentity = AuthUser | AuthClient;

export interface FormSummary {
  id: string;
  name: string;
  updated_at: string;
}

export interface FormDetail {
  id: string;
  name: string;
  data: Record<string, unknown>;
  metadata: QuestionnaireMetadata;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface ReviewFinding {
  severity: 'error' | 'warning' | 'info';
  section: string;
  message: string;
}

export interface ClientSummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  createdAt: string;
}

export type CaseStatus =
  | 'intake'
  | 'documents'
  | 'review'
  | 'ready_to_file'
  | 'filed'
  | 'discharged'
  | 'dismissed'
  | 'closed';

export interface CaseSummary {
  id: string;
  clientId: string;
  clientFirstName: string;
  clientLastName: string;
  chapter: string;
  status: CaseStatus;
  filingDate: string | null;
  createdAt: string;
  progress?: {
    docs: string;
    sections: string;
  };
  attention?: {
    count: number;
    hasErrors: boolean;
  };
}

export interface QualityIssue {
  type: 'duplicate' | 'validation_error' | 'unsupported_format' | 'oversized';
  message: string;
  severity: 'error' | 'warning';
  canRetry: boolean;
}

export interface DocumentSummary {
  id: string;
  originalFilename: string;
  mimeType: string;
  fileSizeBytes: number;
  docClass: string | null;
  belongsTo: string;
  processingStatus: string;
  classificationConfidence: number | null;
  classificationMethod: string | null;
  createdAt: string;
  processingResult?: ProcessingResult | null;
  qualityIssues?: QualityIssue[];
}

export interface ProcessingResult {
  docClass: string;
  classificationConfidence: number;
  classificationMethod: string;
  extractionConfidence: number | null;
  processingStatus: string;
  validationWarnings: number;
  needsReview: boolean;
  error?: string;
}

export interface ExtractionResultSummary {
  id: string;
  extractionMethod: string;
  confidenceScore: number | null;
  extractedData: { data: Record<string, unknown>; fieldConfidences: Record<string, number>; warnings: string[] };
  status: string;
  version: number;
  reviewedBy: string | null;
  reviewNotes: string | null;
}

export interface AutofillSource {
  documentId: string;
  docClass: string;
  confidence: number;
}

export interface AutofillPatch {
  fields: Partial<QuestionnaireData>;
  sources: Record<string, AutofillSource>;
}

export interface ValidationResultSummary {
  id: string;
  validationType: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  isDismissed: boolean;
}

export interface ReviewQueueDocument {
  id: string;
  originalFilename: string;
  docClass: string | null;
  processingStatus: string;
  classificationConfidence: number | null;
  createdAt: string;
}

export interface ReviewSummary {
  extractionQueue: ReviewQueueDocument[];
  validationWarnings: ValidationResultSummary[];
  counts: {
    extraction: number;
    validation: number;
  };
}

// ---- API ----

export const api = {
  // Auth
  login: (email: string, password = '') =>
    request<{ token: string; user: AuthUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  clientLogin: (email: string, password = '') =>
    request<{ token: string; client: AuthClient }>('/auth/client/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  getMe: () => request<AuthIdentity>('/auth/me'),

  // Clients
  listClients: () => request<ClientSummary[]>('/clients'),

  getClient: (id: string) => request<ClientSummary>(`/clients/${id}`),

  createClient: (data: {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    chapter?: '7' | '13';
  }) =>
    request<{ id: string; caseId: string | null }>('/clients', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteClient: (id: string) =>
    request<{ success: boolean }>(`/clients/${id}`, { method: 'DELETE' }),

  // Cases
  listCases: (clientId?: string, expand?: string[]) => {
    const params = new URLSearchParams();
    if (clientId) params.set('clientId', clientId);
    if (expand && expand.length > 0) params.set('expand', expand.join(','));
    const query = params.toString();
    return request<CaseSummary[]>(`/cases${query ? `?${query}` : ''}`);
  },

  getCase: (id: string) =>
    request<Record<string, unknown>>(`/cases/${id}`),

  createCase: (clientId: string, chapter: '7' | '13' = '7') =>
    request<{ id: string; questionnaireId: string }>('/cases', {
      method: 'POST',
      body: JSON.stringify({ clientId, chapter }),
    }),

  updateCase: (id: string, data: Record<string, unknown>) =>
    request<{ id: string }>(`/cases/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteCase: (id: string) =>
    request<{ success: boolean }>(`/cases/${id}`, { method: 'DELETE' }),

  // Forms (questionnaires)
  listForms: () => request<FormSummary[]>('/forms'),

  getForm: (id: string) => request<FormDetail>(`/forms/${id}`),

  createForm: (name: string, data: Record<string, unknown>) =>
    request<{ id: string; name: string }>('/forms', {
      method: 'POST',
      body: JSON.stringify({ name, data }),
    }),

  updateForm: (id: string, name: string, data: Record<string, unknown>, expectedVersion?: number) =>
    request<{ id: string; name: string; version: number }>(`/forms/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name, data }),
      headers: expectedVersion !== undefined ? { 'If-Match': String(expectedVersion) } : undefined,
    }),

  deleteForm: (id: string) =>
    request<{ success: boolean }>(`/forms/${id}`, { method: 'DELETE' }),

  reviewForm: (id: string) =>
    request<{ findings: ReviewFinding[] }>(`/forms/${id}/review`, { method: 'POST' }),

  downloadForm: (id: string) => {
    const token = getToken();
    const url = `${BASE}/forms/${id}/download${token ? `?token=${token}` : ''}`;
    window.open(url, '_blank');
  },

  // Client portal
  clientListCases: () =>
    request<Array<{
      id: string;
      chapter: string;
      status: CaseStatus;
      filingDate: string | null;
      createdAt: string;
    }>>('/client-portal/cases'),

  clientGetCase: (id: string) =>
    request<Record<string, unknown>>(`/client-portal/cases/${id}`),

  // Documents
  listDocuments: (caseId: string) =>
    request<DocumentSummary[]>(`/documents?caseId=${encodeURIComponent(caseId)}`),

  uploadDocument: async (
    caseId: string,
    file: File,
    metadata?: { belongsTo?: string; docClass?: string },
  ): Promise<DocumentSummary> => {
    const token = getToken();
    const formData = new FormData();
    formData.append('file', file);
    formData.append('caseId', caseId);
    if (metadata?.belongsTo) formData.append('belongsTo', metadata.belongsTo);
    if (metadata?.docClass) formData.append('docClass', metadata.docClass);

    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${BASE}/documents/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || 'Upload failed');
    }
    return res.json();
  },

  deleteDocument: (id: string) =>
    request<{ success: boolean }>(`/documents/${id}`, { method: 'DELETE' }),

  getExtraction: (documentId: string) =>
    request<ExtractionResultSummary>(`/documents/${documentId}/extraction`),

  getValidations: (documentId: string) =>
    request<ValidationResultSummary[]>(`/documents/${documentId}/validations`),

  acceptExtraction: (documentId: string) =>
    request<{ success: boolean }>(`/documents/${documentId}/extraction/accept`, { method: 'POST' }),

  correctExtraction: (documentId: string, extractedData: Record<string, unknown>, notes: string) =>
    request<Record<string, unknown>>(`/documents/${documentId}/extraction/correct`, {
      method: 'POST',
      body: JSON.stringify({ extractedData, notes }),
    }),

  dismissValidation: (documentId: string, validationId: string) =>
    request<{ success: boolean }>(`/documents/${documentId}/validations/${validationId}/dismiss`, { method: 'POST' }),

  processDocument: (documentId: string) =>
    request<ProcessingResult>(`/documents/${documentId}/process`, { method: 'POST' }),

  reprocessDocument: (documentId: string) =>
    request<ProcessingResult>(`/documents/${documentId}/reprocess`, { method: 'POST' }),

  processAllDocuments: (caseId: string) =>
    request<{ processed: number; results: Array<{ documentId: string; filename: string; result: ProcessingResult | null; error?: string }> }>(
      `/cases/${caseId}/process-documents`,
      { method: 'POST' },
    ),

  autofillForm: (caseId: string) =>
    request<AutofillPatch>(`/cases/${caseId}/autofill`, { method: 'POST' }),

  autofillAndMerge: (caseId: string) =>
    request<{ filledFields: string[]; skippedFields: string[] }>(`/cases/${caseId}/questionnaire/autofill`, { method: 'POST' }),

  getReviewSummary: (caseId: string) =>
    request<ReviewSummary>(`/cases/${caseId}/review-summary`),

  downloadDocument: (id: string, filename: string) => {
    const token = getToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    fetch(`${BASE}/documents/${id}/download`, { headers })
      .then((res) => res.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      });
  },
};
