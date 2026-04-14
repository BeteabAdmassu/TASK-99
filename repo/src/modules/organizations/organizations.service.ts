import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { NotFoundError, ConflictError } from '../../utils/errors';
import { createAuditLog } from '../audit/audit.service';

interface CreateOrganizationData {
  name: string;
  slug: string;
  settings?: Record<string, unknown>;
}

interface UpdateOrganizationData {
  name?: string;
  settings?: Record<string, unknown>;
}

export async function createOrganization(data: CreateOrganizationData) {
  try {
    const organization = await prisma.organization.create({
      data: {
        name: data.name,
        slug: data.slug,
        settings: data.settings ?? null,
      },
    });

    logger.info({ organizationId: organization.id, slug: organization.slug }, 'Organization created');

    return organization;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictError('Organization with this slug already exists');
    }
    throw error;
  }
}

export async function getOrganization(id: string) {
  const organization = await prisma.organization.findUnique({
    where: { id },
  });

  if (!organization) {
    throw new NotFoundError('Organization not found');
  }

  return organization;
}

export async function updateOrganization(
  id: string,
  data: UpdateOrganizationData,
  actorId: string,
) {
  const existing = await prisma.organization.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError('Organization not found');
  }

  const organization = await prisma.organization.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.settings !== undefined && { settings: data.settings }),
    },
  });

  await createAuditLog({
    organizationId: id,
    actorId,
    action: 'organization_updated',
    resourceType: 'organization',
    resourceId: id,
    details: {
      changes: data,
    },
  });

  logger.info({ organizationId: id, actorId }, 'Organization updated');

  return organization;
}
