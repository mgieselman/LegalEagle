import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import path from 'path';
import multer from 'multer';
import { eq, and, isNull } from 'drizzle-orm';
import db from '../db';
import { cases } from '../db/schema';
import { getLawFirmId } from '../auth/middleware';
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
} from '../services/documents';
import { getBlobStorage } from '../storage';

const router = Router();

function paramId(req: Request): string {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] : id;
}

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
function handleMulterError(err: Error | null, req: Request, res: Response, next: () => void): void {
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
  const deleted = deleteDocument(id, lawFirmId);
  if (!deleted) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }
  res.json({ success: true });
});

export default router;
