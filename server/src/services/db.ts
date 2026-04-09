/**
 * Database service — Drizzle ORM wrapper with tenant scoping.
 *
 * All query functions require a lawFirmId for tenant isolation.
 * Routes pass this from req.user.lawFirmId (set by auth middleware).
 */
import { eq, and, isNull, desc } from 'drizzle-orm';
import db from '../db';
import { questionnaires, cases } from '../db/schema';
import { generateId } from '../db/seed';

export interface FormRow {
  id: string;
  name: string;
  data: string;
  created_at: string;
  updated_at: string;
}

export interface FormSummary {
  id: string;
  name: string;
  updated_at: string;
}

/**
 * List all questionnaires for a tenant (non-deleted).
 */
export function listForms(lawFirmId: string): FormSummary[] {
  return db
    .select({
      id: questionnaires.id,
      name: questionnaires.name,
      updated_at: questionnaires.updatedAt,
    })
    .from(questionnaires)
    .where(and(eq(questionnaires.lawFirmId, lawFirmId), isNull(questionnaires.deletedAt)))
    .orderBy(desc(questionnaires.updatedAt))
    .all();
}

/**
 * Get a single questionnaire by ID, scoped to tenant.
 */
export function getForm(id: string, lawFirmId: string): FormRow | undefined {
  const row = db
    .select({
      id: questionnaires.id,
      name: questionnaires.name,
      data: questionnaires.data,
      created_at: questionnaires.createdAt,
      updated_at: questionnaires.updatedAt,
    })
    .from(questionnaires)
    .where(and(eq(questionnaires.id, id), eq(questionnaires.lawFirmId, lawFirmId)))
    .get();

  if (!row) return undefined;
  return row;
}

/**
 * Create a new questionnaire in the tenant's default case.
 */
export function createForm(id: string, name: string, data: string, lawFirmId: string): void {
  const now = new Date().toISOString();
  // Find first case for this firm (backward compat until case selection is added in Phase 4)
  const firstCase = db.select({ id: cases.id })
    .from(cases)
    .where(eq(cases.lawFirmId, lawFirmId))
    .limit(1)
    .get();
  const caseId = firstCase?.id || 'case-001';

  db.insert(questionnaires)
    .values({
      id,
      caseId,
      lawFirmId,
      name,
      data,
      createdAt: now,
      updatedAt: now,
    })
    .run();
}

/**
 * Update an existing questionnaire, scoped to tenant.
 */
export function updateForm(id: string, name: string, data: string, lawFirmId: string): void {
  const now = new Date().toISOString();
  db.update(questionnaires)
    .set({ name, data, updatedAt: now })
    .where(and(eq(questionnaires.id, id), eq(questionnaires.lawFirmId, lawFirmId)))
    .run();
}

/**
 * Soft-delete a questionnaire, scoped to tenant.
 */
export function deleteForm(id: string, lawFirmId: string): void {
  const now = new Date().toISOString();
  db.update(questionnaires)
    .set({ deletedAt: now })
    .where(and(eq(questionnaires.id, id), eq(questionnaires.lawFirmId, lawFirmId)))
    .run();
}

export { generateId };
export default db;
