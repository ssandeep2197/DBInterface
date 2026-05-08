import type { ConnectionOptions } from '@dbi/shared';
import { registry } from '../db/registry';

/**
 * Authenticate by attempting a real connection with the provided credentials.
 * On success, the registry holds a pool keyed by `connectionId`; the session
 * stores only the id and a non-sensitive metadata snapshot, never the password.
 */
export class AuthService {
  async login(connectionId: string, opts: ConnectionOptions): Promise<void> {
    await registry.create(
      connectionId,
      {
        host: opts.host,
        port: opts.port,
        user: opts.user,
        database: opts.database || undefined,
        useTLS: opts.useTLS,
      },
      opts.password,
    );
  }

  async logout(connectionId: string): Promise<void> {
    await registry.destroy(connectionId);
  }
}
