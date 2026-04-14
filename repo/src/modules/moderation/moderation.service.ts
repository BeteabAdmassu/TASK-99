import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { NotFoundError, ValidationError } from '../../utils/errors';
import { parsePagination, buildPaginatedResponse } from '../../utils/pagination';
import { createAuditLog } from '../audit/audit.service';

interface BulkActionData {
  action: 'delete' | 'lock' | 'archive';
  resourceType: 'thread' | 'reply';
  resourceIds: string[];
}

interface RecycleBinFilters {
  resourceType?: 'thread' | 'reply';
}

interface PaginationInput {
  page?: string | number;
  limit?: string | number;
}

interface RecycleBinItem {
  id: string;
  type: 'thread' | 'reply';
  title?: string;
  body?: string;
  deletedAt: Date;
  deletedBy: string | null;
}

export async function bulkAction(
  orgId: string,
  actorId: string,
  data: BulkActionData,
) {
  const { action, resourceType, resourceIds } = data;
  let processed = 0;
  let failed = 0;
  const errors: Array<{ resourceId: string; message: string }> = [];

  for (const resourceId of resourceIds) {
    try {
      if (resourceType === 'thread') {
        const thread = await prisma.thread.findFirst({
          where: { id: resourceId, organizationId: orgId },
        });

        if (!thread) {
          failed++;
          errors.push({ resourceId, message: 'Thread not found' });
          continue;
        }

        if (action === 'delete') {
          if (thread.deletedAt !== null) {
            failed++;
            errors.push({ resourceId, message: 'Thread already deleted' });
            continue;
          }
          await prisma.thread.update({
            where: { id: resourceId },
            data: { deletedAt: new Date(), deletedBy: actorId },
          });
        } else if (action === 'lock') {
          await prisma.thread.update({
            where: { id: resourceId },
            data: { isLocked: true },
          });
        } else if (action === 'archive') {
          await prisma.thread.update({
            where: { id: resourceId },
            data: { isArchived: true },
          });
        } else {
          failed++;
          errors.push({ resourceId, message: `Action '${action}' is not supported` });
          continue;
        }

        processed++;
      } else if (resourceType === 'reply') {
        const reply = await prisma.reply.findFirst({
          where: { id: resourceId, organizationId: orgId },
        });

        if (!reply) {
          failed++;
          errors.push({ resourceId, message: 'Reply not found' });
          continue;
        }

        if (action === 'delete') {
          if (reply.deletedAt !== null) {
            failed++;
            errors.push({ resourceId, message: 'Reply already deleted' });
            continue;
          }
          await prisma.reply.update({
            where: { id: resourceId },
            data: { deletedAt: new Date(), deletedBy: actorId },
          });
        } else {
          // Replies don't have isLocked or isArchived fields
          failed++;
          errors.push({ resourceId, message: `Action '${action}' is not supported for replies` });
          continue;
        }

        processed++;
      }
    } catch (err) {
      failed++;
      errors.push({
        resourceId,
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  await createAuditLog({
    organizationId: orgId,
    actorId,
    action: 'bulk_moderation',
    resourceType,
    details: {
      bulkAction: action,
      resourceType,
      totalRequested: resourceIds.length,
      processed,
      failed,
      errors: errors.length > 0 ? errors : undefined,
    },
  });

  logger.info({ orgId, action: data.action, processed, failed }, 'Bulk action completed');

  return { processed, failed, errors };
}

export async function listRecycleBin(
  orgId: string,
  filters: RecycleBinFilters,
  pagination: PaginationInput,
) {
  const { skip, take, page, limit } = parsePagination(pagination);

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  let threads: RecycleBinItem[] = [];
  let replies: RecycleBinItem[] = [];
  let threadCount = 0;
  let replyCount = 0;

  if (!filters.resourceType || filters.resourceType === 'thread') {
    const threadWhere = {
      organizationId: orgId,
      deletedAt: { not: null as unknown as undefined, gte: thirtyDaysAgo },
    };

    const [threadData, count] = await Promise.all([
      prisma.thread.findMany({
        where: threadWhere,
        orderBy: { deletedAt: 'desc' as const },
        select: {
          id: true,
          title: true,
          body: true,
          deletedAt: true,
          deletedBy: true,
        },
      }),
      prisma.thread.count({ where: threadWhere }),
    ]);

    threads = threadData.map((t) => ({
      id: t.id,
      type: 'thread' as const,
      title: t.title,
      body: t.body,
      deletedAt: t.deletedAt!,
      deletedBy: t.deletedBy,
    }));
    threadCount = count;
  }

  if (!filters.resourceType || filters.resourceType === 'reply') {
    const replyWhere = {
      organizationId: orgId,
      deletedAt: { not: null as unknown as undefined, gte: thirtyDaysAgo },
    };

    const [replyData, count] = await Promise.all([
      prisma.reply.findMany({
        where: replyWhere,
        orderBy: { deletedAt: 'desc' as const },
        select: {
          id: true,
          body: true,
          deletedAt: true,
          deletedBy: true,
        },
      }),
      prisma.reply.count({ where: replyWhere }),
    ]);

    replies = replyData.map((r) => ({
      id: r.id,
      type: 'reply' as const,
      body: r.body,
      deletedAt: r.deletedAt!,
      deletedBy: r.deletedBy,
    }));
    replyCount = count;
  }

  // Merge and sort by deletedAt DESC
  const combined: RecycleBinItem[] = [...threads, ...replies].sort(
    (a, b) => b.deletedAt.getTime() - a.deletedAt.getTime(),
  );

  const total = threadCount + replyCount;

  // Paginate in JS
  const paginatedData = combined.slice(skip, skip + take);

  return buildPaginatedResponse(paginatedData, total, page, limit);
}

export async function restoreItem(
  orgId: string,
  itemType: string,
  itemId: string,
  actorId: string,
) {
  if (itemType !== 'thread' && itemType !== 'reply') {
    throw new ValidationError('Invalid item type. Must be "thread" or "reply".');
  }

  if (itemType === 'thread') {
    const thread = await prisma.thread.findFirst({
      where: { id: itemId, organizationId: orgId, deletedAt: { not: null } },
    });

    if (!thread) {
      throw new NotFoundError('Deleted thread not found');
    }

    await prisma.thread.update({
      where: { id: itemId },
      data: { deletedAt: null, deletedBy: null },
    });
  } else {
    const reply = await prisma.reply.findFirst({
      where: { id: itemId, organizationId: orgId, deletedAt: { not: null } },
    });

    if (!reply) {
      throw new NotFoundError('Deleted reply not found');
    }

    await prisma.reply.update({
      where: { id: itemId },
      data: { deletedAt: null, deletedBy: null },
    });
  }

  await createAuditLog({
    organizationId: orgId,
    actorId,
    action: 'content_restored',
    resourceType: itemType,
    resourceId: itemId,
  });

  return { success: true };
}

export async function permanentDelete(
  orgId: string,
  itemType: string,
  itemId: string,
  actorId: string,
) {
  if (itemType !== 'thread' && itemType !== 'reply') {
    throw new ValidationError('Invalid item type. Must be "thread" or "reply".');
  }

  if (itemType === 'thread') {
    const thread = await prisma.thread.findFirst({
      where: { id: itemId, organizationId: orgId },
    });

    if (!thread) {
      throw new NotFoundError('Thread not found');
    }

    await prisma.thread.delete({ where: { id: itemId } });
  } else {
    const reply = await prisma.reply.findFirst({
      where: { id: itemId, organizationId: orgId },
    });

    if (!reply) {
      throw new NotFoundError('Reply not found');
    }

    await prisma.reply.delete({ where: { id: itemId } });
  }

  await createAuditLog({
    organizationId: orgId,
    actorId,
    action: 'content_purged',
    resourceType: itemType,
    resourceId: itemId,
  });

  return { success: true };
}
