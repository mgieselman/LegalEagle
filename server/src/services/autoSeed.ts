import db, { sqlite } from '../db';
import { lawFirms, users, clients, cases, questionnaires } from '../db/schema';
import {
  seedLawFirm,
  seedUsers,
  seedClients,
  seedCases,
  seedQuestionnaires,
} from '../db/seed';

function ensureTablesExist(): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS law_firms (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      deleted_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      law_firm_id TEXT NOT NULL REFERENCES law_firms(id),
      email TEXT NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL,
      deleted_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      law_firm_id TEXT NOT NULL REFERENCES law_firms(id),
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      password_hash TEXT NOT NULL DEFAULT '',
      spouse_first_name TEXT NOT NULL DEFAULT '',
      spouse_last_name TEXT NOT NULL DEFAULT '',
      deleted_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS cases (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL REFERENCES clients(id),
      law_firm_id TEXT NOT NULL REFERENCES law_firms(id),
      chapter TEXT NOT NULL DEFAULT '7',
      status TEXT NOT NULL DEFAULT 'intake',
      filing_date TEXT,
      filing_district TEXT NOT NULL DEFAULT '',
      is_joint_filing INTEGER NOT NULL DEFAULT 0,
      household_size INTEGER NOT NULL DEFAULT 1,
      deleted_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS questionnaires (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL REFERENCES cases(id),
      law_firm_id TEXT NOT NULL REFERENCES law_firms(id),
      name TEXT NOT NULL DEFAULT 'Untitled',
      data TEXT NOT NULL DEFAULT '{}',
      deleted_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL REFERENCES cases(id),
      law_firm_id TEXT NOT NULL REFERENCES law_firms(id),
      uploaded_by TEXT NOT NULL,
      original_filename TEXT NOT NULL,
      blob_path TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_size_bytes INTEGER NOT NULL,
      file_hash TEXT NOT NULL,
      doc_class TEXT,
      belongs_to TEXT NOT NULL DEFAULT 'debtor',
      processing_status TEXT NOT NULL DEFAULT 'uploaded',
      page_count INTEGER,
      upload_batch_id TEXT,
      deleted_at TEXT,
      created_at TEXT NOT NULL
    );
  `);
}

export function autoSeed(): void {
  ensureTablesExist();

  // Check if data already exists
  const existingFirms = db.select().from(lawFirms).all();
  if (existingFirms.length > 0) {
    return;
  }

  // Seed data in order (respecting FK constraints)
  db.insert(lawFirms).values(seedLawFirm).run();
  for (const user of seedUsers) {
    db.insert(users).values(user).run();
  }
  for (const client of seedClients) {
    db.insert(clients).values(client).run();
  }
  for (const caseData of seedCases) {
    db.insert(cases).values(caseData).run();
  }
  for (const questionnaire of seedQuestionnaires) {
    db.insert(questionnaires).values(questionnaire).run();
  }

  console.log(
    `Auto-seeded: 1 firm, ${seedUsers.length} users, ${seedClients.length} clients, ${seedCases.length} cases, ${seedQuestionnaires.length} questionnaires`,
  );
}
