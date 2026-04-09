import { Router, Request, Response } from 'express';
import { getForm } from '../services/db';
import { generatePdf } from '../services/pdfGenerator';
import { getLawFirmId } from '../auth/middleware';

const router = Router();

router.get('/:id/download', async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const firmId = getLawFirmId(req);
  const form = getForm(id, firmId);
  if (!form) {
    res.status(404).json({ error: 'Form not found' });
    return;
  }

  try {
    const formData = JSON.parse(form.data);
    const pdfBuffer = await generatePdf(formData);
    const filename = `BK_Questionnaire_${form.name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('PDF generation error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'PDF generation failed' });
  }
});

export default router;
