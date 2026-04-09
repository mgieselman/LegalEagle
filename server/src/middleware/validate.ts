/**
 * Zod validation middleware — validates request body against a schema.
 * Returns 400 with structured errors if validation fails.
 */
import { Request, Response, NextFunction } from 'express';
import type { ZodType } from 'zod/v4';

export function validateBody(schema: ZodType) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: 'Validation failed',
        issues: result.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
      return;
    }
    req.body = result.data;
    next();
  };
}
