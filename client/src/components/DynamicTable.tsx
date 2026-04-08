import { Button } from './ui/button';
import { Input } from './ui/input';
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
  rows,
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
        <div className="overflow-x-auto">
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
                      className="h-8 w-8 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Button variant="outline" size="sm" onClick={addRow} className="gap-1">
        <Plus className="h-4 w-4" /> Add Row
      </Button>
    </div>
  );
}
