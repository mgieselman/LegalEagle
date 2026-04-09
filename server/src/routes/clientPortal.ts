/**
 * Client portal routes — endpoints for authenticated bankruptcy clients.
 * Clients can only see their own cases and questionnaires.
 */
import { Router, Request, Response } from 'express';
import { eq, and, isNull } from 'drizzle-orm';
import db from '../db';
import { cases, clients, questionnaires } from '../db/schema';

const router = Router();

function getClientId(req: Request): string | null {
  if (!req.user || req.user.role !== 'client') return null;
  return (req.user as { clientId: string }).clientId;
}

// GET /api/client-portal/cases — list cases for the authenticated client
router.get('/cases', (req: Request, res: Response) => {
  const clientId = getClientId(req);
  if (!clientId) {
    res.status(403).json({ error: 'Client access required' });
    return;
  }

  const rows = db
    .select({
      id: cases.id,
      chapter: cases.chapter,
      status: cases.status,
      filingDate: cases.filingDate,
      createdAt: cases.createdAt,
    })
    .from(cases)
    .where(and(eq(cases.clientId, clientId), isNull(cases.deletedAt)))
    .all();

  res.json(rows);
});

// GET /api/client-portal/cases/:id — get case detail (only if it belongs to the client)
router.get('/cases/:id', (req: Request, res: Response) => {
  const clientId = getClientId(req);
  if (!clientId) {
    res.status(403).json({ error: 'Client access required' });
    return;
  }

  const caseId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const caseRow = db
    .select()
    .from(cases)
    .where(and(eq(cases.id, caseId), eq(cases.clientId, clientId), isNull(cases.deletedAt)))
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
    .where(eq(clients.id, clientId))
    .get();

  res.json({
    ...caseRow,
    client,
    questionnaire: questionnaire
      ? { ...questionnaire, data: JSON.parse(questionnaire.data) }
      : null,
  });
});

export default router;
