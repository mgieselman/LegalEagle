import { z } from 'zod/v4';

export const createClientSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email().optional().default(''),
  phone: z.string().optional().default(''),
  spouseFirstName: z.string().optional().default(''),
  spouseLastName: z.string().optional().default(''),
  /** Optionally create a case at the same time */
  chapter: z.enum(['7', '13']).optional(),
});

export const updateClientSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  spouseFirstName: z.string().optional(),
  spouseLastName: z.string().optional(),
});

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
