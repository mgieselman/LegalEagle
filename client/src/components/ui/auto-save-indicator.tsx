import type { AutoSaveStatus } from '@/hooks/useAutoSave';

interface AutoSaveIndicatorProps {
  status: AutoSaveStatus;
}

export function AutoSaveIndicator({ status }: AutoSaveIndicatorProps) {
  if (status === 'idle') return null;

  return (
    <div className="flex items-center gap-1 text-xs">
      {status === 'saving' && (
        <>
          <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
          <span className="text-muted-foreground">Saving...</span>
        </>
      )}
      {status === 'saved' && (
        <>
          <div className="h-2 w-2 rounded-full bg-green-500" />
          <span className="text-muted-foreground">Saved</span>
        </>
      )}
      {status === 'error' && (
        <>
          <div className="h-2 w-2 rounded-full bg-red-500" />
          <span className="text-destructive">Save failed</span>
        </>
      )}
      {status === 'conflict' && (
        <>
          <div className="h-2 w-2 rounded-full bg-amber-500" />
          <span className="text-amber-600">Conflict</span>
        </>
      )}
      {status === 'offline' && (
        <>
          <div className="h-2 w-2 rounded-full bg-gray-500" />
          <span className="text-muted-foreground">Offline</span>
        </>
      )}
    </div>
  );
}
