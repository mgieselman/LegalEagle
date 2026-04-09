export interface ValidationFinding {
  validationType: 'internal_consistency' | 'cross_document' | 'temporal_gap' | 'questionnaire_mismatch';
  severity: 'error' | 'warning' | 'info';
  message: string;
  detailsJson?: string;
  documentId?: string;
}
