import type { DocClass } from '../classification/types';
import type { ExtractionOutput } from './types';
import { extractWithAI } from './aiExtractor';

/**
 * Extract structured data from document text.
 * Currently AI-only; rule-based extractors (e.g., CSV parsing) can be added later.
 */
export async function extractDocument(
  textContent: string,
  docClass: DocClass,
): Promise<ExtractionOutput> {
  return extractWithAI(textContent, docClass);
}

export type { ExtractionOutput } from './types';
