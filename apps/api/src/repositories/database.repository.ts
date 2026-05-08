import type { Pool, RowDataPacket } from 'mysql2/promise';
import { isSystemDatabase } from '@dbi/shared';
import { quoteIdent } from '../lib/sql';

export class DatabaseRepository {
  constructor(private readonly pool: Pool) {}

  async listDatabases(): Promise<{ user: string[]; system: string[] }> {
    const [rows] = await this.pool.query<RowDataPacket[]>('SHOW DATABASES');
    const all = rows.map((r) => String(r.Database));
    return {
      user: all.filter((n) => !isSystemDatabase(n)),
      system: all.filter((n) => isSystemDatabase(n)),
    };
  }

  async createDatabase(name: string): Promise<void> {
    await this.pool.query(`CREATE DATABASE ${quoteIdent(name)}`);
  }

  async dropDatabase(name: string): Promise<void> {
    await this.pool.query(`DROP DATABASE ${quoteIdent(name)}`);
  }
}
