import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuid } from 'uuid';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { decryptField } from '../../config/encryption';
import { UnauthorizedError, LockedError, NotFoundError } from '../../utils/errors';
import { maskUsername } from '../../utils/masks';
import { createAuditLog } from '../audit/audit.service';

export async function login(
  username: string,
  password: string,
  organizationId: string,
  ipAddress?: string,
  correlationId?: string,
) {
  const user = await prisma.user.findUnique({
    where: {
      organizationId_username: {
        organizationId,
        username,
      },
    },
  });

  if (!user) {
    logger.warn({ username: maskUsername(username), orgId: organizationId.slice(0, 8) }, 'Login attempt for non-existent user');
    throw new UnauthorizedError('Invalid username or password');
  }

  // Check for active lockout
  const activeLockout = await prisma.accountLockout.findFirst({
    where: {
      userId: user.id,
      expiresAt: { gt: new Date() },
    },
    orderBy: { expiresAt: 'desc' },
  });

  if (activeLockout) {
    logger.warn({ userId: user.id }, 'Login attempt on locked account');
    throw new LockedError('Account is temporarily locked due to too many failed attempts', {
      lockedUntil: activeLockout.expiresAt,
    });
  }

  // Compare password
  const passwordValid = await bcrypt.compare(password, user.passwordHash);

  if (!passwordValid) {
    // Record failed attempt
    await prisma.loginAttempt.create({
      data: {
        userId: user.id,
        success: false,
        ipAddress: ipAddress ?? null,
      },
    });

    // Check if 5 failures in the last 15 minutes
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const recentFailures = await prisma.loginAttempt.count({
      where: {
        userId: user.id,
        success: false,
        attemptedAt: { gte: fifteenMinutesAgo },
      },
    });

    if (recentFailures >= 5) {
      const lockoutExpiry = new Date(Date.now() + 15 * 60 * 1000);
      await prisma.accountLockout.create({
        data: {
          userId: user.id,
          expiresAt: lockoutExpiry,
        },
      });

      logger.warn({ userId: user.id }, 'Account locked after 5 failed attempts');

      await createAuditLog({
        organizationId: user.organizationId,
        actorId: user.id,
        action: 'account_locked',
        resourceType: 'user',
        resourceId: user.id,
        details: { reason: 'Too many failed login attempts' },
        ipAddress,
        correlationId,
      });
    }

    await createAuditLog({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'login_failed',
      resourceType: 'user',
      resourceId: user.id,
      ipAddress,
      correlationId,
    });

    throw new UnauthorizedError('Invalid username or password');
  }

  // Successful login - record attempt
  await prisma.loginAttempt.create({
    data: {
      userId: user.id,
      success: true,
      ipAddress: ipAddress ?? null,
    },
  });

  // Generate JWT
  const jti = uuid();
  const token = jwt.sign(
    {
      userId: user.id,
      organizationId: user.organizationId,
      role: user.role as string,
      jti,
    },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN },
  );

  // Create audit log for successful login
  await createAuditLog({
    organizationId: user.organizationId,
    actorId: user.id,
    action: 'login',
    resourceType: 'user',
    resourceId: user.id,
    ipAddress,
    correlationId,
  });

  // Create event log for page_view on successful login
  await prisma.eventLog.create({
    data: {
      organizationId: user.organizationId,
      userId: user.id,
      eventType: 'page_view',
      metadata: { page: 'login' },
    },
  });

  logger.info({ userId: user.id, organizationId: user.organizationId }, 'User logged in');

  const { passwordHash, emailEncrypted, ...safeUser } = user;
  const email = decryptField(emailEncrypted);

  return {
    token,
    user: { ...safeUser, email },
  };
}

export async function logout(tokenJti: string, expiresAt: Date) {
  await prisma.tokenBlacklist.create({
    data: {
      tokenJti,
      expiresAt,
    },
  });

  logger.info({ jti: tokenJti }, 'Token blacklisted');
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  const { passwordHash, emailEncrypted, ...safeUser } = user;
  const email = decryptField(emailEncrypted);

  return { ...safeUser, email };
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  const currentValid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!currentValid) {
    throw new UnauthorizedError('Current password is incorrect');
  }

  const newHash = await bcrypt.hash(newPassword, env.BCRYPT_ROUNDS);

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: newHash },
  });

  await createAuditLog({
    organizationId: user.organizationId,
    actorId: userId,
    action: 'password_change',
    resourceType: 'user',
    resourceId: userId,
  });

  logger.info({ userId }, 'Password changed');
}
