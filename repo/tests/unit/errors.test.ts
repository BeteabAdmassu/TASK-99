import {
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  LockedError,
  RateLimitError,
  BusinessRuleError,
} from '../../src/utils/errors';

describe('Error classes', () => {
  // ── AppError ────────────────────────────────────────────────────────────

  it('AppError sets message, statusCode, code, and details', () => {
    const err = new AppError('boom', 500, 'INTERNAL', { extra: 1 });
    expect(err.message).toBe('boom');
    expect(err.statusCode).toBe(500);
    expect(err.code).toBe('INTERNAL');
    expect(err.details).toEqual({ extra: 1 });
    expect(err.name).toBe('AppError');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
  });

  it('AppError details defaults to undefined', () => {
    const err = new AppError('msg', 400, 'CODE');
    expect(err.details).toBeUndefined();
  });

  // ── ValidationError ─────────────────────────────────────────────────────

  it('ValidationError defaults to 400 VALIDATION_ERROR', () => {
    const err = new ValidationError();
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.message).toBe('Validation failed');
  });

  it('ValidationError accepts custom message and details', () => {
    const err = new ValidationError('bad input', { field: 'name' });
    expect(err.message).toBe('bad input');
    expect(err.details).toEqual({ field: 'name' });
    expect(err).toBeInstanceOf(AppError);
  });

  // ── UnauthorizedError ───────────────────────────────────────────────────

  it('UnauthorizedError defaults to 401 UNAUTHORIZED', () => {
    const err = new UnauthorizedError();
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('UNAUTHORIZED');
    expect(err.message).toBe('Authentication required');
  });

  it('UnauthorizedError accepts custom message', () => {
    const err = new UnauthorizedError('bad token');
    expect(err.message).toBe('bad token');
  });

  // ── ForbiddenError ──────────────────────────────────────────────────────

  it('ForbiddenError defaults to 403 FORBIDDEN', () => {
    const err = new ForbiddenError();
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('FORBIDDEN');
    expect(err.message).toBe('Insufficient permissions');
  });

  // ── NotFoundError ───────────────────────────────────────────────────────

  it('NotFoundError defaults to 404 NOT_FOUND', () => {
    const err = new NotFoundError();
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.message).toBe('Resource not found');
  });

  // ── ConflictError ───────────────────────────────────────────────────────

  it('ConflictError defaults to 409 CONFLICT', () => {
    const err = new ConflictError();
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe('CONFLICT');
    expect(err.message).toBe('Resource already exists');
  });

  // ── LockedError ─────────────────────────────────────────────────────────

  it('LockedError defaults to 423 ACCOUNT_LOCKED', () => {
    const err = new LockedError();
    expect(err.statusCode).toBe(423);
    expect(err.code).toBe('ACCOUNT_LOCKED');
    expect(err.message).toBe('Account locked');
  });

  it('LockedError accepts details', () => {
    const err = new LockedError('locked out', { retryAfter: 60 });
    expect(err.details).toEqual({ retryAfter: 60 });
  });

  // ── RateLimitError ──────────────────────────────────────────────────────

  it('RateLimitError defaults to 429 RATE_LIMITED', () => {
    const err = new RateLimitError();
    expect(err.statusCode).toBe(429);
    expect(err.code).toBe('RATE_LIMITED');
    expect(err.message).toBe('Too many requests');
  });

  // ── BusinessRuleError ───────────────────────────────────────────────────

  it('BusinessRuleError accepts custom statusCode, code, message, and details', () => {
    const err = new BusinessRuleError(422, 'CUSTOM_RULE', 'rule violation', { limit: 5 });
    expect(err.statusCode).toBe(422);
    expect(err.code).toBe('CUSTOM_RULE');
    expect(err.message).toBe('rule violation');
    expect(err.details).toEqual({ limit: 5 });
    expect(err).toBeInstanceOf(AppError);
  });
});
