import { useState, useEffect, useCallback } from 'react';
import { api, type FormSummary, type ReviewFinding } from '@/api/client';
import { trackPlausibleEvent } from '@/lib/plausible';
import type { QuestionnaireData, QuestionnaireValue } from '@/types/questionnaire';
import { createEmptyQuestionnaire } from '@/types/questionnaire';
import { useAutoSave, type UseAutoSaveReturn } from '@/hooks/useAutoSave';

/** Merge saved data with empty defaults so nested objects always have all fields defined. */
export function mergeWithDefaults(saved: Record<string, unknown>): QuestionnaireData {
  const defaults = createEmptyQuestionnaire() as unknown as Record<string, unknown>;
  const result = { ...defaults };
  for (const [key, val] of Object.entries(saved)) {
    if (
      typeof val === 'object' && val !== null && !Array.isArray(val) &&
      typeof defaults[key] === 'object' && defaults[key] !== null && !Array.isArray(defaults[key])
    ) {
      result[key] = { ...(defaults[key] as Record<string, unknown>), ...(val as Record<string, unknown>) };
    } else if (val !== undefined) {
      result[key] = val;
    }
  }
  return result as unknown as QuestionnaireData;
}

export interface UseQuestionnaireStateOptions {
  caseId?: string;
  mode?: 'staff' | 'client';
  questionnaireData?: { id: string; name: string; data: Record<string, unknown>; version: number };
  readOnly?: boolean;
}

export interface UseQuestionnaireStateReturn {
  // Data
  data: QuestionnaireData;
  formName: string;
  currentFormId: string | null;
  readOnly: boolean;

  // Handlers
  handleChange: (path: string, value: QuestionnaireValue) => void;
  handleSave: () => Promise<void>;
  handleDownload: () => Promise<void>;
  handleReview: () => Promise<void>;

  // Save state
  saving: boolean;
  autoSave: UseAutoSaveReturn;

  // Review state
  reviewing: boolean;
  hasReview: boolean;
  findings: ReviewFinding[];
  setHasReview: (v: boolean) => void;
  setFindings: (f: ReviewFinding[]) => void;

  // Standalone form management
  formList: FormSummary[];
  handleSelectForm: (id: string) => Promise<void>;
  handleNewForm: () => void;

  // Toast messages (consumers display these)
  lastMessage: string | null;
  clearMessage: () => void;
}

export function useQuestionnaireState({
  caseId,
  mode = 'staff',
  questionnaireData,
  readOnly: readOnlyProp = false,
}: UseQuestionnaireStateOptions = {}): UseQuestionnaireStateReturn {
  const [formList, setFormList] = useState<FormSummary[]>([]);
  const [currentFormId, setCurrentFormId] = useState<string | null>(null);
  const [data, setData] = useState<QuestionnaireData>(createEmptyQuestionnaire());
  const [isDirty, setIsDirty] = useState(false);
  const [formName, setFormName] = useState('');
  const [saving, setSaving] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [hasReview, setHasReview] = useState(false);
  const [findings, setFindings] = useState<ReviewFinding[]>([]);
  const [lastMessage, setLastMessage] = useState<string | null>(null);

  const showMessage = (msg: string) => {
    setLastMessage(msg);
  };

  const clearMessage = () => setLastMessage(null);

  // Auto-save — only fires after user has edited (isDirty)
  const autoSave = useAutoSave(
    data as unknown as Record<string, unknown>,
    currentFormId,
    questionnaireData?.version ?? null,
    formName || 'Untitled',
    readOnlyProp,
    {
      onSuccess: () => console.log('Auto-saved successfully'),
      onError: (error) => console.warn('Auto-save failed:', error),
    },
    isDirty,
  );

  // Load form list (standalone mode)
  const loadFormList = useCallback(async () => {
    try {
      const list = await api.listForms();
      setFormList(list);
    } catch {
      console.error('Failed to load forms');
    }
  }, []);

  useEffect(() => { if (!caseId) loadFormList(); }, [loadFormList, caseId]);

  // Load case questionnaire
  useEffect(() => {
    if (questionnaireData) {
      setCurrentFormId(questionnaireData.id);
      setData(mergeWithDefaults(questionnaireData.data));
      setFormName(questionnaireData.name);
      return;
    }
    if (!caseId) return;
    const fetchCase = mode === 'client' ? api.clientGetCase(caseId) : api.getCase(caseId);
    fetchCase.then((caseData) => {
      const q = caseData.questionnaire as { id: string; name: string; data: Record<string, unknown> } | null;
      if (q) {
        setCurrentFormId(q.id);
        setData(mergeWithDefaults(q.data));
        setFormName(q.name);
      }
    }).catch(() => {
      showMessage('Failed to load case');
    });
  }, [caseId, questionnaireData, mode]);

  const handleSelectForm = async (id: string) => {
    if (!id) return;
    try {
      const form = await api.getForm(id);
      setCurrentFormId(id);
      setData(mergeWithDefaults(form.data as Record<string, unknown>));
      setFormName(form.name);
      setFindings([]);
      setHasReview(false);
    } catch {
      showMessage('Failed to load form');
    }
  };

  const handleNewForm = () => {
    setCurrentFormId(null);
    setData(createEmptyQuestionnaire());
    setFormName('');
    setFindings([]);
    setHasReview(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (currentFormId) {
        await autoSave.forceSave();
        trackPlausibleEvent('Form Saved', { mode: 'update' });
        showMessage('Form saved successfully');
      } else {
        const name = data.fullName || formName || 'Untitled';
        const result = await api.createForm(name, data as unknown as Record<string, unknown>);
        setCurrentFormId(result.id);
        setFormName(name);
        trackPlausibleEvent('Form Saved', { mode: 'create' });
        showMessage('Form saved successfully');
      }
      await loadFormList();
    } catch {
      if (!currentFormId) {
        showMessage('Failed to save form');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async () => {
    if (!currentFormId) {
      showMessage('Save the form first before downloading');
      return;
    }
    try {
      const name = data.fullName || formName || 'Untitled';
      await api.updateForm(currentFormId, name, data as unknown as Record<string, unknown>);
    } catch {
      // continue with download anyway
    }
    trackPlausibleEvent('Form Downloaded');
    api.downloadForm(currentFormId);
  };

  const handleReview = async () => {
    let formId = currentFormId;

    if (!formId) {
      setSaving(true);
      try {
        const name = data.fullName || formName || 'Untitled';
        const result = await api.createForm(name, data as unknown as Record<string, unknown>);
        formId = result.id;
        setCurrentFormId(formId);
        setFormName(name);
        await loadFormList();
      } catch {
        showMessage('Failed to save form before review');
        setSaving(false);
        return;
      }
      setSaving(false);
    } else {
      try {
        const name = data.fullName || formName || 'Untitled';
        await api.updateForm(formId, name, data as unknown as Record<string, unknown>);
      } catch {
        // continue with review anyway
      }
    }

    setReviewing(true);
    setHasReview(true);
    setFindings([]);
    try {
      const result = await api.reviewForm(formId);
      setFindings(result.findings);
      const errorCount = result.findings.filter((f) => f.severity === 'error').length;
      const warningCount = result.findings.filter((f) => f.severity === 'warning').length;
      const infoCount = result.findings.filter((f) => f.severity === 'info').length;

      trackPlausibleEvent('AI Review Run', {
        findings: result.findings.length,
        errors: errorCount,
        warnings: warningCount,
        info: infoCount,
      });
    } catch {
      setFindings([{ severity: 'error', section: 'General', message: 'Failed to run AI review.' }]);
    } finally {
      setReviewing(false);
    }
  };

  const handleChange = (path: string, value: QuestionnaireValue) => {
    setIsDirty(true);
    setData((prev) => {
      const next = { ...prev };
      const keys = path.split('.');
      let obj: Record<string, unknown> = next;
      for (let i = 0; i < keys.length - 1; i++) {
        obj[keys[i]] = { ...(obj[keys[i]] as Record<string, unknown>) };
        obj = obj[keys[i]] as Record<string, unknown>;
      }
      obj[keys[keys.length - 1]] = value;
      return next;
    });
  };

  return {
    data,
    formName,
    currentFormId,
    readOnly: readOnlyProp,
    handleChange,
    handleSave,
    handleDownload,
    handleReview,
    saving,
    autoSave,
    reviewing,
    hasReview,
    findings,
    setHasReview,
    setFindings,
    formList,
    handleSelectForm,
    handleNewForm,
    lastMessage,
    clearMessage,
  };
}
