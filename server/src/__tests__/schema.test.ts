import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq, isNull } from 'drizzle-orm';
import path from 'path';
import fs from 'fs';
import * as schema from '../db/schema';

const TEST_DB_PATH = path.join(__dirname, '../../data/test-schema.db');

describe('Drizzle Schema', () => {
  let sqlite: InstanceType<typeof Database>;
  let db: ReturnType<typeof drizzle>;

  beforeAll(() => {
    const dbDir = path.dirname(TEST_DB_PATH);
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

    sqlite = new Database(TEST_DB_PATH);
    sqlite.pragma('foreign_keys = ON');
    db = drizzle(sqlite, { schema });

    // Create tables
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS law_firms (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, address TEXT NOT NULL DEFAULT '',
        phone TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '',
        deleted_at TEXT, created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY, law_firm_id TEXT NOT NULL REFERENCES law_firms(id),
        email TEXT NOT NULL, name TEXT NOT NULL, password_hash TEXT NOT NULL DEFAULT '',
        role TEXT NOT NULL, deleted_at TEXT, created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS clients (
        id TEXT PRIMARY KEY, law_firm_id TEXT NOT NULL REFERENCES law_firms(id),
        first_name TEXT NOT NULL, last_name TEXT NOT NULL,
        email TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '',
        password_hash TEXT NOT NULL DEFAULT '',
        spouse_first_name TEXT NOT NULL DEFAULT '', spouse_last_name TEXT NOT NULL DEFAULT '',
        deleted_at TEXT, created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS cases (
        id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES clients(id),
        law_firm_id TEXT NOT NULL REFERENCES law_firms(id),
        chapter TEXT NOT NULL DEFAULT '7', status TEXT NOT NULL DEFAULT 'intake',
        filing_date TEXT, filing_district TEXT NOT NULL DEFAULT '',
        is_joint_filing INTEGER NOT NULL DEFAULT 0, household_size INTEGER NOT NULL DEFAULT 1,
        deleted_at TEXT, created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS questionnaires (
        id TEXT PRIMARY KEY, case_id TEXT NOT NULL REFERENCES cases(id),
        law_firm_id TEXT NOT NULL REFERENCES law_firms(id),
        name TEXT NOT NULL DEFAULT 'Untitled', data TEXT NOT NULL DEFAULT '{}',
        deleted_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
    `);
  });

  beforeEach(() => {
    // Clean all tables in reverse FK order
    sqlite.exec('DELETE FROM questionnaires');
    sqlite.exec('DELETE FROM cases');
    sqlite.exec('DELETE FROM clients');
    sqlite.exec('DELETE FROM users');
    sqlite.exec('DELETE FROM law_firms');
  });

  afterAll(() => {
    sqlite.close();
    try { fs.unlinkSync(TEST_DB_PATH); } catch { /* ignore */ }
    try { fs.unlinkSync(TEST_DB_PATH + '-wal'); } catch { /* ignore */ }
    try { fs.unlinkSync(TEST_DB_PATH + '-shm'); } catch { /* ignore */ }
  });

  const now = new Date().toISOString();

  function seedFirm() {
    db.insert(schema.lawFirms)
      .values({ id: 'firm-1', name: 'Test Firm', createdAt: now })
      .run();
  }

  function seedFirmAndUser() {
    seedFirm();
    db.insert(schema.users)
      .values({
        id: 'user-1',
        lawFirmId: 'firm-1',
        email: 'test@test.com',
        name: 'Test User',
        role: 'admin',
        createdAt: now,
      })
      .run();
  }

  function seedFullChain() {
    seedFirmAndUser();
    db.insert(schema.clients)
      .values({
        id: 'client-1',
        lawFirmId: 'firm-1',
        firstName: 'John',
        lastName: 'Doe',
        createdAt: now,
      })
      .run();
    db.insert(schema.cases)
      .values({
        id: 'case-1',
        clientId: 'client-1',
        lawFirmId: 'firm-1',
        createdAt: now,
      })
      .run();
    db.insert(schema.questionnaires)
      .values({
        id: 'quest-1',
        caseId: 'case-1',
        lawFirmId: 'firm-1',
        name: 'John Doe',
        data: '{"fullName":"John Doe"}',
        createdAt: now,
        updatedAt: now,
      })
      .run();
  }

  // ---- Law Firms ----
  it('should create and retrieve a law firm', () => {
    seedFirm();
    const firm = db.select().from(schema.lawFirms).where(eq(schema.lawFirms.id, 'firm-1')).get();
    expect(firm).toBeDefined();
    expect(firm!.name).toBe('Test Firm');
  });

  // ---- Users ----
  it('should create a user linked to a firm', () => {
    seedFirmAndUser();
    const user = db.select().from(schema.users).where(eq(schema.users.id, 'user-1')).get();
    expect(user).toBeDefined();
    expect(user!.lawFirmId).toBe('firm-1');
    expect(user!.role).toBe('admin');
  });

  // ---- Full chain ----
  it('should create full chain: firm → user → client → case → questionnaire', () => {
    seedFullChain();
    const quest = db
      .select()
      .from(schema.questionnaires)
      .where(eq(schema.questionnaires.id, 'quest-1'))
      .get();
    expect(quest).toBeDefined();
    expect(quest!.caseId).toBe('case-1');
    expect(quest!.lawFirmId).toBe('firm-1');
    expect(JSON.parse(quest!.data)).toEqual({ fullName: 'John Doe' });
  });

  // ---- Soft delete ----
  it('should soft delete by setting deleted_at', () => {
    seedFullChain();

    db.update(schema.questionnaires)
      .set({ deletedAt: now })
      .where(eq(schema.questionnaires.id, 'quest-1'))
      .run();

    // Still exists in DB
    const all = db.select().from(schema.questionnaires).all();
    expect(all).toHaveLength(1);
    expect(all[0].deletedAt).toBe(now);

    // Filtered out when checking for non-deleted
    const active = db
      .select()
      .from(schema.questionnaires)
      .where(isNull(schema.questionnaires.deletedAt))
      .all();
    expect(active).toHaveLength(0);
  });

  it('should soft delete a client without cascading to cases', () => {
    seedFullChain();

    db.update(schema.clients)
      .set({ deletedAt: now })
      .where(eq(schema.clients.id, 'client-1'))
      .run();

    // Case still exists (no cascade delete)
    const caseRow = db.select().from(schema.cases).where(eq(schema.cases.id, 'case-1')).get();
    expect(caseRow).toBeDefined();
  });

  // ---- FK constraints ----
  it('should reject a user with invalid law_firm_id', () => {
    expect(() => {
      db.insert(schema.users)
        .values({
          id: 'user-bad',
          lawFirmId: 'nonexistent-firm',
          email: 'bad@test.com',
          name: 'Bad User',
          role: 'admin',
          createdAt: now,
        })
        .run();
    }).toThrow();
  });

  it('should reject a case with invalid client_id', () => {
    seedFirm();
    expect(() => {
      db.insert(schema.cases)
        .values({
          id: 'case-bad',
          clientId: 'nonexistent-client',
          lawFirmId: 'firm-1',
          createdAt: now,
        })
        .run();
    }).toThrow();
  });

  // ---- Multiple records ----
  it('should support multiple clients per firm', () => {
    seedFirm();
    db.insert(schema.clients)
      .values({ id: 'c1', lawFirmId: 'firm-1', firstName: 'A', lastName: 'B', createdAt: now })
      .run();
    db.insert(schema.clients)
      .values({ id: 'c2', lawFirmId: 'firm-1', firstName: 'C', lastName: 'D', createdAt: now })
      .run();

    const allClients = db
      .select()
      .from(schema.clients)
      .where(eq(schema.clients.lawFirmId, 'firm-1'))
      .all();
    expect(allClients).toHaveLength(2);
  });

  it('should support multiple cases per client', () => {
    seedFirm();
    db.insert(schema.clients)
      .values({ id: 'c1', lawFirmId: 'firm-1', firstName: 'A', lastName: 'B', createdAt: now })
      .run();
    db.insert(schema.cases)
      .values({ id: 'case-a', clientId: 'c1', lawFirmId: 'firm-1', chapter: '7', createdAt: now })
      .run();
    db.insert(schema.cases)
      .values({ id: 'case-b', clientId: 'c1', lawFirmId: 'firm-1', chapter: '13', createdAt: now })
      .run();

    const allCases = db
      .select()
      .from(schema.cases)
      .where(eq(schema.cases.clientId, 'c1'))
      .all();
    expect(allCases).toHaveLength(2);
    expect(allCases.map((c) => c.chapter).sort()).toEqual(['13', '7']);
  });
});
