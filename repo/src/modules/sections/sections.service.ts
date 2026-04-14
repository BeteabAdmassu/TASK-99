import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { NotFoundError } from '../../utils/errors';

export async function createSection(
  orgId: string,
  data: { name: string; description?: string; displayOrder?: number },
) {
  const section = await prisma.forumSection.create({
    data: {
      organizationId: orgId,
      name: data.name,
      description: data.description,
      displayOrder: data.displayOrder ?? 0,
    },
  });

  logger.info({ orgId, sectionId: section.id }, 'Section created');

  return section;
}

export async function listSections(orgId: string, includeSubsections?: boolean) {
  const sections = await prisma.forumSection.findMany({
    where: { organizationId: orgId },
    orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    ...(includeSubsections
      ? { include: { subsections: { orderBy: { displayOrder: 'asc' } } } }
      : {}),
  });

  return sections;
}

export async function getSection(orgId: string, sectionId: string) {
  const section = await prisma.forumSection.findFirst({
    where: { id: sectionId, organizationId: orgId },
    include: { subsections: { orderBy: { displayOrder: 'asc' } } },
  });

  if (!section) {
    throw new NotFoundError('Section not found');
  }

  return section;
}

export async function updateSection(
  orgId: string,
  sectionId: string,
  data: { name?: string; description?: string; displayOrder?: number },
) {
  const existing = await prisma.forumSection.findFirst({
    where: { id: sectionId, organizationId: orgId },
  });

  if (!existing) {
    throw new NotFoundError('Section not found');
  }

  const updated = await prisma.forumSection.update({
    where: { id: sectionId },
    data,
  });

  return updated;
}

export async function deleteSection(orgId: string, sectionId: string) {
  const existing = await prisma.forumSection.findFirst({
    where: { id: sectionId, organizationId: orgId },
  });

  if (!existing) {
    throw new NotFoundError('Section not found');
  }

  await prisma.forumSection.delete({
    where: { id: sectionId },
  });
}

export async function createSubsection(
  orgId: string,
  sectionId: string,
  data: { name: string; description?: string; displayOrder?: number },
) {
  const section = await prisma.forumSection.findFirst({
    where: { id: sectionId, organizationId: orgId },
  });

  if (!section) {
    throw new NotFoundError('Section not found');
  }

  const subsection = await prisma.forumSubsection.create({
    data: {
      sectionId,
      organizationId: orgId,
      name: data.name,
      description: data.description,
      displayOrder: data.displayOrder ?? 0,
    },
  });

  return subsection;
}

export async function listSubsections(orgId: string, sectionId: string) {
  const subsections = await prisma.forumSubsection.findMany({
    where: { sectionId, organizationId: orgId },
    orderBy: { displayOrder: 'asc' },
  });

  return subsections;
}

export async function updateSubsection(
  orgId: string,
  subId: string,
  data: { name?: string; description?: string; displayOrder?: number },
) {
  const existing = await prisma.forumSubsection.findFirst({
    where: { id: subId, organizationId: orgId },
  });

  if (!existing) {
    throw new NotFoundError('Subsection not found');
  }

  const updated = await prisma.forumSubsection.update({
    where: { id: subId },
    data,
  });

  return updated;
}

export async function deleteSubsection(orgId: string, subId: string) {
  const existing = await prisma.forumSubsection.findFirst({
    where: { id: subId, organizationId: orgId },
  });

  if (!existing) {
    throw new NotFoundError('Subsection not found');
  }

  await prisma.forumSubsection.delete({
    where: { id: subId },
  });
}
