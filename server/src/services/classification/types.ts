import { DOC_CLASS_VALUES } from '../../validation/documents.schema';

export type DocClass = typeof DOC_CLASS_VALUES[number];

export interface ClassificationResult {
  docClass: DocClass;
  confidence: number;
  method: 'rule_engine' | 'ai';
  reasoning?: string;
}
