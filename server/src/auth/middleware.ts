/**
 * Auth middleware — validates token from Authorization header and
 * attaches user identity to req.user.
 *
 * In dev mode (DevAuthProvider), requests without a token still get
 * the default admin user so the app works without login.
 */
import { Request, Response, NextFunction } from 'express';
import type { IAuthProvider, AuthUser } from './types';

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
