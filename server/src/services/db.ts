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
  metadata: string;
  version: number;
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
      metadata: questionnaires.metadata,
      version: questionnaires.version,
      created_at: questionnaires.createdAt,
      updated_at: questionnaires.updatedAt,
    })
    .from(questionnaires)
    .where(and(eq(questionnaires.id, id), eq(questionnaires.lawFirmId, lawFirmId)))
    .get();

  if (!row) return undefined;
  return {
    ...row,
    metadata: row.metadata as string,
  };
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
 * If expectedVersion is provided, returns false on version mismatch (optimistic locking).
 */
export function updateForm(
  id: string, 
  name: string, 
  data: string, 
  lawFirmId: string, 
  expectedVersion?: number,
  metadata?: string
): { success: boolean; version: number } {
  const now = new Date().toISOString();
  const updateData: any = { name, data, updatedAt: now };
  if (metadata !== undefined) {
    updateData.metadata = metadata;
  }

  if (expectedVersion !== undefined) {
    // Optimistic locking: only update if version matches
    updateData.version = expectedVersion + 1;
    const result = db.update(questionnaires)
      .set(updateData)
      .where(and(eq(questionnaires.id, id), eq(questionnaires.lawFirmId, lawFirmId), eq(questionnaires.version, expectedVersion)))
      .run();

    if (result.changes === 0) {
      // Version mismatch — fetch current version
      const current = db.select({ version: questionnaires.version })
        .from(questionnaires)
        .where(and(eq(questionnaires.id, id), eq(questionnaires.lawFirmId, lawFirmId)))
        .get();
      return { success: false, version: current?.version ?? 0 };
    }
    return { success: true, version: expectedVersion + 1 };
  }

  // No version check — always update
  const current = db.select({ version: questionnaires.version })
    .from(questionnaires)
    .where(and(eq(questionnaires.id, id), eq(questionnaires.lawFirmId, lawFirmId)))
    .get();
  const nextVersion = (current?.version ?? 0) + 1;
  updateData.version = nextVersion;

  db.update(questionnaires)
    .set(updateData)
    .where(and(eq(questionnaires.id, id), eq(questionnaires.lawFirmId, lawFirmId)))
    .run();
  return { success: true, version: nextVersion };
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
