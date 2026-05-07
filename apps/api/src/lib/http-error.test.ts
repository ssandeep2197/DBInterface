import { describe, it, expect } from 'vitest';
import { HttpError } from './http-error';

describe('HttpError', () => {
  it('carries status, code, message, and optional details', () => {
    const err = HttpError.badRequest('bad', { field: 'name' });
    expect(err.status).toBe(400);
    expect(err.code).toBe('BAD_REQUEST');
    expect(err.message).toBe('bad');
    expect(err.details).toEqual({ field: 'name' });
  });

  it('exposes typed factories for common statuses', () => {
    expect(HttpError.unauthorized().status).toBe(401);
    expect(HttpError.forbidden().status).toBe(403);
    expect(HttpError.notFound().status).toBe(404);
    expect(HttpError.conflict('dup').status).toBe(409);
    expect(HttpError.internal().status).toBe(500);
  });

  it('is an instance of Error', () => {
    expect(HttpError.badRequest('x') instanceof Error).toBe(true);
  });
});
