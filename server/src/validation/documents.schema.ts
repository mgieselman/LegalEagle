import { z } from 'zod/v4';

export const DOC_CLASS_VALUES = [
  'paystub', 'bank_statement_checking', 'bank_statement_savings', 'tax_return',
  'ira_statement', '401k_statement', 'credit_card_statement', 'payroll_export',
  'w2', '1099', 'other', 'unclassified',
] as const;

export const ALLOWED_EXTENSIONS = ['.pdf', '.csv', '.xlsx', '.txt'] as const;
export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB


/** Validated from multipart form fields (not the file itself — multer handles that). */
export const uploadDocumentMetaSchema = z.object({
  caseId: z.string().min(1, 'Case ID is required'),
  belongsTo: z.enum(['debtor', 'spouse']).default('debtor'),
  docClass: z.enum(DOC_CLASS_VALUES).optional(),
});

export type UploadDocumentMeta = z.infer<typeof uploadDocumentMetaSchema>;
