import { prisma } from '../../config/database';
import { NotFoundError } from '../../utils/errors';
import { createAuditLog } from '../audit/audit.service';

interface CreateCarouselItemData {
  title: string;
  imageUrl?: string;
  linkUrl?: string;
  displayOrder?: number;
  startDate: string;
  endDate: string;
}

interface UpdateCarouselItemData {
  title?: string;
  imageUrl?: string;
  linkUrl?: string;
  displayOrder?: number;
  startDate?: string;
  endDate?: string;
  isActive?: boolean;
}

export async function createCarouselItem(
  orgId: string,
  actorId: string,
  data: CreateCarouselItemData,
) {
  const item = await prisma.carouselItem.create({
    data: {
      organizationId: orgId,
      createdBy: actorId,
      title: data.title,
      imageUrl: data.imageUrl ?? null,
      linkUrl: data.linkUrl ?? null,
      displayOrder: data.displayOrder ?? 0,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
    },
  });

  await createAuditLog({
    organizationId: orgId,
    actorId,
    action: 'config_update',
    resourceType: 'carousel_item',
    resourceId: item.id,
    details: { operation: 'create', title: data.title },
  });

  return item;
}

export async function listCarouselItems(
  orgId: string,
  includeExpired?: boolean,
) {
  const where: Record<string, unknown> = {
    organizationId: orgId,
  };

  if (!includeExpired) {
    const now = new Date();
    where.startDate = { lte: now };
    where.endDate = { gte: now };
    where.isActive = true;
  }

  const items = await prisma.carouselItem.findMany({
    where,
    orderBy: { displayOrder: 'asc' },
  });

  return items;
}

export async function updateCarouselItem(
  orgId: string,
  id: string,
  data: UpdateCarouselItemData,
  actorId: string,
) {
  const existing = await prisma.carouselItem.findFirst({
    where: { id, organizationId: orgId },
  });

  if (!existing) {
    throw new NotFoundError('Carousel item not found');
  }

  const updateData: Record<string, unknown> = {};
  if (data.title !== undefined) updateData.title = data.title;
  if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl;
  if (data.linkUrl !== undefined) updateData.linkUrl = data.linkUrl;
  if (data.displayOrder !== undefined) updateData.displayOrder = data.displayOrder;
  if (data.startDate !== undefined) updateData.startDate = new Date(data.startDate);
  if (data.endDate !== undefined) updateData.endDate = new Date(data.endDate);
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  const updated = await prisma.carouselItem.update({
    where: { id },
    data: updateData,
  });

  await createAuditLog({
    organizationId: orgId,
    actorId,
    action: 'config_update',
    resourceType: 'carousel_item',
    resourceId: id,
    details: { operation: 'update', updatedFields: Object.keys(updateData) },
  });

  return updated;
}

export async function deleteCarouselItem(orgId: string, id: string) {
  const existing = await prisma.carouselItem.findFirst({
    where: { id, organizationId: orgId },
  });

  if (!existing) {
    throw new NotFoundError('Carousel item not found');
  }

  await prisma.carouselItem.delete({ where: { id } });

  return { success: true };
}
