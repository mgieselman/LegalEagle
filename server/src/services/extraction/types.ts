import type { ExtractionData } from './schemas';

export interface ExtractionOutput {
  data: ExtractionData;
  confidence: number;
  fieldConfidences: Record<string, number>;
  warnings: string[];
}
