import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { listForms, getForm, createForm, updateForm, deleteForm } from '../services/db';
import { getLawFirmId } from '../auth/middleware';
import { validateBody } from '../middleware/validate';
import { createFormSchema, updateFormSchema } from '../validation/forms.schema';

const router = Router();

function paramId(req: Request): string {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] : id;
}

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

// Update a form (tenant-scoped, validated)
router.put('/:id', validateBody(updateFormSchema), (req: Request, res: Response) => {
  const id = paramId(req);
  const firmId = getLawFirmId(req);
  const existing = getForm(id, firmId);
  if (!existing) {
    res.status(404).json({ error: 'Form not found' });
    return;
  }
  const name = req.body.name || existing.name;
  const data = JSON.stringify(req.body.data || JSON.parse(existing.data));
  updateForm(id, name, data, firmId);
  res.json({ id, name });
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
