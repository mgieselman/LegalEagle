/**
 * Text extraction from various file formats.
 * Used by classification and extraction services to get text content from uploaded files.
 */

export async function extractText(content: Buffer, mimeType: string): Promise<string> {
  switch (mimeType) {
    case 'text/plain':
    case 'text/csv':
      return content.toString('utf-8');

    case 'application/pdf':
      return extractPdfText(content);

    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      return content.toString('utf-8').replace(/[^\x20-\x7E\n\r\t]/g, ' ');

    default:
      return content.toString('utf-8');
  }
}

async function extractPdfText(content: Buffer): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

  const data = new Uint8Array(content);
  const doc = await pdfjsLib.getDocument({ data, useSystemFonts: true }).promise;
  const textParts: string[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .filter((item: Record<string, unknown>) => 'str' in item)
      .map((item: Record<string, unknown>) => String(item.str))
      .join(' ');
    textParts.push(pageText);
  }

  return textParts.join('\n\n');
}
