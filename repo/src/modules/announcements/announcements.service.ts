import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { NotFoundError } from '../../utils/errors';
import { parsePagination, buildPaginatedResponse } from '../../utils/pagination';
import { createAuditLog } from '../audit/audit.service';
import { createForAnnouncement } from '../notifications/notifications.service';

interface CreateAnnouncementData {
  title: string;
  body: string;
  displayOrder?: number;
  startDate: string;
  endDate: string;
}

interface UpdateAnnouncementData {
  title?: string;
  body?: string;
  displayOrder?: number;
  startDate?: string;
  endDate?: string;
  isPublished?: boolean;
}

interface PaginationInput {
  page?: string | number;
  limit?: string | number;
}

export async function createAnnouncement(
  orgId: string,
  actorId: string,
  data: CreateAnnouncementData,
) {
  const announcement = await prisma.announcement.create({
    data: {
      organizationId: orgId,
      createdBy: actorId,
      title: data.title,
      body: data.body,
      displayOrder: data.displayOrder ?? 0,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
    },
  });

  logger.info({ orgId, announcementId: announcement.id }, 'Announcement created');

  await createAuditLog({
    organizationId: orgId,
    actorId,
    action: 'config_update',
    resourceType: 'announcement',
    resourceId: announcement.id,
    details: { operation: 'create', title: data.title },
  });

  return announcement;
}

export async function listAnnouncements(
  orgId: string,
  includeExpired?: boolean,
  pagination?: PaginationInput,
) {
  const { skip, take, page, limit } = parsePagination(pagination ?? {});

  const where: Record<string, unknown> = {
    organizationId: orgId,
  };

  if (!includeExpired) {
    const now = new Date();
    where.startDate = { lte: now };
    where.endDate = { gte: now };
  }

  const [data, total] = await Promise.all([
    prisma.announcement.findMany({
      where,
      orderBy: { displayOrder: 'asc' },
      skip,
      take,
    }),
    prisma.announcement.count({ where }),
  ]);

  return buildPaginatedResponse(data, total, page, limit);
}

export async function getAnnouncement(orgId: string, id: string) {
  const announcement = await prisma.announcement.findFirst({
    where: { id, organizationId: orgId },
  });

  if (!announcement) {
    throw new NotFoundError('Announcement not found');
  }

  return announcement;
}

export async function updateAnnouncement(
  orgId: string,
  id: string,
  data: UpdateAnnouncementData,
  actorId: string,
) {
  const existing = await prisma.announcement.findFirst({
    where: { id, organizationId: orgId },
  });

  if (!existing) {
    throw new NotFoundError('Announcement not found');
  }

  const updateData: Record<string, unknown> = {};
  if (data.title !== undefined) updateData.title = data.title;
  if (data.body !== undefined) updateData.body = data.body;
  if (data.displayOrder !== undefined) updateData.displayOrder = data.displayOrder;
  if (data.startDate !== undefined) updateData.startDate = new Date(data.startDate);
  if (data.endDate !== undefined) updateData.endDate = new Date(data.endDate);
  if (data.isPublished !== undefined) updateData.isPublished = data.isPublished;

  const updated = await prisma.announcement.update({
    where: { id },
    data: updateData,
  });

  await createAuditLog({
    organizationId: orgId,
    actorId,
    action: 'config_update',
    resourceType: 'announcement',
    resourceId: id,
    details: { operation: 'update', updatedFields: Object.keys(updateData) },
  });

  // Trigger notification when announcement is published
  if (data.isPublished === true && !existing.isPublished) {
    createForAnnouncement(orgId, id, updated.title).catch(() => {});
  }

  return updated;
}

export async function deleteAnnouncement(orgId: string, id: string, actorId: string) {
  const existing = await prisma.announcement.findFirst({
    where: { id, organizationId: orgId },
  });

  if (!existing) {
    throw new NotFoundError('Announcement not found');
  }

  await prisma.announcement.delete({ where: { id } });

  await createAuditLog({
    organizationId: orgId,
    actorId,
    action: 'config_delete',
    resourceType: 'announcement',
    resourceId: id,
    details: { title: existing.title },
  });

  return { success: true };
}
