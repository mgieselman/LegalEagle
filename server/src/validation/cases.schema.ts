import { z } from 'zod/v4';

export const createCaseSchema = z.object({
  clientId: z.string().min(1, 'Client ID is required'),
  chapter: z.enum(['7', '13']).default('7'),
  filingDistrict: z.string().optional().default(''),
  isJointFiling: z.boolean().optional().default(false),
  householdSize: z.number().int().positive().optional().default(1),
});

export const updateCaseSchema = z.object({
  chapter: z.enum(['7', '13']).optional(),
  status: z
    .enum([
      'intake',
      'documents',
      'review',
      'ready_to_file',
      'filed',
      'discharged',
      'dismissed',
      'closed',
    ])
    .optional(),
  filingDate: z.string().optional(),
  filingDistrict: z.string().optional(),
  isJointFiling: z.boolean().optional(),
  householdSize: z.number().int().positive().optional(),
});

export type CreateCaseInput = z.infer<typeof createCaseSchema>;
export type UpdateCaseInput = z.infer<typeof updateCaseSchema>;
