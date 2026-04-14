import { prisma } from '../../config/database';
import { NotFoundError, ConflictError } from '../../utils/errors';
import { Prisma } from '@prisma/client';

export async function createTag(
  orgId: string,
  data: { name: string; slug: string; category?: string },
) {
  try {
    const tag = await prisma.tag.create({
      data: {
        organizationId: orgId,
        name: data.name,
        slug: data.slug,
        category: data.category,
      },
    });

    return tag;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictError('Tag slug already exists in this organization');
    }
    throw error;
  }
}

export async function listTags(orgId: string, category?: string) {
  const where: Record<string, unknown> = {
    organizationId: orgId,
  };

  if (category) {
    where.category = category;
  }

  const tags = await prisma.tag.findMany({
    where,
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  });

  return tags;
}

export async function updateTag(
  orgId: string,
  tagId: string,
  data: { name?: string; slug?: string; category?: string },
) {
  const existing = await prisma.tag.findFirst({
    where: { id: tagId, organizationId: orgId },
  });

  if (!existing) {
    throw new NotFoundError('Tag not found');
  }

  try {
    const updated = await prisma.tag.update({
      where: { id: tagId },
      data,
    });

    return updated;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictError('Tag slug already exists in this organization');
    }
    throw error;
  }
}

export async function deleteTag(orgId: string, tagId: string) {
  const existing = await prisma.tag.findFirst({
    where: { id: tagId, organizationId: orgId },
  });

  if (!existing) {
    throw new NotFoundError('Tag not found');
  }

  await prisma.tag.delete({
    where: { id: tagId },
  });
}
