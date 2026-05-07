import { reinitPool, closePool } from '../db/pool';
import { HttpError } from '../lib/http-error';
import { logger } from '../lib/logger';

/**
 * Authenticate against MySQL by attempting a `SELECT 1` with the supplied password.
 * On success the pool is initialized with that password for the rest of the session.
 *
 * This preserves the original tool's UX (sign in with your MySQL root password) while
 * fixing the security model: a real session, no module-level "logged" flag, and a real
 * connection pool instead of one shared connection.
 */
export class AuthService {
  async login(password: string): Promise<void> {
    const pool = await reinitPool(password);
    try {
      await pool.query('SELECT 1');
    } catch (err) {
      await closePool();
      logger.warn({ err: (err as Error).message }, 'mysql auth failed');
      throw HttpError.unauthorized('invalid credentials');
    }
  }

  async logout(): Promise<void> {
    await closePool();
  }
}
