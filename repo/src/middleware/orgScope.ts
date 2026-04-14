import { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '../utils/errors';

export function orgScopeMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const orgId = req.params.orgId;
  if (!req.user) {
    next(new ForbiddenError('Access denied to this organization'));
    return;
  }

  if (orgId && req.user.organizationId !== orgId) {
    next(new ForbiddenError('Access denied to this organization'));
    return;
  }

  req.organizationId = orgId || req.user.organizationId;
  next();
}
