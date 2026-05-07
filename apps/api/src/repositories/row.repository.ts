import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { getPool } from '../db/pool';
import { quoteIdent, quoteRef } from '../lib/sql';

/**
 * Build a parameterized WHERE clause from a record of column → value pairs.
 * Returns the clause text and the ordered values array, suitable for the `?`
 * placeholder style used by mysql2.
 */
function buildWhere(where: Record<string, unknown>): { clause: string; values: unknown[] } {
  const cols = Object.keys(where);
  if (cols.length === 0) {
    return { clause: '', values: [] };
  }
  const clause = cols.map((c) => `${quoteIdent(c)} = ?`).join(' AND ');
  const values = cols.map((c) => where[c]);
  return { clause, values };
}

export class RowRepository {
  async selectAll(
    database: string,
    table: string,
    limit = 1000,
  ): Promise<Record<string, unknown>[]> {
    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT * FROM ${quoteRef(database, table)} LIMIT ?`,
      [limit],
    );
    return rows as Record<string, unknown>[];
  }

  async insert(
    database: string,
    table: string,
    values: Record<string, unknown>,
  ): Promise<ResultSetHeader> {
    const cols = Object.keys(values);
    if (cols.length === 0) {
      throw new Error('insert requires at least one value');
    }
    const colSql = cols.map((c) => quoteIdent(c)).join(', ');
    const placeholders = cols.map(() => '?').join(', ');
    const params = cols.map((c) => values[c]);
    const [result] = await getPool().query<ResultSetHeader>(
      `INSERT INTO ${quoteRef(database, table)} (${colSql}) VALUES (${placeholders})`,
      params,
    );
    return result;
  }

  async update(
    database: string,
    table: string,
    values: Record<string, unknown>,
    where: Record<string, unknown>,
  ): Promise<ResultSetHeader> {
    const setCols = Object.keys(values);
    if (setCols.length === 0) {
      throw new Error('update requires at least one value');
    }
    const setSql = setCols.map((c) => `${quoteIdent(c)} = ?`).join(', ');
    const setParams = setCols.map((c) => values[c]);

    const { clause: whereSql, values: whereParams } = buildWhere(where);
    if (!whereSql) {
      throw new Error('update requires a WHERE clause');
    }

    const [result] = await getPool().query<ResultSetHeader>(
      `UPDATE ${quoteRef(database, table)} SET ${setSql} WHERE ${whereSql}`,
      [...setParams, ...whereParams],
    );
    return result;
  }

  async delete(
    database: string,
    table: string,
    where: Record<string, unknown>,
  ): Promise<ResultSetHeader> {
    const { clause, values } = buildWhere(where);
    if (!clause) {
      throw new Error('delete requires a WHERE clause');
    }
    const [result] = await getPool().query<ResultSetHeader>(
      `DELETE FROM ${quoteRef(database, table)} WHERE ${clause}`,
      values,
    );
    return result;
  }

  async search(
    database: string,
    table: string,
    column: string,
    query: string,
    limit = 200,
  ): Promise<Record<string, unknown>[]> {
    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT * FROM ${quoteRef(database, table)} WHERE ${quoteIdent(column)} LIKE ? LIMIT ?`,
      [`%${query}%`, limit],
    );
    return rows as Record<string, unknown>[];
  }
}
