import type { RequestHandler } from 'express';
import { HttpError } from '../lib/http-error';

declare module 'express-session' {
  interface SessionData {
    authenticated?: boolean;
    issuedAt?: number;
  }
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (req.session?.authenticated) {
    return next();
  }
  next(HttpError.unauthorized());
};
