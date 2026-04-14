import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { NotFoundError, ConflictError } from '../../utils/errors';
import { createAuditLog } from '../audit/audit.service';

interface CreateFlagData {
  key: string;
  value: unknown;
  description?: string;
}

interface UpdateFlagData {
  value?: unknown;
  description?: string;
}

export async function createFlag(
  orgId: string,
  actorId: string,
  data: CreateFlagData,
) {
  try {
    const flag = await prisma.featureFlag.create({
      data: {
        organizationId: orgId,
        flagKey: data.key,
        value: data.value as Prisma.InputJsonValue,
        description: data.description ?? null,
        updatedBy: actorId,
      },
    });

    await createAuditLog({
      organizationId: orgId,
      actorId,
      action: 'feature_flag_change',
      resourceType: 'feature_flag',
      resourceId: flag.id,
      details: { action: 'created', key: data.key, value: data.value },
    });

    logger.info({ flagId: flag.id, flagKey: data.key, orgId }, 'Feature flag created');

    return flag;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictError('Feature flag with this key already exists');
    }
    throw error;
  }
}

export async function listFlags(orgId: string) {
  const flags = await prisma.featureFlag.findMany({
    where: { organizationId: orgId },
    orderBy: { flagKey: 'asc' },
  });

  return flags;
}

export async function updateFlag(
  orgId: string,
  flagId: string,
  actorId: string,
  data: UpdateFlagData,
) {
  const existing = await prisma.featureFlag.findFirst({
    where: { id: flagId, organizationId: orgId },
  });

  if (!existing) {
    throw new NotFoundError('Feature flag not found');
  }

  const updateData: Record<string, unknown> = {
    updatedBy: actorId,
  };

  if (data.value !== undefined) {
    updateData.value = data.value as Prisma.InputJsonValue;
  }

  if (data.description !== undefined) {
    updateData.description = data.description;
  }

  const updated = await prisma.featureFlag.update({
    where: { id: flagId },
    data: updateData,
  });

  await createAuditLog({
    organizationId: orgId,
    actorId,
    action: 'feature_flag_change',
    resourceType: 'feature_flag',
    resourceId: flagId,
    details: {
      action: 'updated',
      key: existing.flagKey,
      before: { value: existing.value, description: existing.description },
      after: { value: data.value ?? existing.value, description: data.description ?? existing.description },
    },
  });

  logger.info({ flagId, flagKey: existing.flagKey, orgId, actorId }, 'Feature flag updated');

  return updated;
}

export async function deleteFlag(
  orgId: string,
  flagId: string,
  actorId: string,
) {
  const existing = await prisma.featureFlag.findFirst({
    where: { id: flagId, organizationId: orgId },
  });

  if (!existing) {
    throw new NotFoundError('Feature flag not found');
  }

  await prisma.featureFlag.delete({
    where: { id: flagId },
  });

  await createAuditLog({
    organizationId: orgId,
    actorId,
    action: 'feature_flag_change',
    resourceType: 'feature_flag',
    resourceId: flagId,
    details: { action: 'deleted', key: existing.flagKey, value: existing.value },
  });

  logger.info({ flagId, flagKey: existing.flagKey, orgId, actorId }, 'Feature flag deleted');
}

export async function getFlag(orgId: string, key: string) {
  const flag = await prisma.featureFlag.findFirst({
    where: {
      organizationId: orgId,
      flagKey: key,
    },
  });

  return flag || null;
}
