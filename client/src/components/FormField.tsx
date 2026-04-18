import { Input } from './ui/input';
import { Label } from './ui/label';
import { Wand2 } from 'lucide-react';
import type { AutofillSource } from '../types/questionnaire';
import type { ReviewFinding } from '@/api/client';
import { SeverityCard, SeverityIcon } from './ui/severity-indicator';

interface FormFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  className?: string;
  autofillSource?: AutofillSource;
  readOnly?: boolean;
  /** Dot-notation field key used to match against ReviewFinding.fieldHint */
  fieldKey?: string;
  /** Section-scoped AI review findings. Filtered by fieldKey to show inline banners. */
  findings?: ReviewFinding[];
}

export function FormField({ 
  label, 
  value, 
  onChange, 
  type = 'text', 
  placeholder, 
  className,
  autofillSource,
  readOnly = false,
  fieldKey,
  findings,
}: FormFieldProps) {
  const isAutofilled = !!autofillSource;
  const fieldFindings = fieldKey && findings ? findings.filter((f) => f.fieldHint === fieldKey) : [];
  
  return (
    <div className={className}>
      <div className="flex items-center gap-2 mb-1">
        <Label className="block">{label}</Label>
        {isAutofilled && (
          <div
            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
            title={`Auto-filled from ${autofillSource.docClass.replace(/[<>"'&]/g, '')} (confidence: ${Math.round(autofillSource.confidence * 100)}%)`}
          >
            <Wand2 className="h-3 w-3" />
            Auto-filled
          </div>
        )}
      </div>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        disabled={readOnly}
        className={`${isAutofilled ? 'bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800' : ''} ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
      />
      {fieldFindings.map((f, i) => (
        <SeverityCard key={i} severity={f.severity} className="mt-2">
          <div className="flex items-start gap-2">
            <SeverityIcon severity={f.severity} className="shrink-0 mt-0.5" />
            <p className="text-sm">{f.message}</p>
          </div>
        </SeverityCard>
      ))}
    </div>
  );
}

interface YesNoFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  readOnly?: boolean;
  fieldKey?: string;
  findings?: ReviewFinding[];
}

export function YesNoField({ label, value, onChange, className, readOnly = false, fieldKey, findings }: YesNoFieldProps) {
  const fieldFindings = fieldKey && findings ? findings.filter((f) => f.fieldHint === fieldKey) : [];
  return (
    <div className={className}>
      <div className={`flex items-center gap-4 ${readOnly ? '' : ''}`}>
        <span className="text-sm font-medium">{label}</span>
        <label className={`flex items-center gap-2 py-1 px-1 ${readOnly ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
          <input 
            type="radio" 
            name={label} 
            checked={value === 'yes'} 
            onChange={() => !readOnly && onChange('yes')} 
            disabled={readOnly}
            className="accent-primary h-4 w-4" 
          />
          <span className="text-sm">Yes</span>
        </label>
        <label className={`flex items-center gap-2 py-1 px-1 ${readOnly ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
          <input 
            type="radio" 
            name={label} 
            checked={value === 'no'} 
            onChange={() => !readOnly && onChange('no')} 
            disabled={readOnly}
            className="accent-primary h-4 w-4" 
          />
          <span className="text-sm">No</span>
        </label>
      </div>
      {fieldFindings.map((f, i) => (
        <SeverityCard key={i} severity={f.severity} className="mt-2">
          <div className="flex items-start gap-2">
            <SeverityIcon severity={f.severity} className="shrink-0 mt-0.5" />
            <p className="text-sm">{f.message}</p>
          </div>
        </SeverityCard>
      ))}
    </div>
  );
}

interface TextAreaFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  className?: string;
  readOnly?: boolean;
  fieldKey?: string;
  findings?: ReviewFinding[];
}

export function TextAreaField({ label, value, onChange, rows = 2, className, readOnly = false, fieldKey, findings }: TextAreaFieldProps) {
  const fieldFindings = fieldKey && findings ? findings.filter((f) => f.fieldHint === fieldKey) : [];
  return (
    <div className={className}>
      <Label className="mb-1 block">{label}</Label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        readOnly={readOnly}
        disabled={readOnly}
        rows={rows}
        className={`flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-base md:text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
      />
      {fieldFindings.map((f, i) => (
        <SeverityCard key={i} severity={f.severity} className="mt-2">
          <div className="flex items-start gap-2">
            <SeverityIcon severity={f.severity} className="shrink-0 mt-0.5" />
            <p className="text-sm">{f.message}</p>
          </div>
        </SeverityCard>
      ))}
    </div>
  );
}

/**
 * Renders inline review finding banners for a DynamicTable or other non-field-component UI block.
 * Shows findings whose fieldHint starts with the given prefix (e.g. "bankDeposits", "vehicles").
 * Place this directly above the table it describes.
 */
export function FindingsBanner({ findings, prefix }: { findings?: ReviewFinding[]; prefix: string }) {
  const matching = findings?.filter((f) => f.fieldHint?.startsWith(prefix)) ?? [];
  if (matching.length === 0) return null;
  return (
    <div className="space-y-2">
      {matching.map((f, i) => (
        <SeverityCard key={i} severity={f.severity}>
          <div className="flex items-start gap-2">
            <SeverityIcon severity={f.severity} className="shrink-0 mt-0.5" />
            <p className="text-sm">{f.message}</p>
          </div>
        </SeverityCard>
      ))}
    </div>
  );
}
