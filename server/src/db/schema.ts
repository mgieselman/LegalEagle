import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// ============================================================
// Law Firms
// ============================================================
export const lawFirms = sqliteTable('law_firms', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  address: text('address').notNull().default(''),
  phone: text('phone').notNull().default(''),
  email: text('email').notNull().default(''),
  deletedAt: text('deleted_at'),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
});

// ============================================================
// Users (law firm staff: paralegal, attorney, admin)
// ============================================================
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  lawFirmId: text('law_firm_id')
    .notNull()
    .references(() => lawFirms.id),
  email: text('email').notNull(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull().default(''), // dev stub: empty
  role: text('role', { enum: ['paralegal', 'attorney', 'admin'] }).notNull(),
  deletedAt: text('deleted_at'),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
});

// ============================================================
// Clients (bankruptcy debtors)
// ============================================================
export const clients = sqliteTable('clients', {
  id: text('id').primaryKey(),
  lawFirmId: text('law_firm_id')
    .notNull()
    .references(() => lawFirms.id),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  email: text('email').notNull().default(''),
  phone: text('phone').notNull().default(''),
  passwordHash: text('password_hash').notNull().default(''), // for client portal auth
  // Spouse info (for joint filings)
  spouseFirstName: text('spouse_first_name').notNull().default(''),
  spouseLastName: text('spouse_last_name').notNull().default(''),
  deletedAt: text('deleted_at'),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
});

// ============================================================
// Cases (a client can have multiple bankruptcy filings)
// ============================================================
export const cases = sqliteTable('cases', {
  id: text('id').primaryKey(),
  clientId: text('client_id')
    .notNull()
    .references(() => clients.id),
  lawFirmId: text('law_firm_id')
    .notNull()
    .references(() => lawFirms.id), // denormalized for fast tenant queries
  chapter: text('chapter', { enum: ['7', '13'] }).notNull().default('7'),
  status: text('status', {
    enum: ['intake', 'documents', 'review', 'ready_to_file', 'filed', 'discharged', 'dismissed', 'closed'],
  })
    .notNull()
    .default('intake'),
  filingDate: text('filing_date'),
  filingDistrict: text('filing_district').notNull().default(''),
  isJointFiling: integer('is_joint_filing', { mode: 'boolean' }).notNull().default(false),
  householdSize: integer('household_size').notNull().default(1),
  deletedAt: text('deleted_at'),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
});

// ============================================================
// Questionnaires (one per case, stores the 27-section form data)
// ============================================================
export const questionnaires = sqliteTable('questionnaires', {
  id: text('id').primaryKey(),
  caseId: text('case_id')
    .notNull()
    .references(() => cases.id),
  lawFirmId: text('law_firm_id')
    .notNull()
    .references(() => lawFirms.id), // denormalized
  name: text('name').notNull().default('Untitled'),
  data: text('data').notNull().default('{}'), // JSON string of QuestionnaireData
  deletedAt: text('deleted_at'),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
  updatedAt: text('updated_at').notNull().default(new Date().toISOString()),
});

// ============================================================
// Documents (uploaded files per case)
// ============================================================
export const documents = sqliteTable('documents', {
  id: text('id').primaryKey(),
  caseId: text('case_id')
    .notNull()
    .references(() => cases.id),
  lawFirmId: text('law_firm_id')
    .notNull()
    .references(() => lawFirms.id),
  uploadedBy: text('uploaded_by').notNull(), // userId or clientId
  originalFilename: text('original_filename').notNull(),
  blobPath: text('blob_path').notNull(),
  mimeType: text('mime_type').notNull(),
  fileSizeBytes: integer('file_size_bytes').notNull(),
  fileHash: text('file_hash').notNull(), // SHA-256
  docClass: text('doc_class', {
    enum: [
      'paystub', 'bank_statement_checking', 'bank_statement_savings', 'tax_return',
      'ira_statement', '401k_statement', 'credit_card_statement', 'payroll_export',
      'w2', '1099', 'other', 'unclassified',
    ],
  }),
  belongsTo: text('belongs_to', { enum: ['debtor', 'spouse'] }).notNull().default('debtor'),
  processingStatus: text('processing_status', {
    enum: [
      'uploaded', 'classifying', 'splitting', 'extracting', 'extracted',
      'needs_review', 'reviewed', 'failed', 'replaced',
    ],
  }).notNull().default('uploaded'),
  pageCount: integer('page_count'),
  uploadBatchId: text('upload_batch_id'),
  deletedAt: text('deleted_at'),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
});

// ============================================================
// Type helpers for select results
// ============================================================
export type LawFirm = typeof lawFirms.$inferSelect;
export type User = typeof users.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type Case = typeof cases.$inferSelect;
export type Questionnaire = typeof questionnaires.$inferSelect;

export type NewLawFirm = typeof lawFirms.$inferInsert;
export type NewUser = typeof users.$inferInsert;
export type NewClient = typeof clients.$inferInsert;
export type NewCase = typeof cases.$inferInsert;
export type NewQuestionnaire = typeof questionnaires.$inferInsert;
export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
