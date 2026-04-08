import Database, { Database as DatabaseType } from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../data/legaleagle.db');

// Ensure data directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db: DatabaseType = new Database(dbPath);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS forms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL DEFAULT 'Untitled',
    data TEXT NOT NULL DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

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

const stmts = {
  listForms: db.prepare('SELECT id, name, updated_at FROM forms ORDER BY updated_at DESC'),
  getForm: db.prepare('SELECT * FROM forms WHERE id = ?'),
  createForm: db.prepare('INSERT INTO forms (id, name, data) VALUES (?, ?, ?)'),
  updateForm: db.prepare('UPDATE forms SET name = ?, data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'),
  deleteForm: db.prepare('DELETE FROM forms WHERE id = ?'),
};

export function listForms(): FormSummary[] {
  return stmts.listForms.all() as FormSummary[];
}

export function getForm(id: string): FormRow | undefined {
  return stmts.getForm.get(id) as FormRow | undefined;
}

export function createForm(id: string, name: string, data: string): void {
  stmts.createForm.run(id, name, data);
}

export function updateForm(id: string, name: string, data: string): void {
  stmts.updateForm.run(name, data, id);
}

export function deleteForm(id: string): void {
  stmts.deleteForm.run(id);
}

export default db;
