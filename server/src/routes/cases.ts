import { Router, Request, Response } from 'express';
import { eq, and, isNull } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import db from '../db';
import { cases, clients, questionnaires } from '../db/schema';
import { getLawFirmId } from '../auth/middleware';
import { validateBody } from '../middleware/validate';
import { createCaseSchema, updateCaseSchema } from '../validation/cases.schema';

const router = Router();

function paramId(req: Request): string {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] : id;
}

// GET /api/cases — list all cases for the tenant
router.get('/', (req: Request, res: Response) => {
  const firmId = getLawFirmId(req);

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
    .where(and(eq(cases.lawFirmId, firmId), isNull(cases.deletedAt)))
    .all();

  res.json(rows);
});

// GET /api/cases/:id — get a specific case with its questionnaire
router.get('/:id', (req: Request, res: Response) => {
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
router.post('/', validateBody(createCaseSchema), (req: Request, res: Response) => {
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
router.put('/:id', validateBody(updateCaseSchema), (req: Request, res: Response) => {
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

// DELETE /api/cases/:id — soft delete
router.delete('/:id', (req: Request, res: Response) => {
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
