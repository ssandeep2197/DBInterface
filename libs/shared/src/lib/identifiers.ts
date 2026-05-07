import { z } from 'zod';

/**
 * MySQL identifier validator. Permits only ASCII letters, digits, and underscores,
 * 1–64 chars, not starting with a digit. Anything outside this set is rejected up
 * front so we never have to escape user input into backticks at the SQL layer.
 */
export const sqlIdentifier = z
  .string()
  .min(1, 'identifier required')
  .max(64, 'identifier too long')
  .regex(/^[A-Za-z_][A-Za-z0-9_]*$/, 'invalid identifier');

export type SqlIdentifier = z.infer<typeof sqlIdentifier>;

export const SYSTEM_DATABASES = [
  'information_schema',
  'sys',
  'performance_schema',
  'mysql',
] as const;

export type SystemDatabase = (typeof SYSTEM_DATABASES)[number];

export function isSystemDatabase(name: string): name is SystemDatabase {
  return (SYSTEM_DATABASES as readonly string[]).includes(name);
}
