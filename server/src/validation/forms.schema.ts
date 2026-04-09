import { z } from 'zod/v4';
import { questionnaireDataSchema } from './questionnaire.schema';

/** POST /api/forms — create a new form */
export const createFormSchema = z.object({
  name: z.string().min(1, 'Form name is required').optional(),
  data: questionnaireDataSchema.partial().optional(),
});

/** PUT /api/forms/:id — update an existing form */
export const updateFormSchema = z.object({
  name: z.string().min(1).optional(),
  data: questionnaireDataSchema.partial().optional(),
});

export type CreateFormInput = z.infer<typeof createFormSchema>;
export type UpdateFormInput = z.infer<typeof updateFormSchema>;
