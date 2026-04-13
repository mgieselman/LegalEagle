/**
 * Text extraction from various file formats.
 * Used by classification and extraction services to get text content from uploaded files.
 */

/**
 * Extract both text content and PDF form fields in a single pdfjs-dist pass.
 * Use this instead of calling extractText + extractPdfFormFields separately for PDFs —
 * it avoids loading and parsing the PDF document twice.
 */
export async function extractPdfContent(
  content: Buffer,
): Promise<{ text: string; formFields: Record<string, string> }> {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(content);
  const doc = await pdfjsLib.getDocument({ data, useSystemFonts: true }).promise;

  const textParts: string[] = [];
  const formFields: Record<string, string> = {};

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);

    // Text layer
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .filter((item: Record<string, unknown>) => 'str' in item)
      .map((item: Record<string, unknown>) => String(item.str))
      .join(' ');
    textParts.push(pageText);

    // Form fields (Widget annotations) — needed for W-2s whose values live here, not in text
    const annotations = await page.getAnnotations();
    for (const ann of annotations) {
      const annotation = ann as Record<string, unknown>;
      if (annotation.subtype === 'Widget' && annotation.fieldName) {
        const name = String(annotation.fieldName);
        const value = annotation.fieldValue !== undefined && annotation.fieldValue !== null
          ? String(annotation.fieldValue)
          : '';
        if (value !== '') formFields[name] = value;
      }
    }
  }

  return { text: textParts.join('\n\n'), formFields };
}

export async function extractText(content: Buffer, mimeType: string): Promise<string> {
  switch (mimeType) {
    case 'text/plain':
    case 'text/csv':
      return content.toString('utf-8');

    case 'application/pdf': {
      const { text } = await extractPdfContent(content);
      return text;
    }

    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      return content.toString('utf-8').replace(/[^\x20-\x7E\n\r\t]/g, ' ');

    default:
      return content.toString('utf-8');
  }
}
