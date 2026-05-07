import type { RowDataPacket } from 'mysql2/promise';
import { isSystemDatabase } from '@dbi/shared';
import { getPool } from '../db/pool';
import { quoteIdent } from '../lib/sql';

/**
 * Repository for database-level (catalog) operations. Repositories are the only
 * layer that builds SQL — services and routes never touch the driver directly.
 *
 * `getPool()` is called per query rather than cached in the constructor, because
 * `reinitPool()` (invoked on login) replaces the pool entirely; a cached reference
 * would become stale and throw "Pool is closed".
 */
export class DatabaseRepository {
  async listDatabases(): Promise<{ user: string[]; system: string[] }> {
    const [rows] = await getPool().query<RowDataPacket[]>('SHOW DATABASES');
    const all = rows.map((r) => String(r.Database));
    return {
      user: all.filter((n) => !isSystemDatabase(n)),
      system: all.filter((n) => isSystemDatabase(n)),
    };
  }

  async createDatabase(name: string): Promise<void> {
    await getPool().query(`CREATE DATABASE ${quoteIdent(name)}`);
  }

  async dropDatabase(name: string): Promise<void> {
    await getPool().query(`DROP DATABASE ${quoteIdent(name)}`);
  }
}
