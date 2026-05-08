import { isSystemDatabase } from '@dbi/shared';
import type { RowRepository } from '../repositories/row.repository';
import type { TableRepository } from '../repositories/table.repository';
import { HttpError } from '../lib/http-error';

async function ensureColumnsExist(
  tables: TableRepository,
  database: string,
  table: string,
  keys: string[],
): Promise<void> {
  const cols = await tables.describeTable(database, table);
  const known = new Set(cols.map((c) => c.Field));
  const unknown = keys.filter((k) => !known.has(k));
  if (unknown.length > 0) {
    throw HttpError.badRequest(`unknown column(s): ${unknown.join(', ')}`);
  }
}

export class RowService {
  constructor(
    private readonly rows: RowRepository,
    private readonly tables: TableRepository,
  ) {}

  private guardSystem(database: string) {
    if (isSystemDatabase(database)) {
      throw HttpError.forbidden(`cannot mutate system database "${database}"`);
    }
  }

  selectAll(database: string, table: string) {
    return this.rows.selectAll(database, table);
  }

  async insert(database: string, table: string, values: Record<string, unknown>) {
    this.guardSystem(database);
    await ensureColumnsExist(this.tables, database, table, Object.keys(values));
    const result = await this.rows.insert(database, table, values);
    return { affectedRows: result.affectedRows, insertId: result.insertId };
  }

  async update(
    database: string,
    table: string,
    values: Record<string, unknown>,
    where: Record<string, unknown>,
  ) {
    this.guardSystem(database);
    await ensureColumnsExist(this.tables, database, table, [
      ...Object.keys(values),
      ...Object.keys(where),
    ]);
    const result = await this.rows.update(database, table, values, where);
    return { affectedRows: result.affectedRows };
  }

  async delete(database: string, table: string, where: Record<string, unknown>) {
    this.guardSystem(database);
    await ensureColumnsExist(this.tables, database, table, Object.keys(where));
    const result = await this.rows.delete(database, table, where);
    return { affectedRows: result.affectedRows };
  }

  async search(database: string, table: string, column: string, query: string) {
    await ensureColumnsExist(this.tables, database, table, [column]);
    return this.rows.search(database, table, column, query);
  }
}
