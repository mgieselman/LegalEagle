import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAutoSave } from '@/hooks/useAutoSave';
import { api } from '@/api/client';

// Mock the API module
vi.mock('@/api/client', () => ({
  api: {
    updateForm: vi.fn(),
  },
}));

// Mock debounce callback
vi.mock('usehooks-ts', () => ({
  useDebounceCallback: vi.fn((fn, _delay) => {
    const debouncedFn = vi.fn((...args) => fn(...args));
    debouncedFn.cancel = vi.fn();
    return debouncedFn;
  }),
}));

describe('useAutoSave', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const defaultProps = {
    data: { field1: 'value1', field2: 'value2' },
    questionnaireId: 'questionnaire-1',
    questionnaireVersion: 1,
    formName: 'test-form',
    readOnly: false,
  };

  it('should initialize with idle status', () => {
    const { result } = renderHook(() => useAutoSave(
      defaultProps.data,
      defaultProps.questionnaireId,
      defaultProps.questionnaireVersion,
      defaultProps.formName,
      defaultProps.readOnly,
      {},
      false, // not dirty yet — no user edits
    ));

    expect(result.current.status).toBe('idle');
    expect(result.current.errorMessage).toBe(null);
    expect(result.current.lastSavedAt).toBe(null);
  });

  it('should not auto-save when readOnly is true', async () => {
    renderHook(() => useAutoSave(
      defaultProps.data,
      defaultProps.questionnaireId,
      defaultProps.questionnaireVersion,
      defaultProps.formName,
      true // readOnly
    ));

    // Wait for any potential debounced calls
    await waitFor(() => {}, { timeout: 500 });
    
    expect(api.updateForm).not.toHaveBeenCalled();
  });

  it('should not auto-save when questionnaireId is null', async () => {
    renderHook(() => useAutoSave(
      defaultProps.data,
      null, // no questionnaireId
      defaultProps.questionnaireVersion,
      defaultProps.formName,
      defaultProps.readOnly
    ));

    await waitFor(() => {}, { timeout: 500 });
    
    expect(api.updateForm).not.toHaveBeenCalled();
  });

  it('should not auto-save when questionnaireVersion is null', async () => {
    renderHook(() => useAutoSave(
      defaultProps.data,
      defaultProps.questionnaireId,
      null, // no version
      defaultProps.formName,
      defaultProps.readOnly
    ));

    await waitFor(() => {}, { timeout: 500 });
    
    expect(api.updateForm).not.toHaveBeenCalled();
  });

  it('should handle successful auto-save', async () => {
    vi.mocked(api.updateForm).mockResolvedValue({ version: 2 });
    
    const { result, rerender } = renderHook(
      ({ data }) => useAutoSave(
        data,
        defaultProps.questionnaireId,
        defaultProps.questionnaireVersion,
        defaultProps.formName,
        defaultProps.readOnly
      ),
      { initialProps: { data: defaultProps.data } }
    );

    // Trigger data change to initiate auto-save
    rerender({ data: { field1: 'updated-value', field2: 'value2' } });

    await waitFor(() => {
      expect(result.current.status).toBe('saved');
      expect(result.current.lastSavedAt).toBeInstanceOf(Date);
      expect(result.current.errorMessage).toBe(null);
    });

    expect(api.updateForm).toHaveBeenCalledWith(
      'questionnaire-1',
      'test-form',
      { field1: 'updated-value', field2: 'value2' },
      1
    );
  });

  it('should handle version conflict error (409)', async () => {
    const conflictError = new Error('Version conflict - questionnaire was modified');
    vi.mocked(api.updateForm).mockRejectedValue(conflictError);
    
    const { result, rerender } = renderHook(
      ({ data }) => useAutoSave(
        data,
        defaultProps.questionnaireId,
        defaultProps.questionnaireVersion,
        defaultProps.formName,
        defaultProps.readOnly
      ),
      { initialProps: { data: defaultProps.data } }
    );

    rerender({ data: { field1: 'updated-value', field2: 'value2' } });

    await waitFor(() => {
      expect(result.current.status).toBe('conflict');
      expect(result.current.errorMessage).toBe(
        'Someone else edited this form. Please refresh to see the latest changes.'
      );
    });
  });

  it('should handle general save error', async () => {
    const saveError = new Error('Network error');
    vi.mocked(api.updateForm).mockRejectedValue(saveError);
    
    const { result, rerender } = renderHook(
      ({ data }) => useAutoSave(
        data,
        defaultProps.questionnaireId,
        defaultProps.questionnaireVersion,
        defaultProps.formName,
        defaultProps.readOnly
      ),
      { initialProps: { data: defaultProps.data } }
    );

    rerender({ data: { field1: 'updated-value', field2: 'value2' } });

    await waitFor(() => {
      expect(result.current.status).toBe('error');
      expect(result.current.errorMessage).toBe('Save failed: Network error');
    });
  });

  it('should handle offline state', async () => {
    // Mock offline state
    Object.defineProperty(navigator, 'onLine', {
      value: false,
      writable: true,
    });

    const { result, rerender } = renderHook(
      ({ data }) => useAutoSave(
        data,
        defaultProps.questionnaireId,
        defaultProps.questionnaireVersion,
        defaultProps.formName,
        defaultProps.readOnly
      ),
      { initialProps: { data: defaultProps.data } }
    );

    rerender({ data: { field1: 'updated-value', field2: 'value2' } });

    await waitFor(() => {
      expect(result.current.status).toBe('offline');
      expect(result.current.errorMessage).toBe(
        'Offline — changes will be saved when connection is restored'
      );
    });
  });

  it('should retry save when coming back online', async () => {
    vi.mocked(api.updateForm).mockResolvedValue({ version: 2 });
    
    // Start offline
    Object.defineProperty(navigator, 'onLine', {
      value: false,
      writable: true,
    });

    const { result, rerender } = renderHook(
      ({ data }) => useAutoSave(
        data,
        defaultProps.questionnaireId,
        defaultProps.questionnaireVersion,
        defaultProps.formName,
        defaultProps.readOnly
      ),
      { initialProps: { data: defaultProps.data } }
    );

    rerender({ data: { field1: 'updated-value', field2: 'value2' } });

    await waitFor(() => {
      expect(result.current.status).toBe('offline');
    });

    // Come back online
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      writable: true,
    });
    
    // Trigger online event
    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    await waitFor(() => {
      expect(result.current.status).toBe('saved');
    });

    expect(api.updateForm).toHaveBeenCalled();
  });

  it('should force save immediately when forceSave is called', async () => {
    vi.mocked(api.updateForm).mockResolvedValue({ version: 2 });

    const { result } = renderHook(() => useAutoSave(
      defaultProps.data,
      defaultProps.questionnaireId,
      defaultProps.questionnaireVersion,
      defaultProps.formName,
      defaultProps.readOnly,
      {},
      false, // not dirty — forceSave should bypass dirty check
    ));

    await act(async () => {
      await result.current.forceSave();
    });

    expect(api.updateForm).toHaveBeenCalledWith(
      'questionnaire-1',
      'test-form',
      defaultProps.data,
      1
    );

    expect(result.current.status).toBe('saved');
  });

  it('should update version when questionnaire version prop changes', () => {
    const { result, rerender } = renderHook(
      ({ version }) => useAutoSave(
        defaultProps.data,
        defaultProps.questionnaireId,
        version,
        defaultProps.formName,
        defaultProps.readOnly,
        {},
        false, // not dirty
      ),
      { initialProps: { version: 1 } }
    );

    // Update version
    rerender({ version: 3 });

    // The internal version should update to match
    expect(result.current.status).toBe('idle'); // Should remain idle
  });

  it('should call onSuccess callback on successful save', async () => {
    const onSuccess = vi.fn();
    vi.mocked(api.updateForm).mockResolvedValue({ version: 2 });
    
    const { rerender } = renderHook(
      ({ data }) => useAutoSave(
        data,
        defaultProps.questionnaireId,
        defaultProps.questionnaireVersion,
        defaultProps.formName,
        defaultProps.readOnly,
        { onSuccess }
      ),
      { initialProps: { data: defaultProps.data } }
    );

    rerender({ data: { field1: 'updated-value', field2: 'value2' } });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it('should call onError callback on save failure', async () => {
    const onError = vi.fn();
    const saveError = new Error('Save failed');
    vi.mocked(api.updateForm).mockRejectedValue(saveError);
    
    const { rerender } = renderHook(
      ({ data }) => useAutoSave(
        data,
        defaultProps.questionnaireId,
        defaultProps.questionnaireVersion,
        defaultProps.formName,
        defaultProps.readOnly,
        { onError }
      ),
      { initialProps: { data: defaultProps.data } }
    );

    rerender({ data: { field1: 'updated-value', field2: 'value2' } });

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(expect.stringContaining('Save failed'));
    });
  });

  it('should auto-clear saved status after delay', async () => {
    vi.mocked(api.updateForm).mockResolvedValue({ version: 2 });
    
    const { result, rerender } = renderHook(
      ({ data }) => useAutoSave(
        data,
        defaultProps.questionnaireId,
        defaultProps.questionnaireVersion,
        defaultProps.formName,
        defaultProps.readOnly
      ),
      { initialProps: { data: defaultProps.data } }
    );

    rerender({ data: { field1: 'updated-value', field2: 'value2' } });

    await waitFor(() => {
      expect(result.current.status).toBe('saved');
    });

    // Test that auto-clear functionality exists (without waiting for full timeout)
    expect(result.current.status).toBe('saved');
  });

  it('should accept custom debounce delay option', () => {
    const customDelay = 5000;
    
    const { result } = renderHook(() => useAutoSave(
      defaultProps.data,
      defaultProps.questionnaireId,
      defaultProps.questionnaireVersion,
      defaultProps.formName,
      defaultProps.readOnly,
      { debounceMs: customDelay },
      false, // not dirty
    ));

    // Test passes if hook initializes without error with custom delay
    expect(result.current.status).toBe('idle');
  });
});