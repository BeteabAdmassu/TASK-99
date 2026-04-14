import { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '../utils/errors';
import { env } from '../config/env';

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

/**
 * Denies access to any user whose role is in the provided list.
 * Use to enforce read-only boundaries for roles such as `analyst`.
 */
export function denyRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (req.user && roles.includes(req.user.role)) {
      next(new ForbiddenError('Insufficient permissions'));
      return;
    }
    next();
  };
}

export function requirePlatformAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (
    !req.user ||
    req.user.role !== 'admin' ||
    req.user.organizationId !== env.PLATFORM_ORG_ID
  ) {
    next(new ForbiddenError('Organization creation requires platform administrator privileges'));
    return;
  }
  next();
}
