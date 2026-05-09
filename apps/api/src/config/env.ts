import { z } from 'zod';

/**
 * Parse string env vars as booleans, defaulting to `fallback` when the var is
 * absent. `z.coerce.boolean()` treats any non-empty string as truthy — so
 * "false", "0", "no" would all become true. This treats those values correctly.
 */
const envBoolean = (fallback: boolean) =>
  z
    .string()
    .optional()
    .transform((v) => {
      if (v === undefined) return fallback;
      return ['true', '1', 'yes', 'on'].includes(v.toLowerCase());
    });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  API_PORT: z.coerce.number().int().min(1).max(65535).default(8082),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 chars'),
  SESSION_MAX_AGE_MS: z.coerce.number().int().positive().default(60 * 60 * 1000),
  CORS_ORIGIN: z.string().default('http://localhost:4200'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),

  /**
   * When true, reject MySQL connection attempts that resolve to private/loopback
   * IP ranges (10/8, 172.16/12, 192.168/16, 127/8, ::1, fc00::/7, etc.). Set to
   * `true` for any internet-facing deployment to limit SSRF blast radius.
   */
  BLOCK_PRIVATE_HOSTS: envBoolean(false),

  /**
   * When true, set the session cookie with `sameSite: 'none'` and `secure: true`
   * so the cookie crosses origins (web on Vercel, api on Render, etc.). Requires
   * HTTPS in production.
   */
  CROSS_SITE_COOKIES: envBoolean(false),

  /**
   * When true, mark the session cookie `Secure`. Set this for HTTPS deployments.
   * Leave false for HTTP-only setups (local dev, IP-only VPS demos) — otherwise
   * the browser drops the cookie and login appears to silently fail.
   */
  FORCE_HTTPS: envBoolean(false),
});

export type AppEnv = z.infer<typeof envSchema>;

let cached: AppEnv | null = null;

export function loadEnv(): AppEnv {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

export function isProd(env: AppEnv = loadEnv()): boolean {
  return env.NODE_ENV === 'production';
}
