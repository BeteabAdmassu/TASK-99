import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { encryptField, decryptField } from '../../config/encryption';
import { NotFoundError, ConflictError } from '../../utils/errors';
import { parsePagination, buildPaginatedResponse } from '../../utils/pagination';
import { createAuditLog } from '../audit/audit.service';

interface CreateUserData {
  username: string;
  password: string;
  role?: 'admin' | 'moderator' | 'analyst' | 'user';
  email?: string;
}

interface ListUsersFilters {
  role?: string;
  search?: string;
}

interface PaginationInput {
  page?: string | number;
  limit?: string | number;
}

function formatUserResponse(user: Record<string, unknown>) {
  const { passwordHash, emailEncrypted, ...rest } = user;
  const email = decryptField(emailEncrypted as Buffer | null | undefined);
  return { ...rest, email };
}

export async function createUser(
  orgId: string,
  data: CreateUserData,
  actorId: string,
) {
  const passwordHash = await bcrypt.hash(data.password, env.BCRYPT_ROUNDS);
  const emailEncrypted = encryptField(data.email ?? null);

  try {
    const user = await prisma.user.create({
      data: {
        organizationId: orgId,
        username: data.username,
        passwordHash,
        emailEncrypted: emailEncrypted ?? undefined,
        role: data.role ?? 'user',
      },
    });

    await createAuditLog({
      organizationId: orgId,
      actorId,
      action: 'user_created',
      resourceType: 'user',
      resourceId: user.id,
      details: { username: data.username, role: data.role ?? 'user' },
    });

    await prisma.eventLog.create({
      data: {
        organizationId: orgId,
        userId: user.id,
        eventType: 'registration',
        metadata: { username: data.username },
      },
    });

    logger.info({ userId: user.id, organizationId: orgId }, 'User created');

    return formatUserResponse(user as unknown as Record<string, unknown>);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictError('Username already taken');
    }
    throw error;
  }
}

export async function listUsers(
  orgId: string,
  filters: ListUsersFilters,
  pagination: PaginationInput,
) {
  const { skip, take, page, limit } = parsePagination(pagination);

  const where: Record<string, unknown> = {
    organizationId: orgId,
  };

  if (filters.role) {
    where.role = filters.role;
  }

  if (filters.search) {
    where.username = { contains: filters.search };
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.user.count({ where }),
  ]);

  const data = users.map((u) => formatUserResponse(u as unknown as Record<string, unknown>));

  return buildPaginatedResponse(data, total, page, limit);
}

export async function getUser(orgId: string, userId: string) {
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      organizationId: orgId,
    },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  return formatUserResponse(user as unknown as Record<string, unknown>);
}

export async function updateRole(
  orgId: string,
  userId: string,
  role: 'admin' | 'moderator' | 'analyst' | 'user',
  actorId: string,
) {
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      organizationId: orgId,
    },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  const previousRole = user.role;

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { role },
  });

  await createAuditLog({
    organizationId: orgId,
    actorId,
    action: 'role_updated',
    resourceType: 'user',
    resourceId: userId,
    details: { previousRole, newRole: role },
  });

  logger.info({ userId, previousRole, newRole: role, actorId }, 'User role updated');

  return formatUserResponse(updated as unknown as Record<string, unknown>);
}

export async function banUser(
  orgId: string,
  userId: string,
  actorId: string,
  reason?: string,
) {
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      organizationId: orgId,
    },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      isBanned: true,
      bannedAt: new Date(),
      bannedBy: actorId,
      banReason: reason ?? null,
    },
  });

  await createAuditLog({
    organizationId: orgId,
    actorId,
    action: 'user_banned',
    resourceType: 'user',
    resourceId: userId,
    details: { reason: reason ?? null },
  });

  logger.info({ userId, actorId, reason }, 'User banned');

  return formatUserResponse(updated as unknown as Record<string, unknown>);
}

export async function unbanUser(
  orgId: string,
  userId: string,
  actorId: string,
) {
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      organizationId: orgId,
    },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      isBanned: false,
      bannedAt: null,
      bannedBy: null,
      banReason: null,
    },
  });

  await createAuditLog({
    organizationId: orgId,
    actorId,
    action: 'user_unbanned',
    resourceType: 'user',
    resourceId: userId,
  });

  logger.info({ userId, actorId }, 'User unbanned');

  return formatUserResponse(updated as unknown as Record<string, unknown>);
}

export async function muteUser(
  orgId: string,
  userId: string,
  actorId: string,
  durationHours: number,
  reason?: string,
) {
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      organizationId: orgId,
    },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  const mutedUntil = new Date(Date.now() + durationHours * 60 * 60 * 1000);

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      isMuted: true,
      mutedUntil,
      mutedBy: actorId,
      muteReason: reason ?? null,
    },
  });

  await createAuditLog({
    organizationId: orgId,
    actorId,
    action: 'user_muted',
    resourceType: 'user',
    resourceId: userId,
    details: { durationHours, mutedUntil: mutedUntil.toISOString(), reason: reason ?? null },
  });

  logger.info({ userId, actorId, durationHours, mutedUntil }, 'User muted');

  return formatUserResponse(updated as unknown as Record<string, unknown>);
}

export async function unmuteUser(
  orgId: string,
  userId: string,
  actorId: string,
) {
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      organizationId: orgId,
    },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      isMuted: false,
      mutedUntil: null,
      mutedBy: null,
      muteReason: null,
    },
  });

  await createAuditLog({
    organizationId: orgId,
    actorId,
    action: 'user_unmuted',
    resourceType: 'user',
    resourceId: userId,
  });

  logger.info({ userId, actorId }, 'User unmuted');

  return formatUserResponse(updated as unknown as Record<string, unknown>);
}
