const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

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

export const api = {
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
};
