import type { ErrorRequestHandler, RequestHandler } from 'express';
import { HttpError } from '../lib/http-error';
import { logger } from '../lib/logger';
import { isProd } from '../config/env';

export const notFound: RequestHandler = (_req, _res, next) => {
  next(HttpError.notFound());
};

/**
 * Centralized error handler. Express recognises this by its 4-arg signature.
 * Translates HttpError → JSON; everything else becomes a generic 500 with the
 * details suppressed in production.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof HttpError) {
    if (err.status >= 500) {
      logger.error({ err, requestId: req.id }, err.message);
    } else {
      logger.warn({ requestId: req.id, code: err.code, path: req.path }, err.message);
    }
    res.status(err.status).json({
      error: err.message,
      code: err.code,
      ...(err.details ? { details: err.details } : {}),
    });
    return;
  }

  // mysql2 errors carry useful codes — surface them as 400/409 where appropriate.
  const sqlErr = err as { code?: string; sqlMessage?: string };
  if (sqlErr?.code === 'ER_DUP_ENTRY') {
    res.status(409).json({ error: sqlErr.sqlMessage ?? 'duplicate entry', code: 'DUPLICATE' });
    return;
  }
  if (sqlErr?.code === 'ER_BAD_DB_ERROR' || sqlErr?.code === 'ER_NO_SUCH_TABLE') {
    res.status(404).json({ error: sqlErr.sqlMessage ?? 'not found', code: 'NOT_FOUND' });
    return;
  }
  if (typeof sqlErr?.code === 'string' && sqlErr.code.startsWith('ER_')) {
    res.status(400).json({ error: sqlErr.sqlMessage ?? 'sql error', code: sqlErr.code });
    return;
  }

  logger.error({ err, requestId: req.id }, 'unhandled error');
  res.status(500).json({
    error: isProd() ? 'internal server error' : (err as Error)?.message ?? 'internal server error',
    code: 'INTERNAL',
  });
};
