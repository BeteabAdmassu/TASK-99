import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../../src/middleware/validate';
import { ValidationError } from '../../src/utils/errors';

function mockReq(overrides: Partial<Request> = {}): Request {
  return { headers: {}, params: {}, query: {}, body: {}, ...overrides } as Request;
}

function mockRes(): Response {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('validate middleware', () => {
  it('passes when body matches schema', () => {
    const schema = z.object({ name: z.string() });
    const middleware = validate({ body: schema });

    const req = mockReq({ body: { name: 'Alice' } });
    const next = jest.fn();
    middleware(req, mockRes(), next);

    expect(next).toHaveBeenCalledWith();
    expect(req.body.name).toBe('Alice');
  });

  it('calls next with ValidationError when body is invalid', () => {
    const schema = z.object({ name: z.string().min(1) });
    const middleware = validate({ body: schema });

    const req = mockReq({ body: {} });
    const next = jest.fn();
    middleware(req, mockRes(), next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.statusCode).toBe(400);
  });

  it('validates query parameters', () => {
    const schema = z.object({ page: z.string().regex(/^\d+$/) });
    const middleware = validate({ query: schema });

    const req = mockReq({ query: { page: '5' } as any });
    const next = jest.fn();
    middleware(req, mockRes(), next);

    expect(next).toHaveBeenCalledWith();
  });

  it('rejects invalid query parameters', () => {
    const schema = z.object({ page: z.string().regex(/^\d+$/) });
    const middleware = validate({ query: schema });

    const req = mockReq({ query: { page: 'abc' } as any });
    const next = jest.fn();
    middleware(req, mockRes(), next);

    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(ValidationError);
  });

  it('validates path params', () => {
    const schema = z.object({ id: z.string().uuid() });
    const middleware = validate({ params: schema });

    const req = mockReq({ params: { id: '00000000-0000-0000-0000-000000000001' } as any });
    const next = jest.fn();
    middleware(req, mockRes(), next);

    expect(next).toHaveBeenCalledWith();
  });

  it('passes non-Zod errors through to next', () => {
    // Force a non-Zod error by passing a schema that throws a different error
    const badSchema = {
      parse: () => {
        throw new TypeError('unexpected');
      },
    } as any;
    const middleware = validate({ body: badSchema });

    const req = mockReq({ body: {} });
    const next = jest.fn();
    middleware(req, mockRes(), next);

    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(TypeError);
  });
});
