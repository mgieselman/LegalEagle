/**
 * Backward compatibility tests — verifies that the Drizzle-based db.ts
 * exports the same interface (now with tenant scoping).
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const TEST_DB_PATH = path.join(__dirname, '../../data/test-compat.db');
process.env.DATABASE_PATH = TEST_DB_PATH;

const TEST_FIRM_ID = 'firm-001';

describe('Forms Backward Compatibility (Drizzle + Tenant Scoping)', () => {
  let sqlite: InstanceType<typeof Database>;

  beforeAll(async () => {
    const dbDir = path.dirname(TEST_DB_PATH);
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
    try { fs.unlinkSync(TEST_DB_PATH); } catch { /* ignore */ }

    const { autoSeed } = await import('../services/autoSeed');
    autoSeed();
    sqlite = new Database(TEST_DB_PATH);
  });

  beforeEach(async () => {
    sqlite.exec('DELETE FROM questionnaires');
    const { createForm } = await import('../services/db');
    createForm('seed-1', 'Seed Form', JSON.stringify({ fullName: 'Seed User' }), TEST_FIRM_ID);
  });

  afterAll(() => {
    sqlite.close();
    try { fs.unlinkSync(TEST_DB_PATH); } catch { /* ignore */ }
    try { fs.unlinkSync(TEST_DB_PATH + '-wal'); } catch { /* ignore */ }
    try { fs.unlinkSync(TEST_DB_PATH + '-shm'); } catch { /* ignore */ }
  });

  it('should list forms scoped to tenant', async () => {
    const { listForms } = await import('../services/db');
    const forms = listForms(TEST_FIRM_ID);
    expect(forms.length).toBeGreaterThanOrEqual(1);
    expect(forms[0]).toHaveProperty('id');
    expect(forms[0]).toHaveProperty('name');
    expect(forms[0]).toHaveProperty('updated_at');
  });

  it('should not list forms from another tenant', async () => {
    const { listForms } = await import('../services/db');
    const forms = listForms('other-firm');
    expect(forms).toHaveLength(0);
  });

  it('should get a form by ID scoped to tenant', async () => {
    const { getForm } = await import('../services/db');
    const form = getForm('seed-1', TEST_FIRM_ID);
    expect(form).toBeDefined();
    expect(form!.name).toBe('Seed Form');
  });

  it('should not get a form from another tenant', async () => {
    const { getForm } = await import('../services/db');
    const form = getForm('seed-1', 'other-firm');
    expect(form).toBeUndefined();
  });

  it('should create a form for a tenant', async () => {
    const { createForm, getForm } = await import('../services/db');
    createForm('new-1', 'New Form', '{"test":true}', TEST_FIRM_ID);
    const form = getForm('new-1', TEST_FIRM_ID);
    expect(form).toBeDefined();
    expect(form!.name).toBe('New Form');
  });

  it('should update a form scoped to tenant', async () => {
    const { updateForm, getForm } = await import('../services/db');
    updateForm('seed-1', 'Updated', '{"updated":true}', TEST_FIRM_ID);
    const form = getForm('seed-1', TEST_FIRM_ID);
    expect(form!.name).toBe('Updated');
  });

  it('should soft-delete a form scoped to tenant', async () => {
    const { deleteForm, listForms } = await import('../services/db');
    deleteForm('seed-1', TEST_FIRM_ID);
    const forms = listForms(TEST_FIRM_ID);
    const found = forms.find((f) => f.id === 'seed-1');
    expect(found).toBeUndefined();
  });

  it('should store large JSON data', async () => {
    const { createForm, getForm } = await import('../services/db');
    const largeData = {
      unsecuredDebts: Array.from({ length: 50 }, (_, i) => ({
        creditorName: `Creditor ${i}`,
        creditorAddress: `${i} Main St`,
        accountNo: `ACC${i}`,
        amountOwed: `${(i + 1) * 100}`,
        dateOpened: '2020-01-01',
      })),
    };
    createForm('large-1', 'Large', JSON.stringify(largeData), TEST_FIRM_ID);
    const form = getForm('large-1', TEST_FIRM_ID);
    expect(form).toBeDefined();
    const parsed = JSON.parse(form!.data);
    expect(parsed.unsecuredDebts).toHaveLength(50);
  });
});
