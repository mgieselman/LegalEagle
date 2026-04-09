import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import Database, { Database as DatabaseType } from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const TEST_DB_PATH = path.join(__dirname, '../../data/test.db');

interface FormRow {
  id: string;
  name: string;
  data: string;
  created_at: string;
  updated_at: string;
}

interface FormSummary {
  id: string;
  name: string;
  updated_at: string;
}

describe('Forms CRUD', () => {
  let db: DatabaseType;
  let stmts: {
    listForms: ReturnType<DatabaseType['prepare']>;
    getForm: ReturnType<DatabaseType['prepare']>;
    createForm: ReturnType<DatabaseType['prepare']>;
    updateForm: ReturnType<DatabaseType['prepare']>;
    deleteForm: ReturnType<DatabaseType['prepare']>;
  };

  beforeAll(() => {
    const dbDir = path.dirname(TEST_DB_PATH);
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

    db = new Database(TEST_DB_PATH);
    db.exec(`
      CREATE TABLE IF NOT EXISTS forms (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL DEFAULT 'Untitled',
        data TEXT NOT NULL DEFAULT '{}',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    stmts = {
      listForms: db.prepare('SELECT id, name, updated_at FROM forms ORDER BY updated_at DESC'),
      getForm: db.prepare('SELECT * FROM forms WHERE id = ?'),
      createForm: db.prepare('INSERT INTO forms (id, name, data) VALUES (?, ?, ?)'),
      updateForm: db.prepare(
        'UPDATE forms SET name = ?, data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      ),
      deleteForm: db.prepare('DELETE FROM forms WHERE id = ?'),
    };
  });

  beforeEach(() => {
    db.exec('DELETE FROM forms');
  });

  afterAll(() => {
    db.close();
    try {
      fs.unlinkSync(TEST_DB_PATH);
    } catch {
      /* ignore */
    }
    try {
      fs.unlinkSync(TEST_DB_PATH + '-wal');
    } catch {
      /* ignore */
    }
    try {
      fs.unlinkSync(TEST_DB_PATH + '-shm');
    } catch {
      /* ignore */
    }
  });

  it('should create and retrieve a form', () => {
    stmts.createForm.run('test-id-1', 'John Doe', JSON.stringify({ fullName: 'John Doe' }));
    const form = stmts.getForm.get('test-id-1') as FormRow | undefined;
    expect(form).toBeDefined();
    expect(form!.name).toBe('John Doe');
    expect(JSON.parse(form!.data)).toEqual({ fullName: 'John Doe' });
  });

  it('should list all forms', () => {
    stmts.createForm.run('id-1', 'Alice', '{}');
    stmts.createForm.run('id-2', 'Bob', '{}');
    const forms = stmts.listForms.all() as FormSummary[];
    expect(forms).toHaveLength(2);
  });

  it('should update a form', () => {
    stmts.createForm.run('id-1', 'Original', '{"a":1}');
    stmts.updateForm.run('Updated', '{"a":2}', 'id-1');
    const form = stmts.getForm.get('id-1') as FormRow | undefined;
    expect(form!.name).toBe('Updated');
    expect(JSON.parse(form!.data)).toEqual({ a: 2 });
  });

  it('should delete a form', () => {
    stmts.createForm.run('id-1', 'ToDelete', '{}');
    expect(stmts.getForm.get('id-1')).toBeDefined();
    stmts.deleteForm.run('id-1');
    expect(stmts.getForm.get('id-1')).toBeUndefined();
  });

  it('should return undefined for nonexistent form', () => {
    expect(stmts.getForm.get('nonexistent')).toBeUndefined();
  });

  it('should handle empty data', () => {
    stmts.createForm.run('empty-id', 'Empty', '{}');
    const form = stmts.getForm.get('empty-id') as FormRow | undefined;
    expect(JSON.parse(form!.data)).toEqual({});
  });

  it('should store large JSON data', () => {
    const largeData = {
      unsecuredDebts: Array.from({ length: 50 }, (_, i) => ({
        creditorName: `Creditor ${i}`,
        creditorAddress: `${i} Main St`,
        accountNo: `ACC${i}`,
        amountOwed: `${(i + 1) * 100}`,
        dateOpened: '2020-01-01',
      })),
    };
    stmts.createForm.run('large-id', 'Large Form', JSON.stringify(largeData));
    const form = stmts.getForm.get('large-id') as FormRow | undefined;
    const parsed = JSON.parse(form!.data);
    expect(parsed.unsecuredDebts).toHaveLength(50);
  });
});
