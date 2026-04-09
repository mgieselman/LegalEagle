/**
 * Document processing pipeline — orchestrates classify → extract → validate.
 * Runs synchronously after upload.
 */
import { extractText } from './textExtraction';
import { classifyDocument } from './classification';
import { extractDocument } from './extraction';
import { validateDocument, validateCase } from './validation';
import { updateProcessingStatus, updateClassification } from './documents';
import { createExtractionResult } from './extractionResults';
import { createValidationResult, clearDocumentValidations } from './validationResults';

const AUTO_ACCEPT_THRESHOLD = 0.9;

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
    // Step 1: Classify
    updateProcessingStatus(documentId, 'classifying', lawFirmId);

    const textContent = await extractText(content, mimeType);
    const classification = await classifyDocument(filename, textContent);

    updateClassification(
      documentId,
      classification.docClass,
      classification.confidence,
      classification.method,
      lawFirmId,
    );

    // If unclassified, stop and request review
    if (classification.docClass === 'unclassified') {
      updateProcessingStatus(documentId, 'needs_review', lawFirmId);
      return {
        docClass: 'unclassified',
        classificationConfidence: classification.confidence,
        classificationMethod: classification.method,
        extractionConfidence: null,
        processingStatus: 'needs_review',
        validationWarnings: 0,
        needsReview: true,
      };
    }

    // Step 2: Extract
    updateProcessingStatus(documentId, 'extracting', lawFirmId);
    const extraction = await extractDocument(textContent, classification.docClass);

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
        extractionMethod: 'ai_parse',
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
      classification.docClass,
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
      docClass: classification.docClass,
      classificationConfidence: classification.confidence,
      classificationMethod: classification.method,
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
