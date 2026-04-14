import { DuplicateEntryError, NotFoundError } from './errors';

export class ValidationError extends Error {
  readonly code = 'VALIDATION_ERROR' as const;
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export interface ErrorBody {
  error: string;
  message: string;
}

/**
 * Map a thrown value to a standard JSON error response.
 *
 * - ValidationError → 400
 * - NotFoundError   → 404
 * - DuplicateEntryError → 409
 * - anything else   → 500
 *
 * Used uniformly by Phase 1 route handlers; Phases 2 and 3 reuse it.
 */
export function errorResponse(err: unknown): Response {
  if (err instanceof ValidationError) {
    return Response.json(
      { error: err.code, message: err.message } satisfies ErrorBody,
      { status: 400 },
    );
  }
  if (err instanceof NotFoundError) {
    return Response.json(
      { error: err.code, message: err.message } satisfies ErrorBody,
      { status: 404 },
    );
  }
  if (err instanceof DuplicateEntryError) {
    return Response.json(
      { error: err.code, message: err.message } satisfies ErrorBody,
      { status: 409 },
    );
  }
  const message = err instanceof Error ? err.message : String(err);
  return Response.json({ error: 'INTERNAL', message } satisfies ErrorBody, { status: 500 });
}
