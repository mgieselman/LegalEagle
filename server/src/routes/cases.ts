import { Router, Request, Response } from 'express';
import { eq, and, isNull } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import db from '../db';
import { cases, clients, questionnaires } from '../db/schema';
import { getLawFirmId, requireStaff, verifyCaseAccess } from '../auth/middleware';
import { validateBody } from '../middleware/validate';
import { createCaseSchema, updateCaseSchema } from '../validation/cases.schema';
import { listDocuments, getDocument } from '../services/documents';
import { getLatestExtraction } from '../services/extractionResults';
import { listCaseValidations } from '../services/validationResults';
import { buildAutofillPatch, type ExtractionInput } from '../services/autofill/questionnaireMapper';
import type { ExtractionData } from '../services/extraction/schemas';
import { getBlobStorage } from '../storage';
import { processDocument } from '../services/pipeline';
import type { ProcessingResult } from '../services/pipeline';
import { paramId } from '../utils/params';

const router = Router();

/**
 * Compute document and questionnaire completion for a case.
 * Returns format like "3/5 docs, 18/27 sections"
 */
function computeCaseProgress(caseId: string, firmId: string): { docs: string; sections: string; } {
  // Document progress: count reviewed/accepted documents
  const docs = listDocuments(caseId, firmId);
  const acceptedDocs = docs.filter(d => d.processingStatus === 'reviewed').length;
  const totalDocs = docs.length;

  // Questionnaire progress: count non-empty sections
  const questionnaire = db
    .select({ data: questionnaires.data })
    .from(questionnaires)
    .where(and(eq(questionnaires.caseId, caseId), isNull(questionnaires.deletedAt)))
    .get();

  let filledSections = 0;
  const totalSections = 27; // Fixed number of sections

  if (questionnaire) {
    try {
      const data = JSON.parse(questionnaire.data) as Record<string, unknown>;
      // Count sections that have at least one non-empty string or non-empty array field
      filledSections = Object.keys(data).filter(key => {
        const value = data[key];
        if (typeof value === 'string') return value.trim() !== '';
        if (Array.isArray(value)) return value.length > 0;
        if (typeof value === 'object' && value !== null) {
          return Object.values(value as Record<string, unknown>).some(subValue => {
            if (typeof subValue === 'string') return subValue.trim() !== '';
            if (Array.isArray(subValue)) return subValue.length > 0;
            return subValue != null;
          });
        }
        return value != null;
      }).length;
    } catch {
      // Invalid JSON, consider 0 sections filled
    }
  }

  return {
    docs: `${acceptedDocs}/${totalDocs}`,
    sections: `${filledSections}/${totalSections}`,
  };
}

/**
 * Compute attention count for a case (items needing staff review).
 * Returns { count, hasErrors }
 */
function computeCaseAttention(caseId: string, firmId: string): { count: number; hasErrors: boolean; } {
  // Documents needing review
  const docs = listDocuments(caseId, firmId);
  const needsReview = docs.filter(d => d.processingStatus === 'needs_review' || d.processingStatus === 'extracted').length;

  // Non-dismissed validation warnings
  const validations = listCaseValidations(caseId, firmId);
  const activeValidations = validations.filter(v => !v.isDismissed);
  const errorValidations = activeValidations.filter(v => v.severity === 'error');

  return {
    count: needsReview + activeValidations.length,
    hasErrors: errorValidations.length > 0,
  };
}

// GET /api/cases — list cases for the tenant, optionally filtered by clientId
router.get('/', requireStaff, (req: Request, res: Response) => {
  const firmId = getLawFirmId(req);
  const clientId = typeof req.query.clientId === 'string' ? req.query.clientId : undefined;
  const expand = typeof req.query.expand === 'string' ? req.query.expand.split(',') : [];
  const includeProgress = expand.includes('progress');
  const includeAttention = expand.includes('attention');

  const conditions = [eq(cases.lawFirmId, firmId), isNull(cases.deletedAt)];
  if (clientId) {
    conditions.push(eq(cases.clientId, clientId));
  }

  const rows = db
    .select({
      id: cases.id,
      clientId: cases.clientId,
      clientFirstName: clients.firstName,
      clientLastName: clients.lastName,
      chapter: cases.chapter,
      status: cases.status,
      filingDate: cases.filingDate,
      createdAt: cases.createdAt,
    })
    .from(cases)
    .innerJoin(clients, eq(cases.clientId, clients.id))
    .where(and(...conditions))
    .all();

  // Optionally add progress and attention data
  const results = rows.map(row => {
    const result: Record<string, unknown> = { ...row };
    
    if (includeProgress) {
      result.progress = computeCaseProgress(row.id, firmId);
    }
    
    if (includeAttention) {
      result.attention = computeCaseAttention(row.id, firmId);
    }
    
    return result;
  });

  res.json(results);
});

// GET /api/cases/:id — get a specific case with its questionnaire
router.get('/:id', requireStaff, (req: Request, res: Response) => {
  const firmId = getLawFirmId(req);
  const caseId = paramId(req);

  const caseRow = db
    .select()
    .from(cases)
    .where(and(eq(cases.id, caseId), eq(cases.lawFirmId, firmId), isNull(cases.deletedAt)))
    .get();

  if (!caseRow) {
    res.status(404).json({ error: 'Case not found' });
    return;
  }

  const questionnaire = db
    .select()
    .from(questionnaires)
    .where(and(eq(questionnaires.caseId, caseId), isNull(questionnaires.deletedAt)))
    .get();

  const client = db
    .select()
    .from(clients)
    .where(eq(clients.id, caseRow.clientId))
    .get();

  res.json({
    ...caseRow,
    client,
    questionnaire: questionnaire
      ? { ...questionnaire, data: JSON.parse(questionnaire.data) }
      : null,
  });
});

// POST /api/cases — create a new case for an existing client
router.post('/', requireStaff, validateBody(createCaseSchema), (req: Request, res: Response) => {
  const firmId = getLawFirmId(req);
  const { clientId, chapter, filingDistrict, isJointFiling, householdSize } = req.body;
  const now = new Date().toISOString();

  // Verify client belongs to this firm
  const client = db
    .select()
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.lawFirmId, firmId), isNull(clients.deletedAt)))
    .get();

  if (!client) {
    res.status(404).json({ error: 'Client not found' });
    return;
  }

  const caseId = uuidv4();
  const questId = uuidv4();

  db.insert(cases)
    .values({
      id: caseId,
      clientId,
      lawFirmId: firmId,
      chapter,
      status: 'intake',
      filingDistrict: filingDistrict || '',
      isJointFiling: isJointFiling || false,
      householdSize: householdSize || 1,
      createdAt: now,
    })
    .run();

  // Create an empty questionnaire for the case
  db.insert(questionnaires)
    .values({
      id: questId,
      caseId,
      lawFirmId: firmId,
      name: `${client.firstName} ${client.lastName}`,
      data: '{}',
      createdAt: now,
      updatedAt: now,
    })
    .run();

  res.status(201).json({ id: caseId, questionnaireId: questId });
});

// PUT /api/cases/:id — update case details
router.put('/:id', requireStaff, validateBody(updateCaseSchema), (req: Request, res: Response) => {
  const firmId = getLawFirmId(req);
  const caseId = paramId(req);

  const existing = db
    .select()
    .from(cases)
    .where(and(eq(cases.id, caseId), eq(cases.lawFirmId, firmId), isNull(cases.deletedAt)))
    .get();

  if (!existing) {
    res.status(404).json({ error: 'Case not found' });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (req.body.chapter) updates.chapter = req.body.chapter;
  if (req.body.status) updates.status = req.body.status;
  if (req.body.filingDate !== undefined) updates.filingDate = req.body.filingDate;
  if (req.body.filingDistrict !== undefined) updates.filingDistrict = req.body.filingDistrict;
  if (req.body.isJointFiling !== undefined) updates.isJointFiling = req.body.isJointFiling;
  if (req.body.householdSize !== undefined) updates.householdSize = req.body.householdSize;

  if (Object.keys(updates).length > 0) {
    db.update(cases)
      .set(updates)
      .where(eq(cases.id, caseId))
      .run();
  }

  res.json({ id: caseId });
});

// POST /api/cases/:id/autofill — map accepted extraction results to a questionnaire patch
router.post('/:id/autofill', (req: Request, res: Response) => {
  const caseId = paramId(req);
  if (!verifyCaseAccess(req, res, caseId)) return;

  const firmId = getLawFirmId(req);

  const docs = listDocuments(caseId, firmId);
  const inputs: ExtractionInput[] = [];

  for (const doc of docs) {
    const extraction = getLatestExtraction(doc.id, firmId);
    if (!extraction) continue;

    let parsed: { data: ExtractionData; fieldConfidences: Record<string, number> };
    try {
      parsed = JSON.parse(extraction.extractedData) as typeof parsed;
    } catch {
      continue; // Skip documents with corrupt extraction data
    }

    inputs.push({
      documentId: doc.id,
      docClass: doc.docClass,
      data: parsed.data,
      fieldConfidences: parsed.fieldConfidences ?? {},
      belongsTo: doc.belongsTo,
    });
  }

  res.json(buildAutofillPatch(inputs));
});

// POST /api/cases/:id/questionnaire/autofill — build patch AND merge into the questionnaire (server-side)
router.post('/:id/questionnaire/autofill', (req: Request, res: Response) => {
  const caseId = paramId(req);
  if (!verifyCaseAccess(req, res, caseId)) return;

  const firmId = getLawFirmId(req);

  // 1. Load questionnaire
  const questionnaire = db
    .select()
    .from(questionnaires)
    .where(and(eq(questionnaires.caseId, caseId), isNull(questionnaires.deletedAt)))
    .get();

  if (!questionnaire) {
    res.status(404).json({ error: 'Questionnaire not found' });
    return;
  }

  // 2. Build autofill patch from documents
  const docs = listDocuments(caseId, firmId);
  const inputs: ExtractionInput[] = [];

  for (const doc of docs) {
    const extraction = getLatestExtraction(doc.id, firmId);
    if (!extraction) continue;

    let parsed: { data: ExtractionData; fieldConfidences: Record<string, number> };
    try {
      parsed = JSON.parse(extraction.extractedData) as typeof parsed;
    } catch {
      continue; // Skip documents with corrupt extraction data
    }

    inputs.push({
      documentId: doc.id,
      docClass: doc.docClass,
      data: parsed.data,
      fieldConfidences: parsed.fieldConfidences ?? {},
      belongsTo: doc.belongsTo,
    });
  }

  const patch = buildAutofillPatch(inputs);

  // 3. Merge patch into questionnaire data (only fill empty fields)
  let qData: Record<string, unknown>;
  try {
    qData = JSON.parse(questionnaire.data) as Record<string, unknown>;
  } catch {
    res.status(500).json({ error: 'Corrupt questionnaire data' });
    return;
  }
  const filledFields: string[] = [];

  for (const [path, value] of Object.entries(patch.fields)) {
    const keys = path.split('.');
    let obj: Record<string, unknown> = qData;
    let skip = false;

    // Traverse to parent
    for (let i = 0; i < keys.length - 1; i++) {
      if (typeof obj[keys[i]] !== 'object' || obj[keys[i]] === null) {
        obj[keys[i]] = {};
      }
      obj = obj[keys[i]] as Record<string, unknown>;
    }

    const lastKey = keys[keys.length - 1];
    const existing = obj[lastKey];

    // Skip non-empty fields
    if (Array.isArray(existing) && existing.length > 0) skip = true;
    if (typeof existing === 'string' && existing.trim() !== '') skip = true;

    if (!skip) {
      if (
        typeof value === 'object' && value !== null && !Array.isArray(value) &&
        typeof existing === 'object' && existing !== null && !Array.isArray(existing)
      ) {
        obj[lastKey] = { ...existing as Record<string, unknown>, ...value as Record<string, unknown> };
      } else {
        obj[lastKey] = value;
      }
      filledFields.push(path);
    }
  }

  // 4. Build metadata for autofilled fields
  let qMetadata: Record<string, unknown>;
  try {
    qMetadata = questionnaire.metadata ? JSON.parse(questionnaire.metadata as string) : {};
  } catch {
    qMetadata = {};
  }
  
  if (!qMetadata.autofillSources) {
    qMetadata.autofillSources = {};
  }
  
  // Record autofill sources for filled fields
  const autofillSources = qMetadata.autofillSources as Record<string, unknown>;
  for (const filledPath of filledFields) {
    if (patch.sources[filledPath]) {
      autofillSources[filledPath] = patch.sources[filledPath];
    }
  }

  // 5. Save updated questionnaire with metadata
  db.update(questionnaires)
    .set({ 
      data: JSON.stringify(qData), 
      metadata: JSON.stringify(qMetadata),
      updatedAt: new Date().toISOString() 
    })
    .where(eq(questionnaires.id, questionnaire.id))
    .run();

  res.json({ filledFields, skippedFields: Object.keys(patch.fields).filter((f) => !filledFields.includes(f)) });
});

// POST /api/cases/:id/process-documents — process all uploaded (unprocessed) docs in a case
router.post('/:id/process-documents', async (req: Request, res: Response) => {
  const caseId = paramId(req);
  if (!verifyCaseAccess(req, res, caseId)) return;

  const firmId = getLawFirmId(req);

  const docs = listDocuments(caseId, firmId).filter((d) => d.processingStatus === 'uploaded');

  const storage = getBlobStorage();
  const results: Array<{ documentId: string; filename: string; result: ProcessingResult | null; error?: string }> = [];

  for (const doc of docs) {
    try {
      const fullDoc = getDocument(doc.id, firmId);
      if (!fullDoc) continue;
      const content = await storage.download(fullDoc.blobPath);
      const result = await processDocument(doc.id, content, fullDoc.originalFilename, fullDoc.mimeType, caseId, firmId);
      results.push({ documentId: doc.id, filename: doc.originalFilename, result });
    } catch (err) {
      results.push({
        documentId: doc.id,
        filename: doc.originalFilename,
        result: null,
        error: err instanceof Error ? err.message : 'Processing failed',
      });
    }
  }

  res.json({ processed: results.length, results });
});

// GET /api/cases/:id/review-summary — aggregate review data for the Review tab
router.get('/:id/review-summary', requireStaff, (req: Request, res: Response) => {
  const firmId = getLawFirmId(req);
  const caseId = paramId(req);

  // Verify case exists and belongs to this firm
  const caseRow = db
    .select()
    .from(cases)
    .where(and(eq(cases.id, caseId), eq(cases.lawFirmId, firmId), isNull(cases.deletedAt)))
    .get();

  if (!caseRow) {
    res.status(404).json({ error: 'Case not found' });
    return;
  }

  // 1. Documents needing review (extracted or needs_review status)
  const docs = listDocuments(caseId, firmId);
  const extractionQueue = docs
    .filter((d) => d.processingStatus === 'extracted' || d.processingStatus === 'needs_review')
    .map((d) => ({
      id: d.id,
      originalFilename: d.originalFilename,
      docClass: d.docClass,
      processingStatus: d.processingStatus,
      classificationConfidence: d.classificationConfidence,
      createdAt: d.createdAt,
    }));

  // 2. Non-dismissed validation warnings
  const allValidations = listCaseValidations(caseId, firmId);
  const validationWarnings = allValidations.filter((v) => !v.isDismissed);

  res.json({
    extractionQueue,
    validationWarnings,
    counts: {
      extraction: extractionQueue.length,
      validation: validationWarnings.length,
    },
  });
});

// DELETE /api/cases/:id — soft delete
router.delete('/:id', requireStaff, (req: Request, res: Response) => {
  const firmId = getLawFirmId(req);
  const caseId = paramId(req);

  const existing = db
    .select()
    .from(cases)
    .where(and(eq(cases.id, caseId), eq(cases.lawFirmId, firmId), isNull(cases.deletedAt)))
    .get();

  if (!existing) {
    res.status(404).json({ error: 'Case not found' });
    return;
  }

  const now = new Date().toISOString();
  db.update(cases)
    .set({ deletedAt: now })
    .where(eq(cases.id, caseId))
    .run();

  res.json({ success: true });
});

export default router;
