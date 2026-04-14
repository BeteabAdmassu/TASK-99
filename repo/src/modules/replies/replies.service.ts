import { prisma } from '../../config/database';
import { NotFoundError, ForbiddenError, BusinessRuleError } from '../../utils/errors';
import { parsePagination, buildPaginatedResponse } from '../../utils/pagination';
import { createAuditLog } from '../audit/audit.service';

interface CreateReplyData {
  body: string;
  parentReplyId?: string;
}

interface PaginationInput {
  page?: string | number;
  limit?: string | number;
}

export async function createReply(
  orgId: string,
  threadId: string,
  userId: string,
  data: CreateReplyData,
) {
  const thread = await prisma.thread.findFirst({
    where: { id: threadId, organizationId: orgId, deletedAt: null },
  });

  if (!thread) {
    throw new NotFoundError('Thread not found');
  }

  if (thread.isLocked) {
    throw new BusinessRuleError(403, 'THREAD_LOCKED', 'Cannot reply to a locked thread');
  }

  let depth = 1;

  if (data.parentReplyId) {
    const parentReply = await prisma.reply.findFirst({
      where: { id: data.parentReplyId, threadId, deletedAt: null },
    });

    if (!parentReply) {
      throw new NotFoundError('Parent reply not found');
    }

    if (parentReply.depth >= 3) {
      throw new BusinessRuleError(
        400,
        'MAX_NESTING_DEPTH',
        'Maximum reply nesting depth reached',
      );
    }

    depth = parentReply.depth + 1;
  }

  const reply = await prisma.reply.create({
    data: {
      organizationId: orgId,
      threadId,
      authorId: userId,
      parentReplyId: data.parentReplyId ?? null,
      depth,
      body: data.body,
    },
    include: {
      author: { select: { id: true, username: true } },
    },
  });

  await prisma.thread.update({
    where: { id: threadId },
    data: {
      replyCount: { increment: 1 },
      lastActivityAt: new Date(),
    },
  });

  await prisma.eventLog.create({
    data: {
      organizationId: orgId,
      userId,
      eventType: 'engagement',
      metadata: { threadId, replyId: reply.id },
    },
  });

  return reply;
}

export async function listReplies(
  orgId: string,
  threadId: string,
  pagination: PaginationInput,
) {
  const { skip, take, page, limit } = parsePagination(pagination);

  const where = {
    threadId,
    organizationId: orgId,
    deletedAt: null,
  };

  const [data, total] = await Promise.all([
    prisma.reply.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      skip,
      take,
      include: {
        author: { select: { id: true, username: true } },
      },
    }),
    prisma.reply.count({ where }),
  ]);

  return buildPaginatedResponse(data, total, page, limit);
}

export async function updateReply(
  orgId: string,
  replyId: string,
  userId: string,
  userRole: string,
  data: { body: string },
) {
  const reply = await prisma.reply.findFirst({
    where: { id: replyId, organizationId: orgId, deletedAt: null },
    include: { thread: true },
  });

  if (!reply) {
    throw new NotFoundError('Reply not found');
  }

  if (reply.thread.isArchived) {
    throw new BusinessRuleError(403, 'THREAD_ARCHIVED', 'Cannot update reply in an archived thread');
  }

  if (userRole === 'user' && reply.authorId !== userId) {
    throw new ForbiddenError('You do not have permission to update this reply');
  }

  const updated = await prisma.reply.update({
    where: { id: replyId },
    data: { body: data.body },
    include: {
      author: { select: { id: true, username: true } },
    },
  });

  return updated;
}

export async function deleteReply(
  orgId: string,
  replyId: string,
  userId: string,
  userRole: string,
) {
  const reply = await prisma.reply.findFirst({
    where: { id: replyId, organizationId: orgId, deletedAt: null },
  });

  if (!reply) {
    throw new NotFoundError('Reply not found');
  }

  if (userRole === 'user' && reply.authorId !== userId) {
    throw new ForbiddenError('You do not have permission to delete this reply');
  }

  await prisma.reply.update({
    where: { id: replyId },
    data: {
      deletedAt: new Date(),
      deletedBy: userId,
    },
  });

  await prisma.thread.update({
    where: { id: reply.threadId },
    data: {
      replyCount: { decrement: 1 },
    },
  });

  await createAuditLog({
    organizationId: orgId,
    actorId: userId,
    action: 'reply_deleted',
    resourceType: 'reply',
    resourceId: replyId,
  });
}
