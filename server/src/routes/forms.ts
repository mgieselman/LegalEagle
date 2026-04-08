import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { listForms, getForm, createForm, updateForm, deleteForm } from '../services/db';

const router = Router();

function paramId(req: Request): string {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] : id;
}

// List all forms
router.get('/', (_req: Request, res: Response) => {
  const forms = listForms();
  res.json(forms);
});

// Get a specific form
router.get('/:id', (req: Request, res: Response) => {
  const id = paramId(req);
  const form = getForm(id);
  if (!form) {
    res.status(404).json({ error: 'Form not found' });
    return;
  }
  res.json({
    ...form,
    data: JSON.parse(form.data),
  });
});

// Create a new form
router.post('/', (req: Request, res: Response) => {
  const id = uuidv4();
  const name = req.body.name || 'Untitled';
  const data = JSON.stringify(req.body.data || {});
  createForm(id, name, data);
  res.status(201).json({ id, name });
});

// Update a form
router.put('/:id', (req: Request, res: Response) => {
  const id = paramId(req);
  const existing = getForm(id);
  if (!existing) {
    res.status(404).json({ error: 'Form not found' });
    return;
  }
  const name = req.body.name || existing.name;
  const data = JSON.stringify(req.body.data || JSON.parse(existing.data));
  updateForm(id, name, data);
  res.json({ id, name });
});

// Delete a form
router.delete('/:id', (req: Request, res: Response) => {
  const id = paramId(req);
  const existing = getForm(id);
  if (!existing) {
    res.status(404).json({ error: 'Form not found' });
    return;
  }
  deleteForm(id);
  res.json({ success: true });
});

export default router;
