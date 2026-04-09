/**
 * Auth interfaces — all auth providers implement IAuthProvider.
 * This allows swapping DevAuthProvider for a real provider later.
 */

export interface AuthUser {
  userId: string;
  lawFirmId: string;
  role: 'paralegal' | 'attorney' | 'admin';
  name: string;
  email: string;
}

export interface AuthClient {
  clientId: string;
  lawFirmId: string;
  role: 'client';
  name: string;
  email: string;
}

export type AuthIdentity = AuthUser | AuthClient;

export interface IAuthProvider {
  /** Validate a token and return the user/client identity, or null if invalid */
  validateToken(token: string): Promise<AuthIdentity | null>;

  /** Create a token for a staff user login */
  createStaffToken(email: string, password: string): Promise<{ token: string; user: AuthUser } | null>;

  /** Create a token for a client login */
  createClientToken(email: string, password: string): Promise<{ token: string; client: AuthClient } | null>;
}
