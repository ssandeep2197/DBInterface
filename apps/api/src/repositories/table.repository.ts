import type { Pool, RowDataPacket } from 'mysql2/promise';
import type { ColumnDefinition, ColumnSchema } from '@dbi/shared';
import { quoteIdent, quoteRef } from '../lib/sql';

const COLUMN_TYPE_SQL: Record<ColumnDefinition['type'], (def: ColumnDefinition) => string> = {
  INT: () => 'INT',
  VARCHAR: (d) => `VARCHAR(${d.length ?? 255})`,
  TEXT: () => 'TEXT',
  BOOLEAN: () => 'BOOLEAN',
  DATETIME: () => 'DATETIME',
  DATE: () => 'DATE',
  DECIMAL: (d) => `DECIMAL(${d.length ?? 10},2)`,
};

export class TableRepository {
  constructor(private readonly pool: Pool) {}

  async listTables(database: string): Promise<string[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT table_name AS name FROM information_schema.tables WHERE table_schema = ?`,
      [database],
    );
    return rows.map((r) => String(r.name));
  }

  async createTable(database: string, table: string, columns: ColumnDefinition[]): Promise<void> {
    const hasPk = columns.some((c) => c.primaryKey);
    const parts: string[] = [];

    if (!hasPk && !columns.some((c) => c.name.toLowerCase() === 'id')) {
      parts.push('`id` INT AUTO_INCREMENT PRIMARY KEY');
    }

    for (const col of columns) {
      const type = COLUMN_TYPE_SQL[col.type](col);
      const nullSpec = col.nullable ? 'NULL' : 'NOT NULL';
      const pk = col.primaryKey ? ' PRIMARY KEY' : '';
      parts.push(`${quoteIdent(col.name)} ${type} ${nullSpec}${pk}`);
    }

    const sql = `CREATE TABLE IF NOT EXISTS ${quoteRef(database, table)} (${parts.join(', ')})`;
    await this.pool.query(sql);
  }

  async dropTable(database: string, table: string): Promise<void> {
    await this.pool.query(`DROP TABLE ${quoteRef(database, table)}`);
  }

  async truncateTable(database: string, table: string): Promise<void> {
    await this.pool.query(`TRUNCATE TABLE ${quoteRef(database, table)}`);
  }

  async renameTable(database: string, oldName: string, newName: string): Promise<void> {
    await this.pool.query(
      `RENAME TABLE ${quoteRef(database, oldName)} TO ${quoteRef(database, newName)}`,
    );
  }

  async describeTable(database: string, table: string): Promise<ColumnSchema[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SHOW COLUMNS FROM ${quoteRef(database, table)}`,
    );
    return rows as unknown as ColumnSchema[];
  }

  async renameColumn(
    database: string,
    table: string,
    oldName: string,
    newName: string,
  ): Promise<void> {
    await this.pool.query(
      `ALTER TABLE ${quoteRef(database, table)} RENAME COLUMN ${quoteIdent(oldName)} TO ${quoteIdent(newName)}`,
    );
  }
}
