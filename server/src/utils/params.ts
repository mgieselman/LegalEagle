import type { Request } from 'express';

/** Extract a route param as a single string (handles Express 5's string | string[] return). */
export function paramId(req: Request): string {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] : id;
}
