import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const id = (req.headers['x-correlation-id'] as string) || crypto.randomUUID();
  req.correlationId = id;
  res.setHeader('X-Correlation-ID', id);
  next();
}
