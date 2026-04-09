import { Router, Request, Response } from 'express';
import { getForm } from '../services/db';
import { reviewForm } from '../services/reviewAgent';
import { getLawFirmId } from '../auth/middleware';

const router = Router();

router.post('/:id/review', async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const firmId = getLawFirmId(req);
  const form = getForm(id, firmId);
  if (!form) {
    res.status(404).json({ error: 'Form not found' });
    return;
  }

  try {
    const formData = JSON.parse(form.data);
    const findings = await reviewForm(formData);
    res.json({ findings });
  } catch (err) {
    console.error('Review error:', err instanceof Error ? err.message : err);
    res.status(500).json({
      error: 'Review failed',
      details: err instanceof Error ? err.message : String(err),
    });
  }
});

export default router;
