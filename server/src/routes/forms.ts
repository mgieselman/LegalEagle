import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { eq, and } from 'drizzle-orm';
import db from '../db';
import { questionnaires, cases } from '../db/schema';
import { listForms, getForm, createForm, updateForm, deleteForm } from '../services/db';
import { getLawFirmId } from '../auth/middleware';
import { validateBody } from '../middleware/validate';
import { createFormSchema, updateFormSchema } from '../validation/forms.schema';
import { paramId } from '../utils/params';

// Read-only case statuses (cannot be modified after filing)
const READ_ONLY_CASE_STATUSES = ['filed', 'discharged', 'dismissed', 'closed'] as const;

const router = Router();

// List all forms (tenant-scoped)
router.get('/', (req: Request, res: Response) => {
  const firmId = getLawFirmId(req);
  const forms = listForms(firmId);
  res.json(forms);
});

// Get a specific form (tenant-scoped)
router.get('/:id', (req: Request, res: Response) => {
  const id = paramId(req);
  const firmId = getLawFirmId(req);
  const form = getForm(id, firmId);
  if (!form) {
    res.status(404).json({ error: 'Form not found' });
    return;
  }
  res.json({
    ...form,
    data: JSON.parse(form.data),
    metadata: form.metadata ? JSON.parse(form.metadata as string) : { autofillSources: {} },
  });
});

// Create a new form (tenant-scoped, validated)
router.post('/', validateBody(createFormSchema), (req: Request, res: Response) => {
  const firmId = getLawFirmId(req);
  const id = uuidv4();
  const name = req.body.name || 'Untitled';
  const data = JSON.stringify(req.body.data || {});
  createForm(id, name, data, firmId);
  res.status(201).json({ id, name });
});

// Update a form (tenant-scoped, validated, with optimistic locking)
router.put('/:id', validateBody(updateFormSchema), (req: Request, res: Response) => {
  const id = paramId(req);
  const firmId = getLawFirmId(req);
  const existing = getForm(id, firmId);
  if (!existing) {
    res.status(404).json({ error: 'Form not found' });
    return;
  }

  // Check if associated case is filed (read-only protection)
  const questionnaire = db
    .select({ caseId: questionnaires.caseId })
    .from(questionnaires)
    .where(and(eq(questionnaires.id, id), eq(questionnaires.lawFirmId, firmId)))
    .get();

  if (questionnaire) {
    const caseRow = db
      .select({ status: cases.status })
      .from(cases)
      .where(and(eq(cases.id, questionnaire.caseId), eq(cases.lawFirmId, firmId)))
      .get();

    if (caseRow && READ_ONLY_CASE_STATUSES.includes(caseRow.status as typeof READ_ONLY_CASE_STATUSES[number])) {
      res.status(403).json({ 
        error: 'Form is read-only', 
        message: 'This questionnaire cannot be modified because the case has been filed.' 
      });
      return;
    }
  }

  const name = req.body.name || existing.name;
  const data = JSON.stringify(req.body.data || JSON.parse(existing.data));
  const metadata = req.body.metadata ? JSON.stringify(req.body.metadata) : undefined;
  
  // Check for If-Match header for optimistic locking
  const ifMatchHeader = req.headers['if-match'];
  let expectedVersion: number | undefined;
  if (ifMatchHeader && typeof ifMatchHeader === 'string') {
    expectedVersion = parseInt(ifMatchHeader, 10);
    if (isNaN(expectedVersion)) {
      res.status(400).json({ error: 'Invalid If-Match header' });
      return;
    }
  }

  const result = updateForm(id, name, data, firmId, expectedVersion, metadata);
  if (!result.success) {
    res.status(409).json({ 
      error: 'Version conflict', 
      currentVersion: result.version,
      message: 'Another user has modified this form. Please refresh and try again.'
    });
    return;
  }

  res.json({ id, name, version: result.version });
});

// Delete a form (tenant-scoped, soft delete)
router.delete('/:id', (req: Request, res: Response) => {
  const id = paramId(req);
  const firmId = getLawFirmId(req);
  const existing = getForm(id, firmId);
  if (!existing) {
    res.status(404).json({ error: 'Form not found' });
    return;
  }
  deleteForm(id, firmId);
  res.json({ success: true });
});

export default router;
