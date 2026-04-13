import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import path from 'path';
import multer from 'multer';
import { eq, and, isNull } from 'drizzle-orm';
import db from '../db';
import { cases } from '../db/schema';
import { getLawFirmId, requireStaff, verifyCaseAccess } from '../auth/middleware';
import {
  uploadDocumentMetaSchema,
  ALLOWED_EXTENSIONS,
  MAX_FILE_SIZE,
} from '../validation/documents.schema';
import {
  createDocument,
  listDocuments,
  getDocument,
  deleteDocument,
  findDuplicateByHash,
  updateProcessingStatus,
} from '../services/documents';
import { checkDocumentQuality } from '../services/qualityCheck';
import { getBlobStorage } from '../storage';
import { processDocument } from '../services/pipeline';
import { getLatestExtraction, updateExtractionStatus, createCorrectedExtraction } from '../services/extractionResults';
import { listDocumentValidations, dismissValidation } from '../services/validationResults';
import { paramId } from '../utils/params';

const router = Router();

// Multer config: memory storage, file size + extension filtering
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext as typeof ALLOWED_EXTENSIONS[number])) {
      cb(new Error(`File type ${ext} not allowed. Accepted: ${ALLOWED_EXTENSIONS.join(', ')}`));
      return;
    }
    cb(null, true);
  },
});

// Wrapper to catch multer errors and return 400 instead of 500
function handleMulterError(err: Error | null, _req: Request, res: Response, next: () => void): void {
  if (err) {
    res.status(400).json({ error: err.message });
    return;
  }
  next();
}

// ---------------------------------------------------------------
// POST /api/documents/upload — upload a document
// ---------------------------------------------------------------
router.post('/upload', (req: Request, res: Response, next) => {
  upload.single('file')(req, res, (err) => handleMulterError(err as Error | null, req, res, () => next()));
}, async (req: Request, res: Response) => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'No file provided' });
      return;
    }

    // Validate metadata fields
    const metaResult = uploadDocumentMetaSchema.safeParse({
      caseId: req.body.caseId,
      belongsTo: req.body.belongsTo,
      docClass: req.body.docClass || undefined,
    });
    if (!metaResult.success) {
      res.status(400).json({ error: 'Invalid metadata', details: metaResult.error.issues });
      return;
    }
    const meta = metaResult.data;

    // Verify client has access to this case
    if (!verifyCaseAccess(req, res, meta.caseId)) return;

    const lawFirmId = getLawFirmId(req);

    // Verify case exists and belongs to tenant
    const caseRow = db
      .select()
      .from(cases)
      .where(and(eq(cases.id, meta.caseId), eq(cases.lawFirmId, lawFirmId), isNull(cases.deletedAt)))
      .get();
    if (!caseRow) {
      res.status(404).json({ error: 'Case not found' });
      return;
    }

    // Compute SHA-256 hash
    const fileHash = crypto.createHash('sha256').update(file.buffer).digest('hex');

    // Check for duplicate
    const existing = findDuplicateByHash(meta.caseId, fileHash, lawFirmId);
    if (existing) {
      res.status(409).json({
        error: 'Duplicate file',
        existingFilename: existing.originalFilename,
        existingId: existing.id,
      });
      return;
    }

    // Perform quality checks
    const existingDocuments = listDocuments(meta.caseId, lawFirmId);
    const qualityIssues = await checkDocumentQuality(
      file.buffer,
      file.originalname,
      file.mimetype,
      fileHash,
      existingDocuments.map(d => ({ originalFilename: d.originalFilename, fileHash: d.id })) // Use id as placeholder since we don't have fileHash in summary
    );

    // Block upload if there are error-level quality issues
    const errorIssues = qualityIssues.filter(issue => issue.severity === 'error');
    if (errorIssues.length > 0) {
      res.status(400).json({
        error: 'Document quality issues detected',
        issues: errorIssues,
      });
      return;
    }

    // Build blob path and upload
    const docId = uuidv4();
    const ext = path.extname(file.originalname).toLowerCase();
    const blobPath = `${lawFirmId}/${caseRow.clientId}/${meta.caseId}/originals/${docId}${ext}`;

    const storage = getBlobStorage();
    await storage.upload(blobPath, file.buffer, file.mimetype);

    // Insert DB record
    const userId = req.user && 'userId' in req.user ? req.user.userId : req.user && 'clientId' in req.user ? req.user.clientId : 'unknown';
    const doc = createDocument(
      {
        id: docId,
        caseId: meta.caseId,
        uploadedBy: userId,
        originalFilename: file.originalname,
        blobPath,
        mimeType: file.mimetype,
        fileSizeBytes: file.size,
        fileHash,
        docClass: meta.docClass,
        belongsTo: meta.belongsTo,
        qualityIssues, // Include all quality issues (warnings and errors)
      },
      lawFirmId,
    );

    res.status(201).json(doc);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed';
    res.status(500).json({ error: message });
  }
});

// ---------------------------------------------------------------
// GET /api/documents?caseId=X — list documents for a case
// ---------------------------------------------------------------
router.get('/', (req: Request, res: Response) => {
  const caseId = req.query.caseId;
  if (!caseId || typeof caseId !== 'string') {
    res.status(400).json({ error: 'caseId query parameter is required' });
    return;
  }

  // Verify client has access to this case
  if (!verifyCaseAccess(req, res, caseId)) return;

  const lawFirmId = getLawFirmId(req);
  const docs = listDocuments(caseId, lawFirmId);
  res.json(docs);
});

// ---------------------------------------------------------------
// GET /api/documents/:id/download — download a document
// ---------------------------------------------------------------
router.get('/:id/download', async (req: Request, res: Response) => {
  const id = paramId(req);
  const lawFirmId = getLawFirmId(req);
  const doc = getDocument(id, lawFirmId);
  if (!doc) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }

  const storage = getBlobStorage();
  const buffer = await storage.download(doc.blobPath);

  res.set('Content-Type', doc.mimeType);
  res.set('Content-Disposition', `attachment; filename="${doc.originalFilename}"`);
  res.send(buffer);
});

// ---------------------------------------------------------------
// DELETE /api/documents/:id — soft-delete a document
// ---------------------------------------------------------------
router.delete('/:id', (req: Request, res: Response) => {
  const id = paramId(req);
  const lawFirmId = getLawFirmId(req);
  const doc = getDocument(id, lawFirmId);
  if (!doc) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }
  // Verify client has access to this document's case
  if (!verifyCaseAccess(req, res, doc.caseId)) return;

  const deleted = deleteDocument(id, lawFirmId);
  if (!deleted) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }
  res.json({ success: true });
});

// ---------------------------------------------------------------
// GET /api/documents/:id/extraction — latest extraction result
// ---------------------------------------------------------------
router.get('/:id/extraction', requireStaff, (req: Request, res: Response) => {
  const id = paramId(req);
  const lawFirmId = getLawFirmId(req);
  const extraction = getLatestExtraction(id, lawFirmId);
  if (!extraction) {
    res.status(404).json({ error: 'No extraction found' });
    return;
  }
  // Parse the extractedData JSON for the response
  res.json({
    ...extraction,
    extractedData: JSON.parse(extraction.extractedData),
  });
});

// ---------------------------------------------------------------
// GET /api/documents/:id/validations — validation results
// ---------------------------------------------------------------
router.get('/:id/validations', requireStaff, (req: Request, res: Response) => {
  const id = paramId(req);
  const lawFirmId = getLawFirmId(req);
  const validations = listDocumentValidations(id, lawFirmId);
  res.json(validations);
});

// ---------------------------------------------------------------
// POST /api/documents/:id/extraction/accept — accept extraction
// ---------------------------------------------------------------
router.post('/:id/extraction/accept', requireStaff, (req: Request, res: Response) => {
  const id = paramId(req);
  const lawFirmId = getLawFirmId(req);
  const extraction = getLatestExtraction(id, lawFirmId);
  if (!extraction) {
    res.status(404).json({ error: 'No extraction found' });
    return;
  }
  const userId = req.user && 'userId' in req.user ? req.user.userId : 'unknown';
  updateExtractionStatus(extraction.id, 'reviewed_accepted', userId, null, lawFirmId);
  updateProcessingStatus(id, 'reviewed', lawFirmId);
  res.json({ success: true });
});

// ---------------------------------------------------------------
// POST /api/documents/:id/extraction/correct — submit corrections
// ---------------------------------------------------------------
router.post('/:id/extraction/correct', requireStaff, (req: Request, res: Response) => {
  const id = paramId(req);
  const lawFirmId = getLawFirmId(req);
  const { extractedData, notes } = req.body as { extractedData: Record<string, unknown>; notes?: string };
  if (!extractedData) {
    res.status(400).json({ error: 'extractedData is required' });
    return;
  }
  const userId = req.user && 'userId' in req.user ? req.user.userId : 'unknown';
  const corrected = createCorrectedExtraction(
    id,
    JSON.stringify(extractedData),
    userId,
    notes ?? '',
    lawFirmId,
  );

  updateProcessingStatus(id, 'reviewed', lawFirmId);
  res.json(corrected);
});

// ---------------------------------------------------------------
// POST /api/documents/:id/validations/:vid/dismiss — dismiss a validation
// ---------------------------------------------------------------
router.post('/:id/validations/:vid/dismiss', requireStaff, (req: Request, res: Response) => {
  const vid = Array.isArray(req.params.vid) ? req.params.vid[0] : req.params.vid;
  const lawFirmId = getLawFirmId(req);
  const userId = req.user && 'userId' in req.user ? req.user.userId : 'unknown';
  const dismissed = dismissValidation(vid, userId, lawFirmId);
  if (!dismissed) {
    res.status(404).json({ error: 'Validation not found' });
    return;
  }
  res.json({ success: true });
});

// ---------------------------------------------------------------
// POST /api/documents/:id/process — run (or re-run) the pipeline
// ---------------------------------------------------------------
async function handleProcessDocument(req: Request, res: Response): Promise<void> {
  const id = paramId(req);
  const lawFirmId = getLawFirmId(req);
  const doc = getDocument(id, lawFirmId);
  if (!doc) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }

  // Verify client has access to this document's case
  if (!verifyCaseAccess(req, res, doc.caseId)) return;

  const storage = getBlobStorage();
  const content = await storage.download(doc.blobPath);

  const result = await processDocument(
    id,
    content,
    doc.originalFilename,
    doc.mimeType,
    doc.caseId,
    lawFirmId,
  );

  res.json(result);
}

router.post('/:id/process', handleProcessDocument);
// Keep /reprocess as an alias for backwards compatibility
router.post('/:id/reprocess', handleProcessDocument);

export default router;
