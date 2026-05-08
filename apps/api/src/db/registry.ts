import { promises as dns } from 'node:dns';
import { isIP } from 'node:net';
import mysql, { type Pool } from 'mysql2/promise';
import { loadEnv } from '../config/env';
import { logger } from '../lib/logger';
import { HttpError } from '../lib/http-error';
import { isPrivateOrLoopback } from './private-host';

export interface ConnectionMeta {
  host: string;
  port: number;
  user: string;
  database?: string;
  useTLS: boolean;
}

interface Entry {
  pool: Pool;
  meta: ConnectionMeta;
  lastUsed: number;
}

/**
 * Per-session MySQL connection registry. Each session gets its own pool keyed by
 * a connection id (the session id). Pools are closed when the user logs out or
 * after `MAX_IDLE_MS` of inactivity.
 *
 * Why this design:
 *   - The original tool had one global pool — broke under concurrent users.
 *   - Storing credentials in the session would let them ride every cookie; we keep
 *     them server-side in the pool object instead. The session only carries an id.
 */
class ConnectionRegistry {
  private entries = new Map<string, Entry>();
  private sweepTimer: NodeJS.Timeout | null = null;
  private readonly maxConnections = 50;
  private readonly maxIdleMs = 30 * 60 * 1000;

  startSweep() {
    if (this.sweepTimer) return;
    this.sweepTimer = setInterval(() => this.sweepIdle(), 60 * 1000);
    this.sweepTimer.unref();
  }

  stopSweep() {
    if (this.sweepTimer) clearInterval(this.sweepTimer);
    this.sweepTimer = null;
  }

  async create(id: string, meta: ConnectionMeta, password: string): Promise<void> {
    if (this.entries.size >= this.maxConnections) {
      throw HttpError.forbidden('connection limit reached on server');
    }
    await this.destroy(id);
    await assertHostAllowed(meta.host);

    const pool = mysql.createPool({
      host: meta.host,
      port: meta.port,
      user: meta.user,
      password,
      database: meta.database || undefined,
      ssl: meta.useTLS ? { rejectUnauthorized: true } : undefined,
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
      multipleStatements: false,
      namedPlaceholders: true,
      connectTimeout: 10_000,
    });

    try {
      await pool.query('SELECT 1');
    } catch (err) {
      await pool.end().catch(() => undefined);
      logger.warn(
        { host: meta.host, port: meta.port, user: meta.user, err: (err as Error).message },
        'mysql auth failed',
      );
      throw HttpError.unauthorized('connection failed: ' + (err as Error).message);
    }

    this.entries.set(id, { pool, meta, lastUsed: Date.now() });
    logger.info({ id, host: meta.host, port: meta.port, user: meta.user }, 'connection opened');
  }

  get(id: string): Pool | null {
    const entry = this.entries.get(id);
    if (!entry) return null;
    entry.lastUsed = Date.now();
    return entry.pool;
  }

  meta(id: string): ConnectionMeta | null {
    return this.entries.get(id)?.meta ?? null;
  }

  has(id: string): boolean {
    return this.entries.has(id);
  }

  async destroy(id: string): Promise<void> {
    const entry = this.entries.get(id);
    if (!entry) return;
    this.entries.delete(id);
    await entry.pool.end().catch(() => undefined);
    logger.info({ id }, 'connection closed');
  }

  async destroyAll(): Promise<void> {
    const ids = [...this.entries.keys()];
    await Promise.all(ids.map((id) => this.destroy(id)));
  }

  async sweepIdle(): Promise<void> {
    const cutoff = Date.now() - this.maxIdleMs;
    for (const [id, entry] of this.entries) {
      if (entry.lastUsed < cutoff) {
        logger.info({ id }, 'sweeping idle connection');
        await this.destroy(id);
      }
    }
  }

  size(): number {
    return this.entries.size;
  }
}

export const registry = new ConnectionRegistry();

/**
 * Reject connections to private/loopback IP ranges when BLOCK_PRIVATE_HOSTS=true.
 * Resolves the host through DNS so a hostname pointing at 127.0.0.1 can't sneak
 * past a literal-IP check. Best-effort defense, not bulletproof: TOCTOU-DNS is a
 * known SSRF gap. Document the residual risk in deployment notes.
 */
async function assertHostAllowed(host: string): Promise<void> {
  const env = loadEnv();
  if (!env.BLOCK_PRIVATE_HOSTS) return;

  const ips: string[] = [];
  if (isIP(host)) {
    ips.push(host);
  } else {
    try {
      const records = await dns.lookup(host, { all: true });
      ips.push(...records.map((r) => r.address));
    } catch {
      throw HttpError.badRequest(`could not resolve host: ${host}`);
    }
  }

  for (const ip of ips) {
    if (isPrivateOrLoopback(ip)) {
      throw HttpError.forbidden(`host resolves to a blocked range: ${ip}`);
    }
  }
}

