import type { ColumnDefinition } from '@dbi/shared';
import { isSystemDatabase } from '@dbi/shared';
import type { TableRepository } from '../repositories/table.repository';
import { HttpError } from '../lib/http-error';

export class TableService {
  constructor(private readonly repo: TableRepository) {}

  private guardSystem(database: string) {
    if (isSystemDatabase(database)) {
      throw HttpError.forbidden(`cannot mutate system database "${database}"`);
    }
  }

  list(database: string) {
    return this.repo.listTables(database);
  }

  async create(database: string, table: string, columns: ColumnDefinition[]) {
    this.guardSystem(database);
    const pkCount = columns.filter((c) => c.primaryKey).length;
    if (pkCount > 1) {
      throw HttpError.badRequest('only one column may be marked PRIMARY KEY');
    }
    await this.repo.createTable(database, table, columns);
  }

  async drop(database: string, table: string) {
    this.guardSystem(database);
    await this.repo.dropTable(database, table);
  }

  async truncate(database: string, table: string) {
    this.guardSystem(database);
    await this.repo.truncateTable(database, table);
  }

  async rename(database: string, oldName: string, newName: string) {
    this.guardSystem(database);
    await this.repo.renameTable(database, oldName, newName);
  }

  describe(database: string, table: string) {
    return this.repo.describeTable(database, table);
  }

  async renameColumn(database: string, table: string, oldName: string, newName: string) {
    this.guardSystem(database);
    await this.repo.renameColumn(database, table, oldName, newName);
  }
}
