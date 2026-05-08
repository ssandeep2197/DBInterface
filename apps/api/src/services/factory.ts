import type { Request } from 'express';
import { registry } from '../db/registry';
import { HttpError } from '../lib/http-error';
import { DatabaseRepository } from '../repositories/database.repository';
import { TableRepository } from '../repositories/table.repository';
import { RowRepository } from '../repositories/row.repository';
import { DatabaseService } from './database.service';
import { TableService } from './table.service';
import { RowService } from './row.service';

/**
 * Build a request-scoped service container backed by the session's MySQL pool.
 * Services and repos are cheap to construct; doing it per-request keeps state
 * out of module scope and makes per-user pool isolation natural.
 */
export function services(req: Request) {
  const id = req.session?.connectionId;
  if (!id) throw HttpError.unauthorized();
  const pool = registry.get(id);
  if (!pool) throw HttpError.unauthorized('connection expired');

  const dbRepo = new DatabaseRepository(pool);
  const tableRepo = new TableRepository(pool);
  const rowRepo = new RowRepository(pool);

  return {
    db: new DatabaseService(dbRepo),
    table: new TableService(tableRepo),
    row: new RowService(rowRepo, tableRepo),
  };
}
