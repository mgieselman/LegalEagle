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
  const [currentVersion, setCurrentVersion] = useState<number | null>(questionnaireVersion);

  const isOnlineRef = useRef(navigator.onLine);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Use refs for values that change frequently so saveToAPI stays stable
  const dataRef = useRef(data);
  dataRef.current = data;
  const formNameRef = useRef(formName);
  formNameRef.current = formName;
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  // Track online/offline state
  useEffect(() => {
    function handleOnline() { isOnlineRef.current = true; setIsOnline(true); }
    function handleOffline() { isOnlineRef.current = false; setIsOnline(false); }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Update version when prop changes
  useEffect(() => {
    if (questionnaireVersion !== null && questionnaireVersion !== currentVersion) {
      setCurrentVersion(questionnaireVersion);
    }
  }, [questionnaireVersion]); // eslint-disable-line react-hooks/exhaustive-deps

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
      setCurrentVersion(result.version);
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

  // Retry when coming back online
  useEffect(() => {
    if (status === 'offline' && isOnline) {
      saveToAPI();
    }
  }, [status, isOnline, saveToAPI]);

  return {
    status,
    errorMessage,
    lastSavedAt,
    forceSave,
  };
}
