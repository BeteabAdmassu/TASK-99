import { Request, Response, NextFunction } from 'express';
import { correlationIdMiddleware } from '../../src/middleware/correlationId';

function mockReq(headers: Record<string, string> = {}): Request {
  return { headers, correlationId: undefined } as any as Request;
}

function mockRes(): Response & { _headers: Record<string, string> } {
  const res: any = { _headers: {} };
  res.setHeader = jest.fn((key: string, value: string) => {
    res._headers[key] = value;
  });
  return res;
}

describe('correlationIdMiddleware', () => {
  it('generates a UUID when no X-Correlation-ID header is present', () => {
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    correlationIdMiddleware(req, res, next);

    expect(req.correlationId).toBeDefined();
    expect(typeof req.correlationId).toBe('string');
    expect(req.correlationId!.length).toBeGreaterThan(0);
    expect(next).toHaveBeenCalled();
  });

  it('uses existing X-Correlation-ID header value', () => {
    const req = mockReq({ 'x-correlation-id': 'custom-id-123' });
    const res = mockRes();
    const next = jest.fn();

    correlationIdMiddleware(req, res, next);

    expect(req.correlationId).toBe('custom-id-123');
  });

  it('sets X-Correlation-ID response header', () => {
    const req = mockReq({ 'x-correlation-id': 'resp-test-id' });
    const res = mockRes();
    const next = jest.fn();

    correlationIdMiddleware(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('X-Correlation-ID', 'resp-test-id');
  });

  it('generated ID is a valid UUID format', () => {
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    correlationIdMiddleware(req, res, next);

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    expect(req.correlationId).toMatch(uuidRegex);
  });
});
