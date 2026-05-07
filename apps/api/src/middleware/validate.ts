import type { RequestHandler } from 'express';
import { ZodSchema } from 'zod';
import { HttpError } from '../lib/http-error';

type Source = 'body' | 'query' | 'params';

/**
 * Validate `req[source]` with the given Zod schema and replace it with the parsed
 * result so downstream code reads sanitized, fully-typed input.
 */
export function validate<T>(schema: ZodSchema<T>, source: Source = 'body'): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return next(HttpError.badRequest('validation failed', result.error.flatten()));
    }
    (req as unknown as Record<Source, T>)[source] = result.data;
    next();
  };
}
