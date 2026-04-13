/** Result type returned by all rule-based extractors. */
export interface RuleExtractionResult<T> {
  data: Partial<T>;
  fieldConfidences: Record<string, number>;
  warnings: string[];
  confidence: number;
}
