import { Router, Request, Response } from 'express';
import { eq, and, isNull } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import db from '../db';
import { clients, cases, questionnaires } from '../db/schema';
import { getLawFirmId } from '../auth/middleware';
import { validateBody } from '../middleware/validate';
import { createClientSchema, updateClientSchema } from '../validation/clients.schema';

const router = Router();

// GET /api/clients — list all clients for the tenant
router.get('/', (req: Request, res: Response) => {
  const firmId = getLawFirmId(req);
  const rows = db
    .select()
    .from(clients)
    .where(and(eq(clients.lawFirmId, firmId), isNull(clients.deletedAt)))
    .all();
  res.json(rows);
});

// GET /api/clients/:id — get a specific client
router.get('/:id', (req: Request, res: Response) => {
  const firmId = getLawFirmId(req);
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const client = db
    .select()
    .from(clients)
    .where(and(eq(clients.id, id), eq(clients.lawFirmId, firmId), isNull(clients.deletedAt)))
    .get();
  if (!client) {
    res.status(404).json({ error: 'Client not found' });
    return;
  }
  res.json(client);
});

// POST /api/clients — create a new client (optionally with a case)
router.post('/', validateBody(createClientSchema), (req: Request, res: Response) => {
  const firmId = getLawFirmId(req);
  const { firstName, lastName, email, phone, spouseFirstName, spouseLastName, chapter } = req.body;
  const now = new Date().toISOString();
  const clientId = uuidv4();

  db.insert(clients)
    .values({
      id: clientId,
      lawFirmId: firmId,
      firstName,
      lastName,
      email: email || '',
      phone: phone || '',
      spouseFirstName: spouseFirstName || '',
      spouseLastName: spouseLastName || '',
      createdAt: now,
    })
    .run();

  let caseId: string | null = null;

  // If chapter is provided, create a case + empty questionnaire
  if (chapter) {
    caseId = uuidv4();
    const questId = uuidv4();

    db.insert(cases)
      .values({
        id: caseId,
        clientId,
        lawFirmId: firmId,
        chapter,
        status: 'intake',
        createdAt: now,
      })
      .run();

    db.insert(questionnaires)
      .values({
        id: questId,
        caseId,
        lawFirmId: firmId,
        name: `${firstName} ${lastName}`,
        data: '{}',
        createdAt: now,
        updatedAt: now,
      })
      .run();
  }

  res.status(201).json({ id: clientId, caseId });
});

// PUT /api/clients/:id — update a client
router.put('/:id', validateBody(updateClientSchema), (req: Request, res: Response) => {
  const firmId = getLawFirmId(req);
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const existing = db
    .select()
    .from(clients)
    .where(and(eq(clients.id, id), eq(clients.lawFirmId, firmId), isNull(clients.deletedAt)))
    .get();

  if (!existing) {
    res.status(404).json({ error: 'Client not found' });
    return;
  }

  const updates: Record<string, string> = {};
  if (req.body.firstName) updates.firstName = req.body.firstName;
  if (req.body.lastName) updates.lastName = req.body.lastName;
  if (req.body.email !== undefined) updates.email = req.body.email;
  if (req.body.phone !== undefined) updates.phone = req.body.phone;
  if (req.body.spouseFirstName !== undefined) updates.spouseFirstName = req.body.spouseFirstName;
  if (req.body.spouseLastName !== undefined) updates.spouseLastName = req.body.spouseLastName;

  if (Object.keys(updates).length > 0) {
    db.update(clients)
      .set(updates)
      .where(eq(clients.id, id))
      .run();
  }

  res.json({ id });
});

// DELETE /api/clients/:id — soft delete a client
router.delete('/:id', (req: Request, res: Response) => {
  const firmId = getLawFirmId(req);
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const existing = db
    .select()
    .from(clients)
    .where(and(eq(clients.id, id), eq(clients.lawFirmId, firmId), isNull(clients.deletedAt)))
    .get();

  if (!existing) {
    res.status(404).json({ error: 'Client not found' });
    return;
  }

  const now = new Date().toISOString();
  db.update(clients)
    .set({ deletedAt: now })
    .where(eq(clients.id, id))
    .run();

  res.json({ success: true });
});

export default router;
