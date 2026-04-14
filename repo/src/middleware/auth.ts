import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { UnauthorizedError } from '../utils/errors';

interface JwtPayload {
  userId: string;
  organizationId: string;
  role: string;
  jti: string;
  iat: number;
  exp: number;
}

export async function authMiddleware(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Authentication required');
    }

    const token = authHeader.slice(7);
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

    const blacklisted = await prisma.tokenBlacklist.findUnique({
      where: { tokenJti: payload.jti },
    });
    if (blacklisted) {
      throw new UnauthorizedError('Token has been revoked');
    }

    const user = await prisma.user.findFirst({
      where: { id: payload.userId, organizationId: payload.organizationId },
    });
    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    req.user = {
      id: user.id,
      username: user.username,
      role: user.role,
      organizationId: user.organizationId,
      isBanned: user.isBanned,
      isMuted: user.isMuted,
      mutedUntil: user.mutedUntil,
    };
    req.tokenJti = payload.jti;
    next();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      next(err);
      return;
    }
    if (err instanceof jwt.JsonWebTokenError || err instanceof jwt.TokenExpiredError) {
      next(new UnauthorizedError('Invalid or expired token'));
      return;
    }
    next(err);
  }
}

export async function optionalAuthMiddleware(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      next();
      return;
    }

    const token = authHeader.slice(7);
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

    const user = await prisma.user.findFirst({
      where: { id: payload.userId, organizationId: payload.organizationId },
    });
    if (user) {
      req.user = {
        id: user.id,
        username: user.username,
        role: user.role,
        organizationId: user.organizationId,
        isBanned: user.isBanned,
        isMuted: user.isMuted,
        mutedUntil: user.mutedUntil,
      };
      req.tokenJti = payload.jti;
    }
    next();
  } catch {
    next();
  }
}
