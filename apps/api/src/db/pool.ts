import mysql, { Pool, PoolOptions } from 'mysql2/promise';
import { loadEnv } from '../config/env';
import { logger } from '../lib/logger';

let pool: Pool | null = null;

/**
 * Lazily create the MySQL connection pool. We don't create it at import time so
 * tests can reset state and so that auth credentials can be re-applied at runtime
 * (the original app authenticated with a user-supplied password — we keep that
 * model but back it with a real pool).
 */
export function getPool(overrides?: Partial<PoolOptions>): Pool {
  if (pool) return pool;
  const env = loadEnv();
  pool = mysql.createPool({
    host: env.MYSQL_HOST,
    port: env.MYSQL_PORT,
    user: env.MYSQL_USER,
    password: env.MYSQL_PASSWORD,
    waitForConnections: true,
    connectionLimit: env.MYSQL_CONNECTION_LIMIT,
    queueLimit: 0,
    multipleStatements: false,
    namedPlaceholders: true,
    ...overrides,
  });
  logger.info({ host: env.MYSQL_HOST, port: env.MYSQL_PORT }, 'mysql pool initialized');
  return pool;
}

/** Recreate the pool with a new password (used by /auth login). */
export async function reinitPool(password: string): Promise<Pool> {
  await closePool();
  const env = loadEnv();
  pool = mysql.createPool({
    host: env.MYSQL_HOST,
    port: env.MYSQL_PORT,
    user: env.MYSQL_USER,
    password,
    waitForConnections: true,
    connectionLimit: env.MYSQL_CONNECTION_LIMIT,
    queueLimit: 0,
    multipleStatements: false,
    namedPlaceholders: true,
  });
  return pool;
}

export async function closePool(): Promise<void> {
  if (!pool) return;
  await pool.end().catch(() => undefined);
  pool = null;
}
