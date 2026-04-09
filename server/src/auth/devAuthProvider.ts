/**
 * Dev auth provider — auto-authenticates requests for local development.
 *
 * Behavior:
 * - If no Authorization header: returns the default seeded admin user
 * - If Authorization header with "Bearer dev-{userId}": returns that user
 * - createStaffToken: accepts any email, returns a dev token
 * - createClientToken: accepts any email, returns a dev token
 */
import { eq, and, isNull } from 'drizzle-orm';
import db from '../db';
import { users, clients } from '../db/schema';
import { SEED_IDS } from '../db/seed';
import type { IAuthProvider, AuthUser, AuthClient, AuthIdentity } from './types';

export class DevAuthProvider implements IAuthProvider {
  async validateToken(token: string): Promise<AuthIdentity | null> {
    // dev-client-{clientId} tokens
    if (token.startsWith('dev-client-')) {
      const clientId = token.replace('dev-client-', '');
      return this.getClientIdentity(clientId);
    }

    // dev-{userId} tokens
    if (token.startsWith('dev-')) {
      const userId = token.replace('dev-', '');
      return this.getUserIdentity(userId);
    }

    // Fallback: default admin
    return this.getUserIdentity(SEED_IDS.adminUser);
  }

  async createStaffToken(
    email: string,
    _password: string,
  ): Promise<{ token: string; user: AuthUser } | null> {
    const user = db
      .select()
      .from(users)
      .where(and(eq(users.email, email), isNull(users.deletedAt)))
      .get();

    if (!user) return null;

    const authUser: AuthUser = {
      userId: user.id,
      lawFirmId: user.lawFirmId,
      role: user.role as AuthUser['role'],
      name: user.name,
      email: user.email,
    };

    return { token: `dev-${user.id}`, user: authUser };
  }

  async createClientToken(
    email: string,
    _password: string,
  ): Promise<{ token: string; client: AuthClient } | null> {
    const client = db
      .select()
      .from(clients)
      .where(and(eq(clients.email, email), isNull(clients.deletedAt)))
      .get();

    if (!client) return null;

    const authClient: AuthClient = {
      clientId: client.id,
      lawFirmId: client.lawFirmId,
      role: 'client',
      name: `${client.firstName} ${client.lastName}`,
      email: client.email,
    };

    return { token: `dev-client-${client.id}`, client: authClient };
  }

  private getUserIdentity(userId: string): AuthUser | null {
    const user = db
      .select()
      .from(users)
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .get();

    if (!user) return null;

    return {
      userId: user.id,
      lawFirmId: user.lawFirmId,
      role: user.role as AuthUser['role'],
      name: user.name,
      email: user.email,
    };
  }

  private getClientIdentity(clientId: string): AuthClient | null {
    const client = db
      .select()
      .from(clients)
      .where(and(eq(clients.id, clientId), isNull(clients.deletedAt)))
      .get();

    if (!client) return null;

    return {
      clientId: client.id,
      lawFirmId: client.lawFirmId,
      role: 'client',
      name: `${client.firstName} ${client.lastName}`,
      email: client.email,
    };
  }
}
