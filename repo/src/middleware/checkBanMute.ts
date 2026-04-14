import { Request, Response, NextFunction } from 'express';
import { BusinessRuleError } from '../utils/errors';
import { prisma } from '../config/database';

export async function checkBanMuteMiddleware(req: Request, _res: Response, next: NextFunction): Promise<void> {
  // Only applies to write methods
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    next();
    return;
  }

  if (!req.user) {
    next();
    return;
  }

  if (req.user.isBanned) {
    next(new BusinessRuleError(403, 'USER_BANNED', 'Account is banned'));
    return;
  }

  if (req.user.isMuted && req.user.mutedUntil) {
    if (new Date(req.user.mutedUntil) > new Date()) {
      next(new BusinessRuleError(403, 'USER_MUTED', `Account muted until ${req.user.mutedUntil.toISOString()}`));
      return;
    }
    // Mute expired — auto-clear (fire and forget)
    prisma.user.update({
      where: { id: req.user.id },
      data: { isMuted: false, mutedUntil: null, mutedBy: null, muteReason: null },
    }).catch(() => {});
    req.user.isMuted = false;
    req.user.mutedUntil = null;
  }

  next();
}
