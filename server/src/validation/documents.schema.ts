import { z } from 'zod/v4';

export const DOC_CLASS_VALUES = [
  'payStub.us', 'bankStatement.us.checking', 'bankStatement.us.savings', 'tax.us.1040',
  'ira_statement', '401k_statement', 'creditCard', 'payroll_export',
  'tax.us.w2', 'tax.us.1099', 'other', 'unclassified',
  'profit_loss_statement', 'retirement_account', 'collection_letter',
  'legal_document', 'vehicle_loan_statement', 'mortgage.us', 'social_security_letter',
  'idDocument', 'social_security_card', 'brokerage_statement', 'vehicle_title',
] as const;

export const ALLOWED_EXTENSIONS = ['.pdf', '.csv', '.xlsx', '.txt', '.jpg', '.jpeg', '.png', '.heic', '.webp'] as const;
export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB


/** Validated from multipart form fields (not the file itself — multer handles that). */
export const uploadDocumentMetaSchema = z.object({
  caseId: z.string().min(1, 'Case ID is required'),
  belongsTo: z.enum(['debtor', 'spouse']).default('debtor'),
  docClass: z.enum(DOC_CLASS_VALUES).optional(),
});

export type UploadDocumentMeta = z.infer<typeof uploadDocumentMetaSchema>;
