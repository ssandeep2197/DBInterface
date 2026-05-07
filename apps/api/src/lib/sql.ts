import { sqlIdentifier } from '@dbi/shared';
import { HttpError } from './http-error';

/**
 * Quote a MySQL identifier (database, table, column) safely.
 *
 * Why: `mysql2` can only parameterize *values*, not identifiers. We accept identifiers
 * only after passing them through a strict allowlist (`sqlIdentifier`), then wrap in
 * backticks. Any embedded backtick is doubled per MySQL escape rules — defense in depth
 * even though the allowlist already forbids it.
 */
export function quoteIdent(name: string): string {
  const result = sqlIdentifier.safeParse(name);
  if (!result.success) {
    throw HttpError.badRequest(`invalid identifier: ${name}`);
  }
  return '`' + result.data.replace(/`/g, '``') + '`';
}

/** Quote a fully-qualified `db.table` reference. */
export function quoteRef(db: string, table: string): string {
  return `${quoteIdent(db)}.${quoteIdent(table)}`;
}
