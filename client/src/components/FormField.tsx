import { Input } from './ui/input';
import { Label } from './ui/label';

interface FormFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  className?: string;
}

export function FormField({ label, value, onChange, type = 'text', placeholder, className }: FormFieldProps) {
  return (
    <div className={className}>
      <Label className="mb-1 block">{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

interface YesNoFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function YesNoField({ label, value, onChange, className }: YesNoFieldProps) {
  return (
    <div className={`flex items-center gap-4 ${className || ''}`}>
      <span className="text-sm font-medium">{label}</span>
      <label className="flex items-center gap-2 cursor-pointer py-1 px-1">
        <input type="radio" name={label} checked={value === 'yes'} onChange={() => onChange('yes')} className="accent-primary h-4 w-4" />
        <span className="text-sm">Yes</span>
      </label>
      <label className="flex items-center gap-2 cursor-pointer py-1 px-1">
        <input type="radio" name={label} checked={value === 'no'} onChange={() => onChange('no')} className="accent-primary h-4 w-4" />
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
}

export function TextAreaField({ label, value, onChange, rows = 2, className }: TextAreaFieldProps) {
  return (
    <div className={className}>
      <Label className="mb-1 block">{label}</Label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-base md:text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
    </div>
  );
}
