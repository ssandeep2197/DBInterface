/**
 * Typed HTTP error. Routes/services throw this; the error middleware translates it
 * into a JSON response with the right status code.
 */
export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message: string, details?: unknown) {
    return new HttpError(400, 'BAD_REQUEST', message, details);
  }
  static unauthorized(message = 'authentication required') {
    return new HttpError(401, 'UNAUTHORIZED', message);
  }
  static forbidden(message = 'forbidden') {
    return new HttpError(403, 'FORBIDDEN', message);
  }
  static notFound(message = 'not found') {
    return new HttpError(404, 'NOT_FOUND', message);
  }
  static conflict(message: string) {
    return new HttpError(409, 'CONFLICT', message);
  }
  static internal(message = 'internal server error', details?: unknown) {
    return new HttpError(500, 'INTERNAL', message, details);
  }
}
