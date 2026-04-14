import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { NotFoundError, ForbiddenError, BusinessRuleError } from '../../utils/errors';
import { parsePagination, buildPaginatedResponse } from '../../utils/pagination';
import { createAuditLog } from '../audit/audit.service';

interface CreateThreadData {
  subsectionId: string;
  title: string;
  body: string;
  tagIds?: string[];
}

interface UpdateThreadData {
  title?: string;
  body?: string;
  tagIds?: string[];
}

interface ThreadFilters {
  subsectionId?: string;
  tagId?: string;
  search?: string;
  sort?: 'latest' | 'oldest' | 'mostReplies' | 'mostViews';
}

interface PaginationInput {
  page?: string | number;
  limit?: string | number;
}

interface UpdateThreadStateData {
  isPinned?: boolean;
  isFeatured?: boolean;
  isLocked?: boolean;
  isArchived?: boolean;
}

export async function createThread(
  orgId: string,
  userId: string,
  data: CreateThreadData,
) {
  const subsection = await prisma.forumSubsection.findFirst({
    where: { id: data.subsectionId, organizationId: orgId },
  });

  if (!subsection) {
    throw new NotFoundError('Subsection not found');
  }

  // Validate all tag IDs before any mutation so an invalid tag never leaves an orphaned thread.
  if (data.tagIds && data.tagIds.length > 0) {
    const validTags = await prisma.tag.findMany({
      where: { id: { in: data.tagIds }, organizationId: orgId },
      select: { id: true },
    });
    if (validTags.length !== data.tagIds.length) {
      throw new BusinessRuleError(400, 'INVALID_TAG', 'One or more tag IDs do not belong to this organization');
    }
  }

  // Create thread and its tag associations atomically.
  const thread = await prisma.$transaction(async (tx) => {
    const newThread = await tx.thread.create({
      data: {
        organizationId: orgId,
        subsectionId: data.subsectionId,
        authorId: userId,
        title: data.title,
        body: data.body,
      },
      include: {
        author: { select: { id: true, username: true } },
        threadTags: { include: { tag: true } },
      },
    });

    if (data.tagIds && data.tagIds.length > 0) {
      await tx.threadTag.createMany({
        data: data.tagIds.map((tagId) => ({ threadId: newThread.id, tagId })),
        skipDuplicates: true,
      });
    }

    return newThread;
  });

  logger.info({ orgId, threadId: thread.id }, 'Thread created');

  await prisma.eventLog.create({
    data: {
      organizationId: orgId,
      userId,
      eventType: 'post_created',
      metadata: { threadId: thread.id, subsectionId: data.subsectionId },
    },
  });

  if (data.tagIds && data.tagIds.length > 0) {
    const threadWithTags = await prisma.thread.findUnique({
      where: { id: thread.id },
      include: {
        author: { select: { id: true, username: true } },
        threadTags: { include: { tag: true } },
      },
    });
    return threadWithTags;
  }

  return thread;
}

export async function listThreads(
  orgId: string,
  filters: ThreadFilters,
  pagination: PaginationInput,
) {
  const { skip, take, page, limit } = parsePagination(pagination);

  const where: Record<string, unknown> = {
    organizationId: orgId,
    deletedAt: null,
  };

  if (filters.subsectionId) {
    where.subsectionId = filters.subsectionId;
  }

  if (filters.tagId) {
    where.threadTags = {
      some: { tagId: filters.tagId },
    };
  }

  if (filters.search) {
    where.title = { contains: filters.search };
  }

  let sortField: string;
  let sortDirection: 'asc' | 'desc';

  switch (filters.sort) {
    case 'oldest':
      sortField = 'createdAt';
      sortDirection = 'asc';
      break;
    case 'mostReplies':
      sortField = 'replyCount';
      sortDirection = 'desc';
      break;
    case 'mostViews':
      sortField = 'viewCount';
      sortDirection = 'desc';
      break;
    case 'latest':
    default:
      sortField = 'lastActivityAt';
      sortDirection = 'desc';
      break;
  }

  const orderBy = [
    { isPinned: 'desc' as const },
    { [sortField]: sortDirection },
  ];

  const [data, total] = await Promise.all([
    prisma.thread.findMany({
      where,
      orderBy,
      skip,
      take,
      include: {
        author: { select: { id: true, username: true } },
        threadTags: { include: { tag: true } },
      },
    }),
    prisma.thread.count({ where }),
  ]);

  return buildPaginatedResponse(data, total, page, limit);
}

export async function getThread(orgId: string, threadId: string) {
  const thread = await prisma.thread.findFirst({
    where: { id: threadId, organizationId: orgId, deletedAt: null },
    include: {
      author: { select: { id: true, username: true } },
      threadTags: { include: { tag: true } },
    },
  });

  if (!thread) {
    throw new NotFoundError('Thread not found');
  }

  // Fire-and-forget view count increment
  prisma.thread
    .update({
      where: { id: threadId },
      data: { viewCount: { increment: 1 } },
    })
    .catch(() => {});

  // Fire-and-forget event log
  prisma.eventLog
    .create({
      data: {
        organizationId: orgId,
        eventType: 'page_view',
        metadata: { threadId },
      },
    })
    .catch(() => {});

  return thread;
}

export async function updateThread(
  orgId: string,
  threadId: string,
  userId: string,
  userRole: string,
  data: UpdateThreadData,
) {
  const thread = await prisma.thread.findFirst({
    where: { id: threadId, organizationId: orgId },
  });

  if (!thread) {
    throw new NotFoundError('Thread not found');
  }

  if (thread.deletedAt) {
    throw new NotFoundError('Thread not found');
  }

  if (thread.isArchived) {
    throw new BusinessRuleError(403, 'THREAD_ARCHIVED', 'Cannot update an archived thread');
  }

  if (userRole === 'user' && thread.authorId !== userId) {
    throw new ForbiddenError('You do not have permission to update this thread');
  }

  // When tagIds is present the entire update must be all-or-nothing:
  // validate tag ownership first, then apply field changes + tag replacement
  // in one transaction so an invalid tag never leaves title/body partially written.
  if (data.tagIds !== undefined) {
    if (data.tagIds.length > 0) {
      const validTags = await prisma.tag.findMany({
        where: { id: { in: data.tagIds }, organizationId: orgId },
        select: { id: true },
      });
      if (validTags.length !== data.tagIds.length) {
        throw new BusinessRuleError(400, 'INVALID_TAG', 'One or more tag IDs do not belong to this organization');
      }
    }

    const fieldData: Record<string, unknown> = {};
    if (data.title !== undefined) fieldData.title = data.title;
    if (data.body !== undefined) fieldData.body = data.body;

    await prisma.$transaction(async (tx) => {
      if (Object.keys(fieldData).length > 0) {
        await tx.thread.update({ where: { id: threadId }, data: fieldData });
      }
      await tx.threadTag.deleteMany({ where: { threadId } });
      if (data.tagIds!.length > 0) {
        await tx.threadTag.createMany({
          data: data.tagIds!.map((tagId) => ({ threadId, tagId })),
          skipDuplicates: true,
        });
      }
    });

    const refreshed = await prisma.thread.findUnique({
      where: { id: threadId },
      include: {
        author: { select: { id: true, username: true } },
        threadTags: { include: { tag: true } },
      },
    });
    return refreshed;
  }

  // No tagIds — simple field-only update path, unchanged.
  const updateData: Record<string, unknown> = {};
  if (data.title !== undefined) updateData.title = data.title;
  if (data.body !== undefined) updateData.body = data.body;

  const updated = await prisma.thread.update({
    where: { id: threadId },
    data: updateData,
    include: {
      author: { select: { id: true, username: true } },
      threadTags: { include: { tag: true } },
    },
  });

  return updated;
}

export async function deleteThread(
  orgId: string,
  threadId: string,
  userId: string,
  userRole: string,
) {
  const thread = await prisma.thread.findFirst({
    where: { id: threadId, organizationId: orgId },
  });

  if (!thread) {
    throw new NotFoundError('Thread not found');
  }

  if (thread.deletedAt) {
    throw new NotFoundError('Thread not found');
  }

  if (userRole === 'user' && thread.authorId !== userId) {
    throw new ForbiddenError('You do not have permission to delete this thread');
  }

  await prisma.thread.update({
    where: { id: threadId },
    data: {
      deletedAt: new Date(),
      deletedBy: userId,
    },
  });

  await createAuditLog({
    organizationId: orgId,
    actorId: userId,
    action: 'thread_deleted',
    resourceType: 'thread',
    resourceId: threadId,
  });
}

export async function updateThreadState(
  orgId: string,
  threadId: string,
  data: UpdateThreadStateData,
  actorId: string,
) {
  const thread = await prisma.thread.findFirst({
    where: { id: threadId, organizationId: orgId, deletedAt: null },
  });

  if (!thread) {
    throw new NotFoundError('Thread not found');
  }

  if (data.isPinned === true) {
    const subsection = await prisma.forumSubsection.findUnique({
      where: { id: thread.subsectionId },
      select: { sectionId: true },
    });

    if (subsection) {
      const pinnedCount = await prisma.thread.count({
        where: {
          organizationId: orgId,
          isPinned: true,
          deletedAt: null,
          id: { not: threadId },
          subsection: {
            sectionId: subsection.sectionId,
          },
        },
      });

      if (pinnedCount >= 3) {
        throw new BusinessRuleError(
          400,
          'PINNED_LIMIT_REACHED',
          'Maximum 3 pinned threads per section',
        );
      }
    }
  }

  const updateData: Record<string, unknown> = {};
  if (data.isPinned !== undefined) updateData.isPinned = data.isPinned;
  if (data.isFeatured !== undefined) updateData.isFeatured = data.isFeatured;
  if (data.isLocked !== undefined) updateData.isLocked = data.isLocked;
  if (data.isArchived !== undefined) updateData.isArchived = data.isArchived;

  const updated = await prisma.thread.update({
    where: { id: threadId },
    data: updateData,
  });

  await createAuditLog({
    organizationId: orgId,
    actorId,
    action: 'thread_state_updated',
    resourceType: 'thread',
    resourceId: threadId,
    details: data as Record<string, unknown>,
  });

  return updated;
}
