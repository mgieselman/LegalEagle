export interface ExtractionOutput {
  data: Record<string, unknown>;
  confidence: number;
  fieldConfidences: Record<string, number>;
  warnings: string[];
}
