import { isSystemDatabase } from '@dbi/shared';
import type { DatabaseRepository } from '../repositories/database.repository';
import { HttpError } from '../lib/http-error';

export class DatabaseService {
  constructor(private readonly repo: DatabaseRepository) {}

  list() {
    return this.repo.listDatabases();
  }

  async create(name: string): Promise<void> {
    if (isSystemDatabase(name)) {
      throw HttpError.forbidden(`cannot create reserved database "${name}"`);
    }
    await this.repo.createDatabase(name);
  }

  async drop(name: string): Promise<void> {
    if (isSystemDatabase(name)) {
      throw HttpError.forbidden(`cannot drop system database "${name}"`);
    }
    await this.repo.dropDatabase(name);
  }
}
