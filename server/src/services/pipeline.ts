/**
 * Document processing pipeline — orchestrates classify → extract → validate.
 * Runs synchronously after upload.
 *
 * When PYTHON_EXTRACTOR_URL is set, classification and extraction are delegated
 * to the Python service (extractor/). Otherwise the TypeScript pipeline runs.
 */
import { extractText, extractPdfContent } from './textExtraction';
import { classifyDocument } from './classification';
import { extractDocument } from './extraction';
import { tryRuleExtraction } from './extraction/ruleExtractors';
import { validateDocument, validateCase } from './validation';
import { updateProcessingStatus, updateClassification } from './documents';
import { type Document } from '../db/schema';
import { createExtractionResult } from './extractionResults';
import { createValidationResult, clearDocumentValidations } from './validationResults';
import { callPythonExtractor } from './pythonExtractor';

const AUTO_ACCEPT_THRESHOLD = 0.9;
const RULE_EXTRACTION_THRESHOLD = 0.85;

export interface ProcessingResult {
  docClass: string;
  classificationConfidence: number;
  classificationMethod: string;
  extractionConfidence: number | null;
  processingStatus: string;
  validationWarnings: number;
  needsReview: boolean;
  error?: string;
}

/**
 * Process a document through the full pipeline: classify → extract → validate.
 */
export async function processDocument(
  documentId: string,
  content: Buffer,
  filename: string,
  mimeType: string,
  caseId: string,
  lawFirmId: string,
): Promise<ProcessingResult> {
  try {
    // Step 1: Classify + Extract
    updateProcessingStatus(documentId, 'classifying', lawFirmId);

    // When the Python extractor service is configured, delegate the full
    // classify → extract pipeline to it. The TS pipeline runs as a fallback.
    let classificationInfo: { docClass: string; confidence: number; method: string };
    let extraction: {
      data: Record<string, unknown>;
      confidence: number;
      fieldConfidences: Record<string, number>;
      warnings: string[];
      extractionMethod: 'rule_engine' | 'ai_parse' | 'human_entry';
    };

    if (process.env.PYTHON_EXTRACTOR_URL) {
      const pythonResult = await callPythonExtractor(content, filename, mimeType);
      classificationInfo = {
        docClass: pythonResult.doc_class,
        confidence: pythonResult.classification_confidence,
        method: pythonResult.classification_method,
      };
      extraction = {
        data: pythonResult.data as Record<string, unknown>,
        confidence: pythonResult.confidence,
        fieldConfidences: pythonResult.field_confidences,
        warnings: pythonResult.warnings,
        extractionMethod: pythonResult.extraction_method as 'rule_engine' | 'ai_parse' | 'human_entry',
      };
    } else {
      // TypeScript pipeline
      let textContent: string;
      let pdfFormFields: Record<string, string> = {};
      if (mimeType === 'application/pdf') {
        const extracted = await extractPdfContent(content);
        textContent = extracted.text;
        pdfFormFields = extracted.formFields;
      } else {
        textContent = await extractText(content, mimeType);
      }

      const classification = await classifyDocument(filename, textContent);
      classificationInfo = {
        docClass: classification.docClass,
        confidence: classification.confidence,
        method: classification.method,
      };

      if (classification.docClass !== 'unclassified') {
        updateProcessingStatus(documentId, 'extracting', lawFirmId);
        const ruleResult = tryRuleExtraction(classification.docClass, textContent, pdfFormFields);
        if (ruleResult && ruleResult.confidence >= RULE_EXTRACTION_THRESHOLD) {
          extraction = {
            data: ruleResult.data as Record<string, unknown>,
            confidence: ruleResult.confidence,
            fieldConfidences: ruleResult.fieldConfidences,
            warnings: ruleResult.warnings,
            extractionMethod: 'rule_engine',
          };
        } else {
          const aiResult = await extractDocument(textContent, classification.docClass);
          extraction = { ...aiResult, data: aiResult.data as Record<string, unknown>, extractionMethod: 'ai_parse' };
        }
      } else {
        extraction = { data: {}, confidence: 0, fieldConfidences: {}, warnings: [], extractionMethod: 'rule_engine' };
      }
    }

    updateClassification(
      documentId,
      classificationInfo.docClass as Document['docClass'],
      classificationInfo.confidence,
      classificationInfo.method as 'rule_engine' | 'ai',
      lawFirmId,
    );

    // If unclassified, stop and request review
    if (classificationInfo.docClass === 'unclassified') {
      updateProcessingStatus(documentId, 'needs_review', lawFirmId);
      return {
        docClass: 'unclassified',
        classificationConfidence: classificationInfo.confidence,
        classificationMethod: classificationInfo.method,
        extractionConfidence: null,
        processingStatus: 'needs_review',
        validationWarnings: 0,
        needsReview: true,
      };
    }

    updateProcessingStatus(documentId, 'extracting', lawFirmId);

    // Determine extraction status based on confidence
    const extractionStatus = extraction.confidence >= AUTO_ACCEPT_THRESHOLD
      ? 'auto_accepted' as const
      : 'needs_review' as const;

    const documentStatus = extraction.confidence >= AUTO_ACCEPT_THRESHOLD
      ? 'extracted' as const
      : 'needs_review' as const;

    // Store extraction result
    createExtractionResult(
      {
        documentId,
        extractionMethod: extraction.extractionMethod,
        confidenceScore: extraction.confidence,
        extractedData: JSON.stringify({
          data: extraction.data,
          fieldConfidences: extraction.fieldConfidences,
          warnings: extraction.warnings,
        }),
        status: extractionStatus,
      },
      lawFirmId,
    );

    updateProcessingStatus(documentId, documentStatus, lawFirmId);

    // Step 3: Validate
    // Clear previous validations if re-processing
    clearDocumentValidations(documentId, lawFirmId);

    // Internal validation
    const internalFindings = validateDocument(
      classificationInfo.docClass,
      extraction.data,
      documentId,
    );

    // Cross-document + temporal validation
    const caseFindings = validateCase(caseId, lawFirmId);

    // Store all findings
    const allFindings = [...internalFindings, ...caseFindings];
    for (const finding of allFindings) {
      createValidationResult(
        {
          caseId,
          documentId: finding.documentId,
          validationType: finding.validationType,
          severity: finding.severity,
          message: finding.message,
          detailsJson: finding.detailsJson,
        },
        lawFirmId,
      );
    }

    return {
      docClass: classificationInfo.docClass,
      classificationConfidence: classificationInfo.confidence,
      classificationMethod: classificationInfo.method,
      extractionConfidence: extraction.confidence,
      processingStatus: documentStatus,
      validationWarnings: allFindings.filter((f) => f.severity === 'warning' || f.severity === 'error').length,
      needsReview: documentStatus === 'needs_review',
    };
  } catch (err) {
    updateProcessingStatus(documentId, 'failed', lawFirmId);
    return {
      docClass: 'unclassified',
      classificationConfidence: 0,
      classificationMethod: 'rule_engine',
      extractionConfidence: null,
      processingStatus: 'failed',
      validationWarnings: 0,
      needsReview: false,
      error: err instanceof Error ? err.message : 'Processing failed',
    };
  }
}
