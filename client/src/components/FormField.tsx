import { Input } from './ui/input';
import { Label } from './ui/label';
import { Wand2 } from 'lucide-react';
import type { AutofillSource } from '../types/questionnaire';

interface FormFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  className?: string;
  autofillSource?: AutofillSource;
  readOnly?: boolean;
}

export function FormField({ 
  label, 
  value, 
  onChange, 
  type = 'text', 
  placeholder, 
  className,
  autofillSource,
  readOnly = false
}: FormFieldProps) {
  const isAutofilled = !!autofillSource;
  
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
    </div>
  );
}

interface YesNoFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  readOnly?: boolean;
}

export function YesNoField({ label, value, onChange, className, readOnly = false }: YesNoFieldProps) {
  return (
    <div className={`flex items-center gap-4 ${className || ''}`}>
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
  );
}

interface TextAreaFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  className?: string;
  readOnly?: boolean;
}

export function TextAreaField({ label, value, onChange, rows = 2, className, readOnly = false }: TextAreaFieldProps) {
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
    </div>
  );
}
