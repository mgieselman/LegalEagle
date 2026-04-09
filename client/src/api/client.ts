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
    headers,
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

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

export interface CaseSummary {
  id: string;
  clientId: string;
  clientFirstName: string;
  clientLastName: string;
  chapter: string;
  status: string;
  filingDate: string | null;
  createdAt: string;
}

export interface DocumentSummary {
  id: string;
  originalFilename: string;
  mimeType: string;
  fileSizeBytes: number;
  docClass: string | null;
  belongsTo: string;
  processingStatus: string;
  createdAt: string;
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
  listCases: () => request<CaseSummary[]>('/cases'),

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

  updateForm: (id: string, name: string, data: Record<string, unknown>) =>
    request<{ id: string; name: string }>(`/forms/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name, data }),
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
      status: string;
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
