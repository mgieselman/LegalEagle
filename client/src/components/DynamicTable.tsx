import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Plus, Trash2 } from 'lucide-react';

interface Column {
  key: string;
  label: string;
  type?: string;
  placeholder?: string;
}

interface DynamicTableProps<T extends Record<string, string>> {
  columns: Column[];
  rows: T[];
  onChange: (rows: T[]) => void;
  createEmpty: () => T;
}

export function DynamicTable<T extends Record<string, string>>({
  columns,
  rows = [] as unknown as T[],
  onChange,
  createEmpty,
}: DynamicTableProps<T>) {
  const addRow = () => onChange([...rows, createEmpty()]);
  const removeRow = (index: number) => onChange(rows.filter((_, i) => i !== index));
  const updateCell = (index: number, key: string, value: string) => {
    const updated = rows.map((row, i) =>
      i === index ? { ...row, [key]: value } : row
    );
    onChange(updated);
  };

  return (
    <div className="space-y-2">
      {rows.length > 0 && (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  {columns.map((col) => (
                    <th key={col.key} className="text-left font-medium p-2 text-muted-foreground">
                      {col.label}
                    </th>
                  ))}
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIdx) => (
                  <tr key={rowIdx} className="border-b">
                    {columns.map((col) => (
                      <td key={col.key} className="p-1">
                        <Input
                          type={col.type || 'text'}
                          value={row[col.key] || ''}
                          onChange={(e) => updateCell(rowIdx, col.key, e.target.value)}
                          placeholder={col.placeholder}
                          className="text-sm"
                        />
                      </td>
                    ))}
                    <td className="p-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeRow(rowIdx)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card layout */}
          <div className="md:hidden space-y-3">
            {rows.map((row, rowIdx) => (
              <div key={rowIdx} className="border rounded-lg p-3 space-y-2 bg-muted/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Entry {rowIdx + 1}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeRow(rowIdx)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                {columns.map((col) => (
                  <div key={col.key}>
                    <Label className="text-xs mb-1 block">{col.label}</Label>
                    <Input
                      type={col.type || 'text'}
                      value={row[col.key] || ''}
                      onChange={(e) => updateCell(rowIdx, col.key, e.target.value)}
                      placeholder={col.placeholder}
                      className="text-sm"
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
      <Button variant="outline" size="sm" onClick={addRow} className="gap-1">
        <Plus className="h-4 w-4" /> Add Row
      </Button>
    </div>
  );
}
