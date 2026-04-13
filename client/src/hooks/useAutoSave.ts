import { useEffect, useRef, useState, useCallback } from 'react';
import { useDebounceCallback } from 'usehooks-ts';
import { api } from '@/api/client';

interface UseAutoSaveOptions {
  debounceMs?: number;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'offline' | 'conflict';

export interface UseAutoSaveReturn {
  status: AutoSaveStatus;
  errorMessage: string | null;
  lastSavedAt: Date | null;
  forceSave: () => Promise<void>;
}

/**
 * Auto-save hook with debouncing and optimistic locking for questionnaires.
 * Automatically saves form data 2 seconds after user stops typing.
 */
export function useAutoSave(
  data: Record<string, unknown>,
  questionnaireId: string | null,
  questionnaireVersion: number | null,
  formName: string,
  readOnly = false,
  options: UseAutoSaveOptions = {},
  isDirty = true,
): UseAutoSaveReturn {
  const { debounceMs = 2000, onSuccess, onError } = options;

  const [status, setStatus] = useState<AutoSaveStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  // Track version returned from API saves; fall back to prop for initial/external version
  const [savedVersion, setSavedVersion] = useState<number | null>(null);
  const currentVersion = savedVersion ?? questionnaireVersion;

  const isOnlineRef = useRef(navigator.onLine);

  // Use refs for values that change frequently so saveToAPI stays stable
  const dataRef = useRef(data);
  const formNameRef = useRef(formName);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  const isDirtyRef = useRef(isDirty);

  // Update refs after render to avoid accessing refs during render
  useEffect(() => {
    dataRef.current = data;
  }, [data]);
  
  useEffect(() => {
    formNameRef.current = formName;
  }, [formName]);
  
  useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);
  
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);
  
  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  // Refs for retry-on-online (avoids setState-in-effect pattern)
  const statusRef = useRef(status);
  useEffect(() => { statusRef.current = status; }, [status]);
  const saveToAPIRef = useRef<() => Promise<void>>();

  // Track online/offline state + retry save when coming back online
  useEffect(() => {
    function handleOnline() {
      isOnlineRef.current = true;
      // Retry if we were offline
      if (statusRef.current === 'offline') {
        saveToAPIRef.current?.();
      }
    }
    function handleOffline() { isOnlineRef.current = false; }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Stable save function — uses refs for frequently changing values
  const saveToAPI = useCallback(async (): Promise<void> => {
    if (!questionnaireId || !currentVersion || readOnly) return;

    if (!isOnlineRef.current) {
      setStatus('offline');
      setErrorMessage('Offline — changes will be saved when connection is restored');
      return;
    }

    setStatus('saving');
    setErrorMessage(null);

    try {
      const result = await api.updateForm(
        questionnaireId,
        formNameRef.current,
        dataRef.current,
        currentVersion,
      );
      setSavedVersion(result.version);
      setStatus('saved');
      setLastSavedAt(new Date());
      setErrorMessage(null);
      onSuccessRef.current?.();

      // Auto-clear "saved" status after 3 seconds
      setTimeout(() => {
        setStatus(s => s === 'saved' ? 'idle' : s);
      }, 3000);

    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Version conflict') || error.message.includes('409')) {
          setStatus('conflict');
          const msg = 'Someone else edited this form. Please refresh to see the latest changes.';
          setErrorMessage(msg);
          onErrorRef.current?.(msg);
        } else {
          setStatus('error');
          const msg = `Save failed: ${error.message}`;
          setErrorMessage(msg);
          onErrorRef.current?.(msg);
        }
      } else {
        setStatus('error');
        const msg = 'Save failed: unknown error';
        setErrorMessage(msg);
        onErrorRef.current?.(msg);
      }
    }
  }, [questionnaireId, currentVersion, readOnly]);

  // Keep ref in sync for event handler access
  useEffect(() => { saveToAPIRef.current = saveToAPI; }, [saveToAPI]);

  // Debounced auto-save — stable because saveToAPI is stable
  const debouncedSave = useDebounceCallback(saveToAPI, debounceMs);

  // Force save (manual trigger)
  const forceSave = useCallback(async (): Promise<void> => {
    debouncedSave.cancel();
    await saveToAPI();
  }, [debouncedSave, saveToAPI]);

  // Auto-save when data changes (only after user has edited)
  useEffect(() => {
    if (readOnly || !questionnaireId || !currentVersion) return;
    if (!isDirtyRef.current) return;

    debouncedSave();

    return () => {
      debouncedSave.cancel();
    };
  }, [data, questionnaireId, currentVersion, readOnly, debouncedSave]);

  return {
    status,
    errorMessage,
    lastSavedAt,
    forceSave,
  };
}
