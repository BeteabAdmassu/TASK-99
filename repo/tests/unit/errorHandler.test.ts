/**
 * Unit tests for the global error handler middleware.
 *
 * We mock the logger to avoid noisy output and the Prisma module to avoid
 * needing a generated client for pure unit tests.
 */

jest.mock('../../src/config/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

jest.mock('@prisma/client', () => {
  class PrismaClientKnownRequestError extends Error {
    code: string;
    clientVersion: string;
    constructor(message: string, opts: { code: string; clientVersion: string }) {
      super(message);
      this.name = 'PrismaClientKnownRequestError';
      this.code = opts.code;
      this.clientVersion = opts.clientVersion;
    }
  }
  return {
    Prisma: { PrismaClientKnownRequestError },
  };
});

import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { errorHandler } from '../../src/middleware/errorHandler';
import { AppError, NotFoundError, ValidationError } from '../../src/utils/errors';

function mockReq(): Request {
  return { correlationId: 'test-corr-id' } as any;
}

function mockRes() {
  const res: any = { _status: 0, _json: null };
  res.status = jest.fn((code: number) => { res._status = code; return res; });
  res.json = jest.fn((body: any) => { res._json = body; return res; });
  return res as Response & { _status: number; _json: any };
}

const next: NextFunction = jest.fn();

describe('errorHandler', () => {
  // ── AppError subclasses ───────────────────────────────────────────────

  it('returns structured JSON for AppError with correct status', () => {
    const err = new NotFoundError('Thread not found');
    const res = mockRes();

    errorHandler(err, mockReq(), res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res._json).toEqual({
      error: { code: 'NOT_FOUND', message: 'Thread not found' },
    });
  });

  it('includes details in response when present', () => {
    const err = new ValidationError('Bad input', { fields: ['name'] });
    const res = mockRes();

    errorHandler(err, mockReq(), res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res._json.error.details).toEqual({ fields: ['name'] });
  });

  it('omits details key when details is undefined', () => {
    const err = new AppError('nope', 403, 'FORBIDDEN');
    const res = mockRes();

    errorHandler(err, mockReq(), res, next);

    expect(res._json.error).not.toHaveProperty('details');
  });

  // ── Prisma errors ─────────────────────────────────────────────────────

  it('maps Prisma P2002 to 409 CONFLICT', () => {
    const err = new (Prisma.PrismaClientKnownRequestError as any)(
      'Unique constraint failed',
      { code: 'P2002', clientVersion: '5.0.0' },
    );
    const res = mockRes();

    errorHandler(err, mockReq(), res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res._json.error.code).toBe('CONFLICT');
  });

  it('maps Prisma P2025 to 404 NOT_FOUND', () => {
    const err = new (Prisma.PrismaClientKnownRequestError as any)(
      'Record not found',
      { code: 'P2025', clientVersion: '5.0.0' },
    );
    const res = mockRes();

    errorHandler(err, mockReq(), res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res._json.error.code).toBe('NOT_FOUND');
  });

  // ── Unknown errors ────────────────────────────────────────────────────

  it('returns 500 INTERNAL_ERROR for unknown errors', () => {
    const err = new TypeError('unexpected failure');
    const res = mockRes();

    errorHandler(err, mockReq(), res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res._json.error.code).toBe('INTERNAL_ERROR');
    expect(res._json.error.message).toBe('An unexpected error occurred');
  });

  it('does not leak stack traces in 500 response', () => {
    const err = new Error('secret internal detail');
    const res = mockRes();

    errorHandler(err, mockReq(), res, next);

    expect(res._json.error.message).not.toContain('secret internal detail');
    expect(JSON.stringify(res._json)).not.toContain('stack');
  });
});
