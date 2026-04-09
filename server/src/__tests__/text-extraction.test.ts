import { describe, it, expect } from 'vitest';
import { extractText } from '../services/textExtraction';

describe('Text Extraction', () => {
  it('extracts text from plain text buffer', async () => {
    const buffer = Buffer.from('Hello World\nSecond line');
    const result = await extractText(buffer, 'text/plain');
    expect(result).toBe('Hello World\nSecond line');
  });

  it('extracts text from CSV buffer', async () => {
    const csv = 'Name,Amount\nJohn,1000\nJane,2000';
    const buffer = Buffer.from(csv);
    const result = await extractText(buffer, 'text/csv');
    expect(result).toContain('Name,Amount');
    expect(result).toContain('John,1000');
  });

  it('returns string for unknown mime types', async () => {
    const buffer = Buffer.from('some content');
    const result = await extractText(buffer, 'application/octet-stream');
    expect(result).toBe('some content');
  });
});
