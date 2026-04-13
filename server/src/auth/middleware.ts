/**
 * Auth middleware — validates token from Authorization header and
 * attaches user identity to req.user.
 *
 * In dev mode (DevAuthProvider), requests without a token still get
 * the default admin user so the app works without login.
 */
import { Request, Response, NextFunction } from 'express';
import { eq, and, isNull } from 'drizzle-orm';
import type { IAuthProvider, AuthUser } from './types';
import db from '../db';
import { cases } from '../db/schema';

/**
 * Creates an auth middleware using the given provider.
 * Attaches req.user on success. Returns 401 on failure.
 */
export function createAuthMiddleware(provider: IAuthProvider) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';

    const identity = await provider.validateToken(token);
    if (!identity) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    req.user = identity;
    next();
  };
}

/**
 * Middleware that requires a staff role (paralegal, attorney, or admin).
 * Must be used after createAuthMiddleware.
 */
export function requireStaff(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || req.user.role === 'client') {
    res.status(403).json({ error: 'Forbidden: staff access required' });
    return;
  }
  next();
}

/**
 * Middleware that requires a specific staff role.
 */
export function requireRole(...roles: AuthUser['role'][]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || req.user.role === 'client' || !roles.includes(req.user.role)) {
      res.status(403).json({ error: `Forbidden: requires ${roles.join(' or ')} role` });
      return;
    }
    next();
  };
}

/**
 * Helper to get the lawFirmId from the authenticated user.
 * Works for both staff and client identities.
 */
export function getLawFirmId(req: Request): string {
  if (!req.user) throw new Error('No authenticated user on request');
  return req.user.lawFirmId;
}

/**
 * Verify that a client user owns the case. Staff users pass through.
 * Returns true if access is allowed, or sends an error response and returns false.
 */
export function verifyCaseAccess(req: Request, res: Response, caseId: string): boolean {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  // Staff can access any case in their firm
  if (req.user.role !== 'client') return true;

  // Client must own the case
  const clientId = 'clientId' in req.user ? req.user.clientId : null;
  if (!clientId) {
    res.status(403).json({ error: 'Forbidden' });
    return false;
  }
  const lawFirmId = getLawFirmId(req);
  const caseRow = db
    .select({ clientId: cases.clientId })
    .from(cases)
    .where(and(eq(cases.id, caseId), eq(cases.lawFirmId, lawFirmId), isNull(cases.deletedAt)))
    .get();

  if (!caseRow || caseRow.clientId !== clientId) {
    res.status(403).json({ error: 'Forbidden: you do not have access to this case' });
    return false;
  }
  return true;
}
