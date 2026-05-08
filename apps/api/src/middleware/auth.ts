import type { RequestHandler } from 'express';
import { HttpError } from '../lib/http-error';
import { registry } from '../db/registry';

declare module 'express-session' {
  interface SessionData {
    authenticated?: boolean;
    connectionId?: string;
    issuedAt?: number;
  }
}

/**
 * Require both a valid session AND a live pool in the registry. The latter check
 * matters because pools live in memory: a server restart wipes them while the
 * session cookie remains valid. We surface that as 401 so the UI redirects to login.
 */
export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.session?.authenticated || !req.session?.connectionId) {
    return next(HttpError.unauthorized());
  }
  if (!registry.has(req.session.connectionId)) {
    req.session.destroy(() => undefined);
    return next(HttpError.unauthorized('connection expired — please sign in again'));
  }
  next();
};
