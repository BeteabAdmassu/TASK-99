import { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '../utils/errors';

export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new ForbiddenError('Insufficient permissions'));
      return;
    }

    // admin is implicitly allowed for everything
    if (req.user.role === 'admin' || roles.includes(req.user.role)) {
      next();
      return;
    }

    next(new ForbiddenError('Insufficient permissions'));
  };
}
